import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { chromeConfig, chromePackageVersion, uploadChrome } from '../scripts/upload-chrome.mjs';

const env = {
  CHROME_PUBLISHER_ID: 'b1a3396a-f794-4c0e-b368-30e7e9f5cfbb',
  CHROME_EXTENSION_ID: 'jklllohlbljogmomdfhggfojpgellcmh',
  CHROME_ACCESS_TOKEN: 'secret-test-token',
  TAG_NAME: 'v0.2.7',
};
const config = chromeConfig(env);
const name = `publishers/${config.publisherId}/items/${config.extensionId}`;
const identity = { name, itemId: config.extensionId };
const itemUrl = `https://chromewebstore.googleapis.com/v2/${name}`;
const revision = (state, version = config.version) => ({ state, distributionChannels: [{ crxVersion: version, deployPercentage: 100 }] });

function zip(version = config.version, compressed = true) {
  const filename = Buffer.from('manifest.json');
  const manifest = Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Rosewash', version }));
  const data = compressed ? deflateRawSync(manifest) : manifest;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(compressed ? 8 : 0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(manifest.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(compressed ? 8 : 0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(manifest.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + data.length, 16);
  return Buffer.concat([local, filename, data, central, filename, end]);
}

function mock(responses) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${env.CHROME_ACCESS_TOKEN}`);
      const next = responses.shift();
      assert.ok(next, 'Unexpected API request');
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify({ ...identity, ...next.body }), { status: next.status ?? 200 });
    },
    wait: async () => {},
    log: () => {},
    pollLimit: 2,
  };
}

test('Chrome configuration fails clearly for missing or malformed input', () => {
  for (const key of Object.keys(env)) {
    const missing = { ...env };
    delete missing[key];
    assert.throws(() => chromeConfig(missing), new RegExp(key));
  }
  assert.throws(() => chromeConfig({ ...env, CHROME_EXTENSION_ID: 'not-an-item' }), /CHROME_EXTENSION_ID/);
  assert.throws(() => chromeConfig({ ...env, TAG_NAME: 'v0.2.7;echo secret' }), /TAG_NAME/);
  assert.throws(() => chromeConfig({ ...env, SUBMIT: 'yes' }), /SUBMIT/);
});

test('Chrome reads stored/deflated root manifests and rejects invalid or mismatched packages before requests', async () => {
  assert.equal(chromePackageVersion(zip()), config.version);
  assert.equal(chromePackageVersion(zip(config.version, false)), config.version);
  assert.throws(() => chromePackageVersion(Buffer.from('not a zip')), /valid ZIP/);
  const api = mock([]);
  await assert.rejects(uploadChrome(config, zip('0.2.6'), api), /manifest version does not match/);
  assert.equal(api.calls.length, 0);
});

test('Chrome check_only verifies identity with one read and needs no ZIP', async () => {
  const api = mock([{ body: {} }]);
  assert.deepEqual(await uploadChrome({ ...config, checkOnly: true }, undefined, api), { checked: true, authenticated: true });
  assert.deepEqual(api.calls.map(({ url, method }) => [url, method]), [[`${itemUrl}:fetchStatus`, 'GET']]);
  const wrong = mock([{ body: { itemId: 'wrong' } }]);
  await assert.rejects(uploadChrome({ ...config, checkOnly: true }, undefined, wrong), /unexpected item identity/);
});

test('Chrome synchronous upload sends original ZIP then submits for review and verifies documented version field', async () => {
  const bytes = zip();
  const api = mock([
    { body: { publishedItemRevisionStatus: revision('PUBLISHED', '0.2.6') } },
    { body: { uploadState: 'SUCCEEDED', crxVersion: config.version } },
    { body: { state: 'PENDING_REVIEW' } },
    { body: { submittedItemRevisionStatus: revision('PENDING_REVIEW') } },
  ]);
  assert.deepEqual(await uploadChrome(config, bytes, api), { uploaded: true, submitted: true, state: 'PENDING_REVIEW' });
  const upload = api.calls[1];
  assert.equal(upload.url, `https://chromewebstore.googleapis.com/upload/v2/${name}:upload`);
  assert.equal(upload.headers['Content-Type'], 'application/zip');
  assert.equal(upload.body, bytes);
  assert.equal(api.calls[2].url, `${itemUrl}:publish`);
  assert.deepEqual(JSON.parse(api.calls[2].body), { publishType: 'DEFAULT_PUBLISH', skipReview: false });
});

test('Chrome asynchronous upload polls lastAsyncUploadState and checks submitted revision version', async () => {
  const api = mock([
    { body: {} },
    { body: { uploadState: 'IN_PROGRESS' } },
    { body: { lastAsyncUploadState: 'IN_PROGRESS' } },
    { body: { lastAsyncUploadState: 'SUCCEEDED', publishedItemRevisionStatus: revision('PUBLISHED', '0.2.6') } },
    { body: { state: 'PENDING_REVIEW' } },
    { body: { submittedItemRevisionStatus: revision('PENDING_REVIEW') } },
  ]);
  assert.equal((await uploadChrome(config, zip(), api)).submitted, true);
  assert.equal(api.calls.filter(({ method }) => method === 'POST').length, 2);
  assert.equal(api.calls[3].url, `${itemUrl}:fetchStatus`);
});

test('Chrome skips repeated uploads for published and active submissions of the same version', async () => {
  for (const body of [
    { publishedItemRevisionStatus: revision('PUBLISHED') },
    { submittedItemRevisionStatus: revision('PENDING_REVIEW') },
    { submittedItemRevisionStatus: revision('STAGED') },
  ]) {
    const api = mock([{ body }]);
    await uploadChrome(config, zip(), api);
    assert.equal(api.calls.length, 1);
  }
});

test('Chrome blocks conflicting review, in-progress upload, and rejected same version before mutation', async () => {
  for (const body of [
    { submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.2.6') },
    { lastAsyncUploadState: 'IN_PROGRESS' },
    { submittedItemRevisionStatus: revision('REJECTED') },
    { takenDown: true },
  ]) {
    const api = mock([{ body }]);
    await assert.rejects(uploadChrome(config, zip(), api));
    assert.equal(api.calls.length, 1);
  }
});

test('Chrome submit=false uploads without publishing', async () => {
  const api = mock([{ body: {} }, { body: { uploadState: 'SUCCEEDED', crxVersion: config.version } }]);
  assert.deepEqual(await uploadChrome({ ...config, submit: false }, zip(), api), { uploaded: true, submitted: false });
  assert.equal(api.calls.length, 2);
});

test('Chrome stops before publishing on wrong version, failed upload, or async timeout', async () => {
  for (const responses of [
    [{ body: { uploadState: 'SUCCEEDED', crxVersion: '0.2.6' } }],
    [{ body: { uploadState: 'FAILED' } }],
    [{ body: { uploadState: 'IN_PROGRESS' } }, { body: { lastAsyncUploadState: 'FAILED' } }],
    [{ body: { uploadState: 'UPLOAD_IN_PROGRESS' } }, { body: { lastAsyncUploadState: 'IN_PROGRESS' } }, { body: { lastAsyncUploadState: 'IN_PROGRESS' } }],
  ]) {
    const api = mock([{ body: {} }, ...responses]);
    await assert.rejects(uploadChrome(config, zip(), api));
    assert.equal(api.calls.filter(({ method }) => method === 'POST').length, 1);
  }
});

test('Chrome rejects publish states and never claims success for an unverified submitted version', async () => {
  for (const responses of [
    [{ body: { state: 'REJECTED' } }],
    [{ body: { state: 'PENDING_REVIEW' } }, { body: { submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.2.6') } }, { body: {} }],
  ]) {
    const api = mock([{ body: {} }, { body: { uploadState: 'SUCCEEDED', crxVersion: config.version } }, ...responses]);
    await assert.rejects(uploadChrome(config, zip(), api), /unexpected state|could not be verified/);
    assert.equal(api.calls.filter(({ method }) => method === 'POST').length, 2);
  }
});

test('Chrome does not retry mutations or leak token and server response bodies on errors', async () => {
  for (const failure of [
    new Error(`network secret ${env.CHROME_ACCESS_TOKEN}`),
    { status: 403, body: { secret: env.CHROME_ACCESS_TOKEN } },
  ]) {
    const api = mock([{ body: {} }, failure]);
    await assert.rejects(uploadChrome(config, zip(), api), (error) => {
      assert.ok(!error.message.includes(env.CHROME_ACCESS_TOKEN));
      assert.ok(!error.message.includes('network secret'));
      return true;
    });
    assert.equal(api.calls.length, 2);
  }
});
