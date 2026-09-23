$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-PackageRoot
$app = Join-Path $root 'APP'
$node = Join-Path $root 'RUNTIME\node\node.exe'
$postgresBin = Find-PostgresBin
if (-not $postgresBin) {
  $installer = Get-ChildItem (Join-Path $root 'RUNTIME\installers') -Filter 'postgresql-*-windows-x64.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($installer) { Write-Host "PostgreSQL ornatilmagan. Avval ushbu installerni ishga tushiring:`n$($installer.FullName)" -ForegroundColor Yellow }
  throw 'PostgreSQL 17 ni ornating va ushbu skriptni qayta ishga tushiring.'
}
if (-not (Test-Path $node)) { throw 'Paketdagi Node runtime topilmadi.' }
if (Test-Path (Join-Path $app '.env')) { throw 'Bu paket avval sozlangan. Mavjud sozlamalar avtomatik almashtirilmadi.' }

$adminUser = Read-Host 'PostgreSQL administrator nomi (odatda postgres)'
if (-not $adminUser) { $adminUser = 'postgres' }
$secureAdminPassword = Read-Host 'PostgreSQL administrator paroli' -AsSecureString
$adminPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAdminPassword)
$adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPtr)
$env:PGPASSWORD = $adminPassword
try {
  & (Join-Path $postgresBin 'pg_isready.exe') -h localhost -p 5432 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL server javob bermadi.' }
  $roleExists = & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U $adminUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='turktili_classroom'"
  $dbExists = & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U $adminUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='turktililms_classroom'"
  if ($roleExists -or $dbExists) { throw 'turktili_classroom roli yoki turktililms_classroom bazasi mavjud. Xavfsizlik uchun hech narsa ozgartirilmadi.' }
  $appPassword = ([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36))).TrimEnd('=').Replace('+','A').Replace('/','B')
  & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U $adminUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE turktili_classroom LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;"
  if ($LASTEXITCODE -ne 0) { throw 'Classroom database roli yaratilmadi.' }
  & (Join-Path $postgresBin 'createdb.exe') -h localhost -p 5432 -U $adminUser -O turktili_classroom -E UTF8 turktililms_classroom
  if ($LASTEXITCODE -ne 0) { throw 'Classroom database yaratilmadi.' }
} finally {
  $env:PGPASSWORD = $null
  $adminPassword = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPtr)
}

$jwt = ([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))).TrimEnd('=')
$databaseUrl = "postgresql://turktili_classroom:$([uri]::EscapeDataString($appPassword))@localhost:5432/turktililms_classroom"
$envLines = @(
  'NODE_ENV=production', 'CLASSROOM_MODE=true', 'CLASSROOM_SELF_REGISTRATION=true', 'HOST=0.0.0.0', 'PORT=5000',
  "DATABASE_URL=$databaseUrl", 'FRONTEND_URL=http://localhost:5000', 'FRONTEND_URLS=http://127.0.0.1:5000',
  "JWT_ACCESS_SECRET=$jwt", 'JWT_ACCESS_EXPIRES_IN=15m', 'REFRESH_TOKEN_EXPIRES_IN=30d',
  'JWT_ISSUER=turktililms-classroom', 'JWT_AUDIENCE=turktililms-classroom-users', 'BCRYPT_ROUNDS=12',
  'AUTH_MAX_FAILED_ATTEMPTS=5', 'AUTH_LOCKOUT_MINUTES=15', 'AUTH_REFRESH_COOKIE_NAME=turk_tili_refresh',
  'AUTH_REFRESH_COOKIE_SECURE=false', 'AUTH_REFRESH_COOKIE_SAME_SITE=lax', 'AUTH_REFRESH_COOKIE_PATH=/api/v1/auth',
  "FRONTEND_STATIC_ROOT=$((Join-Path $app 'public').Replace('\','/'))", "MEDIA_STORAGE_ROOT=$((Join-Path $app 'data/media').Replace('\','/'))",
  "CERTIFICATE_ARTIFACT_STORAGE_ROOT=$((Join-Path $app 'data/certificates').Replace('\','/'))"
)
Set-Content -LiteralPath (Join-Path $app '.env') -Value $envLines -Encoding utf8
New-Item -ItemType Directory -Force -Path (Join-Path $app 'data/media'),(Join-Path $app 'data/certificates') | Out-Null

Set-Location $app
foreach ($line in $envLines) { $name,$value = $line -split '=',2; Set-Item -Path "Env:$name" -Value $value }
& $node 'node_modules/prisma/build/index.js' migrate deploy --schema 'backend/prisma/schema.prisma'
if ($LASTEXITCODE -ne 0) { throw 'Prisma migration bajarilmadi.' }
$env:SEED_DEVELOPMENT_USERS='false'
& $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/seed.ts'
if ($LASTEXITCODE -ne 0) { throw 'Asosiy rollar va ruxsatlar yaratilmadi.' }

$teacherCountText = Read-Host 'Nechta oqituvchi hisobi yaratiladi? (2 yoki 3; standart 2)'
$teacherCount = if ($teacherCountText -eq '3') { 3 } else { 2 }
$contentTeacherEmail = $null
for ($index=1; $index -le $teacherCount; $index++) {
  $env:BOOTSTRAP_TEACHER_FIRST_NAME = Read-Host "$index-oqituvchi ismi"
  $env:BOOTSTRAP_TEACHER_LAST_NAME = Read-Host "$index-oqituvchi familiyasi"
  $env:BOOTSTRAP_TEACHER_EMAIL = (Read-Host "$index-oqituvchi emaili").Trim().ToLowerInvariant()
  $securePassword = Read-Host "$index-oqituvchi paroli" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try { $env:BOOTSTRAP_TEACHER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); & $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/bootstrap-teacher.ts' }
  finally { $env:BOOTSTRAP_TEACHER_PASSWORD=$null; [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($LASTEXITCODE -ne 0) { throw "$index-oqituvchi yaratilmadi." }
  if (-not $contentTeacherEmail) { $contentTeacherEmail = $env:BOOTSTRAP_TEACHER_EMAIL }
}
$env:A1_CONTENT_TEACHER_EMAIL=$contentTeacherEmail
$env:A2_CONTENT_TEACHER_EMAIL=$contentTeacherEmail
& $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/seed-a1-content.ts'; if($LASTEXITCODE -ne 0){throw 'A1 import qilinmadi.'}
& $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/seed-a2-content.ts'; if($LASTEXITCODE -ne 0){throw 'A2 import qilinmadi.'}
$env:A1_VOCABULARY_SOURCE=Join-Path $root 'DATABASE\VOCABULARY\A1_Lugatlar.html'
$env:A2_VOCABULARY_SOURCE=Join-Path $root 'DATABASE\VOCABULARY\A2_Lugatlar.html'
& $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/seed-vocabulary.ts'; if($LASTEXITCODE -ne 0){throw 'A1/A2 lugat import qilinmadi.'}
foreach($level in @('A1','A2')) { $env:LEVEL_FINAL_EXAM_LEVEL=$level; & $node 'node_modules/tsx/dist/cli.mjs' 'backend/prisma/seed-level-final-exams.ts'; if($LASTEXITCODE -ne 0){throw "$level yakuniy imtihoni yaratilmadi."} }

Write-Host 'Birinchi sozlash muvaffaqiyatli yakunlandi.' -ForegroundColor Green
Write-Host 'Ixtiyoriy: ALLOW-PRIVATE-FIREWALL.ps1 ni Administrator sifatida ishga tushiring.'
& (Join-Path $PSScriptRoot 'START-TURKTILILMS.ps1')
