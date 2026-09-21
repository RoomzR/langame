$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = ".." }
$out = Join-Path $PSScriptRoot "dist"
New-Item -ItemType Directory -Force -Path $out, "$out\agent", "$out\guest", "$out\admin" | Out-Null

dotnet publish (Join-Path $PSScriptRoot "Rudemir.Agent.csproj") -c Release -r win-x64 --self-contained true -o "$out\agent"
dotnet publish (Join-Path $root "windows-guest-client\Rudemir.GuestClient.csproj") -c Release -r win-x64 --self-contained true -o "$out\guest"
dotnet publish (Join-Path $root "windows-admin-console\Rudemir.AdminConsole.csproj") -c Release -r win-x64 --self-contained true -o "$out\admin"

Write-Host "Пакеты: $out"
Write-Host "Игровой ПК:  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Package AgentGuest -ApiBase http://API:3000"
Write-Host "Стойка:      powershell -ExecutionPolicy Bypass -File .\install.ps1 -Package Admin -ApiBase http://API:3000"
