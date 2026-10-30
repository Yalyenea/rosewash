import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const API = "https://addons.mozilla.org/api/v5/";
const GUID = "rosewash@rosewash";
// AMO FileUploadSerializer uses UUIDField(format="hex"), without hyphens.
const UPLOAD_ID = /^[\da-f]{32}$/i;

function boolean(value, name, defaultValue) {
  if (value === undefined || value === "") return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function readConfig(env = process.env) {
  for (const name of ["FIREFOX_API_KEY", "FIREFOX_API_SECRET", "FIREFOX_ADDON_ID", "TAG_NAME"]) {
    if (!env[name]?.trim()) throw new Error(`Missing required configuration: ${name}`);
  }
  if (!/^v\d+\.\d+\.\d+(?:\.\d+)?$/.test(env.TAG_NAME)) {
    throw new Error("TAG_NAME must be a release tag such as v0.2.7");
  }
  const uploadId = env.FIREFOX_UPLOAD_ID?.trim() || "";
  if (uploadId && !UPLOAD_ID.test(uploadId)) {
    throw new Error("FIREFOX_UPLOAD_ID must be a 32-character hexadecimal AMO upload ID");
  }
  return {
    uploadId,
    apiKey: env.FIREFOX_API_KEY,
    apiSecret: env.FIREFOX_API_SECRET,
    addonId: env.FIREFOX_ADDON_ID.trim(),
    version: env.TAG_NAME.slice(1),
    zipPath: env.FIREFOX_ZIP_PATH || `.tmp/rosewash-${env.TAG_NAME}-firefox.zip`,
    submit: boolean(env.SUBMIT, "SUBMIT", true),
    checkOnly: boolean(env.CHECK_ONLY, "CHECK_ONLY", false)
  };
}

export function createJwt(apiKey, apiSecret, now = Date.now(), nonce = randomUUID()) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: apiKey, jti: nonce, iat: issuedAt, exp: issuedAt + 300
  })}`;
  return `${unsigned}.${createHmac("sha256", apiSecret).update(unsigned).digest("base64url")}`;
}

export async function uploadFirefox(config, {
  fetchImpl = fetch,
  readFileImpl = readFile,
  sleep = setTimeout,
  now = Date.now,
  log = console.log,
  pollIntervalMs = 5000,
  validationTimeoutMs = 600000
} = {}) {
  async function request(path, { method = "GET", body, allowNotFound = false } = {}) {
    const headers = { Authorization: `JWT ${createJwt(config.apiKey, config.apiSecret, now())}` };
    if (typeof body === "string") headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetchImpl(new URL(path, API), {
        method, headers, body, redirect: "error",
        signal: AbortSignal.timeout(method === "POST" ? 120000 : 60000)
      });
    } catch {
      // A failed mutation may already have reached AMO. Retrying could submit twice.
      throw new Error(`Firefox API ${method} request failed; inspect AMO before running again`);
    }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      // AMO errors can contain account details; keep credentials and response bodies out of CI logs.
      throw new Error(`Firefox API ${method} request returned HTTP ${response.status}; inspect AMO Developer Hub`);
    }
    try { return await response.json(); }
    catch { throw new Error("Firefox API returned an invalid JSON response"); }
  }

  const addonPath = `addons/addon/${encodeURIComponent(config.addonId)}/`;
  const profile = await request("accounts/profile/");
  const addon = await request(addonPath);
  if (addon.guid !== GUID) throw new Error(`FIREFOX_ADDON_ID must identify Rosewash (${GUID})`);
  if (!profile.id || !addon.authors?.some((author) => author.id === profile.id)) {
    throw new Error("Firefox API credentials must belong to an author of Rosewash");
  }
  if (addon.is_disabled) throw new Error("Rosewash is disabled on AMO; inspect Developer Hub");
  const existing = await request(`${addonPath}versions/v${encodeURIComponent(config.version)}/`, { allowNotFound: true });
  log(`Firefox configuration verified. Add-on ${addon.id}; current listed version ${addon.current_version?.version || "none"}.`);
  if (config.checkOnly) {
    log(`Check only: release version ${config.version} ${existing ? "already exists" : "does not exist"}; no upload or submission performed.`);
    return { action: "checked", addonId: addon.id, existing: Boolean(existing) };
  }
  if (existing) throw new Error(`Firefox version ${config.version} already exists; inspect AMO before running again`);
  let upload;
  if (config.uploadId) {
    // Explicitly resume an existing validation upload without uploading the archive again.
    upload = await request(`addons/upload/${config.uploadId}/`);
    if (upload.uuid !== config.uploadId) throw new Error("Firefox upload response does not match FIREFOX_UPLOAD_ID");
    if (upload.channel !== "listed") throw new Error("Firefox upload must use the listed channel");
    if (upload.version !== config.version) throw new Error("Firefox archive version does not match TAG_NAME");
    if (upload.submitted !== false) throw new Error("Firefox upload was already submitted; inspect AMO before running again");
    log("Resuming existing Firefox upload; checking AMO validation.");
  } else {
    let zip;
    try { zip = await readFileImpl(config.zipPath); }
    catch { throw new Error("Cannot read the Firefox release archive at FIREFOX_ZIP_PATH"); }
    if (!zip.length) throw new Error("The Firefox release archive is empty");
    const form = new FormData();
    form.set("upload", new Blob([zip], { type: "application/zip" }), basename(config.zipPath));
    form.set("channel", "listed");
    upload = await request("addons/upload/", { method: "POST", body: form });
    log("Firefox archive uploaded; waiting for AMO validation.");
  }
  if (typeof upload.uuid !== "string" || !UPLOAD_ID.test(upload.uuid)) {
    throw new Error("Firefox upload response is missing a valid upload UUID; inspect AMO before running again");
  }
  const uuid = upload.uuid;
  const deadline = now() + validationTimeoutMs;
  while (upload.processed !== true) {
    if (now() >= deadline) throw new Error("Firefox validation timed out; inspect AMO before running again");
    await sleep(Math.min(pollIntervalMs, deadline - now()));
    upload = await request(`addons/upload/${uuid}/`);
  }
  if (upload.channel !== "listed") throw new Error("Firefox upload must use the listed channel");
  if (upload.valid !== true) throw new Error("Firefox archive failed AMO validation; inspect validation results in Developer Hub");
  if (upload.version !== config.version) throw new Error("Firefox archive version does not match TAG_NAME");
  if (upload.submitted) throw new Error("Firefox upload was already submitted; inspect AMO before running again");
  if (!config.submit) {
    log(`Firefox ${config.version} passed AMO validation. SUBMIT=false: no version created or submitted for review.`);
    return { action: "validated", uploadId: uuid };
  }
  // The listed upload channel makes version creation the review submission step.
  const version = await request(`${addonPath}versions/`, {
    method: "POST", body: JSON.stringify({ upload: uuid, license: "MIT" })
  });
  if (!version.id || version.version !== config.version) {
    throw new Error("Firefox version submission response could not be verified; inspect AMO before running again");
  }
  log(`Firefox ${version.version} submitted. Version ID ${version.id}; status ${["public", "unreviewed", "disabled"].includes(version.file?.status) ? version.file.status : "check AMO"}.`);
  return { action: "submitted", versionId: version.id };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await uploadFirefox(readConfig()); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
