#!/usr/bin/env node
import fs from "fs";
import crypto from "crypto";

function readEnv(name, fallback) {
  const val = process.env[name];
  return val !== undefined && val !== "" ? val : fallback;
}

function getConfig() {
  const baseFromOpenAI = readEnv("OPENAI_API_BASE", "");
  const baseFromLite = readEnv("LITELLM_PROXY_URL", "");
  const apiBase = baseFromOpenAI || baseFromLite || "https://api.openai.com";
  const apiKey = readEnv("OPENAI_API_KEY", readEnv("LITELLM_API_KEY", ""));
  const model = readEnv("LLM_MODEL", "gpt-4o-mini");
  const temperature = Number(readEnv("LLM_TEMPERATURE", "0.15"));
  const top_p = Number(readEnv("LLM_TOP_P", "0.8"));
  const timeoutMs = Number(readEnv("LLM_TIMEOUT_MS", "45000"));
  const maxTokens = Number(readEnv("LLM_MAX_TOKENS", "1000"));
  const maxRetries = Number(readEnv("LLM_MAX_RETRIES", "3"));
  const backoffMs = Number(readEnv("LLM_BACKOFF_MS", "600"));
  const cbFile = ".cache/llm_cb.json";
  const cbFailureThreshold = Number(readEnv("LLM_CB_FAILURE_THRESHOLD", "3"));
  const cbOpenMs = Number(readEnv("LLM_CB_OPEN_MS", "300000"));
  return {
    apiBase,
    apiKey,
    model,
    temperature,
    top_p,
    timeoutMs,
    maxTokens,
    maxRetries,
    backoffMs,
    cbFile,
    cbFailureThreshold,
    cbOpenMs,
  };
}

function ensureCacheDir() {
  if (!fs.existsSync(".cache")) {
    fs.mkdirSync(".cache", { recursive: true });
  }
}

function readCircuitState(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { open: false, failures: 0, openedAt: 0 };
  }
}

function writeCircuitState(filePath, state) {
  ensureCacheDir();
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function callChatJson(messages) {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    throw new Error("LLM API key is not configured (OPENAI_API_KEY or LITELLM_API_KEY)");
  }
  // Circuit breaker
  const cb = readCircuitState(cfg.cbFile);
  if (cb.open) {
    const now = Date.now();
    if (now - cb.openedAt < cfg.cbOpenMs) {
      throw new Error("LLM circuit breaker is open; skipping call");
    } else {
      // half-open
      cb.open = false;
      cb.failures = 0;
      writeCircuitState(cfg.cbFile, cb);
    }
  }
  let attempt = 0;
  let lastErr = null;
  while (attempt <= cfg.maxRetries) {
    try {
      const controller = new AbortController();
      const idempKey = crypto.randomUUID();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      const res = await fetch(`${cfg.apiBase.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
          "x-idempotency-key": idempKey,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature: cfg.temperature,
          top_p: cfg.top_p,
          max_tokens: cfg.maxTokens,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 500)}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      if (typeof content !== "string" || !content.trim().startsWith("{")) {
        throw new Error("LLM did not return JSON object content");
      }
      // success → reset breaker
      writeCircuitState(cfg.cbFile, { open: false, failures: 0, openedAt: 0 });
      return content.trim();
    } catch (err) {
      lastErr = err;
      attempt += 1;
      // breaker update
      const s = readCircuitState(cfg.cbFile);
      s.failures += 1;
      if (s.failures >= cfg.cbFailureThreshold) {
        s.open = true;
        s.openedAt = Date.now();
      }
      writeCircuitState(cfg.cbFile, s);
      if (attempt > cfg.maxRetries) {
        break;
      }
      const jitter = Math.floor(Math.random() * 250);
      const backoff = cfg.backoffMs * Math.pow(2, attempt - 1) + jitter;
      await sleep(backoff);
    }
  }
  throw lastErr || new Error("LLM call failed");
}

export function buildSystemPromptJsonOnly(schemaName) {
  return [
    "あなたは厳格なJSONエンジンです。",
    "自然言語の文章・説明は禁止です。",
    `出力は必ず ${schemaName} のJSONオブジェクト1個のみ。`,
    "先頭と末尾に余計なテキストを含めないでください。",
  ].join("\n");
}

