const USITC_SEARCH = "https://hts.usitc.gov/reststop/search";
const CH99_PAGE = "https://hts.usitc.gov/search?query=9903.01.11";
const USITC_ARCHIVE = "https://www.usitc.gov/harmonized_tariff_information/hts/archive/list";

let chapter99Cache: { text: string; fetchedAt: number } | null = null;
let revisionCache: { label: string | null; date: string | null; fetchedAt: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function clean(value: unknown) {
  return String(value ?? "").replace(/<\/?il>/gi, "").replace(/\s+/g, " ").trim();
}

function format8(code: string) {
  const d = digits(code).slice(0, 8);
  if (d.length < 8) return d;
  return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/div>|<\/tr>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchWithTimeout(url: string, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TheLogisticsMindset-TradeRules/2.0 (+https://riteshnair.com)",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRows(keyword: string) {
  const url = new URL(USITC_SEARCH);
  url.searchParams.set("keyword", keyword);
  const res = await fetchWithTimeout(url.toString(), 15000);
  if (!res.ok) throw new Error(`USITC search returned ${res.status}`);
  const raw = await res.text();
  const json = JSON.parse(raw);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function getCurrentRevision() {
  if (revisionCache && Date.now() - revisionCache.fetchedAt < CACHE_MS) return revisionCache;
  let label: string | null = null;
  let date: string | null = null;
  try {
    const res = await fetchWithTimeout(USITC_ARCHIVE, 12000);
    if (res.ok) {
      const text = stripHtml(await res.text());
      const m = text.match(/(2026 HTS Revision\s+\d+)\s*\(([^)]+)\)/i);
      if (m) { label = m[1]; date = m[2]; }
    }
  } catch {}
  revisionCache = { label, date, fetchedAt: Date.now() };
  return revisionCache;
}

async function getChapter99Text() {
  if (chapter99Cache && Date.now() - chapter99Cache.fetchedAt < CACHE_MS) return chapter99Cache.text;
  const res = await fetchWithTimeout(CH99_PAGE, 15000);
  if (!res.ok) throw new Error(`Chapter 99 source returned ${res.status}`);
  const text = stripHtml(await res.text());
  chapter99Cache = { text, fetchedAt: Date.now() };
  return text;
}

function flatten(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === "object") return Object.values(value).flatMap(flatten);
  return [];
}

function ch99Refs(texts: string[]) {
  const out = new Set<string>();
  for (const t of texts) {
    for (const m of String(t).matchAll(/\b99\d{2}\.\d{2}\.\d{2}\b/g)) out.add(m[0]);
  }
  return [...out];
}

function programFor(ref: string, context = "") {
  if (/^9903\.(88|90|91)\./.test(ref) || /section\s*301/i.test(context)) return "Section 301";
  if (/^9903\.(82|85|86|94)\./.test(ref) || /section\s*232/i.test(context)) return "Section 232";
  if (/safeguard|section\s*201/i.test(context)) return "Section 201 / safeguard";
  if (/section\s*122/i.test(context)) return "Section 122";
  return "Chapter 99";
}

function collectCodeContexts(ch99Text: string, code8: string) {
  const needle = format8(code8);
  const compactNeedle = digits(code8);
  const candidates: { context: string; refs: string[]; programHints: string[] }[] = [];
  const normalized = ch99Text;
  const positions = new Set<number>();
  let i = 0;
  while ((i = normalized.indexOf(needle, i)) >= 0) { positions.add(i); i += needle.length; }
  if (!positions.size) {
    i = 0;
    while ((i = normalized.indexOf(compactNeedle, i)) >= 0) { positions.add(i); i += compactNeedle.length; }
  }
  for (const pos of positions) {
    const before = normalized.slice(Math.max(0, pos - 9000), pos);
    const after = normalized.slice(pos, Math.min(normalized.length, pos + 1200));
    const context = `${before}\n${after}`;
    const refs = ch99Refs([context]).slice(-12);
    const programHints: string[] = [];
    if (/section\s*301|products? of China|U\.S\. note 20|U\.S\. note 31/i.test(context)) programHints.push("Section 301");
    if (/section\s*232|U\.S\. note 16|U\.S\. note 33|steel|aluminum|copper|passenger vehicles/i.test(context)) programHints.push("Section 232");
    candidates.push({ context, refs, programHints: [...new Set(programHints)] });
  }
  return candidates;
}

function countryCompatibility(context: string, country: string) {
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const countryName = dn.of(country) || country;
  const low = context.toLowerCase();
  const own = countryName.toLowerCase();
  if (low.includes("products of china") || low.includes("product of china")) return country === "CN" ? "match" : "no-match";
  if (low.includes("products of brazil") || low.includes("product of brazil")) return country === "BR" ? "match" : "no-match";
  if (low.includes("products of russia") || low.includes("product of russia") || low.includes("russian federation")) return country === "RU" ? "match" : "no-match";
  if (low.includes("products of canada") || low.includes("product of canada")) return country === "CA" ? "match" : "no-match";
  if (low.includes("products of mexico") || low.includes("product of mexico")) return country === "MX" ? "match" : "no-match";
  if (low.includes(`products of ${own}`) || low.includes(`product of ${own}`) || low.includes(own)) return "match";
  if (/all countries|regardless of country|any country|articles provided for in/i.test(low)) return "possible";
  return "unknown";
}

function parsePercent(rateText: string) {
  const m = clean(rateText).match(/(?:plus|additional(?: duty of)?|rate of)\s*(\d+(?:\.\d+)?)\s*%/i)
    || clean(rateText).match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m ? Number(m[1]) : null;
}

async function resolveChapter99(ref: string) {
  try {
    const rows = await fetchRows(ref.replace(/\./g, ""));
    const row = rows.find((r: any) => clean(r?.htsno) === ref) || rows.find((r: any) => digits(r?.htsno) === digits(ref));
    if (!row) return { hts: ref, found: false };
    const general = clean(row?.general);
    const additional = clean(row?.additionalDuties);
    const description = clean(row?.description);
    const rateText = additional || general;
    return {
      hts: ref,
      found: true,
      description,
      general,
      additionalDuties: additional,
      rateText,
      ratePercent: parsePercent(rateText)
    };
  } catch (error: any) {
    return { hts: ref, found: false, error: error?.message || String(error) };
  }
}

function directRowSignals(rows: any[]) {
  const texts = rows.flatMap((r: any) => [
    clean(r?.description), clean(r?.general), clean(r?.special), clean(r?.other), clean(r?.additionalDuties), ...flatten(r?.footnotes).map(clean)
  ]).filter(Boolean);
  return { texts, refs: ch99Refs(texts) };
}

function requiredFactsFor(program: string, context: string) {
  const facts: string[] = [];
  const low = context.toLowerCase();
  if (program === "Section 232" && /melt|pour/i.test(context)) facts.push("meltPourCountry");
  if (program === "Section 232" && /content|declared value of the (?:steel|aluminum|copper) content/i.test(context)) facts.push("metalContentValue");
  if (/vehicle|automobile|passenger vehicle|light truck/i.test(context)) facts.push("vehicleManufactureYear");
  if (/usmca|eligible for special tariff treatment/i.test(low)) facts.push("ftaQualification");
  return [...new Set(facts)];
}

async function handler(req: Request) {
  try {
    let input: any = {};
    if (req.method === "GET") {
      const url = new URL(req.url);
      input = Object.fromEntries(url.searchParams.entries());
    } else if (req.method === "POST") {
      input = await req.json();
    } else {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const hts = digits(input?.hts);
    const country = String(input?.country || "").toUpperCase().trim();
    const customsValue = Number(input?.customsValue || 0);
    if (hts.length < 4 || hts.length > 10) return Response.json({ error: "Enter a 4- to 10-digit HTS number." }, { status: 400 });
    if (!/^[A-Z]{2}$/.test(country)) return Response.json({ error: "Enter a 2-letter country code." }, { status: 400 });

    const revision = await getCurrentRevision();
    if (hts.length < 8) {
      return Response.json({
        query: { hts, country },
        currentHts: revision,
        status: "needs-full-hts",
        needsFullHts: true,
        message: "Chapter 99 and trade-remedy rules are generally written at the 8- or 10-digit HTS level. Enter the full HTS before the calculator gives a definitive additional-duty result.",
        measures: [], requiredFacts: []
      });
    }

    const code8 = hts.slice(0,8);
    const rows = await fetchRows(code8);
    const rowSignals = directRowSignals(rows);
    let ch99Text = "";
    let chapter99SourceAvailable = false;
    try {
      ch99Text = await getChapter99Text();
      chapter99SourceAvailable = /U\.S\. note|subchapter III|9903\./i.test(ch99Text);
    } catch {}

    const contexts = chapter99SourceAvailable ? collectCodeContexts(ch99Text, code8) : [];
    const candidateRefs = new Set<string>(rowSignals.refs);
    const contextByRef = new Map<string,string>();

    for (const c of contexts) {
      const compat = countryCompatibility(c.context, country);
      if (compat === "no-match") continue;
      for (const ref of c.refs) {
        candidateRefs.add(ref);
        if (!contextByRef.has(ref)) contextByRef.set(ref, c.context);
      }
    }

    const resolved = await Promise.all([...candidateRefs].slice(0, 40).map(resolveChapter99));
    const measures = resolved
      .filter((r: any) => r.found)
      .map((r: any) => {
        const context = contextByRef.get(r.hts) || rowSignals.texts.join(" ");
        const program = programFor(r.hts, context);
        const compat = countryCompatibility(context, country);
        const ratePercent = r.ratePercent;
        return {
          program,
          hts: r.hts,
          description: r.description,
          rateText: r.rateText,
          ratePercent,
          estimatedDuty: ratePercent != null && customsValue > 0 ? customsValue * ratePercent / 100 : null,
          countryCompatibility: compat,
          requiredFacts: requiredFactsFor(program, context),
          source: "Current USITC HTS / Chapter 99",
          sourceContext: clean(context).slice(-1200)
        };
      })
      .filter((m: any) => m.countryCompatibility !== "no-match");

    const requiredFacts = [...new Set(measures.flatMap((m: any) => m.requiredFacts))];
    const unresolvedContexts = contexts.filter(c => c.refs.length === 0 && countryCompatibility(c.context, country) !== "no-match");

    return Response.json({
      query: { hts, code8: format8(code8), country, customsValue: customsValue || null },
      currentHts: revision,
      chapter99SourceAvailable,
      directChapter99References: rowSignals.refs,
      currentChapter99CodeOccurrences: contexts.length,
      status: chapter99SourceAvailable ? (unresolvedContexts.length ? "review-required" : "resolved") : "source-unavailable",
      measures,
      requiredFacts,
      unresolvedMatches: unresolvedContexts.slice(0, 8).map(c => clean(c.context).slice(-900)),
      safety: {
        falseNegativePolicy: "No current Chapter 99 match is treated as definitive unless the current Chapter 99 source was successfully checked.",
        unresolvedRulePolicy: "If current legal text references the HTS but the rule cannot be resolved automatically, the result is marked review-required rather than not-applicable."
      },
      sources: {
        htsSearch: "https://hts.usitc.gov/",
        chapter99: "https://hts.usitc.gov/reststop/file?release=currentRelease&filename=Chapter%2099",
        archive: USITC_ARCHIVE
      }
    }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=1800" } });
  } catch (error: any) {
    console.error("trade-rules lookup failed", error);
    return Response.json({
      error: "The current Chapter 99 regulatory lookup could not be completed.",
      status: "source-unavailable",
      detail: error?.message || null
    }, { status: 502 });
  }
}

export default handler;

export const config = {
  path: "/api/trade-rules"
};
