#!/bin/bash
cd "$(dirname "$0")"

if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi

if [ ! -d node_modules ]; then npm install; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt || true; fi

mkdir -p patches review/reports audit dialogue
if [ ! -f dialogue/GO.txt ]; then echo HOLD > dialogue/GO.txt; fi

bash scripts/relay.sh --rounds 3 --require-go --stop-on-clean
exit 0
