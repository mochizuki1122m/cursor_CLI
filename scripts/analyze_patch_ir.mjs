#!/usr/bin/env node
import fs from "fs";

const inPath = process.argv[2] || "patches/patch_ir.json";
const outPath = process.argv[3] || "review/reports/analysis.json";

if (!fs.existsSync(inPath)) {
  console.error(`PatchIR not found: ${inPath}`);
  process.exit(2);
}

const patchIr = JSON.parse(fs.readFileSync(inPath, "utf8"));
const patches = Array.isArray(patchIr.patches) ? patchIr.patches : [];
const changedFiles = new Set();
let diffLoc = 0;

for (const p of patches) {
  if (p?.path) changedFiles.add(p.path);
  const hunk = String(p?.hunk || "");
  const lines = hunk.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("@@")) continue; // header
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue; // file headers inside hunk
    if (line.startsWith("+")) { diffLoc += 1; continue; }
    if (line.startsWith("-")) { diffLoc += 1; continue; }
  }
}

const result = {
  task_id: patchIr.task_id || null,
  changed_files: changedFiles.size,
  diff_loc: diffLoc,
};

fs.mkdirSync("review/reports", { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(outPath);
