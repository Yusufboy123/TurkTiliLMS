# Administrator sifatida ishga tushiring. Faqat Private tarmoq va TCP 5000 porti ochiladi.
$ErrorActionPreference='Stop'
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Bu skriptni Administrator sifatida ishga tushiring.' }
Get-NetFirewallRule -DisplayName 'TurkTiliLMS Classroom 5000' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'TurkTiliLMS Classroom 5000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000 -Profile Private | Out-Null
Write-Host 'Private tarmoq uchun 5000-portga ruxsat berildi.' -ForegroundColor Green
