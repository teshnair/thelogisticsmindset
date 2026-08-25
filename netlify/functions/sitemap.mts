import type { Context, Config } from "@netlify/functions";
import glossaryData from "../../data/glossary-data.json";

type GlossaryItem = { id?: string; term?: string };

const ORIGIN = "https://riteshnair.com";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function loadGlossary(): GlossaryItem[] {
  const payload: unknown = glossaryData;
  const items = Array.isArray(payload)
    ? payload
    : (payload as { terms?: unknown })?.terms;

  if (!Array.isArray(items)) throw new Error("Invalid glossary data structure");

  return items.filter(
    (item): item is GlossaryItem =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          "term" in item &&
          (item as GlossaryItem).id &&
          (item as GlossaryItem).term,
      ),
  );
}

export default function handler(req: Request, _context: Context) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    const items = loadGlossary();

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
      ...items.map(
        (item) =>
          `${ORIGIN}/shipping-terms/${encodeURIComponent(String(item.id))}`,
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
      .join("\n")}\n</urlset>\n`;

    return new Response(req.method === "HEAD" ? null : xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("sitemap function failed", error);
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "retry-after": "60" },
    });
  }
}

export const config: Config = {
  path: "/sitemap.xml",
};
