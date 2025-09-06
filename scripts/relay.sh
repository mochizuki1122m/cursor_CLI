#!/usr/bin/env bash
set -euo pipefail

ROUNDS=3
REQUIRE_GO=false
STOP_ON_CLEAN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--rounds) ROUNDS="$2"; shift 2 ;;
    --require-go) REQUIRE_GO=true; shift ;;
    --stop-on-clean) STOP_ON_CLEAN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

mkdir -p patches review/reports audit schema dialogue

if $REQUIRE_GO; then
  if [[ ! -f dialogue/GO.txt ]]; then
    echo "dialogue/GO.txt がありません" >&2; exit 1
  fi
  if [[ "$(tr -d $'\r\n' < dialogue/GO.txt)" != "GO" ]]; then
    echo "GO承認が必要です" >&2; exit 1
  fi
fi

for ((i=1; i<=ROUNDS; i++)); do
  node scripts/run_implementer.mjs \
    | node scripts/validate_json.mjs schema/patch_ir.schema.json \
    > patches/patch_ir.json

  cat patches/patch_ir.json \
    | node scripts/run_critic.mjs \
    | node scripts/validate_json.mjs schema/verify_ir.schema.json \
    > review/reports/verify_ir.json

  node scripts/audit_append.mjs review/reports/verify_ir.json

  CLEAN=$(node -e "const fs=require('fs');const v=JSON.parse(fs.readFileSync('review/reports/verify_ir.json','utf8'));process.stdout.write(String(v.build.ok&&v.tests.ok&&v.static.ok));")
  if $STOP_ON_CLEAN && [[ "$CLEAN" == "true" ]]; then
    break
  fi
done
