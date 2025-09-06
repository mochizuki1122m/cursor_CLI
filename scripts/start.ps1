param([switch]$RequireGo=$true,[int]$Rounds=3,[switch]$StopOnClean)

Write-Host "Setting up environment..."
if (-not (Test-Path .env)) {
  if (Test-Path .env.example) { Copy-Item .env.example .env }
}

if (-not (Test-Path node_modules)) { npm install | Out-Null }
if (-not (Test-Path requirements.txt)) {
  Write-Host "requirements.txt not found, skipping pip install"
} else {
  try { pip --version | Out-Null; pip install -r requirements.txt | Out-Null } catch { }
}

New-Item -ItemType Directory -Force -Path patches,review/reports,audit,dialogue | Out-Null
if (-not (Test-Path dialogue/GO.txt)) { "HOLD" | Out-File -FilePath dialogue/GO.txt -Encoding utf8 }

Write-Host "Launching relay..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/relay.ps1 -Rounds $Rounds @($RequireGo ? "-RequireGo" : $null) @($StopOnClean ? "-StopOnClean" : $null)
