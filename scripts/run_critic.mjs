#!/usr/bin/env node
// import fs from "fs";
import { callChatJson, buildSystemPromptJsonOnly } from "./lib/llm_client.mjs";

const stdin = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
});
const patchIr = JSON.parse(stdin);

const system = buildSystemPromptJsonOnly("VerifyIR (schema/verify_ir.schema.json)");
const user = [
  "与えられたPatchIR(JSON)を検証し、VerifyIR(JSON)のみを返してください。",
  "- build/tests/staticの各okを判定し、root_causeを必要に応じて返すこと",
  "- スキーマに不適合な場合は各ok=falseとし、違反理由をstatic.violationsに追加すること",
  "入力PatchIR:",
  JSON.stringify(patchIr)
].join("\n");
const messages = [
  { role: "system", content: system },
  { role: "user", content: user },
];

try {
  const json = await callChatJson(messages);
  process.stdout.write(json);
} catch (e) {
  const verifyIr = {
    task_id: patchIr.task_id,
    build: { ok: true, logs_path: "logs/build.txt" },
    tests: { ok: false, failed: [], report: "logs/pytest.txt" },
    static: { ok: false, violations: ["fallback"] },
    root_cause: (patchIr.patches || []).map((p) => ({ path: p.path, line: 0, reason: "fallback" }))
  };
  process.stdout.write(JSON.stringify(verifyIr, null, 2));
}
