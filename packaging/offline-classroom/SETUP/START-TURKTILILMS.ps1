$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-PackageRoot
$app = Join-Path $root 'APP'
$envFile = Join-Path $app '.env'
$node = Join-Path $root 'RUNTIME\node\node.exe'
$pidFile = Join-Path $app 'turktililms.pid'
$logDir = Join-Path $app 'logs'

if (-not (Test-Path $envFile)) { throw 'Avval FIRST-TIME-SETUP.cmd ni ishga tushiring.' }
if (-not (Test-Path $node)) { throw 'Paketdagi Node runtime topilmadi.' }
$ip = Get-ClassroomIp
Set-EnvValue $envFile 'FRONTEND_URL' 'http://localhost:5000'
Set-EnvValue $envFile 'FRONTEND_URLS' "http://127.0.0.1:5000,http://$ip`:5000"

if (Test-TurkTiliHealth) {
  Write-Host "TurkTiliLMS ishlayapti: http://$ip`:5000" -ForegroundColor Green
  Start-Process 'http://localhost:5000'
  exit 0
}

if (Test-Path $pidFile) {
  $oldPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    throw "Server jarayoni bor, ammo health tekshiruvi otmadi. PID: $oldPid"
  }
  Remove-Item $pidFile -Force
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$process = Start-Process -FilePath $node -ArgumentList 'backend/dist/server.js' -WorkingDirectory $app -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  if (Test-TurkTiliHealth) {
    Write-Host "TurkTiliLMS tayyor: http://$ip`:5000" -ForegroundColor Green
    Start-Process 'http://localhost:5000'
    exit 0
  }
  if ($process.HasExited) { break }
}
throw "Server ishga tushmadi. APP\logs\server-error.log faylini tekshiring."
