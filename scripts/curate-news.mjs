import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "news");
const LATEST_PATH = path.join(OUT_DIR, "latest.json");
const ARCHIVE_PATH = path.join(OUT_DIR, "archive.json");
const EDITORIALS_PATH = path.join(OUT_DIR, "editorials.json");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const MODEL = process.env.NEWS_MODEL || "openai/gpt-4.1-mini";
const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const SCAN_HOURS = 36;

const ALLOWED_CATEGORIES = new Set([
  "Geopolitics",
  "Customs & Trade",
  "Ocean",
  "Air Cargo",
  "Project Cargo",
  "Inland Transport",
  "Energy",
  "Supply Chain"
]);

const QUERIES = [
  '("Strait of Hormuz" OR "Bab el-Mandeb" OR "Red Sea" OR "Suez Canal" OR "Panama Canal" OR "Black Sea" OR "Taiwan Strait" OR "South China Sea")',
  '(tariff OR sanctions OR customs OR "export ban" OR "import ban" OR "trade restriction" OR "export control") (shipping OR logistics OR trade OR import OR export OR freight)',
  '("port closure" OR "port strike" OR "airport closure" OR "airspace closure" OR "border closure" OR blockade OR "shipping disruption" OR "rail strike" OR "truck strike")',
  '(LNG OR tanker OR crude OR refinery OR pipeline OR bunker) (shipping OR port OR sanctions OR disruption OR attack OR closure)',
  '(earthquake OR hurricane OR typhoon OR flood OR wildfire) (port OR airport OR rail OR shipping OR logistics OR supply chain)'
];

const SOURCE_NAMES = {
  "reuters.com": "Reuters",
  "apnews.com": "Associated Press",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "wto.org": "World Trade Organization",
  "wcoomd.org": "World Customs Organization",
  "imo.org": "International Maritime Organization",
  "cbp.gov": "U.S. Customs and Border Protection",
  "ustr.gov": "U.S. Trade Representative",
  "ec.europa.eu": "European Commission"
};

const OFFICIAL_DOMAINS = new Set([
  "wto.org", "wcoomd.org", "imo.org", "cbp.gov", "ustr.gov", "ec.europa.eu",
  "gov.uk", "customs.gov.cn", "customs.go.jp", "abf.gov.au", "cbsa-asfc.gc.ca"
]);

const PRIORITY_TERMS = [
  ["strait of hormuz", 28], ["bab el-mandeb", 25], ["red sea", 20], ["suez canal", 22],
  ["panama canal", 20], ["black sea", 18], ["taiwan strait", 22], ["south china sea", 15],
  ["port closure", 22], ["airspace closure", 22], ["border closure", 20], ["blockade", 22],
  ["attack", 14], ["missile", 14], ["drone", 10], ["war", 12], ["sanction", 16],
  ["tariff", 14], ["customs", 11], ["export control", 14], ["export ban", 16], ["import ban", 16],
  ["strike", 12], ["lng", 12], ["tanker", 10], ["oil", 7], ["refinery", 8], ["pipeline", 8],
  ["port", 8], ["shipping", 8], ["freight", 8], ["air cargo", 10], ["rail", 6], ["trucking", 6],
  ["earthquake", 12], ["hurricane", 12], ["typhoon", 12], ["flood", 9], ["wildfire", 8]
];

const LOW_VALUE_TERMS = [
  "appoints", "appointment", "award", "conference sponsorship", "webinar", "celebrates",
  "opens new office", "executive joins", "partnership announcement"
];

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(raw) {
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(k => url.searchParams.delete(k));
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

function domainOf(raw) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; }
}

function sourceName(domain) {
  for (const [key, name] of Object.entries(SOURCE_NAMES)) {
    if (domain === key || domain.endsWith(`.${key}`)) return name;
  }
  return domain === "unknown" ? "Unknown source" : domain;
}

function isOfficial(domain) {
  for (const d of OFFICIAL_DOMAINS) if (domain === d || domain.endsWith(`.${d}`)) return true;
  return false;
}

function hashId(url, title) {
  return crypto.createHash("sha1").update(`${url}|${title}`).digest("hex").slice(0, 16);
}

