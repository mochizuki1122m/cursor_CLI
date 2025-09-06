目的
**ディレクター（人間）**の監督下で、**実装エージェント（Implementer）とレビューエージェント（Critic）がIR（中間表現：Intermediate Representation）**中心に協調し、高品質・安全・可監査なコードを継続的に生成するためのフレームワーク。
自然言語は最小化し、**JSON＋差分（unified diff）**を唯一の交換形式とします。

特徴（要点）

厳格な品質統制：多層レビュー（AIレビュー＋CIゲート＋人間レビュー）

セキュリティファースト：SAST（静的アプリケーションセキュリティテスト）／依存脆弱性／秘密検出／SBOM／CodeQL

完全監査証跡：全イベントを JSON Lines で連鎖ハッシュ記録＋署名

継続的改善：Implementer↔Critic の反復／失敗の最小修正で収束

IR固定：SpecIR／PatchIR／VerifyIR の 3 スキーマに厳格準拠（自然言語禁止）

ディレクター承認ゲート：GO しない限り実装ループ不可

モデル最適化：LLaMA/Mistral 系には diff 志向、GPT/Gemini 系には JSON スキーマ志向

アーキテクチャ（概要）
flowchart LR
  Dir[ディレクター] --> FG[Feature Goal]
  FG --> Agents[AIエージェント: Implementer & Critic]
  Agents --> PR[Pull Request]

  subgraph 基盤
    Lite[LiteLLM プロキシ]
    CI[CI/CD: GitHub Actions]
    Repo[Git リポジトリ]
  end

  Agents --> Lite
  PR --> Repo
  Repo --> CI
  CI --> Checks[必須ゲート]
  Checks --> Merge[保護ブランチ]

詳細シーケンス
sequenceDiagram
  autonumber
  participant Human as ディレクター
  participant KAD as Cursor CLI (コンセプト注入)
  participant Impl as Implementer Agent
  participant Crit as Critic Agent
  participant GH as GitHub Actions
  participant Checks as 必須ゲート
  participant Main as 保護ブランチ

  Human->>KAD: アイデア + product_concept.md
  KAD-->>Impl: 概念/コンテキスト注入
  Impl->>Human: 認識の要約提示
  Human-->>KAD: GO/修正（dialogue/GO.txt）
  loop 実装↔レビュー
    Impl->>Crit: PatchIR（JSON）提出
    Crit-->>Impl: VerifyIR（JSON）返却（合否・根因）
  end
  Impl->>GH: PR 作成
  GH->>Checks: Lint/Test/SAST/Secrets/Deps/SBOM/Trivy/CodeQL
  Checks-->>Main: すべて合格ならマージ

ディレクトリ構成
.
├── .cursor/                 # ルール/コマンド/MCP設定（任意）
├── prompts/                 # エージェント用プロンプト（system等）
├── dialogue/                # ゴール・要約・GO承認
│   ├── product_concept.md
│   ├── concept_summary.md
│   └── GO.txt              # 'GO' または修正指示
├── schema/                  # JSON Schema（IR定義）
│   ├── spec_ir.schema.json
│   ├── patch_ir.schema.json
│   └── verify_ir.schema.json
├── patches/                 # PatchIR 出力（JSON）
├── review/reports/          # VerifyIR・スコアカード
├── change_summaries/        # 変更要約
├── policy/                  # セキュリティ/スタイル/レビュー規約
├── scripts/                 # 自動化スクリプト（PowerShell / bash / Node）
├── .github/workflows/       # CI/CD（PRゲート）
└── audit/                   # 監査ログ（JSONL＋署名）

前提条件

OS：Windows 10/11（PowerShell 5.1+）／Linux／macOS

必須：Git / Node.js 18+ / Python 3.10+

推奨：Cursor IDE・Cursor CLI（@cursor/cli）

API：LiteLLM プロキシ（推奨）または各モデル直結

CI：GitHub Actions（他CIでも置換可）

セットアップ
git clone https://github.com/your-org/ai-dev-team.git
cd ai-dev-team

# 依存
npm install
pip install -r requirements.txt
npm install -g @cursor/cli

# 環境
cp .env.example .env
# 例:
# LITELLM_PROXY_URL=http://your-gateway:8000
# LITELLM_API_KEY=your-gateway-access-token
# OPENAI_API_BASE=$LITELLM_PROXY_URL
# OPENAI_API_KEY=$LITELLM_API_KEY
# LLM_TEMPERATURE=0.15
# LLM_TOP_P=0.8


Windows（PowerShell）:

npm install
pip install -r requirements.txt
cp .env.example .env
npm run setup
./scripts/relay.ps1 -Rounds 3 -RequireGo
./scripts/relay.ps1 -Rounds 5 -StopOnClean


Linux/macOS:

npm install
pip install -r requirements.txt
cp .env.example .env
npm run setup

IR（中間表現）仕様
SpecIR（要求仕様）
{
  "task_id": "ABC123",
  "intent": "bugfix | feature | refactor",
  "constraints": ["pytest::test_x passes", "flake8 clean"],
  "targets": [
    {"path": "src/x.py", "region": {"from": 120, "to": 220}}
  ],
  "acceptance": ["pytest::test_x passes"]
}

PatchIR（実装提案：JSON＋unified diff）
{
  "task_id": "ABC123",
  "patches": [
    {
      "path": "src/x.py",
      "hunk": "@@ -120,12 +120,15 @@\n ...diff 本文...\n",
      "risk": ["api_break:false", "complexity:+1"],
      "notes": []
    }
  ]
}

