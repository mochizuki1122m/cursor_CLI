#!/usr/bin/env bash
set -euo pipefail

print_error_context() {
  echo "[relay.sh] エラー発生。関連ログを表示します" >&2
  if [[ -f review/reports/verify_ir.json ]]; then
    echo "== review/reports/verify_ir.json ==" >&2
    sed -n '1,200p' review/reports/verify_ir.json >&2 || true
  fi
  if [[ -f patches/patch_ir.json ]]; then
    echo "== patches/patch_ir.json ==" >&2
    sed -n '1,200p' patches/patch_ir.json >&2 || true
  fi
  if compgen -G "logs/*" > /dev/null; then
    for f in logs/*; do
      [ -f "$f" ] || continue
      echo "== $f ==" >&2
      tail -n 200 "$f" >&2 || true
    done
  fi
}

# エラー／非ゼロ終了時にログを出す
trap 'st=$?; if [[ $st -ne 0 ]]; then print_error_context; fi' EXIT

# .env を取り込み（存在する場合）
if [[ -f .env ]]; then
  # 安全に .env を読み込む（コメント/空行を除外し、キー=値のみを export）
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      # 先頭/末尾の空白を除去
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      export "$key"="$val"
    fi
  done < .env
fi

# UI server を可能なら自動起動（Linux/CIでも邪魔にならないようバックグラウンド）
if [[ -z "${DISABLE_LOCAL_UI:-}" ]]; then
  UI_PORT=${UI_PORT:-34100}
  (node scripts/ui_server.mjs >/dev/null 2>&1 &) || true
  echo "Local UI: http://localhost:${UI_PORT}" >&2
  if command -v xdg-open >/dev/null 2>&1; then
    (xdg-open "http://localhost:${UI_PORT}" >/dev/null 2>&1 &) || true
  elif command -v gio >/dev/null 2>&1; then
    (gio open "http://localhost:${UI_PORT}" >/dev/null 2>&1 &) || true
  fi
fi

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

  # Try to apply patch when verify suggests ok build (example policy; can be adjusted)
  if [[ "$CLEAN" == "true" ]]; then
    node scripts/analyze_patch_ir.mjs || true
    node scripts/apply_patch_ir.mjs || true
    node scripts/make_scorecard.mjs || true
  fi
done
