import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { createApp, IDLE_MS, ABSOLUTE_MS } = await import(`${process.env.APP_SOURCE || '/app/server/src'}/app.js`);
import { createPool, databaseConfig, readSecret } from '/app/server/src/db.js';
const require = createRequire('/app/server/package.json');
const pg = require('pg'), pino = require('pino');
const pool = createPool();
const users = JSON.parse(fs.readFileSync('/test-users.json', 'utf8'));
const results = [], transcripts = [], servers = [];
let clock = Date.now();
const logger = pino({ level: 'silent' });
async function instance(limits = { global: 10000, read: 10000, write: 10000, login: 1000 }, customPool = pool) {
  const app = await createApp({ pool: customPool, sessionSecret: readSecret('SESSION_SECRET'),
    origins: ['http://127.0.0.1:4000'], logger, limits, now: () => clock });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  servers.push({ app, server });
  return `http://127.0.0.1:${server.address().port}`;
}
function agent(base) {
  return { base, cookie: '', token: '', async call(method, route, body, extra = {}) {
    const headers = { ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(this.token ? { 'X-CSRF-Token': this.token } : {}), ...extra };
    if (body !== undefined) headers['Content-Type'] ??= 'application/json';
    const response = await fetch(`${base}${route}`, { method, headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const cookie = response.headers.getSetCookie()[0];
    if (cookie) this.cookie = cookie.split(';')[0];
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    transcripts.push({ at: new Date().toISOString(), method, route,
      requestBody: route.includes('/login') ? '[credentials omitted]' : body,
      origin: headers.Origin, status: response.status,
      response: data && typeof data === 'object' && 'csrfToken' in data ? { ...data, csrfToken: '[redacted]' } : data,
      headers: Object.fromEntries([...response.headers].filter(([key]) => !['set-cookie'].includes(key))) });
    return { status: response.status, data, headers: response.headers, cookie };
  } };
}
async function login(client, index = 0) {
  const before = await client.call('GET', '/api/auth/csrf');
  client.token = before.data.csrfToken;
  const oldCookie = client.cookie;
  const result = await client.call('POST', '/api/auth/login', users[index]);
  assert.equal(result.status, 200);
  client.token = result.data.csrfToken;
  assert.notEqual(client.cookie, oldCookie, 'login must rotate session ID');
  return result;
}
async function check(name, fn) {
  const started = Date.now();
  try { const evidence = await fn(); results.push({ name, passed: true, milliseconds: Date.now() - started, evidence }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const fixture = { firstName: 'Synthetic', lastName: 'Security test', birthdate: '1990-02-28', phone: '+1 202 555 0100', email: 'synthetic@example.test' };
const created = [];
try {
  const base = await instance(), anonymous = agent(base), alice = agent(base), bob = agent(base);
  await check('Anonymous list, upcoming, create, update and delete are rejected', async () => {
    for (const [method, route] of [['GET','/api/birthdays'],['GET','/api/birthdays/upcoming'],['POST','/api/birthdays'],['PUT','/api/birthdays/1'],['DELETE','/api/birthdays/1']])
      assert.equal((await anonymous.call(method, route, method === 'POST' || method === 'PUT' ? fixture : undefined)).status, 401);
  });
  await check('Correct password succeeds, session ID rotates, cookie is HttpOnly and SameSite Strict', async () => {
    const result = await login(alice);
    assert.match(result.cookie, /HttpOnly/i); assert.match(result.cookie, /SameSite=Strict/i);
    assert.doesNotMatch(result.cookie, /; Secure/i); // Explicit loopback HTTP lab mode.
    assert.equal((await alice.call('GET','/api/auth/me')).data.user.username, 'alice');
    await login(bob, 1);
  });
  await check('Incorrect and unknown credentials share generic rejection', async () => {
    const invalid = agent(base); invalid.token = (await invalid.call('GET','/api/auth/csrf')).data.csrfToken;
    const a = await invalid.call('POST','/api/auth/login',{ username:'alice', password:'incorrect' });
    const b = await invalid.call('POST','/api/auth/login',{ username:'unknown-person', password:'incorrect' });
    assert.equal(a.status,401); assert.equal(b.status,401); assert.deepEqual(a.data,b.data);
  });
  let target;
  await check('Owner can create a birthday', async () => {
    const r = await alice.call('POST','/api/birthdays',fixture); assert.equal(r.status,201);
    target = r.data.id; created.push(target); assert.equal(r.data.firstName,fixture.firstName);
  });
  await check('Other user cannot list, change or delete owner record', async () => {
    const list = await bob.call('GET','/api/birthdays?limit=50');
    assert.equal(list.status,200); assert.ok(!list.data.items.some(b => b.id === target));
    assert.equal((await bob.call('PUT',`/api/birthdays/${target}`,fixture)).status,404);
    assert.equal((await bob.call('DELETE',`/api/birthdays/${target}`)).status,404);
    const upcoming = await bob.call('GET','/api/birthdays/upcoming?days=366&limit=50');
    assert.equal(upcoming.status,200); assert.ok(!upcoming.data.items.some(b => b.id === target));
  });
  await check('Owner can update and read their record', async () => {
    const r = await alice.call('PUT',`/api/birthdays/${target}`,{...fixture,lastName:'Updated synthetic'});
    assert.equal(r.status,200); assert.equal(r.data.lastName,'Updated synthetic');
    const list = await alice.call('GET','/api/birthdays?q=Updated%20synthetic');
    assert.equal(list.data.items[0].id,target);
  });
  await check('Wrong type, forged owner, impossible date and long fields are rejected', async () => {
    // Exact BASE-07 payload from the preserved original capture.
    assert.equal((await alice.call('POST','/api/birthdays',{
      firstName:['ArrayValue'],lastName:'Testperson',birthdate:'1995-09-22',
      phone:'+1 202 555 0101',email:'fictional126@example.test',ownerId:'ignored-owner'
    })).status,400);
    for (const body of [{...fixture, firstName:42},{...fixture,owner_id:2},{...fixture,birthdate:'2001-02-29'},
      {...fixture,firstName:'x'.repeat(81)},{...fixture,email:'javascript:alert(1)'},{...fixture,phone:'<script>'}])
      assert.equal((await alice.call('POST','/api/birthdays',body)).status,400);
  });
  await check('Oversized body rejected before mutation', async () => {
    assert.equal((await alice.call('POST','/api/birthdays',{...fixture,firstName:'x'.repeat(9000)})).status,413);
  });
  await check('Missing, forged and Unicode CSRF tokens are rejected without server errors', async () => {
    for (const token of ['', '0'.repeat(64), 'é'.repeat(64)])
      assert.equal((await alice.call('POST','/api/birthdays',fixture,{'X-CSRF-Token':token})).status,403);
  });
  await check('Untrusted origin denied; exact allowed origin permits credentialed CORS', async () => {
    assert.equal((await alice.call('GET','/api/birthdays?limit=1',undefined,{Origin:'https://untrusted.example.test'})).status,403);
    const r = await alice.call('GET','/api/birthdays',undefined,{Origin:'http://127.0.0.1:4000'});
    assert.equal(r.status,200); assert.equal(r.headers.get('access-control-allow-origin'),'http://127.0.0.1:4000');
    assert.equal(r.headers.get('access-control-allow-credentials'),'true');
  });
  await check('Security headers and private no-store responses are present', async () => {
    const r = await alice.call('GET','/api/birthdays');
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal(r.headers.get('cache-control'),'no-store');
    assert.equal(r.headers.get('x-powered-by'),null);
  });
  await check('SQL injection search remains a literal value (negative result)', async () => {
    const r = await alice.call('GET',`/api/birthdays?q=${encodeURIComponent("' OR 1=1 --")}`);
    assert.equal(r.status,200); assert.equal(r.data.items.length,0);
  });
  await check('Pagination limits rows, rejects excessive limits and supports next page', async () => {
    for(let i=0;i<27;i++) { const r = await alice.call('POST','/api/birthdays',{...fixture,lastName:`Page test ${i}`}); assert.equal(r.status,201); created.push(r.data.id); }
    const first = await alice.call('GET','/api/birthdays?limit=10&page=1');
    const second = await alice.call('GET','/api/birthdays?limit=10&page=2');
    assert.equal(first.data.items.length,10); assert.equal(first.data.hasMore,true);
    assert.equal(second.data.items.length,10); assert.ok(!first.data.items.some(a => second.data.items.some(b=>b.id===a.id)));
    assert.equal((await alice.call('GET','/api/birthdays?limit=51')).status,400);
    assert.equal((await alice.call('GET','/api/birthdays/upcoming?days=366&limit=10')).data.items.length,10);
  });
  await check('Dedicated DB role cannot create table, escalate role, read or alter audit events', async () => {
    const rejected = [];
    for (const sql of ['CREATE TABLE forbidden_test(id int)','CREATE ROLE forbidden_role','SELECT * FROM audit_events',
      'DELETE FROM audit_events','UPDATE audit_events SET action=action',"UPDATE users SET enabled=false WHERE false"])
      { await assert.rejects(pool.query(sql), error => { rejected.push({ statement:sql, sqlstate:error.code }); return error.code === '42501'; }); }
    const { rows } = await pool.query('SELECT current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
    assert.equal(rows[0].rolsuper,false); return { role:rows[0],denied:rejected };
  });
  await check('Database connection uses TLS; wrong CA and plaintext connections are rejected', async () => {
    const { rows } = await pool.query('SELECT ssl,version,cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
    assert.equal(rows[0].ssl,true);
    for (const ssl of [{rejectUnauthorized:true}, false]) {
      const client = new pg.Client({...databaseConfig(),ssl});
      try { await assert.rejects(client.connect()); } finally { await client.end().catch(()=>{}); }
    }
    return rows[0];
  });
  await check('Owner deletion succeeds and subsequent update returns not found', async () => {
    assert.equal((await alice.call('DELETE',`/api/birthdays/${target}`)).status,204);
    assert.equal((await alice.call('PUT',`/api/birthdays/${target}`,fixture)).status,404);
    return { deletedTarget:target, auditVerifiedSeparately:true };
  });
  await check('Audit failure rolls back the birthday mutation', async () => {
    const failingPool=Object.create(pool);
    failingPool.query=pool.query.bind(pool);
    failingPool.connect=async () => {
      const client=await pool.connect();
      return { release:()=>client.release(), query:(sql,values)=>{
        if(sql.startsWith('INSERT INTO audit_events')) throw new Error('Injected audit failure');
        return client.query(sql,values);
      } };
    };
    const client=agent(await instance(undefined,failingPool)); await login(client);
    const r=await client.call('POST','/api/birthdays',{...fixture,lastName:'AuditRollbackUnique'});
    assert.equal(r.status,500); assert.equal(r.data.error,'Request failed');
    assert.equal((await alice.call('GET','/api/birthdays?q=AuditRollbackUnique')).data.items.length,0);
  });
  await check('Logout invalidates the server session', async () => {
    const old = alice.cookie; assert.equal((await alice.call('POST','/api/auth/logout',{})).status,204);
    alice.cookie = old; assert.equal((await alice.call('GET','/api/birthdays')).status,401);
  });
  await check('Idle expiry rejects a previously valid session', async () => {
    await login(alice); clock += IDLE_MS + 1;
    assert.equal((await alice.call('GET','/api/birthdays')).status,401);
  });
  await check('Absolute expiry rejects a session despite repeated activity', async () => {
    await login(alice);
    for (let elapsed=0; elapsed<ABSOLUTE_MS; elapsed+=IDLE_MS/2) {
      clock += IDLE_MS/2;
      const r=await alice.call('GET','/api/auth/me');
      assert.equal(r.status,elapsed+IDLE_MS/2>=ABSOLUTE_MS?401:200);
    }
    clock=Date.now();
  });
  await check('Read and write throttles return 429 (four calls with test threshold three)', async () => {
    const limited = agent(await instance({ global:100,login:20,read:3,write:3 })); await login(limited);
    for(let i=0;i<4;i++) assert.equal((await limited.call('GET','/api/birthdays')).status,i===3?429:200);
    for(let i=0;i<4;i++) assert.equal((await limited.call('POST','/api/birthdays',{})).status,i===3?429:400);
  });
  await check('Sign-in throttle returns 429 (four calls with test threshold three)', async () => {
    const limited = agent(await instance({ global:100,login:3 }));
    limited.token=(await limited.call('GET','/api/auth/csrf')).data.csrfToken;
    for(let i=0;i<4;i++) assert.equal((await limited.call('POST','/api/auth/login',{username:'alice',password:'wrong'})).status,i===3?429:401);
  });
  await check('Database outage health message contains no internal details', async () => {
    const failedPool = Object.create(pool);
    failedPool.query = async () => { throw Object.assign(new Error('private connection detail'),{code:'ECONNREFUSED'}); };
    const client=agent(await instance({},failedPool));
    const r=await client.call('GET','/api/health'); assert.equal(r.status,503); assert.deepEqual(r.data,{status:'unavailable'});
  });
} finally {
  // Cleanup uses the same restricted DB role; test audit events intentionally persist.
  if(created.length) await pool.query('DELETE FROM birthdays WHERE id=ANY($1::int[])', [created]);
  for(const { app,server } of servers) { app.locals.sessionStore.close(); await new Promise(resolve=>server.close(resolve)); }
  await pool.end();
  const output=process.env.EVIDENCE_DIR || '/evidence'; fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(`${output}/security-tests.json`,JSON.stringify({capturedAt:new Date().toISOString(),
    scope:'Local containers and synthetic users only. Separate app instances use the production code and real PostgreSQL; time and rate thresholds are injected where labeled.',
    passed:results.filter(r=>r.passed).length,total:results.length,results},null,2));
  fs.writeFileSync(`${output}/http-transcripts.json`,JSON.stringify(transcripts,null,2));
}
if(results.some(r=>!r.passed)) process.exitCode=1;
