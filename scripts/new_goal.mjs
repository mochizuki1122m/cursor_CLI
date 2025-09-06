#!/usr/bin/env node
import fs from "fs";
import path from "path";

const id = process.argv[2] || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,14);
const dir = path.join("tickets", id);
fs.mkdirSync(dir, { recursive: true });

const specPath = path.join(dir, "spec_ir.json");
if (!fs.existsSync(specPath)) {
  let template = {};
  const tPaths = [
    "templates/spec_ir.template.json",
    "templates/spec_ir.example.json"
  ];
  for (const tp of tPaths) {
    try { template = JSON.parse(fs.readFileSync(tp, "utf8")); break; } catch {}
  }
  const nowId = id.toUpperCase();
  const nowStamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,12);
  const s = JSON.stringify(template);
  const filled = s
    .replace(/FEAT-YYYYMMDD-HHMM/g, nowId)
    .replace(/\$\{MAX_DIFF_LOC\}/g, process.env.MAX_DIFF_LOC || "400")
    .replace(/\$\{MAX_CHANGED_FILES\}/g, process.env.MAX_CHANGED_FILES || "10");
  fs.writeFileSync(specPath, JSON.stringify(JSON.parse(filled), null, 2));
}

const goPath = "dialogue/GO.txt";
if (!fs.existsSync("dialogue")) fs.mkdirSync("dialogue", { recursive: true });
fs.writeFileSync(goPath, "HOLD\n", "utf8");

console.log(`New goal scaffolded at ${dir}`);
console.log("Edit spec_ir.json then set dialogue/GO.txt to 'GO' to start.");
