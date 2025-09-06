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
