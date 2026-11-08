import assert from 'node:assert/strict';
import handler from '../api/resolve.js';

const mk = () => {
  const r = { headers: {}, code: 0, body: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
};
let calls = 0;
globalThis.fetch = async (url) => {
  calls++;
  const u = String(url);
  if (u.includes('/tracks/search')) return { ok: true, json: async () => ({ data: [{ id: 'abc', title: 'T' }] }) };
  return { ok: false };
};
const a = mk(); await handler({ method: 'GET', query: { q: 'Lagui Dégun' } }, a);
assert.equal(a.code, 200); assert.equal(a.headers['X-Mazz-Cache'], 'MISS');
assert.match(a.body.streamUrl, /audius\.co\/v1\/tracks\/abc\/stream/);
const b = mk(); await handler({ method: 'GET', query: { q: '  lagui   dégun ' } }, b);
assert.equal(b.headers['X-Mazz-Cache'], 'HIT'); assert.equal(calls, 1);
const c = mk(); await handler({ method: 'GET', query: {} }, c); assert.equal(c.code, 400);
globalThis.fetch = async () => ({ ok: false });
const d = mk(); await handler({ method: 'GET', query: { q: 'zzz inconnu' } }, d); assert.equal(d.code, 404);
console.log('resolve.js: OK');
