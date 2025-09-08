#!/usr/bin/env node
import fs from "fs";
import { callChatJson, buildSystemPromptJsonOnly } from "./lib/llm_client.mjs";

const stdin = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
});
let understanding;
try { understanding = JSON.parse(stdin); } catch { understanding = {}; }

const system = buildSystemPromptJsonOnly("UnderstandingIR (schema/understanding_ir.schema.json)", "critic");
const user = [
  "次のUnderstandingIR(JSON)を批評し、decision.approve=true/falseと理由を返してください。",
  "不明点が残る場合は questions に具体的な追質問を補ってください。",
  JSON.stringify(understanding)
].join("\n");
const messages = [
  { role: "system", content: system },
  { role: "user", content: user },
];

try {
  const json = await callChatJson(messages);
  process.stdout.write(json);
} catch (e) {
  try {
    understanding.decision = { approve: false, reason: "fallback" };
  } catch {}
  process.stdout.write(JSON.stringify(understanding, null, 2));
}

