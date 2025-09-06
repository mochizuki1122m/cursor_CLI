## 目的
Implementer（実装）と Critic（レビュー）が IR（JSON＋diff）を介して安全に自動リレーし、Director（人間）が GO ゲートで最終承認できる、堅牢で監査可能な最小基盤を提供します。

## できること（概要）
- IR固定と機械検証: SpecIR／PatchIR／VerifyIR を JSON Schema 2020-12 で固定。すべての出力はスキーマ検証を強制。
- ガードレール: 自然文混入の拒否、差分（unified diff）強制、GOゲート、反復・コスト上限、監査（JSONLチェーン＋署名）。
- 自動リレー: Implementer→PatchIR → Critic→VerifyIR → 監査 →（合格時）パッチ適用・スコアカード作成。
- CIゲート: ESLint／PyTest／Semgrep／gitleaks／CycloneDX＋署名／CodeQL とスコアカード閾値で PR をブロック。
- ダブルクリック起動: Windows（StartRelay.cmd）、macOS（start-relay.command）。

## クイックスタート（最短5分）
- 1) 依存を入れます。
  - Node.js 18+ / Python 3.10+ / Git（インストール済みであること）
  - リポジトリ直下で次を実行:
```
npm install
pip install -r requirements.txt
cp .env.example .env
```
- 2) ダブルクリックで起動します。
  - Windows: エクスプローラーで `StartRelay.cmd` をダブルクリック
  - macOS: Finderで `start-relay.command` をダブルクリック（初回のみ `chmod +x start-relay.command`）
- 3) GOゲートを開けます。
  - 初回は `dialogue/GO.txt` が `HOLD` です。内容を `GO` に変更して保存すると実装ループが進みます。

起動後は `patches/patch_ir.json` と `review/reports/verify_ir.json`、監査 `audit/log-YYYYMMDD.jsonl` が生成されます。

## 前提条件（推奨環境）
- OS: Windows 10/11, Linux, macOS
- 必須: Git / Node.js 18+ / Python 3.10+
- 推奨: Cursor CLI（`@cursor/cli`）または LiteLLM 経由のAPI接続

## ディレクトリ構成
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
│   └── lib/
│       └── llm_client.mjs
├── dialogue/
│   └── GO.txt
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
│   └── .gitkeep
├── policy/
│   └── .gitkeep
├── change_summaries/
│   └── .gitkeep
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        ├── ci.yml
        └── audit-sign.yml
