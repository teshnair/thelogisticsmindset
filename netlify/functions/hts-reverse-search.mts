const USITC_SEARCH = "https://hts.usitc.gov/reststop/search";

function cleanText(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\/?il>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function cleanUnit(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\s*sup[^>]*>\s*2\s*<\s*\/\s*sup\s*>/gi, "²")
    .replace(/<\s*sup[^>]*>\s*3\s*<\s*\/\s*sup\s*>/gi, "³")
    .replace(/&sup2;|&#178;/gi, "²")
    .replace(/&sup3;|&#179;/gi, "³")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function fullCode(row: any): string {
  const base = digits(row?.htsno);
  const suffix = digits(row?.statisticalSuffix);
  if (!base) return "";
  if (base.length >= 10 || !suffix) return base;
  if (base.length === 8 && suffix.length <= 2) return base + suffix.padStart(2, "0");
  return base;
}

function formatHts(value: string): string {
  const d = digits(value);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  if (d.length <= 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8, 10)}`;
}

async function fetchUSITC(query: string): Promise<any[]> {
  const url = new URL(USITC_SEARCH);
  url.searchParams.set("keyword", query);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
      "User-Agent": "TheLogisticsMindset-HTS-Reverse-Search/1.0 (+https://riteshnair.com)",
    },
  });
  if (!response.ok) throw new Error(`USITC returned HTTP ${response.status}`);
  const raw = await response.text();
  if (!raw.trim()) return [];
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function scoreResult(item: any, terms: string[]): number {
  const description = String(item.description || "").toLowerCase();
  const code = String(item.code || "");
  let score = 0;
  if (terms.length && terms.every(term => description.includes(term))) score += 100;
  for (const term of terms) {
    if (description === term) score += 60;
    else if (description.startsWith(term)) score += 35;
    else if (description.includes(` ${term}`)) score += 20;
    else if (description.includes(term)) score += 10;
  }
  if (code.length === 10) score += 8;
  else if (code.length === 8) score += 6;
  else if (code.length === 6) score += 4;
  else if (code.length === 4) score += 2;
  score += Math.min(Number(item.indent || 0), 8);
  return score;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json();
    const query = String(body?.query ?? "").replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      return Response.json({ error: "Enter at least 2 letters or words to search the HTS." }, { status: 400 });
    }
    if (query.length > 120) {
      return Response.json({ error: "Search description is too long." }, { status: 400 });
    }

    const rows = await fetchUSITC(query);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const results = rows
      .map((row: any) => {
        const code = fullCode(row);
        const description = cleanText(row?.description);
        const units = Array.isArray(row?.units)
          ? row.units.map((unit: any) => cleanUnit(unit)).filter(Boolean)
          : [];
        return {
          code,
          hts: formatHts(code),
          description,
          units: [...new Set(units)],
          indent: Number(row?.indent ?? 0),
        };
      })
      .filter((item: any) => item.code && item.description && !item.code.startsWith("99"))
      .filter((item: any) => {
        const key = `${item.code}|${item.description}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item: any) => ({ ...item, score: scoreResult(item, terms) }))
      .sort((a: any, b: any) => b.score - a.score || a.code.localeCompare(b.code))
      .map(({ score, ...item }: any) => item);

    const MAX_RESULTS = 150;
    return Response.json(
      {
        query,
        totalMatches: results.length,
        results: results.slice(0, MAX_RESULTS),
        truncated: results.length > MAX_RESULTS,
        source: {
          name: "U.S. International Trade Commission Harmonized Tariff Schedule",
          publicUrl: "https://hts.usitc.gov/",
          retrievedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=1800" } }
    );
  } catch (error: any) {
    console.error("HTS reverse search failed", error);
    return Response.json(
      {
        error: "The live USITC description search could not be completed. Please try again.",
        detail: error?.message ?? null,
      },
      { status: 502 }
    );
  }
};

export const config = {
  path: "/api/hts-reverse-search",
  method: "POST",
};
