[English](README.en.md) | [日本語](README.md)

## Purpose
Provide a minimal yet robust and auditable foundation where Implementer (coding agent) and Critic (review agent) collaborate via IR (JSON + unified diff), and the Director (human) gives final approval through a GO gate.

## What This Enables (Overview)
- IR locking and machine validation: SpecIR / PatchIR / VerifyIR fixed by JSON Schema 2020-12. All outputs are schema-validated.
- Guardrails: natural-language blocking, unified diff enforcement, GO gate, iteration/cost limits, audit (JSONL chain + signing).
- Auto relay: Implementer → PatchIR → Critic → VerifyIR → audit → (if clean) patch apply + scorecard.
- CI gates: ESLint / PyTest / Semgrep / gitleaks / CycloneDX + signing / CodeQL and scorecard thresholds block PRs.
- Double-click launch: Windows (StartRelay.cmd), macOS (start-relay.command).

## Quick Start (≈ 5 minutes)
- 1) Install dependencies
  - Node.js 18+ / Python 3.10+ / Git
  - In repo root, run:
```
npm install
pip install -r requirements.txt
cp .env.example .env
```
- 2) Double-click to launch
  - Windows: double-click `StartRelay.cmd`
  - macOS: double-click `start-relay.command` (first time: `chmod +x start-relay.command`)
- 3) Open the GO gate
  - Initially `dialogue/GO.txt` is `HOLD`. Change it to `GO` to start the loop.

After launch, `patches/patch_ir.json`, `review/reports/verify_ir.json`, and `audit/log-YYYYMMDD.jsonl` are generated.

### Declaring What To Build (Goal)
1) Scaffold a new goal
```
node scripts/new_goal.mjs FEAT-001   # optional argument (timestamp ID if omitted)
```
2) Edit `tickets/FEAT-001/spec_ir.json` (pre-populated with an optimized template).
3) Set `dialogue/GO.txt` to `GO` to start the loop for that goal.
4) The latest goal is auto-detected; Implementer receives a summary (intent/targets/constraints/acceptance).

## Prerequisites
- OS: Windows 10/11, Linux, macOS
- Required: Git / Node.js 18+ / Python 3.10+
- Recommended: Cursor CLI (`@cursor/cli`) or LiteLLM as the API front.

## Directory Tree
```
.
├── StartRelay.cmd
├── start-relay.command
├── .env.example
├── .eslintrc.json
├── .gitignore
├── package.json
├── requirements.txt
├── README.md
├── README.en.md
├── schema/
│   ├── spec_ir.schema.json
│   ├── patch_ir.schema.json
│   └── verify_ir.schema.json
├── scripts/
│   ├── relay.sh
│   ├── relay.ps1
│   ├── start.ps1
│   ├── run_implementer.mjs
│   ├── run_critic.mjs
│   ├── validate_json.mjs
│   ├── apply_patch_ir.mjs
│   ├── analyze_patch_ir.mjs
│   ├── make_scorecard.mjs
│   ├── new_goal.mjs
│   └── lib/
│       └── llm_client.mjs
├── templates/
│   ├── spec_ir.template.json
│   └── spec_ir.example.json
├── dialogue/
│   └── GO.txt
├── tickets/
│   └── (auto-generated goals)
├── patches/
│   └── patch_ir.json
├── review/
│   └── reports/
│       ├── verify_ir.json
│       ├── analysis.json
│       └── scorecard.json
├── audit/
│   └── log-YYYYMMDD.jsonl
├── prompts/
│   ├── system_common.txt
│   ├── system_implementer.txt
│   └── system_critic.txt
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        ├── ci.yml
        └── audit-sign.yml
```

## Setup
- Common (commands)
```
npm install
pip install -r requirements.txt
cp .env.example .env
```
- Double-click launch
  - Windows: `StartRelay.cmd`
  - macOS: `start-relay.command` (first time: `chmod +x start-relay.command`)

## Launch (CLI)
- Windows (PowerShell):
```
./scripts/relay.ps1 -Rounds 3 -RequireGo -StopOnClean
```
- Linux/macOS (bash):
```
bash scripts/relay.sh --rounds 3 --require-go --stop-on-clean
```
- GO gate: the loop won’t start until `dialogue/GO.txt` is set to `GO` (default is `HOLD`).

## Environment Variables (Key)
```
LLM_PROVIDER=cursor  # http | cursor
CURSOR_API_BASE / CURSOR_API_KEY  or  OPENAI_API_BASE / OPENAI_API_KEY  or  LITELLM_PROXY_URL / LITELLM_API_KEY
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.15
LLM_TOP_P=0.8
LLM_USE_PRESET=true  # auto-apply model-specific presets (temperature/top_p)
PROMPTS_DIR=prompts  # where system prompts are loaded from
LLM_TIMEOUT_MS / LLM_MAX_TOKENS / LLM_MAX_RETRIES / LLM_BACKOFF_MS
LLM_CB_FAILURE_THRESHOLD / LLM_CB_OPEN_MS
MAX_ROUNDS=6 / MAX_DIFF_LOC=400 / MAX_CHANGED_FILES=10 / MAX_API_TOKENS_PER_ROUND=150000
```

## IR (Intermediate Representation)
- Definitions: `schema/spec_ir.schema.json`, `schema/patch_ir.schema.json`, `schema/verify_ir.schema.json`
- Exchange is JSON only. Unified diff is stored in PatchIR `hunk`.

## Validator (Pre-exec Checks)
- Strict JSON Schema validation (mismatch = immediate error).
- Natural-language blocking (reject non-JSON starts, simple heuristics on long alpha runs / punctuation).

