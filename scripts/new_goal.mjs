#!/usr/bin/env node
import fs from "fs";
import path from "path";

const id = process.argv[2] || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,14);
const dir = path.join("tickets", id);
fs.mkdirSync(dir, { recursive: true });

const specPath = path.join(dir, "spec_ir.json");
if (!fs.existsSync(specPath)) {
  let template = {};
  try { template = JSON.parse(fs.readFileSync("templates/spec_ir.example.json", "utf8")); } catch {}
  template.task_id = id.toUpperCase();
  fs.writeFileSync(specPath, JSON.stringify(template, null, 2));
}

const goPath = "dialogue/GO.txt";
if (!fs.existsSync("dialogue")) fs.mkdirSync("dialogue", { recursive: true });
fs.writeFileSync(goPath, "HOLD\n", "utf8");

console.log(`New goal scaffolded at ${dir}`);
console.log("Edit spec_ir.json then set dialogue/GO.txt to 'GO' to start.");
