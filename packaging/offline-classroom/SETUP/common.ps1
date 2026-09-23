function Get-PackageRoot { Split-Path -Parent $PSScriptRoot }

function Get-ClassroomIp {
  $candidate = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1
  if ($candidate) { return $candidate.IPAddress }
  return '127.0.0.1'
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $replacement = "$Name=$Value"
  $found = $false
  $next = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Name))=") { $found = $true; $replacement } else { $line }
  }
  if (-not $found) { $next += $replacement }
  Set-Content -LiteralPath $Path -Value $next -Encoding utf8
}

function Test-TurkTiliHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/api/v1/health' -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch { return $false }
}

function Find-PostgresBin {
  $psql = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($psql) { return Split-Path -Parent $psql.Source }
  $directory = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' } |
    Where-Object { Test-Path (Join-Path $_ 'psql.exe') } | Select-Object -First 1
  return $directory
}
