#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

log_file="logs/start-relay.log"
mkdir -p logs || true

# UI server (best-effort)
UI_PORT=${UI_PORT:-34100}
if [ -z "${DISABLE_LOCAL_UI:-}" ]; then
  (node scripts/ui_server.mjs >/dev/null 2>&1 &) || true
  echo "Local UI: http://localhost:${UI_PORT}" | tee -a "$log_file"
  # 既定ブラウザで自動表示（best-effort）
  if command -v open >/dev/null 2>&1; then
    (open "http://localhost:${UI_PORT}" >/dev/null 2>&1 &) || true
  elif command -v xdg-open >/dev/null 2>&1; then
    (xdg-open "http://localhost:${UI_PORT}" >/dev/null 2>&1 &) || true
  fi
fi

if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi

# 認証補助: .env を取り込み、必要ならキー入力を促す
if [ -f .env ]; then
  set +u
  set -a; . ./.env; set +a
  set -u
fi

# LLM_PROVIDER が未設定なら cursor にセット
if [ "${LLM_PROVIDER:-}" = "" ]; then
  echo "LLM_PROVIDER=cursor" >> .env
  export LLM_PROVIDER=cursor
fi

# CURSOR_API_KEY が未設定なら、CLIログインを試行→未取得なら手入力を促す
if [ "${LLM_PROVIDER:-}" = "cursor" ] && [ "${CURSOR_API_KEY:-}" = "" ]; then
  for c in cursor cursor-cli cursor-agent; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "Cursor CLI($c)にログインを試行します（キャンセル可）。" | tee -a "$log_file"
      "$c" login || true
      break
    fi
  done
  # 再読み込み（CLIが環境変数を設定する場合に備え）
  if [ -f .env ]; then set -a; . ./.env; set +a; fi
  # 自動取得（有効時）または手動入力
  if [ "${AUTO_FETCH_CURSOR_KEY:-false}" = "true" ]; then
    mkdir -p .cache || true
    fetch_cmd=${CURSOR_KEY_FETCH_CMD:-"cursor auth token"}
    now_ts=$(date +%s)
    last_ts_file=.cache/cursor_key_fetched_at
    last_ts=0
    [ -f "$last_ts_file" ] && last_ts=$(cat "$last_ts_file" 2>/dev/null || echo 0)
    interval_hours=${CURSOR_KEY_FETCH_INTERVAL_HOURS:-24}
    interval_sec=$((interval_hours * 3600))
    should_fetch=true
    if [ -n "${CURSOR_API_KEY:-}" ] && [ $((now_ts - last_ts)) -lt $interval_sec ]; then
      should_fetch=false
      echo "key fetch skipped (within interval)" >> "$log_file"
    fi
    if $should_fetch; then
      if eval "$fetch_cmd" > .cache/cursor_key.txt 2>>"$log_file"; then
        CURSOR_API_KEY=$(cat .cache/cursor_key.txt | tr -d '\r\n')
        if [ -n "$CURSOR_API_KEY" ]; then
          printf "\nCURSOR_API_KEY=%s\n" "$CURSOR_API_KEY" >> .env
          date +%s > "$last_ts_file"
          printf "provider=cursor\ncmd=%s\n" "$fetch_cmd" > .cache/cursor_key_meta.env
          export CURSOR_API_KEY
        fi
      fi
    fi
  fi
  if [ "${CURSOR_API_KEY:-}" = "" ]; then
    echo "CURSOR_API_KEY を入力してください（貼り付け、Enterで確定）:" >&2
    read -r CURSOR_API_KEY
    # .env に追記（既存行があっても末尾行が有効になる想定）
    printf "\nCURSOR_API_KEY=%s\n" "$CURSOR_API_KEY" >> .env
    export CURSOR_API_KEY
  fi
fi


if [ ! -d node_modules ]; then npm install; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt || true; fi

mkdir -p patches review/reports audit dialogue
if [ ! -f dialogue/GO.txt ]; then echo HOLD > dialogue/GO.txt; fi

{
  bash scripts/relay.sh --rounds 3 --require-go --stop-on-clean
} 2> >(tee -a "$log_file" >&2)

echo "OK"
exit 0
