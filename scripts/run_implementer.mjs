#!/usr/bin/env node
import { callChatJson, buildSystemPromptJsonOnly } from "./lib/llm_client.mjs";

const taskId = process.env.TASK_ID || "DEMO-TASK";
const targetPath = process.env.TARGET_PATH || "README.md";
const specSummary = process.env.SPEC_SUMMARY || "";

const system = buildSystemPromptJsonOnly("PatchIR (schema/patch_ir.schema.json)");
const user = [
  "次の要件に対する最小差分パッチをPatchIR(JSON)で出力してください。",
  "- unified diff を hunk に入れること（@@ で始まること）",
  `- 目標ファイル: ${targetPath}`,
  specSummary ? `- 仕様要約: ${specSummary}` : "",
].filter(Boolean).join("\n");
const messages = [
  { role: "system", content: system },
  { role: "user", content: user },
];

try {
  const json = await callChatJson(messages);
  process.stdout.write(json);
} catch (e) {
  // フォールバック: 最小スタブ
  const diffHunk = "@@ -1 +1 @@\n-PLACEHOLDER\n+PLACEHOLDER\n";
  const patchIr = {
    task_id: taskId,
    patches: [
      { path: targetPath, hunk: diffHunk, risk: [], notes: ["fallback"] }
    ]
  };
  process.stdout.write(JSON.stringify(patchIr, null, 2));
}
