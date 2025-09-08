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

# 環境読み込み
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^(\s*#|\s*$)') { return }
    $k,$v = $_.Split('=',2)
    if ($k -and $v) { [System.Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim()) }
  }
}

# 既定: LLM_PROVIDER=cursor
if (-not $env:LLM_PROVIDER -or $env:LLM_PROVIDER -eq '') {
  Add-Content -Path .env -Value "LLM_PROVIDER=cursor"
  $env:LLM_PROVIDER = 'cursor'
}

# Cursor CLI ログイン試行（未ログイン/キー未設定時）
if ($env:LLM_PROVIDER -eq 'cursor' -and (-not $env:CURSOR_API_KEY -or $env:CURSOR_API_KEY -eq '')) {
  $candidates = @('cursor','cursor-cli','cursor-agent')
  foreach ($c in $candidates) {
    $path = (Get-Command $c -ErrorAction SilentlyContinue)
    if ($path) {
      Write-Host "Cursor CLI ($c) にログインを試行します（キャンセル可）" -ForegroundColor Yellow
      try { & $c login } catch { }
      break
    }
  }
  # 再読込
  if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
      if ($_ -match '^(\s*#|\s*$)') { return }
      $k,$v = $_.Split('=',2)
      if ($k -and $v) { [System.Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim()) }
    }
  }
  if (-not $env:CURSOR_API_KEY -or $env:CURSOR_API_KEY -eq '') {
    $key = Read-Host -Prompt 'CURSOR_API_KEY を入力してください'
    Add-Content -Path .env -Value "CURSOR_API_KEY=$key"
    $env:CURSOR_API_KEY = $key
  }
}

Write-Host "Launching relay..."
try {
  # GOゲート自動判定
  $RequireFlag = @()
  if (Test-Path dialogue/GO.txt) {
    $go = (Get-Content dialogue/GO.txt -Raw).Trim()
    if ($go -eq 'GO') { $RequireFlag = @('-RequireGo') }
  }
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/relay.ps1 -Rounds $Rounds @($RequireFlag) @($StopOnClean ? "-StopOnClean" : $null)
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
