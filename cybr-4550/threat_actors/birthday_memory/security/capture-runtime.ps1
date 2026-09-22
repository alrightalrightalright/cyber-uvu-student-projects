$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$out = Join-Path $PSScriptRoot 'evidence/after'
$containers = @()
foreach ($service in @('app','postgres')) {
    $id = docker compose ps -q $service
    $item = (docker inspect $id | ConvertFrom-Json)[0]
    $containers += [ordered]@{
        service=$service; image=$item.Image; user=$item.Config.User; health=$item.State.Health.Status
        readOnly=$item.HostConfig.ReadonlyRootfs; capDrop=$item.HostConfig.CapDrop
        securityOptions=$item.HostConfig.SecurityOpt; memoryBytes=$item.HostConfig.Memory
        nanoCpus=$item.HostConfig.NanoCpus; pidsLimit=$item.HostConfig.PidsLimit
        portBindings=$item.HostConfig.PortBindings; networks=$item.NetworkSettings.Networks.PSObject.Properties.Name
        identity=(docker compose exec -T $service id)
    }
}
[ordered]@{capturedAt=(Get-Date).ToUniversalTime().ToString('o'); containers=$containers} | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $out 'runtime-posture.json')
docker compose exec -T app node -e "const fs=require('fs');try{fs.writeFileSync('/app/forbidden-test','x');process.exit(1)}catch(e){console.log(JSON.stringify({writeDenied:e.code==='EROFS',code:e.code}));if(e.code!=='EROFS')process.exit(1)}" | Set-Content (Join-Path $out 'read-only-proof.json')
docker compose exec -T postgres psql -U birthday_admin -d thebirthdates -c "SELECT id,actor_id,action,target_id,occurred_at,request_id FROM audit_events WHERE target_id=1 ORDER BY id;" | Set-Content (Join-Path $out 'audit-before-restart.txt')
docker compose restart postgres | Out-Null
for ($attempt=0; $attempt -lt 30; $attempt++) {
    docker compose exec -T postgres pg_isready -U birthday_admin -d thebirthdates | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
}
docker compose exec -T postgres psql -U birthday_admin -d thebirthdates -c "SELECT id,actor_id,action,target_id,occurred_at,request_id FROM audit_events WHERE target_id=1 ORDER BY id;" | Set-Content (Join-Path $out 'audit-after-restart.txt')
if ((Get-Content (Join-Path $out 'audit-before-restart.txt') -Raw) -ne (Get-Content (Join-Path $out 'audit-after-restart.txt') -Raw)) { throw 'Audit changed across restart' }
$recovered = $false
for ($attempt=0; $attempt -lt 15; $attempt++) {
    try { $health = Invoke-RestMethod 'http://127.0.0.1:4000/api/health'; $recovered = $health.status -eq 'ok' } catch {}
    if ($recovered) { break }
    Start-Sleep -Seconds 1
}
if (-not $recovered) { throw 'App failed to reconnect after database restart' }
[ordered]@{capturedAt=(Get-Date).ToUniversalTime().ToString('o');auditPersisted=$true;appRecoveredWithoutRestart=$true} | ConvertTo-Json | Set-Content (Join-Path $out 'audit-persistence.json')