```

## セットアップ
- 共通（コマンド）
```
npm install
pip install -r requirements.txt
cp .env.example .env
```
- ダブルクリック起動
  - Windows: `StartRelay.cmd`
  - macOS: `start-relay.command`（初回のみ `chmod +x start-relay.command`）

## 起動方法（CLI）
- Windows（PowerShell）:
```
./scripts/relay.ps1 -Rounds 3 -RequireGo -StopOnClean
```
- Linux/macOS（bash）:
```
bash scripts/relay.sh --rounds 3 --require-go --stop-on-clean
```
- GOゲート: `dialogue/GO.txt` に `GO` を書くまで実装ループは起動しません（初期値は `HOLD`）。

## 環境変数（主要）
```
LLM_PROVIDER=cursor  # http | cursor
CURSOR_API_BASE / CURSOR_API_KEY  または  OPENAI_API_BASE / OPENAI_API_KEY  または  LITELLM_PROXY_URL / LITELLM_API_KEY
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.15
LLM_TOP_P=0.8
LLM_USE_PRESET=true  # モデル別プリセット（温度/Top-p）を自動適用
PROMPTS_DIR=prompts  # systemプロンプト外部ファイルの読み込み場所
LLM_TIMEOUT_MS / LLM_MAX_TOKENS / LLM_MAX_RETRIES / LLM_BACKOFF_MS
LLM_CB_FAILURE_THRESHOLD / LLM_CB_OPEN_MS
MAX_ROUNDS=6 / MAX_DIFF_LOC=400 / MAX_CHANGED_FILES=10 / MAX_API_TOKENS_PER_ROUND=150000
```

## IR（中間表現）
- 定義: `schema/spec_ir.schema.json` / `schema/patch_ir.schema.json` / `schema/verify_ir.schema.json`
- 交換は JSON のみ。差分は PatchIR の `hunk` に unified diff を格納。

## バリデータ（実行前検査）
- JSON Schema 2020-12 で Implementer／Critic 出力を厳格に検証（不一致は即エラー）。
- 自然文遮断（非JSON開始の拒否＋英字長連続/句読点過多のヒューリスティック）。

## プロセス制御（Director主導）
- GOゲート（人間承認）: `dialogue/GO.txt` に Director が「GO」または修正指示を記載しない限り起動しません（`-RequireGo`／`--require-go`）。
- 反復・費用の上限: ラウンド・APIトークン・差分LOC・変更ファイル数に上限を設け、逸脱時は停止します。
```bash
MAX_ROUNDS=6
MAX_CHANGED_FILES=10
MAX_DIFF_LOC=400
MAX_API_TOKENS_PER_ROUND=150000
```
- 二段レビュー: Critic承認後も CODEOWNERS の必須レビューを通過しない限りマージ不可にします。

## エージェント統制（Implementer／Critic）
- 出力はJSONのみ（自然文禁止）。`schema/*.schema.json` に準拠させます。
- 決定性重視: 温度は低温度（既定0.15、推奨0.1〜0.2）、Top-pは0.8、出力トークン短め。
- 日本語優先が必要な場合は英語トークンに負のバイアス（logit bias）を適用します。
- 二者投票／スコアカード: NGが1つでもあれば不合格。必要ならSecondary Criticで合議（クォーラム）。

## 自動リレーの流れ（簡略）
1) Implementer → PatchIR を生成（LLM本接続。JSON限定）。
2) バリデータで PatchIR を検証（JSON Schema + ヒューリスティック）。
3) Critic → VerifyIR を生成（ビルド/テスト/静的解析・root_cause）。
4) 監査（JSONLチェーンに追記、PII匿名化）。
5) 全OKなら: 差分計測 → パッチ適用（3way）→ スコアカード作成。

## 生成物（どこを見ればよいか）
- `patches/patch_ir.json`: Implementer が出した PatchIR
- `review/reports/verify_ir.json`: Critic の検証結果 VerifyIR
- `review/reports/analysis.json`: 差分LOC・変更ファイル数の計測
- `review/reports/scorecard.json`: ゲート判定の要約（CIで参照）
- `audit/log-YYYYMMDD.jsonl`: 全イベントの監査ログ（前行ハッシュ連鎖）

## CI/CD ゲート（`.github/workflows/ci.yml`）
- ESLint／PyTest／Semgrep／gitleaks／CycloneDX＋cosign／CodeQL
- Scorecard 連動: `diff_loc_leq` と `changed_files_leq`、および `build_ok` / `tests_ok` のいずれかが NG なら PR をブロック。

## 監査と署名
- 監査ログ: `audit/log-YYYYMMDD.jsonl`（各行に前行ハッシュを含むチェーン）。
- 匿名化: メール・電話を簡易マスキングして保存。
- 署名: `Audit-Log-Sign` ワークフローで日次署名（Secrets に cosign 鍵が必要）。

## トラブルシュート（抜粋）
- JSON不正 → `scripts/validate_json.mjs` のエラーを確認。温度や出力長を調整。
- パッチ適用失敗 → 競合を解消後に再試行。自動ロールバックで作業空間は保全。
- CI不合格 → `review/reports/scorecard.json` とCIログの該当箇所を参照。

## よくある質問（FAQ）
- ダブルクリックで何が行われますか？
  - 依存導入（未導入時のみ）→ `.env` 初期化 → 必要ディレクトリ作成 → リレー起動（GOゲート有効）です。
- GOを記入する場所は？
  - `dialogue/GO.txt` の全行を `GO` にしてください（大文字）。
- LLMの接続先はどこで変えますか？
  - `.env` の `OPENAI_API_BASE/KEY` または `LITELLM_PROXY_URL/API_KEY` を編集します。

## 既知の拡張ポイント
- 差分LOC・変更ファイルの厳格化（変更前後の AST/CFG ベース評価など）。
- SAST/Secrets の結果を VerifyIR/scorecard に集約して可視化。
- LLM ベンダ冗長化（ルーティング・フェイルオーバ）。
