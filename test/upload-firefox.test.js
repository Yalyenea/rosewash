import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createJwt, readConfig, uploadFirefox } from "../scripts/upload-firefox.mjs";

const env = {
  FIREFOX_API_KEY: "test-key", FIREFOX_API_SECRET: "test-secret",
  FIREFOX_ADDON_ID: "3101107", TAG_NAME: "v0.2.7"
};
const addon = {
  id: 3101107, guid: "rosewash@rosewash", authors: [{ id: 12 }],
  current_version: { version: "0.2.5" }, is_disabled: false
};
const uuid = "4e3fc867-abcd-4321-abcd-123456789012";
const validated = { uuid, processed: true, valid: true, version: "0.2.7", submitted: false };

function harness(extra, config = {}, options = {}) {
  const sequence = [
    ["GET", "/accounts/profile/", { id: 12 }],
    ["GET", "/addons/addon/3101107/", addon],
    ["GET", "/addons/addon/3101107/versions/v0.2.7/", null, 404],
    ...extra
  ];
  const calls = [];
  let clock = 0;
  return {
    calls, sequence,
    run: () => uploadFirefox({ ...readConfig(env), ...config }, {
      fetchImpl: async (url, init) => {
        calls.push({ url, ...init });
        const expected = sequence.shift();
        assert.ok(expected, "no unexpected API request");
        const [method, path, body, status = 200] = expected;
        assert.equal(init.method, method);
        assert.equal(url.href, `https://addons.mozilla.org/api/v5${path}`);
        assert.match(init.headers.Authorization, /^JWT /);
        assert.equal(init.redirect, "error");
        return new Response(JSON.stringify(body), { status });
      },
      readFileImpl: async () => Buffer.from("fake-archive"),
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      log: () => {},
      ...options
    })
  };
}

test("Firefox configuration requires every credential and strict boolean inputs", () => {
  for (const name of Object.keys(env)) {
    assert.throws(() => readConfig({ ...env, [name]: "" }), new RegExp(name));
  }
  assert.throws(() => readConfig({ ...env, SUBMIT: "yes" }), /SUBMIT/);
  assert.throws(() => readConfig({ ...env, CHECK_ONLY: "1" }), /CHECK_ONLY/);
  assert.throws(() => readConfig({ ...env, TAG_NAME: "../../v1" }), /TAG_NAME/);
  assert.equal(readConfig(env).zipPath, ".tmp/rosewash-v0.2.7-firefox.zip");
});

test("Firefox JWT uses HS256, issuer and a five minute lifetime", () => {
  const jwt = createJwt("key", "secret", 1000000, "nonce");
  const [header, payload, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "HS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url")), { iss: "key", jti: "nonce", iat: 1000, exp: 1300 });
  assert.equal(signature, createHmac("sha256", "secret").update(`${header}.${payload}`).digest("base64url"));
});

test("Firefox check-only authenticates and reads state without reading a package or uploading", async () => {
  const h = harness([], { checkOnly: true }, { readFileImpl: () => assert.fail("must not read archive") });
  assert.deepEqual(await h.run(), { action: "checked", addonId: 3101107, existing: false });
  assert.equal(h.calls.length, 3);
  assert.ok(h.calls.every((call) => call.method === "GET"));
});

test("Firefox uploads multipart, polls validation, then creates listed version", async () => {
  const h = harness([
    ["POST", "/addons/upload/", { uuid, processed: false }],
    ["GET", `/addons/upload/${uuid}/`, validated],
    ["POST", "/addons/addon/3101107/versions/", { id: 99, version: "0.2.7", file: { status: "unreviewed" } }]
  ]);
  assert.deepEqual(await h.run(), { action: "submitted", versionId: 99 });
  assert.equal(h.calls[3].body.get("channel"), "listed");
  assert.equal(await h.calls[3].body.get("upload").text(), "fake-archive");
  assert.equal(h.calls[3].headers["Content-Type"], undefined, "fetch sets the multipart boundary");
  assert.deepEqual(JSON.parse(h.calls[5].body), { upload: uuid, license: "MIT" });
  assert.equal(new Set(h.calls.map((call) => call.headers.Authorization)).size, h.calls.length);
  assert.equal(h.sequence.length, 0);
});

test("Firefox submit=false validates only and does not create a version", async () => {
  const h = harness([["POST", "/addons/upload/", validated]], { submit: false });
  assert.deepEqual(await h.run(), { action: "validated", uploadId: uuid });
  assert.equal(h.calls.filter((call) => call.method === "POST").length, 1);
});

test("Firefox validation failure, timeout and package version mismatch never submit", async () => {
  for (const [upload, expected, options] of [
    [{ ...validated, valid: false }, /failed AMO validation/, {}],
    [{ ...validated, version: "0.2.6" }, /does not match/, {}],
    [{ ...validated, processed: false }, /timed out/, { validationTimeoutMs: 0 }]
  ]) {
    const h = harness([["POST", "/addons/upload/", upload]], {}, options);
    await assert.rejects(h.run, expected);
    assert.equal(h.calls.length, 4);
  }
});

test("Firefox stops before upload for an unrelated add-on or a different author", async () => {
  for (const changed of [{ ...addon, guid: "another-addon" }, { ...addon, authors: [{ id: 9 }] }]) {
    const h = harness([]);
    h.sequence[1][2] = changed;
    await assert.rejects(h.run, /must identify Rosewash|must belong to an author/);
    assert.equal(h.calls.length, 2);
  }
});

test("Firefox duplicate versions stop before upload", async () => {
  const h = harness([]);
  h.sequence[2] = ["GET", "/addons/addon/3101107/versions/v0.2.7/", { id: 99 }];
  await assert.rejects(h.run, /already exists/);
  assert.equal(h.calls.length, 3);
});

test("Firefox failed upload is not retried and error does not expose server response", async () => {
  const h = harness([["POST", "/addons/upload/", { secret: "private-server-details" }, 503]]);
  await assert.rejects(h.run, (error) => {
    assert.match(error.message, /HTTP 503/);
    assert.doesNotMatch(error.message, /private-server-details|test-secret|test-key/);
    return true;
  });
  assert.equal(h.calls.length, 4);
});
