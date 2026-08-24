import fs from "node:fs";
import { spawnSync } from "node:child_process";

const statusPath = "data/news/automation-status.json";
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, ["scripts/curate-news.mjs"], {
  encoding: "utf8",
  env: process.env,
  maxBuffer: 4 * 1024 * 1024
});

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

const succeeded = run.status === 0;
const rawError = succeeded ? "" : (run.stderr || run.stdout || `Process exited with status ${run.status}`);
const safeError = rawError
  .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
  .replace(/[A-Za-z0-9_-]{30,}/g, "[redacted]")
  .slice(-1800);

fs.mkdirSync("data/news", { recursive: true });
fs.writeFileSync(statusPath, JSON.stringify({
  startedAt,
  finishedAt: new Date().toISOString(),
  status: succeeded ? "success" : "failure",
  exitCode: run.status,
  error: safeError.trim() || null
}, null, 2) + "\n");

process.exitCode = run.status ?? 1;
