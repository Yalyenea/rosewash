import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://chromewebstore.googleapis.com';
const ACTIVE_STATES = new Set(['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS']);

function boolean(value, name, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false.`);
  return value === 'true';
}

export function chromeConfig(env = process.env) {
  for (const name of ['CHROME_PUBLISHER_ID', 'CHROME_EXTENSION_ID', 'CHROME_ACCESS_TOKEN', 'TAG_NAME']) {
    if (!env[name]?.trim()) throw new Error(`Missing required configuration: ${name}.`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.CHROME_PUBLISHER_ID)) {
    throw new Error('CHROME_PUBLISHER_ID must be the publisher UUID.');
  }
  if (!/^[a-p]{32}$/.test(env.CHROME_EXTENSION_ID)) throw new Error('CHROME_EXTENSION_ID must be the 32-letter store item ID.');
  if (!/^[\x21-\x7e]+$/.test(env.CHROME_ACCESS_TOKEN)) throw new Error('Invalid CHROME_ACCESS_TOKEN.');
  if (!/^v\d+\.\d+\.\d+(?:\.\d+)?$/.test(env.TAG_NAME)) throw new Error('TAG_NAME must be a version tag such as v0.2.7.');
  return {
    publisherId: env.CHROME_PUBLISHER_ID,
    extensionId: env.CHROME_EXTENSION_ID,
    accessToken: env.CHROME_ACCESS_TOKEN,
    version: env.TAG_NAME.slice(1),
    submit: boolean(env.SUBMIT, 'SUBMIT', true),
    checkOnly: boolean(env.CHECK_ONLY, 'CHECK_ONLY', false),
  };
}

// Read the central directory because ZIP data descriptors can leave local-file
// header sizes empty. Only manifest.json is inflated, with a fixed size limit.
export function chromePackageVersion(bytes) {
  try {
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
      if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
        end = offset;
        break;
      }
    }
    if (end < 0 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0) throw new Error();
    const count = bytes.readUInt16LE(end + 10);
    let offset = bytes.readUInt32LE(end + 16);
    let version;
    for (let entry = 0; entry < count; entry++) {
      if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error();
      const nameLength = bytes.readUInt16LE(offset + 28);
      const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
      if (name === 'manifest.json') {
        if (version !== undefined || bytes.readUInt16LE(offset + 8) & 1) throw new Error();
        const method = bytes.readUInt16LE(offset + 10);
        const size = bytes.readUInt32LE(offset + 24);
        if (size > 1024 * 1024) throw new Error();
        const local = bytes.readUInt32LE(offset + 42);
        if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error();
        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
        const data = bytes.subarray(start, start + bytes.readUInt32LE(offset + 20));
        let manifest;
        if (method === 0) manifest = data;
        else if (method === 8) manifest = inflateRawSync(data, { maxOutputLength: 1024 * 1024 });
        else throw new Error();
        if (manifest.length !== size) throw new Error();
        version = JSON.parse(manifest.toString('utf8')).version;
        if (typeof version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(version)) throw new Error();
      }
      offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    }
    if (!version) throw new Error();
    return version;
  } catch {
    throw new Error('Chrome package must be a valid ZIP with one root manifest.json and a valid version.');
  }
}

export async function readChromePackage(path, expectedVersion) {
  if (!path) throw new Error('A Chrome ZIP package path is required.');
  const info = await stat(path);
  if (!info.isFile() || info.size < 22 || info.size > 2 * 1024 ** 3) throw new Error('Chrome package must be a ZIP file smaller than 2 GiB.');
  const bytes = await readFile(path);
  if (chromePackageVersion(bytes) !== expectedVersion) throw new Error('Chrome package manifest version does not match TAG_NAME.');
  return bytes;
}

export async function uploadChrome(config, bytes, {
  fetchImpl = fetch,
  wait = sleep,
  log = console.log,
  pollLimit = 60,
  pollIntervalMs = 10_000,
} = {}) {
  if (!config.checkOnly && chromePackageVersion(bytes) !== config.version) throw new Error('Chrome package manifest version does not match TAG_NAME.');
  const name = `publishers/${config.publisherId}/items/${config.extensionId}`;
  const itemUrl = `${API}/v2/${name}`;

  async function request(url, options, label) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: { Authorization: `Bearer ${config.accessToken}`, ...options.headers },
        redirect: 'error', signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error(`Chrome ${label} request failed. Check the developer dashboard before rerunning; requests are not retried.`);
    }
    if (response.status !== 200) throw new Error(`Chrome ${label} returned HTTP ${response.status}. Check the developer dashboard before rerunning.`);
    let result;
    try { result = await response.json(); }
    catch { throw new Error(`Chrome ${label} returned invalid JSON.`); }
    if (result?.name !== name || result.itemId !== config.extensionId) throw new Error(`Chrome ${label} returned an unexpected item identity.`);
    return result;
  }

  const fetchStatus = () => request(`${itemUrl}:fetchStatus`, { method: 'GET' }, 'status');
  const hasVersion = (revision) => revision?.distributionChannels?.some((channel) => channel.crxVersion === config.version);
  const status = await fetchStatus();
  if (config.checkOnly) {
    log('Chrome: authentication and publisher/item access verified; no package uploaded.');
    return { checked: true, authenticated: true };
  }
  if (hasVersion(status.publishedItemRevisionStatus)) {
    log(`Chrome ${config.version}: already published; no upload or submission needed.`);
    return { alreadyPublished: true, submitted: false };
  }
  const submitted = status.submittedItemRevisionStatus;
  if (submitted && ACTIVE_STATES.has(submitted.state)) {
    if (!hasVersion(submitted)) throw new Error('Chrome has another active submission. Check the developer dashboard before uploading.');
    log(`Chrome ${config.version}: already submitted; no upload or submission needed.`);
    return { alreadySubmitted: true, submitted: true };
  }
  if (hasVersion(submitted)) throw new Error('Chrome already has this version in a rejected or cancelled submission. Check the developer dashboard before rerunning.');
  if (status.takenDown) throw new Error('Chrome item has been taken down. Resolve the policy issue in the developer dashboard.');
  if (['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(status.lastAsyncUploadState)) throw new Error('Chrome already has an upload in progress. Wait before rerunning.');

  const upload = await request(`${API}/upload/v2/${name}:upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: bytes,
  }, 'upload');
  if (upload.uploadState === 'SUCCEEDED') {
    if (upload.crxVersion !== config.version) throw new Error('Chrome uploaded version does not match TAG_NAME. Submission stopped.');
  } else if (['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(upload.uploadState)) {
    // Discovery and UploadState specify IN_PROGRESS; media.upload prose also
    // documents UPLOAD_IN_PROGRESS. fetchStatus has no draft-version field.
    let complete = false;
    for (let attempt = 0; attempt < pollLimit; attempt++) {
      await wait(pollIntervalMs);
      const state = (await fetchStatus()).lastAsyncUploadState;
      if (state === 'SUCCEEDED') { complete = true; break; }
      if (!['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(state)) throw new Error('Chrome asynchronous upload failed or returned an unexpected state. Submission stopped.');
    }
    if (!complete) throw new Error('Chrome upload polling timed out. Check the developer dashboard before rerunning.');
  } else {
    throw new Error('Chrome upload failed or returned an unexpected state. Submission stopped.');
  }
  log(`Chrome ${config.version}: package uploaded.`);
  if (!config.submit) return { uploaded: true, submitted: false };

  const published = await request(`${itemUrl}:publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false }),
  }, 'submission');
  if (!['PENDING_REVIEW', 'PUBLISHED'].includes(published.state)) throw new Error('Chrome submission returned an unexpected state. Check the developer dashboard before rerunning.');
  // The asynchronous upload response omits crxVersion. Verify the server's
  // version from documented revision distribution channels after submission.
  for (let attempt = 0; attempt < pollLimit; attempt++) {
    const current = await fetchStatus();
    if ((hasVersion(current.submittedItemRevisionStatus) && ACTIVE_STATES.has(current.submittedItemRevisionStatus.state))
      || (hasVersion(current.publishedItemRevisionStatus) && current.publishedItemRevisionStatus.state === 'PUBLISHED')) {
      log(`Chrome ${config.version}: submission verified; store review/approval may still be pending.`);
      return { uploaded: true, submitted: true, state: published.state };
    }
    await wait(pollIntervalMs);
  }
  throw new Error('Chrome accepted the submission, but its version could not be verified. Check the developer dashboard before rerunning.');
}

export async function main(env = process.env, args = process.argv.slice(2)) {
  const config = chromeConfig(env);
  const bytes = config.checkOnly ? undefined : await readChromePackage(args[0], config.version);
  return uploadChrome(config, bytes);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
