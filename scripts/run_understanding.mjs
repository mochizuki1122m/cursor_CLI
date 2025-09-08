#!/usr/bin/env node
import fs from "fs";
import { callChatJson, buildSystemPromptJsonOnly } from "./lib/llm_client.mjs";

const specPath = process.argv[2] || process.env.SPEC_PATH || "";
const taskId = process.argv[3] || process.env.TASK_ID || "UNKNOWN-TASK";
const specMd = specPath && fs.existsSync(specPath)
  ? fs.readFileSync(specPath, "utf8")
  : String(process.env.SPEC_MD || "");

const system = buildSystemPromptJsonOnly("UnderstandingIR (schema/understanding_ir.schema.json)", "implementer");
const user = [
  "次のMarkdown仕様を理解し、要約・前提・不明点（質問）・リスク・提案を UnderstandingIR(JSON) で出力してください。",
  `task_id=${taskId}`,
  specMd
].join("\n\n");
const messages = [
  { role: "system", content: system },
  { role: "user", content: user },
];

try {
  const json = await callChatJson(messages);
  process.stdout.write(json);
} catch (e) {
  const fallback = {
    task_id: taskId,
    summary: "fallback",
    questions: ["仕様の不明点を列挙してください"],
    assumptions: [],
    risks: [],
    suggested_targets: [],
    suggested_acceptance: [],
    next_actions: ["不足情報を補い再送"],
    decision: { approve: false, reason: "LLM call failed" }
  };
  process.stdout.write(JSON.stringify(fallback, null, 2));
}

