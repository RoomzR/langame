#Requires -RunAsAdministrator
param(
  [string]$Source = $PSScriptRoot,
  [string]$ApiBase = "http://localhost:3000",
  [ValidateSet("AgentGuest", "Admin")]
  [string]$Package = "AgentGuest"
)

$ErrorActionPreference = "Stop"
$root = "C:\Program Files\Rudemir"
$data = "C:\ProgramData\Rudemir"

function Set-AclSafe([string]$Path, [string]$Identity, [string]$Rights) {
  $acl = Get-Acl $Path
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($Identity, $Rights, "ContainerInherit,ObjectInherit", "None", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -Path $Path -AclObject $acl
}

New-Item -ItemType Directory -Force -Path $root, $data, "$data\logs", "$data\session" | Out-Null
Set-AclSafe $data "NT AUTHORITY\SYSTEM" "FullControl"
Set-AclSafe $data "BUILTIN\Administrators" "FullControl"
try { Set-AclSafe $data "NT AUTHORITY\NETWORK SERVICE" "Modify" } catch { }

if ($Package -eq "Admin") {
  $dest = Join-Path $root "Admin"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $src = Join-Path $Source "dist\admin"
  if (-not (Test-Path $src)) { $src = Join-Path $Source "..\windows-admin-console\bin\Release\net8.0-windows\win-x64\publish" }
  Copy-Item -Path (Join-Path $src "*") -Destination $dest -Recurse -Force
  $cfg = Join-Path $dest "appsettings.json"
  if ($ApiBase) { Set-Content -Path $cfg -Value (@{ ApiBase = $ApiBase } | ConvertTo-Json) -Encoding UTF8 }
  Write-Host "Admin Console: $dest\Rudemir.AdminConsole.exe"
  return
}

$agentDest = Join-Path $root "Agent"
$guestDest = Join-Path $root "Guest"
New-Item -ItemType Directory -Force -Path $agentDest, $guestDest | Out-Null

$agentSrc = Join-Path $Source "dist\agent"
if (-not (Test-Path $agentSrc)) { $agentSrc = Join-Path $Source "bin\Release\net8.0-windows\win-x64\publish" }
$guestSrc = Join-Path $Source "dist\guest"
if (-not (Test-Path $guestSrc)) { $guestSrc = Join-Path $Source "..\windows-guest-client\bin\Release\net8.0-windows\win-x64\publish" }

Copy-Item -Path (Join-Path $agentSrc "*") -Destination $agentDest -Recurse -Force
if (Test-Path $guestSrc) {
  Copy-Item -Path (Join-Path $guestSrc "*") -Destination $guestDest -Recurse -Force
}

$agentJson = Join-Path $data "agent.json"
if (-not (Test-Path $agentJson)) {
  @{ ApiBase = $ApiBase; ClubId = ""; SeatId = ""; AgentToken = ""; Channel = "stable"; Version = "1.0.0" } |
    ConvertTo-Json | Set-Content -Path $agentJson -Encoding UTF8
}

$exe = Join-Path $agentDest "Rudemir.Agent.exe"
$svc = Get-Service -Name RudemirAgent -ErrorAction SilentlyContinue
if ($svc) {
  Stop-Service RudemirAgent -Force -ErrorAction SilentlyContinue
  sc.exe delete RudemirAgent | Out-Null
  Start-Sleep -Seconds 1
}
sc.exe create RudemirAgent binPath= "`"$exe`"" start= auto DisplayName= "RUDEMIR Agent" | Out-Null
sc.exe description RudemirAgent "Системный агент места RUDEMIR: heartbeat, hosts, политика, reboot" | Out-Null
sc.exe failure RudemirAgent reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Start-Service RudemirAgent

Write-Host "Агент: $exe"
Write-Host "Привязка: `"$exe`" pair --api $ApiBase --club <clubId> --seat <seatId> --code <CODE>"
Write-Host "Конфиг: $agentJson"
