import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const gitRoot=git(['rev-parse','--show-toplevel']).toString().trim();
const scope=path.relative(gitRoot,root).replaceAll('\\','/');
const dir=path.join(root,'.secrets');
const patterns=['db-app-password','db-admin-password','session-secret'].map(n=>fs.readFileSync(path.join(dir,n),'utf8').trim());
patterns.push(...JSON.parse(fs.readFileSync(path.join(dir,'demo-users.json'),'utf8')).map(u=>u.password));
for(const name of ['ca.key','server.key']) patterns.push(...fs.readFileSync(path.join(dir,name),'utf8').split(/\r?\n/).filter(s=>s.length>=60));
const leaks=[], defaults=[];
const backupKey=fs.readFileSync(path.join(dir,'backup-key'));
patterns.push(backupKey.toString('hex'),backupKey.toString('base64'));
const check=(buffer,label)=>{const text=buffer.toString();if(buffer.includes(backupKey)||patterns.some(p=>text.includes(p)))leaks.push(label);};
const files=git(['ls-files','--cached','--others','--exclude-standard','-z','.']).toString().split('\0').filter(Boolean);
for(const file of files) if(fs.existsSync(path.join(root,file))) check(fs.readFileSync(path.join(root,file)),`working:${file}`);
const commits=git(['-C',gitRoot,'rev-list','--all','--',scope]).toString().trim().split('\n').filter(Boolean);
if(!commits.length) throw new Error('No scoped history found; refusing a vacuous history scan');
const seen=new Set();
for(const commit of commits) {
  const rows=git(['-C',gitRoot,'ls-tree','-r',commit,'--',scope]).toString().trim().split('\n').filter(Boolean);
  for(const row of rows) {
    const [meta,file]=row.split('\t'), sha=meta.split(' ')[2];
    if(seen.has(sha))continue; seen.add(sha);
    const buffer=git(['cat-file','blob',sha]); check(buffer,`${commit}:${file}`);
    if(/(?:POSTGRES_PASSWORD:\s*birthday|PGPASSWORD=birthday)/.test(buffer.toString())) defaults.push({commit,file,kind:'historical disposable default'});
  }
}
const report={checkedAt:new Date().toISOString(),scope,historyCommits:commits.length,uniqueBlobs:seen.size,
  workingFiles:files.length,activeSecretMatches:leaks,knownHistoricalDefaults:defaults,
  limitations:'Exact generated credential and private-key-content scan, not a universal secret detector. Historical public example defaults retained and not active in hardened deployment.'};
fs.writeFileSync(path.join(root,'security/evidence/after/secret-history-check.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({activeSecretMatches:leaks.length,historyCommits:commits.length,uniqueBlobs:seen.size,historicalDefaultFiles:defaults.length}));
if(leaks.length)process.exitCode=1;
