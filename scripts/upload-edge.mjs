import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

// Publish API v1.1 changes authentication, while the endpoint path remains /v1.
const API = 'https://api.addons.microsoftedge.microsoft.com/v1';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boolean(value, name, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false.`);
  return value === 'true';
}

export function edgeConfig(env = process.env) {
  for (const name of ['EDGE_PRODUCT_ID', 'EDGE_CLIENT_ID', 'EDGE_API_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Missing required configuration: ${name}.`);
    if (!/^[\x21-\x7e]+$/.test(env[name])) throw new Error(`Invalid configuration: ${name}.`);
  }
  if (!GUID.test(env.EDGE_PRODUCT_ID)) {
    throw new Error('EDGE_PRODUCT_ID must be the Partner Center product GUID, not the store or CRX ID.');
  }
  if (env.TAG_NAME && !/^v\d+\.\d+\.\d+(?:\.\d+)?$/.test(env.TAG_NAME)) {
    throw new Error('TAG_NAME must be a version tag such as v0.2.7.');
  }
  if (env.EDGE_RESUME_UPLOAD_ID && !GUID.test(env.EDGE_RESUME_UPLOAD_ID)) {
    throw new Error('EDGE_RESUME_UPLOAD_ID must be an existing upload operation GUID.');
  }
  return {
    productId: env.EDGE_PRODUCT_ID,
    clientId: env.EDGE_CLIENT_ID,
    apiKey: env.EDGE_API_KEY,
    submit: boolean(env.SUBMIT, 'SUBMIT', true),
    checkOnly: boolean(env.CHECK_ONLY, 'CHECK_ONLY', false),
    resumeUploadId: env.EDGE_RESUME_UPLOAD_ID || undefined,
  };
}

export async function readEdgePackage(path) {
  if (!path) throw new Error('An Edge ZIP package path is required.');
  const info = await stat(path);
  if (!info.isFile() || info.size < 4 || info.size > 2 * 1024 ** 3) {
    throw new Error('The Edge package must be a nonempty ZIP file smaller than 2 GiB.');
  }
  const bytes = await readFile(path);
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('The Edge package is not a ZIP file.');
  return bytes;
}

// Do not follow a server-provided URL with API credentials. Only use an operation
// GUID, and build the subsequent URL ourselves under the documented API root.
export function edgeOperationId(location, operationUrl) {
  if (GUID.test(location ?? '')) return location;
  try {
    const url = new URL(location, `${operationUrl}/`);
    const prefix = `${operationUrl}/operations/`;
    if (url.href.startsWith(prefix) && GUID.test(url.href.slice(prefix.length))) {
      return url.href.slice(prefix.length);
    }
  } catch { /* Report a safe fixed message instead of logging server content. */ }
  throw new Error('Edge API returned a missing or invalid operation Location.');
}

export async function uploadEdge(config, bytes, {
  fetchImpl = fetch,
  wait = sleep,
  log = console.log,
  pollLimit = 60,
  pollIntervalMs = 10_000,
} = {}) {
  // Edge has no documented read-only credentials/product endpoint. A local
  // check must not claim server authentication or create a draft to test it.
  if (config.checkOnly) {
    log('Edge: configuration and package checks passed; server authentication has not been verified.');
    return { checked: true, authenticated: false };
  }
  const headers = { Authorization: `ApiKey ${config.apiKey}`, 'X-ClientID': config.clientId };
  const productUrl = `${API}/products/${config.productId}/submissions`;

  async function request(url, options, expectedStatuses, label) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options, headers: { ...headers, ...options.headers },
        redirect: 'error', signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error(`Edge ${label} request failed. Check Partner Center before rerunning; requests are not retried.`);
    }
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`Edge ${label} returned HTTP ${response.status}. Check Partner Center before rerunning.`);
    }
    return response;
  }

  async function runOperation(url, options, label) {
    const response = await request(url, options, [202], label);
    const id = edgeOperationId(response.headers.get('location'), url);
    log(`Edge ${label} accepted; operation ${id}.`);
    return pollOperation(url, id, label);
  }

  async function pollOperation(url, id, label) {
    for (let attempt = 0; attempt < pollLimit; attempt++) {
      await wait(pollIntervalMs);
      // The official PowerShell example and live API also return 202 for status
      // GETs. In either case, the JSON status determines the operation outcome.
      const statusResponse = await request(`${url}/operations/${id}`, { method: 'GET' }, [200, 202], `${label} status`);
      let result;
      try { result = await statusResponse.json(); }
      catch { throw new Error(`Edge ${label} status returned invalid JSON.`); }
      if (result.status === 'Succeeded') {
        log(`Edge ${label} succeeded.`);
        return id;
      }
      if (result.status === 'Failed') {
        throw new Error(`Edge ${label} failed. Review operation ${id} in Partner Center.`);
      }
      if (result.status !== 'InProgress') throw new Error(`Edge ${label} returned an unrecognized operation status.`);
    }
    throw new Error(`Edge ${label} polling timed out for operation ${id}. Check Partner Center before rerunning.`);
  }

  let uploadId;
  if (config.resumeUploadId) {
    log(`Edge: resuming upload operation ${config.resumeUploadId}; the package will not be uploaded again.`);
    uploadId = await pollOperation(`${productUrl}/draft/package`, config.resumeUploadId, 'upload');
  } else {
    uploadId = await runOperation(`${productUrl}/draft/package`, {
      method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: bytes,
    }, 'upload');
  }
  if (!config.submit) return { uploadId, submitted: false };
  const publishId = await runOperation(productUrl, { method: 'POST' }, 'submission');
  log('Edge: submission created for certification; store approval is pending.');
  return { uploadId, publishId, submitted: true };
}

export async function main(env = process.env, args = process.argv.slice(2)) {
  const config = edgeConfig(env);
  const bytes = config.resumeUploadId && !config.checkOnly ? undefined : await readEdgePackage(args[0]);
  return uploadEdge(config, bytes);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
