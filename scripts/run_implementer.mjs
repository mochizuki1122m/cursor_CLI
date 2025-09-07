#!/usr/bin/env node
import fs from "fs";
import { callChatJson, buildSystemPromptJsonOnly } from "./lib/llm_client.mjs";

const taskId = process.env.TASK_ID || "DEMO-TASK";
const specPath = process.env.SPEC_PATH || findLatestSpecPath();
const targetPath = process.env.TARGET_PATH || getPrimaryTargetPath(specPath) || "README.md";
const specSummary = loadSpecSummary(specPath);

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

function findLatestSpecPath() {
  try {
    const base = "tickets";
    const entries = fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, mtime: fs.statSync(pathJoin(base, d.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const e of entries) {
      const p = pathJoin(base, e.name, "spec_ir.json");
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return "";
}

function pathJoin(...parts) { return parts.join("/"); }

function loadSpecSummary(p) {
  if (!p) return "";
  try {
    const obj = JSON.parse(fs.readFileSync(p, "utf8"));
    const intent = obj.intent || "";
    const targets = (obj.targets || []).map((t) => t.path).join(", ");
    const constraints = (obj.constraints || []).join("; ");
    const acceptance = (obj.acceptance || []).join("; ");
    return `intent=${intent}; targets=${targets}; constraints=${constraints}; acceptance=${acceptance}`;
  } catch { return ""; }
}

function getPrimaryTargetPath(p) {
  if (!p) return "";
  try {
    const obj = JSON.parse(fs.readFileSync(p, "utf8"));
    const firstTarget = Array.isArray(obj.targets) ? obj.targets[0] : null;
    const pathStr = firstTarget && typeof firstTarget.path === "string" ? firstTarget.path : "";
    return pathStr || "";
  } catch { return ""; }
}
