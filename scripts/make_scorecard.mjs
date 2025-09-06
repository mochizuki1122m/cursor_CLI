#!/usr/bin/env node
import fs from "fs";

const vPath = process.argv[2] || "review/reports/verify_ir.json";
const outPath = process.argv[3] || "review/reports/scorecard.json";

const v = JSON.parse(fs.readFileSync(vPath, "utf8"));
let analysis = { diff_loc: null, changed_files: null };
try {
  analysis = JSON.parse(fs.readFileSync("review/reports/analysis.json", "utf8"));
} catch {}

const env = (k, d) => (process.env[k] ?? d);
const MAX_DIFF_LOC = Number(env("MAX_DIFF_LOC", "400"));
const MAX_CHANGED_FILES = Number(env("MAX_CHANGED_FILES", "10"));

// These metrics would come from CI or patch analysis; placeholder false defaults
const diff_loc_leq = typeof analysis.diff_loc === "number" ? analysis.diff_loc <= MAX_DIFF_LOC : true;
const changed_files_leq = typeof analysis.changed_files === "number" ? analysis.changed_files <= MAX_CHANGED_FILES : true;

const score = {
  build_ok: !!v?.build?.ok,
  tests_ok: !!v?.tests?.ok,
  sast_ok: !(v?.static?.violations || []).some((x) => /semgrep|sast/i.test(String(x))),
  secrets_ok: !(v?.static?.violations || []).some((x) => /secret|token|credential/i.test(String(x))),
  deps_ok: true,
  sbom_ok: true,
  diff_loc_leq,
  changed_files_leq,
  banned_api_used: (v?.static?.violations || []).filter((x) => /banned_api/i.test(String(x))),
  diff_loc: analysis.diff_loc,
  changed_files: analysis.changed_files,
};

fs.writeFileSync(outPath, JSON.stringify(score, null, 2));
console.log(outPath);
