import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('work/cyber-uvu-student-projects/cybr-4550/threat_actors/birthday_memory/security/evidence/before');
fs.mkdirSync(out, { recursive: true });
const entries = [];
async function request(id, method, route, body, headers = {}) {
  const requestHeaders = { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const response = await fetch(`http://127.0.0.1:4000${route}`, {
    method, headers: requestHeaders, body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  entries.push({ id, time: new Date().toISOString(), request: { method, url: `http://127.0.0.1:4000${route}`, headers: requestHeaders, body }, response: { status: response.status, headers: Object.fromEntries(response.headers), body: raw } });
  return { status: response.status, raw, data: raw ? JSON.parse(raw) : null };
}

const initial = await request('BASE-00', 'GET', '/api/birthdays');
assert.equal(initial.status, 200);
assert.equal(initial.data.length, 0, 'Baseline database must be freshly created.');
const sample = i => ({ firstName: `Fictional${String(i).padStart(3, '0')}`, lastName: 'Testperson', birthdate: '1995-09-22', phone: '+1 202 555 0101', email: `fictional${i}@example.test` });
for (let i = 1; i <= 125; i++) {
  const created = await request(`SEED-${i}`, 'POST', '/api/birthdays', sample(i));
  assert.equal(created.status, 201);
}
const all = await request('BASE-01', 'GET', '/api/birthdays');
assert.equal(all.data.length, 125);
const limited = await request('BASE-02', 'GET', '/api/birthdays?limit=10&page=1');
assert.equal(limited.data.length, 125);
const changed = await request('BASE-03', 'PUT', `/api/birthdays/${all.data[0].id}`, { ...sample(1), firstName: 'ChangedWithoutLogin' });
assert.equal(changed.status, 200);
const removed = await request('BASE-04', 'DELETE', `/api/birthdays/${all.data[0].id}`);
assert.equal(removed.status, 204);
const cors = await request('BASE-05', 'GET', '/api/birthdays?limit=1', undefined, { Origin: 'https://untrusted.example.test' });
assert.equal(cors.status, 200);
const injection = await request('BASE-06', 'GET', '/api/birthdays?q=' + encodeURIComponent("' OR 1=1 --"));
assert.equal(injection.status, 200);
assert.equal(injection.data.length, 0);
const types = await request('BASE-07', 'POST', '/api/birthdays', { ...sample(126), firstName: ['ArrayValue'], ownerId: 'ignored-owner' });
assert.equal(types.status, 201);
const health = await request('BASE-08', 'GET', '/api/health');
assert.equal(health.status, 200);
const upcoming = await request('BASE-09', 'GET', '/api/birthdays/upcoming?days=366&limit=10');
assert.equal(upcoming.data.length, 125);
const summary = {
  capturedAt: new Date().toISOString(), sourceCommit: '849911eff1503f1aa25aa4a6fa3baa57b29ba41b',
  syntheticRecords: 125, authenticationRequired: false, unauthenticatedUpdate: changed.status,
  unauthenticatedDelete: removed.status, requestedLimit: 10, actualReturned: limited.data.length,
  corsAllowOrigin: entries.find(e => e.id === 'BASE-05').response.headers['access-control-allow-origin'],
  sqlInjectionProbeReturnedRows: injection.data.length, wrongTypeAndUnknownOwnerAccepted: types.status,
  note: 'One SQL-injection probe is a negative result for that case only. No generalized claim that injection is impossible. Rate-limit absence is not proven solely by this seed sequence.',
};
fs.writeFileSync(path.join(out, 'http-transcripts.json'), JSON.stringify(entries, null, 2));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, 'http-transcripts.txt'), entries.map(e => `${e.id} | ${e.time}\n${e.request.method} ${e.request.url}\n${JSON.stringify(e.request.headers)}\n${e.request.body ? JSON.stringify(e.request.body) : ''}\nHTTP ${e.response.status}\n${JSON.stringify(e.response.headers, null, 2)}\n${e.response.body}\n`).join('\n'));
console.log(JSON.stringify(summary, null, 2));
