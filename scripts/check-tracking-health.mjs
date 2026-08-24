import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "tracking-carriers.json");
const reportPath = path.join(repoRoot, "tracking-health-report.json");

const NAV_TIMEOUT_MS = 25000;
const CONCURRENCY = 5;
const ISO_VALUES = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18,
  I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27,
  Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36,
  Y: 37, Z: 38
};

function isoCheckDigit(firstTen) {
  let sum = 0;
  for (let i = 0; i < firstTen.length; i += 1) {
    const ch = firstTen[i];
    const value = /\d/.test(ch) ? Number(ch) : ISO_VALUES[ch];
    if (value === undefined) throw new Error(`Cannot create ISO test number from ${firstTen}`);
    sum += value * (2 ** i);
  }
  const remainder = sum % 11;
  return remainder === 10 ? 0 : remainder;
}

function sampleContainer(carrier) {
  const prefix = (carrier.prefixes || []).find(value => /^[A-Z]{4}$/.test(value));
  if (!prefix) return null;
  const firstTen = `${prefix}123456`;
  return `${firstTen}${isoCheckDigit(firstTen)}`;
}

function buildOceanDirectUrl(carrier, number) {
  if (!carrier.direct || !number) return null;

  if (carrier.direct.type === "mscBase64") {
    const payload = `trackingNumber=${number}&trackingMode=0`;
    const encoded = Buffer.from(payload, "utf8").toString("base64");
    return `https://www.msc.com/en/track-a-shipment?params=${encodeURIComponent(encoded)}`;
  }

  if (!carrier.direct.template) return null;
  return carrier.direct.template.replace("{number}", encodeURIComponent(number));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sameHostFamily(a, b) {
  const aHost = hostOf(a);
  const bHost = hostOf(b);
  return aHost === bHost || aHost.endsWith(`.${bHost}`) || bHost.endsWith(`.${aHost}`);
}

async function checkUrl(context, item, mode, url) {
  const page = await context.newPage();
  const started = Date.now();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS
    });

    const statusCode = response?.status() ?? null;
    const finalUrl = page.url();
    const title = (await page.title()).trim().slice(0, 180);

    let status = "pass";
    let message = "Reachable";

    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      status = "warning";
      message = `HTTP ${statusCode}; site may be blocking automated browsers`;
    } else if (mode === "direct-handoff" && [400, 404, 422].includes(statusCode)) {
      status = "warning";
      message = `HTTP ${statusCode}; direct URL is reachable but the synthetic test reference may not exist`;
    } else if (statusCode !== null && statusCode >= 400) {
      status = "fail";
      message = `HTTP ${statusCode}`;
    } else if (!sameHostFamily(url, finalUrl)) {
      status = "warning";
      message = `Redirected to a different host: ${hostOf(finalUrl)}`;
    }

    return {
      id: item.id || item.prefix,
      name: item.name,
      transport: item.transport,
      mode,
      status,
      statusCode,
      checkedUrl: url,
      finalUrl,
      title,
      durationMs: Date.now() - started,
      message
    };
  } catch (error) {
    return {
      id: item.id || item.prefix,
      name: item.name,
      transport: item.transport,
      mode,
      status: "fail",
      statusCode: null,
      checkedUrl: url,
      finalUrl: page.url() || null,
      title: "",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await page.close();
  }
}

async function runPool(tasks, worker, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;
      results[index] = await worker(tasks[index]);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, runWorker));
  return results;
}

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36 TheLogisticsMindset-TrackerHealth/1.0",
  viewport: { width: 1280, height: 900 },
  locale: "en-US"
});

const tasks = [];
for (const carrier of data.ocean || []) {
  const item = { ...carrier, transport: "ocean" };
  tasks.push({ item, mode: "official-tracker", url: carrier.trackerUrl });

  const sample = sampleContainer(carrier);
  const directUrl = buildOceanDirectUrl(carrier, sample);
  if (directUrl) {
    tasks.push({ item, mode: "direct-handoff", url: directUrl });
  }
}

for (const airline of data.air || []) {
  const item = { ...airline, transport: "air" };
  tasks.push({ item, mode: "official-tracker", url: airline.trackerUrl });

  if (airline.direct?.template) {
    const serial = "1234567";
    const check = Number(serial) % 7;
    const awb = `${airline.prefix}-${serial}${check}`;
    const directUrl = airline.direct.template.replace("{number}", encodeURIComponent(awb));
    tasks.push({ item, mode: "direct-handoff", url: directUrl });
  }
}

let results = [];
try {
  results = await runPool(
    tasks,
    ({ item, mode, url }) => checkUrl(context, item, mode, url),
    CONCURRENCY
  );
} finally {
  await context.close();
  await browser.close();
}

const failures = results.filter(result => result.status === "fail");
const warnings = results.filter(result => result.status === "warning");
const passes = results.filter(result => result.status === "pass");

const report = {
  generatedAt: new Date().toISOString(),
  dataVersion: data.version,
  summary: {
    checks: results.length,
    pass: passes.length,
    warning: warnings.length,
    fail: failures.length
  },
  results
};

await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Tracking health: ${passes.length} pass, ${warnings.length} warning, ${failures.length} fail (${results.length} checks)`);
for (const failure of failures) {
  console.error(`FAIL ${failure.transport}/${failure.name}/${failure.mode}: ${failure.message}`);
}
for (const warning of warnings) {
  console.warn(`WARN ${warning.transport}/${warning.name}/${warning.mode}: ${warning.message}`);
}

if (failures.length > 0) process.exitCode = 1;
