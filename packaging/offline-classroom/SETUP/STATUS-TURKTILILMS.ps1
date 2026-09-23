. (Join-Path $PSScriptRoot 'common.ps1')
$ip = Get-ClassroomIp
if (Test-TurkTiliHealth) {
  Write-Host 'Holat: ISHLAYAPTI' -ForegroundColor Green
  Write-Host "Talabalar uchun manzil: http://$ip`:5000"
} else {
  Write-Host 'Holat: TOXTAGAN' -ForegroundColor Yellow
  Write-Host 'START-TURKTILILMS.cmd ni ishga tushiring.'
}
