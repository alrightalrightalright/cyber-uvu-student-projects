$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
foreach ($name in @('.secrets', '.backups')) {
    $folder = Join-Path $projectRoot $name
    if (-not (Test-Path -LiteralPath $folder)) { continue }
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($owner)
    foreach ($sid in @($owner.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
            [System.Security.Principal.SecurityIdentifier]::new($sid), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    }
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [System.IO.Directory]::SetAccessControl($folder, $acl)
    } else {
        Set-Acl -LiteralPath $folder -AclObject $acl
    }
}
