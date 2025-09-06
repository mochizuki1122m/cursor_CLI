#!/usr/bin/env node
import fs from "fs";
import crypto from "crypto";

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
  event,
  prev_hash: prevHash
};
entry.hash = crypto
  .createHash("sha256")
  .update(JSON.stringify(entry))
  .digest("hex");
fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
