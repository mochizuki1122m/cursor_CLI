param([int]$Rounds=3,[switch]$RequireGo,[switch]$StopOnClean)
if ($RequireGo) {
  if (-not (Test-Path dialogue/GO.txt)) { throw "GO.txt がありません" }
  if ((Get-Content dialogue/GO.txt -Raw).Trim() -ne "GO") { throw "GO承認が必要" }
}
New-Item -ItemType Directory -Force -Path patches,review/reports,audit,dialogue | Out-Null
for ($i=1; $i -le $Rounds; $i++) {
  node scripts/run_implementer.mjs |
    node scripts/validate_json.mjs schema/patch_ir.schema.json |
    Out-File -FilePath patches/patch_ir.json -Encoding utf8

  Get-Content patches/patch_ir.json -Raw |
    node scripts/run_critic.mjs |
    node scripts/validate_json.mjs schema/verify_ir.schema.json |
    Out-File -FilePath review/reports/verify_ir.json -Encoding utf8

  node scripts/audit_append.mjs review/reports/verify_ir.json

  $v = ConvertFrom-Json (Get-Content review/reports/verify_ir.json -Raw)
  $clean = ($v.build.ok -and $v.tests.ok -and $v.static.ok)
  if ($clean) {
    node scripts/analyze_patch_ir.mjs | Out-Null
    node scripts/apply_patch_ir.mjs | Out-Null
    node scripts/make_scorecard.mjs | Out-Null
    if ($StopOnClean) { break }
  }
}
