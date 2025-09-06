#!/usr/bin/env node
import fs from "fs";
const stdin = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
});
const patchIr = JSON.parse(stdin);
const verifyIr = {
  task_id: patchIr.task_id,
  build: { ok: true, logs_path: "logs/build.txt" },
  tests: { ok: false, failed: [], report: "logs/pytest.txt" },
  static: { ok: false, violations: ["stub"] },
  root_cause: (patchIr.patches || []).map((p) => ({
    path: p.path,
    line: 0,
    reason: "stub-review"
  }))
};
process.stdout.write(JSON.stringify(verifyIr, null, 2));
