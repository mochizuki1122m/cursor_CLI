#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

log_file="logs/start-relay.log"
mkdir -p logs || true

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
  if [ "${CURSOR_API_KEY:-}" = "" ]; then
    echo "CURSOR_API_KEY を入力してください（貼り付け、Enterで確定）:" >&2
    read -r CURSOR_API_KEY
    # .env に追記（既存行があっても末尾行が有効になる想定）
    printf "\nCURSOR_API_KEY=%s\n" "$CURSOR_API_KEY" >> .env
    export CURSOR_API_KEY
  fi
fi

# GOゲート: GOが設定されているときのみ --require-go を付与
REQUIRE_GO_FLAG=""
if [ -f dialogue/GO.txt ]; then
  GO_VAL=$(tr -d $'\r\n' < dialogue/GO.txt)
  if [ "$GO_VAL" = "GO" ]; then
    REQUIRE_GO_FLAG="--require-go"
  fi
fi

if [ ! -d node_modules ]; then npm install; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt || true; fi

mkdir -p patches review/reports audit dialogue
if [ ! -f dialogue/GO.txt ]; then echo HOLD > dialogue/GO.txt; fi

{
  bash scripts/relay.sh --rounds 3 $REQUIRE_GO_FLAG --stop-on-clean
} 2> >(tee -a "$log_file" >&2)

echo "OK"
exit 0
