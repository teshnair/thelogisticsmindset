import fs from "node:fs";

const checkpointPath = "data/trade-regulatory-reviewed.json";
const reportPath = "trade-regulatory-watch-report.json";
const strict = process.env.REGULATORY_WATCH_STRICT === "1";

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const reviewedThrough = checkpoint.reviewedThrough;
if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedThrough || "")) {
  throw new Error("Invalid reviewedThrough date in trade-regulatory-reviewed.json");
}

const terms = [
  "Section 301",
  "Section 232",
  "Chapter 99",
  "Harmonized Tariff Schedule",
  "additional duties",
  "reciprocal tariff",
  "customs duties"
];

const HTS_ARCHIVE_URL = "https://www.usitc.gov/harmonized_tariff_information/hts/archive/list";
const officialSources = [
  { name: "USITC HTS", url: "https://hts.usitc.gov/" },
  { name: "USITC HTS archive", url: HTS_ARCHIVE_URL },
  { name: "USTR Section 301 search", url: "https://ustr.gov/issue-areas/enforcement/section-301-investigations/search" },
  { name: "USTR tariff actions", url: "https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions" },
  { name: "CBP trade remedies", url: "https://www.cbp.gov/trade/programs-administration/trade-remedies" },
  { name: "Federal Register", url: "https://www.federalregister.gov/" }
];

function afterReviewed(date) {
  return typeof date === "string" && date > reviewedThrough;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "TheLogisticsMindset-Regulatory-Watch/2.0 (+https://riteshnair.com)",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function plainText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function readCurrentHtsRevision() {
  const res = await fetchWithTimeout(HTS_ARCHIVE_URL, { method: "GET" }, 15000);
  if (!res.ok) throw new Error(`USITC archive returned ${res.status}`);
  const text = plainText(await res.text());
  const match = text.match(/2026\s+HTS\s+Revision\s+(\d+)\s*\(([^)]+)\)/i);
  if (!match) throw new Error("Could not identify the current 2026 HTS revision from the USITC archive.");
  return {
    year: 2026,
    revision: Number(match[1]),
    label: `2026 HTS Revision ${Number(match[1])}`,
    publishedDateText: match[2].trim(),
    source: HTS_ARCHIVE_URL
  };
}

const sourceHealth = [];
for (const source of officialSources) {
  try {
    const res = await fetchWithTimeout(source.url, { method: "GET" }, 12000);
    sourceHealth.push({ name: source.name, url: source.url, ok: res.ok, status: res.status });
  } catch (error) {
    sourceHealth.push({ name: source.name, url: source.url, ok: false, error: error?.message || String(error) });
  }
}

let currentHtsRevision = null;
let htsRevisionError = null;
try {
  currentHtsRevision = await readCurrentHtsRevision();
} catch (error) {
  htsRevisionError = error?.message || String(error);
}

const reviewedHtsRevision = Number(checkpoint.htsRevision || 0) || null;
const htsRevisionChanged = Boolean(
  currentHtsRevision &&
  reviewedHtsRevision !== currentHtsRevision.revision
);

const findingsByDocument = new Map();
for (const term of terms) {
  const params = new URLSearchParams({
    per_page: "100",
    order: "newest",
    "conditions[term]": term,
    "conditions[publication_date][gte]": reviewedThrough
  });
  const url = `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 15000);
    if (!res.ok) throw new Error(`Federal Register returned ${res.status}`);
    const json = await res.json();
    for (const doc of json.results || []) {
      if (!afterReviewed(doc.publication_date)) continue;
      const key = doc.document_number || doc.html_url || `${doc.publication_date}|${doc.title}`;
      const existing = findingsByDocument.get(key) || {
        documentNumber: doc.document_number || null,
        title: doc.title || "Untitled notice",
        publicationDate: doc.publication_date || null,
        agencyNames: (doc.agencies || []).map(a => a.name).filter(Boolean),
        htmlUrl: doc.html_url || null,
        pdfUrl: doc.pdf_url || null,
        matchedTerms: []
      };
      if (!existing.matchedTerms.includes(term)) existing.matchedTerms.push(term);
      findingsByDocument.set(key, existing);
    }
  } catch (error) {
    findingsByDocument.set(`error:${term}`, {
      error: true,
      title: `Federal Register search failed for ${term}`,
      message: error?.message || String(error),
      matchedTerms: [term]
    });
  }
}

const findings = [...findingsByDocument.values()];
const sourceFailures = sourceHealth.filter(x => !x.ok);
const materialFindings = findings.filter(x => !x.error);
const searchFailures = findings.filter(x => x.error);

const report = {
  generatedAt: new Date().toISOString(),
  reviewedThrough,
  strict,
  hts: {
    reviewedRevision: reviewedHtsRevision,
    current: currentHtsRevision,
    revisionChanged: htsRevisionChanged,
    error: htsRevisionError
  },
  summary: {
    officialSourcesChecked: sourceHealth.length,
    sourceFailures: sourceFailures.length,
    newFederalRegisterDocuments: materialFindings.length,
    searchFailures: searchFailures.length,
    htsRevisionChanged,
    htsRevisionCheckFailed: Boolean(htsRevisionError)
  },
  sourceHealth,
  findings
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`Regulatory watch checked ${sourceHealth.length} official sources.`);
console.log(`Reviewed-through checkpoint: ${reviewedThrough}`);
console.log(`Reviewed HTS revision: ${reviewedHtsRevision ?? "not recorded"}`);
console.log(`Current HTS revision: ${currentHtsRevision?.revision ?? "unavailable"}`);
console.log(`New potentially relevant Federal Register documents: ${materialFindings.length}`);

if (htsRevisionChanged) {
  console.error(`USITC HTS revision changed from ${reviewedHtsRevision ?? "unrecorded"} to ${currentHtsRevision.revision}.`);
}
if (htsRevisionError) {
  console.error(`USITC HTS revision check failed: ${htsRevisionError}`);
}
if (materialFindings.length) {
  for (const item of materialFindings.slice(0, 20)) {
    console.log(`- ${item.publicationDate}: ${item.title}`);
  }
}
if (sourceFailures.length || searchFailures.length) {
  console.error("One or more regulatory sources could not be checked reliably.");
}

const requiresReview = Boolean(
  materialFindings.length ||
  sourceFailures.length ||
  searchFailures.length ||
  htsRevisionChanged ||
  htsRevisionError
);

if (strict && requiresReview) {
  console.error("Production release blocked: regulatory review is required before publishing.");
  process.exit(2);
}
