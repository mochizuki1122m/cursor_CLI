#!/usr/bin/env node
import fs from "fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaPath = process.argv[2];
if (!schemaPath) {
  console.error("Usage: node scripts/validate_json.mjs <schema.json>");
  process.exit(2);
}
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const stdin = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
});
// Natural language / non-JSON guardrails
const trimmed = stdin.trimStart();
if (!trimmed.startsWith("{")) {
  console.error("Non-JSON output detected: payload must start with '{'");
  process.exit(1);
}
// Simple heuristic: ratio of letters/punctuation typical for prose
const asciiLetters = (trimmed.match(/[A-Za-z]{5,}/g) || []).length;
const jpPunct = (trimmed.match(/[。、「」]/g) || []).length;
const commas = (trimmed.match(/[,，]/g) || []).length;
const periods = (trimmed.match(/[.。]/g) || []).length;
const proseScore = asciiLetters + jpPunct + Math.max(0, commas - 3) + Math.max(0, periods - 3);
if (proseScore > 50) {
  console.error("Likely natural language detected: refuse non-JSON prose");
  process.exit(1);
}
let payload;
try {
  payload = JSON.parse(stdin);
} catch (e) {
  console.error("Invalid JSON input:", e.message);
  process.exit(1);
}
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const ok = validate(payload);
if (!ok) {
  console.error(JSON.stringify({ errors: validate.errors }, null, 2));
  process.exit(1);
}
process.stdout.write(JSON.stringify(payload, null, 2));
