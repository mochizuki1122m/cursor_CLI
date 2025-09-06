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

失敗モードと対策（要点）

自然言語混入 → JSON限定出力・JSONスキーマ検証・自然文検知（ASCII/日本語比率、句読点ヒューリスティック）を適用します。

パッチ不整合（適用失敗/競合）→ 最小差分（Unified diff）を強制し、git apply --3way と自動ロールバックで保全します。

安全ゲート形骸化 → 必須ステータスチェックとブロック条件をすべてPRの必須チェックに設定し、未合格はマージ不可にします。

秘密情報流出 → 秘密検出（gitleaks）、学習禁止ラベル（.no-train）、対話ログのPII匿名化を徹底します。

エージェント暴走 → Director（人間）の GOゲート、反復上限、費用・トークン上限で統制します。

監査欠落 → 完全監査証跡（JSON Lines）と不可改ざん署名（署名付きアーティファクト）を実施します。


IR（中間表現）レイヤの強化

2.1 スキーマ（JSON Schema）定義

仕様IR、パッチIR、検証IR の3系統を固定します。自然言語は許可しません。以下は参考スキーマ（概略）です。実体は schema/*.schema.json を参照してください。

```json
// schema/spec_ir.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SpecIR",
  "type": "object",
  "required": ["task_id", "intent", "targets", "acceptance"],
  "properties": {
    "task_id": {"type": "string", "pattern": "^[A-Z0-9_-]{6,}$"},
    "intent": {"type": "string", "enum": ["bugfix", "feature", "refactor"]},
    "constraints": {"type": "array", "items": {"type": "string"}, "default": []},
    "targets": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["path"],
        "properties": {
          "path": {"type": "string"},
          "region": {
            "type": "object",
            "properties": {
              "from": {"type": "integer", "minimum": 1},
              "to": {"type": "integer", "minimum": 1}
            },
            "required": ["from", "to"]
          }
        }
      }
    },
    "acceptance": {"type": "array", "items": {"type": "string"}}
  }
}
```

```json
// schema/patch_ir.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PatchIR",
  "type": "object",
  "required": ["task_id", "patches"],
  "properties": {
    "task_id": {"type": "string"},
    "patches": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["path", "hunk"],
        "properties": {
          "path": {"type": "string"},
          "hunk": {"type": "string", "pattern": "^@@[\\s\\S]*"},
          "risk": {"type": "array", "items": {"type": "string"}, "default": []},
          "notes": {"type": "array", "items": {"type": "string"}, "default": []}
        }
      }
    }
  }
}
```

```json
// schema/verify_ir.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VerifyIR",
  "type": "object",
  "required": ["task_id", "build", "tests", "static"],
  "properties": {
    "task_id": {"type": "string"},
    "build": {"type": "object", "required": ["ok"], "properties": {
      "ok": {"type": "boolean"}, "logs_path": {"type": "string"}
    }},
    "tests": {"type": "object", "required": ["ok"], "properties": {
      "ok": {"type": "boolean"},
      "failed": {"type": "array", "items": {"type": "string"}},
      "report": {"type": "string"}
    }},
    "static": {"type": "object", "required": ["ok"], "properties": {
      "ok": {"type": "boolean"},
      "violations": {"type": "array", "items": {"type": "string"}}
    }},
    "root_cause": {"type": "array", "items": {
      "type": "object",
      "required": ["path", "line", "reason"],
      "properties": {"path": {"type": "string"}, "line": {"type": "integer"}, "reason": {"type": "string"}}
    }}
  }
}
```

2.2 バリデータ（実行前検査）

JSON Schema 検証で Implementer（実装）／Critic（レビュー）の両出力を拒否可能にします。自然文遮断として、JSON以外（先頭が { 以外）は即時エラーとし、英字連続や句読点分布によるヒューリスティックで拒否します。


プロセス制御（Director主導の厳格化）

3.1 GOゲート（人間承認）

Director（人間）が dialogue/GO.txt に GO または修正指示を記載しない限り実装ループを起動しません。scripts/relay.ps1 -RequireGo／scripts/relay.sh --require-go で強制します。

3.2 反復制限・費用制限

ラウンド上限、APIトークン上限、1ラウンドあたり最大差分LOC、最大変更ファイル数を環境変数で固定し、逸脱時は停止します。

```bash
MAX_ROUNDS=6
MAX_CHANGED_FILES=10
MAX_DIFF_LOC=400
MAX_API_TOKENS_PER_ROUND=150000
```

3.3 二段レビュー（AI→人間）

Critic（レビュー）が承認でも、GitHub の必須レビュー（CODEOWNERS）を通らないとマージできないようにします。


セキュリティ・コンプライアンス（ゲートの強化）

4.1 CI/CD（継続的インテグレーション／デリバリー）必須ゲート

Lint（ESLint/Ruff など）、テスト（Jest/PyTest など）、SAST（Semgrep/Bandit など）、Secrets（gitleaks）、依存脆弱性（npm audit/pip-audit/safety）、SBOM（CycloneDX）＋署名（cosign）、コンテナスキャン（Trivy）、CodeQL を必須化します。

4.2 ブランチ保護と署名

保護ブランチでは必須チェック未合格の PR をマージ不可にします。コミット署名（GPG/Sigstore）と DCO（Developer Certificate of Origin）に準拠します。

```markdown
# .github/PULL_REQUEST_TEMPLATE.md（例）
- [ ] DCO: 私はこの変更に対する権利を有し、適用ライセンスに同意します。
- [ ] 機密・個人情報を含んでいません。
- [ ] 受け入れ条件（Acceptance）を満たすE2E/単体テストが通過しています。
```


エージェント統制（Implementer／Critic）

5.1 出力制約（ログ確率・JSONのみ）

Cursor CLI（cursor-agent）には system で JSON 限定・自然文禁止を設定します。低温度（temperature 0.1〜0.2）と Top-p 0.8、出力トークン上限短めで決定性を確保します。日本語優先が必要な場合は logit bias などで英語トークンに負バイアスを設定します。

5.2 二者投票／スコアカード

Critic はスコアカード（0/1）で合否を返します。NG 項目が 1 つでもあれば不合格とします（ビルド／テスト／静的解析／依存／秘密／差分LOC／変更ファイル数／禁止API）。必要に応じて Secondary Critic を追加し、合議（クォーラム）で決定します。


監査・ロギング・可観測性

6.1 完全監査証跡（改ざん耐性）

JSON Lines で全イベントを audit/log-YYYYMMDD.jsonl に追記します。各行に前行の SHA-256 を含めるハッシュ連鎖で不可改ざん性を担保し、ローテーション時に cosign で署名します。

```json
{"ts":"2025-09-06T14:23:11+09:00","event":"IMPLEMENTER_PATCH","task_id":"ABC123","sha_prev":"...","sha_self":"..."}
```

6.2 メトリクス（KPI）

テスト合格率、静的解析違反/PR、反復回数、平均収束時間、欠陥密度（差分LOC あたり）を定期集計し、劣化検知時は閾値で自動失速（反復停止）して Director が確認します。


再現性・回復性

作業空間は git worktree 等で隔離し、常に復元可能な状態を維持します。パッチ適用に失敗した場合は自動ロールバックし、VerifyIR に失敗理由を格納します。連続失敗・SAST 再発・秘密検出時は強制停止し、Director が審査します。


スクリプト雛形（PowerShell / bash の要点）

PowerShell（scripts/relay.ps1）は GO ゲート・IR検証・監査追記・停止条件判定を順に行います。bash（scripts/relay.sh）も同様の流れで動作します（--require-go／--stop-on-clean などの引数に対応します）。


プロンプト（出力制約の最小例）

Implementer（実装）向け system:

あなたは実装エージェントです。自然言語の文章は禁止します。出力は必ず PatchIR（JSON）で、schema/patch_ir.schema.json に適合させます。差分は unified diff を hunk に入れてください。コード以外の説明は notes に箇条書きで最小限とします。

Critic（レビュー）向け system:

あなたはレビューエージェントです。自然言語は禁止します。入力の PatchIR を検証し、VerifyIR（JSON）だけを出力します。ビルド／テスト／静的解析の成否と root_cause を厳密に返してください。スキーマに不適合ならすべて false とし、違反理由を violations に追加します。


追加の運用ガード

禁止APIリスト（例：child_process.exec の使用）を Semgrep ルールで検出して自動 NG とします。最大差分 LOC 超過時は Director レビュー必須に切り替えます。モデル最適化として、LLaMA/Mistral 系には差分テキストを主に、GPT/Gemini 系には JSON スキーマを主にします。出力揺れを抑えるため temperature=0.1〜0.2、Top-p=0.8 を目安に設定します。


まとめ

IR 固定（JSON＋diff）・スキーマ検証・強制ゲート・監査署名・ロールバックを導入すると、Implementer（実装）× Critic（レビュー）の自動リレーを高品質・安全・可監査にできます。Director（人間）による GO ゲートと二段レビューで最終責任を担保します。これらを既存の Cursor CLI（cursor-agent）と GitHub Actions に薄く重ねるだけで、実運用レベルの堅牢性に到達します。


付録：用語（略称（正式名称））

