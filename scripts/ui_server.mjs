#!/usr/bin/env node
import express from "express";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const app = express();
const port = Number(process.env.UI_PORT || 34100);
const publicDir = path.join(process.cwd(), "ui");

function safeJsonRead(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

// Static files
app.use(express.static(publicDir));

// JSON body
app.use(express.json({ limit: "1mb" }));

// SSE endpoint for events
app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Initial snapshot
  send("snapshot", {
    patch: safeJsonRead("patches/patch_ir.json"),
    verify: safeJsonRead("review/reports/verify_ir.json"),
    score: safeJsonRead("review/reports/scorecard.json"),
  });

  const watcher = chokidar.watch([
    "patches/patch_ir.json",
    "review/reports/verify_ir.json",
    "review/reports/analysis.json",
    "review/reports/scorecard.json",
    "audit/*.jsonl",
    "dialogue/GO.txt",
  ], { ignoreInitial: true });

  watcher.on("add", (p) => send("file_add", { path: p }));
  watcher.on("change", (p) => {
    let payload = null;
    if (p.endsWith("patch_ir.json") || p.endsWith("verify_ir.json") || p.endsWith("scorecard.json") || p.endsWith("analysis.json")) {
      payload = safeJsonRead(p);
    } else if (p.endsWith("GO.txt")) {
      try { payload = fs.readFileSync(p, "utf8").trim(); } catch {}
    }
    send("file_change", { path: p, content: payload });
  });
  watcher.on("unlink", (p) => send("file_unlink", { path: p }));

  req.on("close", () => watcher.close().catch(() => {}));
});

function readTemplateSpec() {
  const tPaths = [
    path.join("templates", "spec_ir.template.json"),
    path.join("templates", "spec_ir.example.json"),
  ];
  for (const p of tPaths) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
  }
  return {
    task_id: "FEAT-YYYYMMDD-HHMM",
    intent: "feature",
    constraints: [],
    targets: [{ path: "README.md", region: { from: 1, to: 200 } }],
    acceptance: ["tests pass"],
  };
}

// Return template spec with a suggested id
app.get("/api/spec-template", (req, res) => {
  const t = readTemplateSpec();
  const id = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  const suggested = JSON.parse(JSON.stringify(t));
  suggested.task_id = (t.task_id || "FEAT-") + id;
  res.json(suggested);
});

// Return raw template without timestamp (for human editing exactly as template)
app.get("/api/spec-template-raw", (req, res) => {
  res.json(readTemplateSpec());
});

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function spawnRelay() {
  const auto = String(process.env.UI_AUTOSTART_RELAY ?? "true").toLowerCase() === "true";
  if (!auto) return;
  const rounds = process.env.UI_ROUNDS || "3";
  if (process.platform === "win32") {
    spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/relay.ps1", "-Rounds", rounds, "-RequireGo", "-StopOnClean"], { stdio: "ignore", detached: true }).unref();
  } else {
    spawn("bash", ["scripts/relay.sh", "--rounds", rounds, "--require-go", "--stop-on-clean"], { stdio: "ignore", detached: true }).unref();
  }
}

// Create goal and optionally start relay by opening GO gate
app.post("/api/goals", (req, res) => {
  try {
    const body = req.body || {};
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return res.status(400).json({ error: "task_id required" });
    const dir = path.join("tickets", task_id);
    ensureDir(dir);
    const intent = ["feature", "bugfix", "refactor"].includes(body.intent) ? body.intent : "feature";
    const normalizeList = (v) => Array.isArray(v) ? v : (String(v || "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
    const constraints = normalizeList(body.constraints);
    const acceptance = normalizeList(body.acceptance);
    const targets = Array.isArray(body.targets) && body.targets.length > 0 ? body.targets.map(t => ({
      path: String(t.path || "README.md"),
      region: t.region && Number(t.region.from) && Number(t.region.to) ? { from: Number(t.region.from), to: Number(t.region.to) } : undefined,
    })) : [{ path: "README.md", region: { from: 1, to: 200 } }];
    const spec = { task_id, intent, constraints, targets, acceptance };
    fs.writeFileSync(path.join(dir, "spec_ir.json"), JSON.stringify(spec, null, 2));
    ensureDir("dialogue");
    const autoStart = body.autoStart !== false;
    fs.writeFileSync(path.join("dialogue", "GO.txt"), autoStart ? "GO\n" : "HOLD\n");
    // Notify clients
    // Fire-and-forget spawn
    if (autoStart) spawnRelay();
    res.json({ ok: true, dir, spec_path: path.join(dir, "spec_ir.json"), started: autoStart });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Accept full SpecIR JSON, validate, save ticket, set GO optionally
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
let specSchema = null;
try {
  specSchema = JSON.parse(fs.readFileSync(path.join("schema", "spec_ir.schema.json"), "utf8"));
} catch {}
const validateSpec = specSchema ? ajv.compile(specSchema) : null;

app.post("/api/spec", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") return res.status(400).json({ error: "JSON body required" });
    if (!validateSpec) return res.status(500).json({ error: "Spec schema not available" });
    const ok = validateSpec(body);
    if (!ok) return res.status(400).json({ error: "schema_invalid", details: validateSpec.errors });
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return res.status(400).json({ error: "task_id required" });
    const dir = path.join("tickets", task_id);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, "spec_ir.json"), JSON.stringify(body, null, 2));
    ensureDir("dialogue");
    const autoStart = String(req.query.autoStart ?? "true").toLowerCase() !== "false";
    fs.writeFileSync(path.join("dialogue", "GO.txt"), autoStart ? "GO\n" : "HOLD\n");
    if (autoStart) spawnRelay();
    res.json({ ok: true, dir, spec_path: path.join(dir, "spec_ir.json"), started: autoStart });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`UI server listening on http://localhost:${port}`);
});

