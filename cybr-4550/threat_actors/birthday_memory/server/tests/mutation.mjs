// Deliberately weaken only a temporary source copy, never the running app.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
fs.mkdirSync('/tmp/mutant',{recursive:true});
fs.cpSync('/app/server/src','/tmp/mutant/src',{recursive:true});
fs.writeFileSync('/tmp/mutant/package.json','{"type":"module"}');
fs.symlinkSync('/app/server/node_modules','/tmp/mutant/node_modules');
const file='/tmp/mutant/src/routes.js', original=fs.readFileSync(file,'utf8');
const changed=original.replace('SELECT * FROM birthdays WHERE owner_id=$1','SELECT * FROM birthdays WHERE $1::int IS NOT NULL');
if(changed===original) throw new Error('Mutation target changed; update this check');
fs.writeFileSync(file,changed);
const result=spawnSync(process.execPath,['/tests/security.mjs'],{env:{...process.env,APP_SOURCE:'/tmp/mutant/src',EVIDENCE_DIR:'/evidence/mutation'},encoding:'utf8'});
const report=JSON.parse(fs.readFileSync('/evidence/mutation/security-tests.json','utf8'));
const isolation=report.results.find(r=>r.name==='Other user cannot list, change or delete owner record');
const detected=result.status!==0 && isolation?.passed===false;
fs.writeFileSync('/evidence/mutation-summary.json',JSON.stringify({capturedAt:new Date().toISOString(),
  mutation:'Removed ownership predicate from SELECT list in a temporary copy',expectedTestFailure:true,
  childExitCode:result.status,detected,failedTests:report.results.filter(r=>!r.passed).map(r=>r.name)},null,2));
console.log(detected?'PASS: ownership regression test detected intentionally removed authorization':'FAIL: mutation escaped detection');
if(!detected) process.exitCode=1;
