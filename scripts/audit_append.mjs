#!/usr/bin/env node
import fs from "fs";
import crypto from "crypto";

function anonymize(obj) {
  const json = JSON.stringify(obj);
  // Very simple PII heuristic: email/phone patterns masking
  const masked = json
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<redacted_email>")
    .replace(/\b\+?\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}\b/g, "<redacted_phone>");
  try { return JSON.parse(masked); } catch { return obj; }
}

const eventPath = process.argv[2];
if (!eventPath) {
  console.error("Usage: node scripts/audit_append.mjs <event_json_path>");
  process.exit(2);
}
const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const now = new Date();
const y = now.getUTCFullYear();
const m = String(now.getUTCMonth() + 1).padStart(2, "0");
const d = String(now.getUTCDate()).padStart(2, "0");
const dir = "audit";
const logPath = `${dir}/log-${y}${m}${d}.jsonl`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
let prevHash = "";
if (fs.existsSync(logPath) && fs.statSync(logPath).size > 0) {
  const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  const last = JSON.parse(lines[lines.length - 1]);
  prevHash = last.hash || "";
}
const entry = {
  timestamp: now.toISOString(),
  event_path: eventPath,
  event: anonymize(event),
  prev_hash: prevHash
};
entry.hash = crypto
  .createHash("sha256")
  .update(JSON.stringify(entry))
  .digest("hex");
fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