## Process Control (Director-led)
- GO gate (human approval): won’t start without `dialogue/GO.txt` = `GO` (`-RequireGo` / `--require-go`).
- Iteration/cost limits: max rounds, tokens, diff LOC, changed files. Exceeding stops the loop.
- Two-step review: even after Critic approval, protected branch + CODEOWNERS review is mandatory.

## Agent Governance (Implementer / Critic)
- Output JSON only (no natural language), conform to `schema/*.schema.json`.
- Determinism: low temperature (default 0.15; 0.1–0.2 recommended), top_p 0.8, short outputs.
- Japanese-first (optional): apply negative bias to English tokens.
- Two-vote / scorecard: if any item is NG, the result is failed. Optional Secondary Critic for quorum.

## Relay Flow (Short)
1) Implementer → PatchIR (LLM-connected, JSON-only)
2) Validator checks PatchIR (schema + heuristics)
3) Critic → VerifyIR (build/tests/static + root_cause)
4) Audit (append to JSONL chain, PII anonymized)
5) If clean: diff analysis → patch apply (3-way) → scorecard

## Local UI Dashboard (Offline)
- Runs on localhost (127.0.0.1) and works offline.
- It auto-opens the browser on launch (`http://localhost:34100`). Disable via `DISABLE_LOCAL_UI=1`.
- Features:
  - Human Spec (Markdown) input (load template → edit → submit)
  - Understanding panel (summary/assumptions/questions/decision) with human confirm/reject
  - Live monitoring of PatchIR / VerifyIR / Scorecard / GO via SSE

### Human input is Markdown only
- Click `Load Markdown Template`, write naturally, then `Submit Spec`.
- Listing Targets is unnecessary; proposed targets are surfaced during the understanding phase.

## Understanding Phase (human confirmation → then implementation)
1) Implementer derives an UnderstandingIR(JSON) from the Markdown (summary/assumptions/questions/risks).
2) Critic reviews and adds questions if needed, and proposes approve=true/false.
3) In the UI, a human verifies the natural-language summary:
   - If correct: click “Confirm (GO)” → GO is set → proceed to implementation.
   - If not: click “Reject”, leave feedback, update Markdown and resubmit.

## Added Key Files / Endpoints
- Scripts/Schemas
  - `scripts/ui_server.mjs` (UI server/SSE)
  - `scripts/run_understanding.mjs` / `scripts/review_understanding.mjs`
  - `schema/understanding_ir.schema.json`
  - `templates/spec_md.template.md`
  - `ui/index.html` / `ui/main.js` / `ui/styles.css`
- APIs
  - `GET /api/spec-md-template`: human-friendly Markdown template
  - `POST /api/spec-md`: accept Markdown, normalize to SpecIR, run understanding
  - `POST /api/understanding/confirm|reject`: human confirm/reject (GO/HOLD)
  - `GET /events`: SSE (PatchIR/VerifyIR/Scorecard/Understanding/GO)

## Environment (Additions)
```
# UI
UI_PORT=34100
DISABLE_LOCAL_UI=

# Key auto-fetch (optional)
AUTO_FETCH_CURSOR_KEY=false
CURSOR_KEY_FETCH_CMD="cursor auth token"
CURSOR_KEY_FETCH_INTERVAL_HOURS=24
```

## Troubleshooting (UI/Launch)
- UI not opening: open `http://localhost:34100` directly; check `DISABLE_LOCAL_UI`.
- UI server logs: `.cache/ui_server.log` (when manually launched)
- On failures, relay scripts print recent `verify_ir.json` / `patch_ir.json` / `logs/*` for context.

## Artifacts (Where to Look)
- `patches/patch_ir.json` — Implementer’s PatchIR
- `review/reports/verify_ir.json` — Critic’s VerifyIR
- `review/reports/analysis.json` — diff LOC / changed files
- `review/reports/scorecard.json` — summarized gate results (used by CI)
- `audit/log-YYYYMMDD.jsonl` — audit trail with chained hashes

## CI/CD Gates (`.github/workflows/ci.yml`)
Note: The minimal distribution does not bundle `.github/workflows/*`. Add them in your own repo if needed.
- ESLint / PyTest / Semgrep / gitleaks / CycloneDX + cosign / CodeQL
- Scorecard enforcement: NG in `diff_loc_leq`, `changed_files_leq`, `build_ok`, or `tests_ok` blocks PRs.

## Audit & Signing
- Audit log: `audit/log-YYYYMMDD.jsonl` (each line includes previous hash).
- Anonymization: simple masking for email/phone.
- Signing: daily by `Audit-Log-Sign` workflow (requires cosign secrets).

## Troubleshooting (Short)
- Invalid JSON → see `scripts/validate_json.mjs`; adjust temperature/output length.
- Patch apply failure → resolve conflicts and retry (workspace is preserved by rollback).
- CI failure → check `review/reports/scorecard.json` and CI logs.

## FAQ
- What does double-click do?
  - Install dependencies (first time), init `.env`, create dirs, launch relay with GO gate.
- Where to write GO?
  - Set `dialogue/GO.txt` to `GO` (uppercase).
- How to switch LLM endpoint?
  - Edit `.env` (use `LLM_PROVIDER=cursor` with `CURSOR_API_BASE/KEY`, or OpenAI/LiteLLM).

## Known Extensions
- Stricter diff metrics (AST/CFG-based), aggregate SAST/Secrets into VerifyIR/scorecard, multi-vendor failover.

