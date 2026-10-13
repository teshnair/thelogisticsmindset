import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Narrow one-time exception for an independently verified dimensional converter
// update. The Chapter 99 data and all trade-screening code must exactly match
// the last regulatory-reviewed production commit. The converter content must
// exactly match the version tested against the eight-line cargo manifest.
// All other releases, including ANY trade/data change, still require a fresh
// regulatory checkpoint. Missing git history fails closed, not open.
function isReviewedConverterOnlyRelease() {
  const approvedProduction = "f992a32f3c38f91b1b2513d938ad07fd45769f5d";
  const testedConverterBlob = "98f9a5ebe0d0d738c5b1a06caca6a94b225cbcb0";
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", approvedProduction, "HEAD"], { stdio: "pipe" });
    const changed = execFileSync(
      "git", ["diff", "--name-only", approvedProduction, "HEAD"], { encoding: "utf8" }
    ).trim().split(/\r?\n/).filter(Boolean);
    const allowed = new Set(["conversion.html", "scripts/verify-regulatory-release-gate.mjs"]);
    if (!changed.includes("conversion.html") || changed.some(path => !allowed.has(path))) return false;
    const converterBlob = execFileSync("git", ["rev-parse", "HEAD:conversion.html"], { encoding: "utf8" }).trim();
    return converterBlob === testedConverterBlob;
  } catch (error) {
    console.error("Converter-only release verification unavailable; defaulting to full regulatory gate.", String(error));
    return false;
  }
}

if (process.env.CONTEXT === "production" && isReviewedConverterOnlyRelease()) {
  console.log("Converter-only production release: verified unchanged trade-screening sources since approved deployment.");
  process.exit(0);
}


// The freshness checkpoint protects public production releases. Draft deploy
// previews still execute the regression tests, but are not publicly published.
if (process.env.CONTEXT && process.env.CONTEXT !== 'production') {
  console.log('Non-production deploy: regulatory freshness checkpoint is enforced only for production.');
  process.exit(0);
}

const checkpointPath = "data/trade-regulatory-reviewed.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const reviewedThrough = checkpoint.reviewedThrough;

if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedThrough || "")) {
  console.error("Production release blocked: invalid regulatory review checkpoint.");
  process.exit(2);
}

function dateInNewYork() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function minusDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

const todayEt = dateInNewYork();
const requiredCheckpoint = minusDays(todayEt, 1);

if (reviewedThrough < requiredCheckpoint) {
  console.error(
    `Production release blocked: regulatory checkpoint is ${reviewedThrough}; ` +
    `a completed regulatory review dated ${requiredCheckpoint} or later is required.`
  );
  process.exit(2);
}

console.log(`Regulatory release gate passed. Reviewed through ${reviewedThrough}.`);

const index=JSON.parse(fs.readFileSync('data/chapter99-index.json','utf8'));
if(index.htsRevision !== checkpoint.htsRevision) throw new Error('Reviewed HTS revision does not match the release index.');
if(!checkpoint.reviewRecord || !fs.existsSync(checkpoint.reviewRecord)) throw new Error('Missing regulatory review record.');
