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
try {
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/relay.ps1 -Rounds $Rounds @($RequireGo ? "-RequireGo" : $null) @($StopOnClean ? "-StopOnClean" : $null)
} catch {
  Write-Host "[start.ps1] エラー発生。relayログの一部を表示します" -ForegroundColor Red
  if (Test-Path review/reports/verify_ir.json) {
    Write-Host "== review/reports/verify_ir.json =="
    Get-Content review/reports/verify_ir.json -First 200 | Out-Host
  }
  if (Test-Path patches/patch_ir.json) {
    Write-Host "== patches/patch_ir.json =="
    Get-Content patches/patch_ir.json -First 200 | Out-Host
  }
  if (Test-Path logs) {
    Get-ChildItem logs -File | ForEach-Object {
      Write-Host "== $($_.FullName) =="
      Get-Content $_.FullName -Tail 200 | Out-Host
    }
  }
  throw
}