VerifyIR（検証結果）
{
  "task_id": "ABC123",
  "build": {"ok": true, "logs_path": "logs/build.txt"},
  "tests": {"ok": false, "failed": ["tests/test_x::test_edge"], "report": "logs/pytest.txt"},
  "static": {"ok": false, "violations": ["E501 line too long src/x.py:137"]},
  "root_cause": [{"path":"src/x.py","line":137,"reason":"IndexError path A"}]
}


厳密定義は schema/*.schema.json を参照。全出力はJSONスキーマ検証を通過しない限り無効。

実行（エンドツーエンド）
PowerShell（Windows）
./scripts/relay.ps1 -Rounds 3 -RequireGo
# -> dialogue/concept_summary.md を確認し、dialogue/GO.txt に 'GO' または訂正を記入
./scripts/relay.ps1 -Rounds 5 -StopOnClean

Linux/macOS（bash）
bash scripts/relay.sh --rounds 3 --require-go
bash scripts/relay.sh --rounds 5 --stop-on-clean

スクリプト要点（抜粋）

scripts/relay.ps1（抜粋）

param([int]$Rounds=3,[switch]$RequireGo,[switch]$StopOnClean)
if ($RequireGo) {
  if (-not (Test-Path dialogue/GO.txt)) { throw "GO.txt がありません" }
  if ((Get-Content dialogue/GO.txt -Raw).Trim() -ne "GO") { throw "GO承認が必要" }
}
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
  if ($v.build.ok -and $v.tests.ok -and $v.static.ok -and $StopOnClean) { break }
}


review/reports/scorecard.json（例）

{
  "build_ok": true,
  "tests_ok": true,
  "sast_ok": true,
  "secrets_ok": true,
  "deps_ok": true,
  "sbom_ok": true,
  "diff_loc_leq": 300,
  "changed_files_leq": 8,
  "banned_api_used": []
}

CI/CD ゲート（GitHub Actions 例）

.github/workflows/ci.yml（本リポジトリに同梱の実体と同一）

name: CI-Gates
on:
  pull_request:
    branches: [ main ]
jobs:
  lint-test-security:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - name: Install Node deps
        run: npm ci || npm install
      - name: Install Python deps
        run: pip install -r requirements.txt
      - name: ESLint
        run: npx eslint .
      - name: PyTest
        run: pytest -q --maxfail=1 --disable-warnings
      - name: Semgrep (SAST)
        uses: returntocorp/semgrep-action@v1
      - name: gitleaks (Secrets)
        uses: gitleaks/gitleaks-action@v2
      - name: SBOM / CycloneDX
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      - name: Cosign sign SBOM (optional)
        if: ${{ secrets.COSIGN_PRIVATE_KEY != '' }}
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
        run: |
          echo "$COSIGN_PRIVATE_KEY" | base64 -d > cosign.key
          cosign sign-blob --yes --key cosign.key sbom.json
          rm -f cosign.key
      - name: CodeQL Init
        uses: github/codeql-action/init@v3
        with:
          languages: 'javascript,python'
      - name: CodeQL Analyze
        uses: github/codeql-action/analyze@v3


ブランチ保護：上記ステータスは必須に設定。通過しない PR はマージ不可。
人的最終レビュー：CODEOWNERS によるレビュー必須。

セキュリティ・コンプライアンス

秘密検出：gitleaks を必須ゲート化

依存脆弱性：npm audit／pip-audit／safety

SAST：Semgrep／Bandit

SBOM（Software Bill of Materials）：CycloneDX＋署名（cosign）

CodeQL：高度解析

禁止API：Semgrep ルールで検出して強制NG

ログの機密保護：PII匿名化／.no-train ラベルによる学習禁止マーカー

監査と可観測性

監査ログ：audit/log-YYYYMMDD.jsonl に全イベントを追記

各行に 前行ハッシュを含める連鎖（改ざん検出）

ローテーション時に cosign 署名

KPI：テスト合格率／静的解析違反／反復回数／収束時間／欠陥密度（差分LOCあたり）

劣化時：自動失速（反復停止）→ ディレクター判断

運用ポリシー（抜粋）

自然言語禁止：Implementer／Critic の出力はJSONのみ。

JSONスキーマ検証：不適合は即座に無効化。

最小差分主義：大規模変更は Director の事前承認が必要。

ラウンドとコスト上限：MAX_ROUNDS／MAX_DIFF_LOC／MAX_CHANGED_FILES／MAX_API_TOKENS_PER_ROUND

停止条件：N 連続失敗、秘密検出、SAST 再発時は強制停止→人間判断。

モデル最適化（実務目安）

LLaMA／Mistral：diff テキスト志向、temperature=0.1〜0.2、top_p=0.8

GPT／Gemini：JSON スキーマ志向（厳格）、出力トークン短め

日本語優先：必要に応じ logit bias で英語トークンを抑制

トラブルシュート

Patch 適用失敗：git apply --3way、競合は VerifyIR に原因を格納。自動ロールバック。

JSON 不正：scripts/validate_json.mjs で弾かれる。出力上限・温度を見直し。

ゲート不合格：review/reports/verify_ir.json と CI の該当ログを確認。

無限反復：-StopOnClean を有効化／MAX_ROUNDS を下げる。

ライセンスと法的注意

本テンプレートはサンプル。各種ツール・モデル・依存のライセンス遵守は利用者の責任。

監査ログやレビュー出力に個人情報や秘密情報を含めないこと。

SBOM／署名／ブランチ保護は組織のポリシーに沿って設定すること。

付録：用語（略称（正式名称））

IR（Intermediate Representation）

SAST（Static Application Security Testing）

SBOM（Software Bill of Materials）

CI/CD（Continuous Integration / Continuous Delivery）

KPI（Key Performance Indicator）

