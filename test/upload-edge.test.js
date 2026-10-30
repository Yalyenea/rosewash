import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeConfig, edgeOperationId, uploadEdge } from '../scripts/upload-edge.mjs';

const productId = '960e04f5-aa93-49c2-95fa-053ec5315c19';
const uploadId = '11111111-1111-4111-8111-111111111111';
const publishId = '22222222-2222-4222-8222-222222222222';
const env = { EDGE_PRODUCT_ID: productId, EDGE_CLIENT_ID: 'client', EDGE_API_KEY: 'private-key' };
const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${productId}/submissions`;
const zip = Buffer.from('PK\x03\x04package');
const accepted = (id) => new Response(null, { status: 202, headers: { Location: id } });
const state = (status, extra = {}) => Response.json({ status, ...extra });

function transport(responses) {
  const calls = [];
  return {
    calls,
    options: {
      wait: async () => {},
      log: () => {},
      fetchImpl: async (url, options) => {
        calls.push({ url, ...options });
        assert.ok(responses.length, 'Unexpected additional request');
        return responses.shift();
      },
    },
  };
}

test('Edge rejects missing credentials and a public CRX ID as its product GUID', () => {
  assert.throws(() => edgeConfig({ ...env, EDGE_API_KEY: '' }), /EDGE_API_KEY/);
  assert.throws(() => edgeConfig({ ...env, EDGE_PRODUCT_ID: 'gjbmoakfjmbcnahoigepocgbngiekhjj' }), /product GUID/);
  assert.throws(() => edgeConfig({ ...env, SUBMIT: 'yes' }), /SUBMIT/);
  assert.throws(() => edgeConfig({ ...env, EDGE_RESUME_UPLOAD_ID: '../wrong-operation' }), /EDGE_RESUME_UPLOAD_ID/);
});

test('Edge v1.1 sends ZIP bytes and waits for upload success before submitting', async () => {
  const mock = transport([
    accepted(uploadId), state('InProgress'), state('Succeeded'),
    accepted(publishId), state('Succeeded'),
  ]);
  const result = await uploadEdge(edgeConfig(env), zip, mock.options);
  assert.deepEqual(result, { uploadId, publishId, submitted: true });
  assert.deepEqual(mock.calls.map(({ method, url }) => [method, url]), [
    ['POST', `${base}/draft/package`],
    ['GET', `${base}/draft/package/operations/${uploadId}`],
    ['GET', `${base}/draft/package/operations/${uploadId}`],
    ['POST', base],
    ['GET', `${base}/operations/${publishId}`],
  ]);
  assert.equal(mock.calls[0].body, zip);
  assert.equal(mock.calls[0].headers['Content-Type'], 'application/zip');
  for (const call of mock.calls) {
    assert.equal(call.headers.Authorization, 'ApiKey private-key');
    assert.equal(call.headers['X-ClientID'], 'client');
    assert.equal(call.redirect, 'error');
  }
});

test('Edge draft-only mode never creates a certification submission', async () => {
  const mock = transport([accepted(uploadId), state('Succeeded')]);
  const result = await uploadEdge(edgeConfig({ ...env, SUBMIT: 'false' }), zip, mock.options);
  assert.deepEqual(result, { uploadId, submitted: false });
  assert.equal(mock.calls.length, 2);
});

test('Edge accepts HTTP 202 status responses and reads their JSON operation state', async () => {
  const mock = transport([
    accepted(uploadId), Response.json({ status: 'InProgress' }, { status: 202 }), state('Succeeded'),
    accepted(publishId), Response.json({ status: 'Succeeded' }, { status: 202 }),
  ]);
  const result = await uploadEdge(edgeConfig(env), zip, mock.options);
  assert.deepEqual(result, { uploadId, publishId, submitted: true });
  assert.equal(mock.calls.filter(({ method }) => method === 'POST').length, 2);
});

test('Edge resumes a prior upload by polling its operation and never posts ZIP bytes again', async () => {
  const mock = transport([
    Response.json({ status: 'InProgress' }, { status: 202 }), state('Succeeded'),
    accepted(publishId), state('Succeeded'),
  ]);
  const result = await uploadEdge(edgeConfig({ ...env, EDGE_RESUME_UPLOAD_ID: uploadId }), undefined, mock.options);
  assert.deepEqual(result, { uploadId, publishId, submitted: true });
  assert.deepEqual(mock.calls.map(({ method, url }) => [method, url]), [
    ['GET', `${base}/draft/package/operations/${uploadId}`],
    ['GET', `${base}/draft/package/operations/${uploadId}`],
    ['POST', base],
    ['GET', `${base}/operations/${publishId}`],
  ]);
  assert.ok(mock.calls.every(({ body }) => body === undefined));
});

test('Edge draft-only resume only reads the existing upload operation', async () => {
  const mock = transport([state('Succeeded')]);
  const result = await uploadEdge(edgeConfig({ ...env, EDGE_RESUME_UPLOAD_ID: uploadId, SUBMIT: 'false' }), undefined, mock.options);
  assert.deepEqual(result, { uploadId, submitted: false });
  assert.deepEqual(mock.calls.map(({ method }) => method), ['GET']);
});

test('Edge failed resumed upload prevents a new upload or certification submission', async () => {
  const mock = transport([Response.json({ status: 'Failed' }, { status: 202 })]);
  await assert.rejects(uploadEdge(edgeConfig({ ...env, EDGE_RESUME_UPLOAD_ID: uploadId }), undefined, mock.options), /upload failed/);
  assert.deepEqual(mock.calls.map(({ method }) => method), ['GET']);
});

test('Edge check-only makes no request and reports authentication as unverified', async () => {
  const mock = transport([]);
  const logs = [];
  const result = await uploadEdge(edgeConfig({ ...env, CHECK_ONLY: 'true' }), zip, {
    ...mock.options, log: (line) => logs.push(line),
  });
  assert.deepEqual(result, { checked: true, authenticated: false });
  assert.equal(mock.calls.length, 0);
  assert.match(logs[0], /authentication has not been verified/);
});

test('Edge failed upload prevents submission and keeps sensitive response text out of errors', async () => {
  const mock = transport([accepted(uploadId), state('Failed', { message: 'private-key' })]);
  await assert.rejects(uploadEdge(edgeConfig(env), zip, mock.options), (error) => {
    assert.match(error.message, /upload failed/);
    assert.doesNotMatch(error.message, /private-key/);
    return true;
  });
  assert.equal(mock.calls.length, 2);
});

test('Edge rejects a failed certification operation after an accepted HTTP response', async () => {
  const mock = transport([
    accepted(uploadId), state('Succeeded'), accepted(publishId),
    state('Failed', { errorCode: 'SubmissionValidationError' }),
  ]);
  await assert.rejects(uploadEdge(edgeConfig(env), zip, mock.options), /submission failed/);
});

test('Edge HTTP upload failures are not retried', async () => {
  const mock = transport([new Response('sensitive response', { status: 429 })]);
  await assert.rejects(uploadEdge(edgeConfig(env), zip, mock.options), /HTTP 429/);
  assert.equal(mock.calls.length, 1);
});

test('Edge stops after a bounded poll without uploading the package again', async () => {
  const mock = transport([accepted(uploadId), state('InProgress')]);
  await assert.rejects(uploadEdge(edgeConfig(env), zip, { ...mock.options, pollLimit: 1 }), /polling timed out/);
  assert.equal(mock.calls.filter(({ method }) => method === 'POST').length, 1);
});

test('Edge only accepts operation Locations for the expected API path', () => {
  const url = `${base}/draft/package`;
  assert.equal(edgeOperationId(uploadId, url), uploadId);
  assert.equal(edgeOperationId(`${url}/operations/${uploadId}`, url), uploadId);
  assert.equal(edgeOperationId(`/v1/products/${productId}/submissions/draft/package/operations/${uploadId}`, url), uploadId);
  assert.throws(() => edgeOperationId(`https://example.com/operations/${uploadId}`, url), /invalid operation/);
  assert.throws(() => edgeOperationId(`${base}/operations/${uploadId}`, url), /invalid operation/);
  assert.throws(() => edgeOperationId(null, url), /invalid operation/);
});
