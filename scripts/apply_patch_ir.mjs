#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", ...opts });
  return res;
}

const patchJsonPath = process.argv[2] || "patches/patch_ir.json";
if (!fs.existsSync(patchJsonPath)) {
  console.error(`PatchIR not found: ${patchJsonPath}`);
  process.exit(2);
}

const patchIr = JSON.parse(fs.readFileSync(patchJsonPath, "utf8"));
const patches = Array.isArray(patchIr.patches) ? patchIr.patches : [];
if (patches.length === 0) {
  console.error("No patches to apply");
  process.exit(1);
}

// Compose a unified diff file from PatchIR entries
const diffParts = patches.map((p) => {
  const filePath = p.path;
  const hunk = (p.hunk || "").endsWith("\n") ? p.hunk : (p.hunk || "") + "\n";
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    hunk.trimEnd(),
    "",
  ].join("\n");
});
const diffText = diffParts.join("\n");

const tmpDir = path.join(".cache");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpPatch = path.join(tmpDir, `apply-${Date.now()}.diff`);
fs.writeFileSync(tmpPatch, diffText + "\n", "utf8");

// Verify we are in a git repo
let res = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (res.status !== 0 || String(res.stdout).trim() !== "true") {
  console.error("Not a git repository; cannot apply patch safely");
  process.exit(2);
}

// Try to apply with 3-way merge and whitespace fix
res = run("git", ["apply", "--3way", "--whitespace=fix", tmpPatch]);
if (res.status === 0) {
  console.log(JSON.stringify({ ok: true, applied: patches.length, patch: tmpPatch }));
  process.exit(0);
}

// On failure, do not modify working tree; keep patch file for inspection
const stderr = (res.stderr || "").slice(0, 2000);
console.error(JSON.stringify({ ok: false, error: "git apply failed", detail: stderr, patch: tmpPatch }));
process.exit(1);

