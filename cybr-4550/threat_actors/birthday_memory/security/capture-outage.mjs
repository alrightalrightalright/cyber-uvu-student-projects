// Run from the project directory against the owned loopback lab only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const records=[];
async function capture(phase) {
  const response=await fetch('http://127.0.0.1:4000/api/health');
  const text=await response.text();
  records.push({phase,at:new Date().toISOString(),request:'GET http://127.0.0.1:4000/api/health',status:response.status,headers:Object.fromEntries(response.headers),body:text});
  return {status:response.status,data:JSON.parse(text)};
}
assert.equal((await capture('before outage')).status,200);
try {
  execFileSync('docker',['compose','stop','postgres'],{stdio:'pipe'});
  const result=await capture('database stopped');
  assert.equal(result.status,503); assert.deepEqual(result.data,{status:'unavailable'});
} finally {
  execFileSync('docker',['compose','start','postgres'],{stdio:'pipe'});
  let recovered=false;
  for(let i=0;i<30;i++) {
    await new Promise(resolve=>setTimeout(resolve,1000));
    if((await capture('recovery probe')).status===200) {recovered=true;break;}
  }
  fs.writeFileSync('security/evidence/after/health-db-offline.json',JSON.stringify({capturedAt:new Date().toISOString(),condition:'Real local database container stopped; app not restarted',recovered,records},null,2));
  assert.ok(recovered,'App must recover without restart');
}
console.log('Real database outage: generic 503; recovery: 200 without app restart.');
