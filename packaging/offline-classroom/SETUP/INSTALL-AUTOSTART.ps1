$ErrorActionPreference='Stop'
$start = Join-Path $PSScriptRoot 'START-TURKTILILMS.cmd'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$start`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'TurkTiliLMS-Classroom' -Action $action -Trigger $trigger -Principal $principal -Description 'TurkTiliLMS classroom serverini foydalanuvchi kirganda ishga tushiradi.' -Force | Out-Null
Write-Host 'Avtomatik ishga tushirish yoqildi.' -ForegroundColor Green
