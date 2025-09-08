#!/usr/bin/env node
import express from "express";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";

const app = express();
const port = Number(process.env.UI_PORT || 34100);
const publicDir = path.join(process.cwd(), "ui");

function safeJsonRead(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

// Static files
app.use(express.static(publicDir));

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

app.listen(port, () => {
  console.log(`UI server listening on http://localhost:${port}`);
});

