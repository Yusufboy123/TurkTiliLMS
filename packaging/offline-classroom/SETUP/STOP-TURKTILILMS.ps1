$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$pidFile = Join-Path (Get-PackageRoot) 'APP\turktililms.pid'
if (-not (Test-Path $pidFile)) { Write-Host 'TurkTiliLMS ishlamayapti.'; exit 0 }
$serverPid = Get-Content $pidFile | Select-Object -First 1
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $serverPid; $process.WaitForExit(10000) }
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'TurkTiliLMS toxtatildi.' -ForegroundColor Green
