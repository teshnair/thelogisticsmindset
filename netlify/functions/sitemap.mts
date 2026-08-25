import type { Context, Config } from "@netlify/functions";

type GlossaryItem = { id?: string; term?: string };

const ORIGIN = "https://riteshnair.com";
let glossaryCache: GlossaryItem[] | null = null;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function loadGlossary(siteUrl: string): Promise<GlossaryItem[]> {
  if (glossaryCache) return glossaryCache;

  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/data/glossary-data.json`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Glossary data request failed with ${response.status}`);

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : payload?.terms;
  if (!Array.isArray(items)) throw new Error("Invalid glossary data structure");

  glossaryCache = items.filter((item): item is GlossaryItem => Boolean(item?.id && item?.term));
  return glossaryCache;
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  try {
    const items = await loadGlossary(context.site.url);

    const coreUrls = [
      "/",
      "/about.html",
      "/blog.html",
      "/news.html",
      "/reference.html",
      "/shipping-terms.html",
      "/tracking.html",
      "/containers.html",
      "/uld.html",
      "/incoterms.html",
      "/hazmat.html",
      "/Customs.html",
      "/hts-duty-calculator.html",
      "/conversion.html",
      "/currency.html",
    ];

    const urls = [
      ...coreUrls.map((path) => `${ORIGIN}${path}`),
      ...items.map((item) => `${ORIGIN}/shipping-terms/${encodeURIComponent(String(item.id))}`),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
      .join("\n")}\n</urlset>\n`;

    return new Response(req.method === "HEAD" ? null : xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "x-robots-tag": "noindex, follow",
      },
    });
  } catch (error) {
    console.error("sitemap function failed", error);
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "retry-after": "60" } });
  }
}

export const config: Config = {
  path: "/sitemap.xml",
};
