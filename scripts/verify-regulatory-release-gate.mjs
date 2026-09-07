import fs from "node:fs";

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
    `a successful Saturday check dated ${requiredCheckpoint} or later is required.`
  );
  process.exit(2);
}

console.log(`Regulatory release gate passed. Reviewed through ${reviewedThrough}.`);
