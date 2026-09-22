// Backups include password hashes: encrypt before writing any archive to disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(args,input)=>execFileSync('docker',['compose','exec','-T','postgres',...args],{cwd:root,input,maxBuffer:64*1024*1024});
const key=fs.readFileSync(path.join(root,'.secrets/backup-key'));
const file=process.argv[3] || path.join(root,'.backups/birthday-backup.aesgcm');
if(process.argv[2]==='create') {
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(process.platform==='win32') execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'deployment/protect-secrets.ps1')],{windowsHide:true});
  const dump=run(['pg_dump','-U','birthday_admin','-d','thebirthdates','-Fc','--no-owner','--no-acl','--exclude-table=sessions']);
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(dump),cipher.final()]);
  fs.writeFileSync(file,Buffer.concat([Buffer.from('BM01'),iv,cipher.getAuthTag(),encrypted]),{mode:0o600});
  console.log(JSON.stringify({backup:file,bytes:encrypted.length,algorithm:'AES-256-GCM',sha256:createHash('sha256').update(encrypted).digest('hex')}));
} else if(process.argv[2]==='verify-restore') {
  const data=fs.readFileSync(file);
  if(data.subarray(0,4).toString()!=='BM01') throw new Error('Unsupported archive');
  const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(4,16)); cipher.setAuthTag(data.subarray(16,32));
  const dump=Buffer.concat([cipher.update(data.subarray(32)),cipher.final()]);
  // Fixed separate restore database, never overwrite the application database.
  run(['createdb','-U','birthday_admin','birthday_restore_check']);
  try {
    run(['pg_restore','-U','birthday_admin','-d','birthday_restore_check','--no-owner','--no-acl','--exit-on-error'],dump);
    const query=['birthdays','audit_events','users'].map(t=>`SELECT '${t}',count(*),md5(COALESCE(json_agg(t ORDER BY id)::text,'[]')) FROM ${t} t`).join(' UNION ALL ')+' ORDER BY 1';
    const live=run(['psql','-U','birthday_admin','-d','thebirthdates','-Atc',query]).toString();
    const restored=run(['psql','-U','birthday_admin','-d','birthday_restore_check','-Atc',query]).toString();
    if(live!==restored) throw new Error('Restored row counts differ; ensure no writes during this check');
    console.log(JSON.stringify({restoredTo:'birthday_restore_check',countsAndContentChecksums:restored.trim().split('\n'),matched:true,checkedAt:new Date().toISOString()}));
  } finally { run(['dropdb','-U','birthday_admin','birthday_restore_check']); }
} else throw new Error('Usage: node deployment/backup.mjs create|verify-restore [archive]');