function normalizeTitle(title) {
  return cleanText(title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function heuristicScore(article) {
  const hay = `${article.title} ${article.description || ""}`.toLowerCase();
  let score = 0;
  for (const [term, points] of PRIORITY_TERMS) if (hay.includes(term)) score += points;
  if (isOfficial(article.domain)) score += 8;
  if (LOW_VALUE_TERMS.some(term => hay.includes(term))) score -= 25;
  return score;
}

function parseGdeltDate(value) {
  const s = String(value || "");
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h = "00", mi = "00", se = "00"] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

async function fetchJson(url, timeoutMs = 15000) {
  const response = await fetch(url, {
    headers: { "User-Agent": "TheLogisticsMindset-NewsCurator/1.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchText(url, timeoutMs = 12000) {
  const response = await fetch(url, {
    headers: { "User-Agent": "TheLogisticsMindset-NewsCurator/1.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchGdelt(query) {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: "75",
    timespan: `${SCAN_HOURS}h`,
    sort: "datedesc",
    format: "json"
  });
  const data = await fetchJson(`${GDELT_ENDPOINT}?${params.toString()}`);
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.map(a => {
    const url = canonicalUrl(a.url || a.url_mobile || "");
    const domain = domainOf(url);
    return {
      title: cleanText(a.title),
      url,
      domain,
      source: sourceName(domain),
      sourceCountry: cleanText(a.sourcecountry || ""),
      language: cleanText(a.language || ""),
      publishedAt: parseGdeltDate(a.seendate),
      description: "",
      discovery: "GDELT"
    };
  }).filter(a => a.title && a.url);
}

function rssTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

async function fetchWtoRss() {
  try {
    const xml = await fetchText("https://www.wto.org/library/rss/latest_news_e.xml");
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 30);
    return items.map(([, block]) => {
      const url = canonicalUrl(rssTag(block, "link"));
      return {
        title: rssTag(block, "title"),
        url,
        domain: "wto.org",
        source: "World Trade Organization",
        sourceCountry: "International",
        language: "English",
        publishedAt: new Date(rssTag(block, "pubDate") || Date.now()).toISOString(),
        description: rssTag(block, "description").slice(0, 700),
        discovery: "WTO RSS"
      };
    }).filter(a => a.title && a.url);
  } catch (error) {
    console.warn(`WTO RSS unavailable: ${error.message}`);
    return [];
  }
}

function metaDescription(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]).slice(0, 750);
  }
  return "";
}

async function enrichDescription(article) {
  if (article.description) return article;
  try {
    const response = await fetch(article.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TheLogisticsMindset-NewsCurator/1.0; +https://riteshnair.com)"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return article;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return article;
    const html = (await response.text()).slice(0, 500000);
    return { ...article, description: metaDescription(html) };
  } catch {
    return article;
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function dedupeArticles(articles) {
  const byUrl = new Map();
  const byTitle = new Set();
  for (const article of articles) {
    const titleKey = normalizeTitle(article.title);
    if (!titleKey || titleKey.length < 12) continue;
    if (byUrl.has(article.url) || byTitle.has(titleKey)) continue;
    byUrl.set(article.url, article);
    byTitle.add(titleKey);
  }
  return [...byUrl.values()];
}

async function discoverCandidates() {
  const batches = await Promise.all(QUERIES.map(async q => {
    try { return await fetchGdelt(q); }
    catch (error) { console.warn(`GDELT query failed: ${error.message}`); return []; }
  }));
  const wto = await fetchWtoRss();
  const deduped = dedupeArticles([...batches.flat(), ...wto]);
  deduped.forEach(a => { a.preScore = heuristicScore(a); });
  const shortlist = deduped
    .filter(a => a.preScore >= 7 || isOfficial(a.domain))
    .sort((a, b) => b.preScore - a.preScore || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 48);
  return mapLimit(shortlist, 6, enrichDescription);
}

function parseModelJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

async function curateWithModel(candidates) {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for GitHub Models inference.");
  const input = candidates.map((a, index) => ({
    id: `c${index}`,
    title: a.title,
    description: a.description,
    source: a.source,
    domain: a.domain,
    sourceCountry: a.sourceCountry,
    language: a.language,
    publishedAt: a.publishedAt,
    url: a.url,
    heuristicScore: a.preScore
  }));

  const system = `You are the editor of The Logistics Mindset, a global logistics reference site. Curate news for logistics professionals from the supplied candidate metadata only. Do not invent facts that are not supported by a title, description or source metadata. Be global, not U.S.-centric. Select only developments with a tangible effect on freight, ports, shipping lanes, aviation, customs, tariffs, sanctions, energy flows, borders, rail/trucking, project cargo or supply-chain continuity. Remove duplicate versions of the same event and generic corporate PR.\n\nFor each selected item return: id, risk (critical|high|watch|normal), score 0-100, category (Geopolitics|Customs & Trade|Ocean|Air Cargo|Project Cargo|Inland Transport|Energy|Supply Chain), region, tags (4-10 concise search terms), summary (original paraphrase, max 55 words), logisticsImpact (max 45 words). Use cautious language for unconfirmed reports.\n\nAlso write one daily editorial based only on the strongest selected developments. The editorial title should be catchy and curiosity-driving, but factual and not misleading, max 85 characters. Provide a one-sentence dek and 4-6 short paragraphs totaling roughly 350-600 words. The editorial must explain the logistics connection, not merely recap politics. Return JSON only with this shape: {"editorial":{"title":"","dek":"","body":["..."],"relatedIds":["c0"]},"items":[...]}.`;

  const response = await fetch(GITHUB_MODELS_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 6500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Candidate articles:\n${JSON.stringify(input)}` }
      ]
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Models HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = await response.json();
  return { result: parseModelJson(data?.choices?.[0]?.message?.content), input };
}

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
}

function normalizeRisk(value, score) {
  const v = String(value || "").toLowerCase();
  if (["critical", "high", "watch", "normal"].includes(v)) return v;
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "watch";
  return "normal";
}

function todayInNewYork() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validateCurated(modelResult, candidatesById) {
  const items = [];
  const seen = new Set();
  for (const raw of Array.isArray(modelResult?.items) ? modelResult.items : []) {
    const candidate = candidatesById.get(String(raw.id));
    if (!candidate || seen.has(candidate.url)) continue;
    const score = clampScore(raw.score);
    const category = ALLOWED_CATEGORIES.has(raw.category) ? raw.category : "Supply Chain";
    const tags = [...new Set((Array.isArray(raw.tags) ? raw.tags : []).map(cleanText).filter(Boolean))].slice(0, 10);
    const item = {
      id: hashId(candidate.url, candidate.title),
      publishedAt: candidate.publishedAt,
      date: candidate.publishedAt.slice(0, 10),
      title: candidate.title,
      source: candidate.source,
      sourceDomain: candidate.domain,
      sourceCountry: candidate.sourceCountry,
      sourceUrl: candidate.url,
      discovery: candidate.discovery,
      risk: normalizeRisk(raw.risk, score),
      score,
      category,
      region: cleanText(raw.region || candidate.sourceCountry || "Global"),
      tags,
      summary: cleanText(raw.summary).slice(0, 650),
      logisticsImpact: cleanText(raw.logisticsImpact).slice(0, 550)
    };
    if (!item.summary || !item.logisticsImpact) continue;
    items.push(item);
    seen.add(candidate.url);
  }
  items.sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
  return items.slice(0, 18);
}

function buildEditorial(raw, candidateIdToItem, date) {
  const related = (Array.isArray(raw?.relatedIds) ? raw.relatedIds : [])
    .map(id => candidateIdToItem.get(String(id))?.id)
    .filter(Boolean)
    .slice(0, 5);
  const body = (Array.isArray(raw?.body) ? raw.body : []).map(cleanText).filter(Boolean).slice(0, 6);
  if (!cleanText(raw?.title) || body.length < 2) return null;
  return {
    date,
    title: cleanText(raw.title).slice(0, 140),
    dek: cleanText(raw.dek).slice(0, 280),
    body,
    relatedItemIds: related
  };
}

function mergeArchive(existing, newItems) {
  const map = new Map((Array.isArray(existing?.items) ? existing.items : []).map(item => [item.id, item]));
  for (const item of newItems) map.set(item.id, item);
  return {
    updatedAt: new Date().toISOString(),
    items: [...map.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.score - a.score)
  };
}

function mergeEditorials(existing, editorial) {
  const list = Array.isArray(existing?.items) ? existing.items.filter(e => e.date !== editorial.date) : [];
  list.push(editorial);
  list.sort((a, b) => b.date.localeCompare(a.date));
  return { updatedAt: new Date().toISOString(), items: list };
}

async function main() {
  ensureDir();
  console.log("Discovering global logistics-relevant news...");
  const candidates = await discoverCandidates();
  console.log(`Shortlisted ${candidates.length} candidates.`);
  if (candidates.length < 3) throw new Error("Too few candidates returned; preserving previous news rather than publishing a weak scan.");

  const { result, input } = await curateWithModel(candidates);
  const candidateMap = new Map(input.map((x, i) => [x.id, candidates[i]]));
  const curated = validateCurated(result, candidateMap);
  if (curated.length < 3) throw new Error("Model returned too few valid curated stories; preserving previous news.");

  const modelIdToPublished = new Map();
  for (const raw of Array.isArray(result.items) ? result.items : []) {
    const candidate = candidateMap.get(String(raw.id));
    if (!candidate) continue;
    const published = curated.find(item => item.sourceUrl === candidate.url);
    if (published) modelIdToPublished.set(String(raw.id), published);
  }

  const date = todayInNewYork();
  const editorial = buildEditorial(result.editorial, modelIdToPublished, date);
  if (!editorial) throw new Error("Model did not return a valid editorial; preserving previous news.");

  const generatedAt = new Date().toISOString();
  const latest = {
    generatedAt,
    scanWindowHours: SCAN_HOURS,
    model: MODEL,
    editorial,
    items: curated
  };

  const archive = mergeArchive(readJson(ARCHIVE_PATH, { items: [] }), curated);
  const editorials = mergeEditorials(readJson(EDITORIALS_PATH, { items: [] }), editorial);

  writeJson(LATEST_PATH, latest);
  writeJson(ARCHIVE_PATH, archive);
  writeJson(EDITORIALS_PATH, editorials);
  console.log(`Published ${curated.length} stories and editorial: ${editorial.title}`);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
