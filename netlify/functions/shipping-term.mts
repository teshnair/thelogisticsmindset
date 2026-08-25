import type { Context, Config } from "@netlify/functions";

type GlossaryItem = {
  id?: string;
  term?: string;
  abbreviation?: string;
  aliases?: string[];
  definition?: string;
  summary?: string;
  image_url?: string;
  image_alt?: string;
  images?: Array<{ url?: string; alt?: string }>;
};

const CANONICAL_ORIGIN = "https://riteshnair.com";
let glossaryCache: GlossaryItem[] | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageUrl(value: unknown): string | null {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function metaDescription(item: GlossaryItem): string {
  const source = String(item.definition || item.summary || `${item.term || "Shipping term"} definition and explanation.`)
    .replace(/\s+/g, " ")
    .trim();
  return source.length <= 158 ? source : `${source.slice(0, 155).trimEnd()}…`;
}

async function loadGlossary(siteUrl: string): Promise<GlossaryItem[]> {
  if (glossaryCache) return glossaryCache;

  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/data/glossary-data.json`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Glossary data request failed with ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : payload?.terms;
  if (!Array.isArray(items)) throw new Error("Invalid glossary data structure");

  glossaryCache = items
    .filter((item): item is GlossaryItem => Boolean(item && item.id && item.term))
    .sort((a, b) => String(a.term).localeCompare(String(b.term), undefined, { sensitivity: "base" }));

  return glossaryCache;
}

function render404(slug: string): Response {
  const safeSlug = escapeHtml(slug);
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Shipping term not found | The Logistics Mindset</title></head>
<body style="font-family:Segoe UI,Tahoma,sans-serif;max-width:820px;margin:60px auto;padding:0 20px;color:#1a2a3a"><h1>Shipping term not found</h1><p>No glossary entry exists for <strong>${safeSlug}</strong>.</p><p><a href="/shipping-terms.html">Search the Shipping Terms glossary</a></p></body></html>`, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}

function relatedNavigation(items: GlossaryItem[], index: number): string {
  const previous = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;

  const link = (item: GlossaryItem | null, label: string) => {
    if (!item?.id || !item.term) return "";
    return `<a href="/shipping-terms/${encodeURIComponent(item.id)}" style="text-decoration:none;color:#2c6bed">${escapeHtml(label)}: ${escapeHtml(item.term)}</a>`;
  };

  return `<nav aria-label="Related glossary navigation" style="display:flex;gap:18px;justify-content:space-between;flex-wrap:wrap;margin-top:30px;padding-top:18px;border-top:1px solid #d8e0e8">
    <span>${link(previous, "Previous")}</span>
    <a href="/shipping-terms.html" style="text-decoration:none;color:#2c6bed;font-weight:600">Search full glossary</a>
    <span>${link(next, "Next")}</span>
  </nav>`;
}

function renderPage(item: GlossaryItem, items: GlossaryItem[], index: number): string {
  const term = String(item.term || "Shipping Term");
  const abbreviation = String(item.abbreviation || "").trim();
  const heading = abbreviation ? `${term} (${abbreviation})` : term;
  const description = metaDescription(item);
  const canonical = `${CANONICAL_ORIGIN}/shipping-terms/${encodeURIComponent(String(item.id))}`;
  const aliases = Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : [];
  const image = safeImageUrl(item.image_url) || safeImageUrl(item.images?.[0]?.url);
  const imageAlt = item.image_alt || item.images?.[0]?.alt || `${term} logistics illustration`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${canonical}#term`,
        name: term,
        alternateName: [abbreviation, ...aliases].filter(Boolean),
        description: item.definition || item.summary || undefined,
        url: canonical,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "The Logistics Mindset Shipping Terms Glossary",
          url: `${CANONICAL_ORIGIN}/shipping-terms.html`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: CANONICAL_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Shipping Terms", item: `${CANONICAL_ORIGIN}/shipping-terms.html` },
          { "@type": "ListItem", position: 3, name: term, item: canonical },
        ],
      },
    ],
  };

  const imageMarkup = image
    ? `<figure style="margin:24px 0"><img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="lazy" style="display:block;max-width:100%;height:auto;border-radius:6px"><figcaption style="font-size:.9rem;color:#666;margin-top:7px">${escapeHtml(imageAlt)}</figcaption></figure>`
    : "";

  const aliasesMarkup = aliases.length
    ? `<p style="color:#555"><strong>Also known as:</strong> ${aliases.map(escapeHtml).join(", ")}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)} Meaning | Shipping Terms | The Logistics Mindset</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(heading)} | The Logistics Mindset">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
<style>
:root{--primary:#1a2a3a;--accent:#2c6bed;--bg:#f4f4f4;--card:#fff;--text:#333}
*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}.wrap{max-width:920px;margin:0 auto;padding:28px 20px 50px}.top{display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:4px solid var(--primary);padding-bottom:18px;margin-bottom:30px}.brand{font-size:.95rem;color:#555}.brand a{color:var(--accent);text-decoration:none}.logo{width:78px;height:auto}.crumbs{font-size:.9rem;color:#666;margin-bottom:18px}.crumbs a{color:var(--accent);text-decoration:none}article{background:var(--card);padding:28px;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,.07)}h1{margin:0 0 8px;color:var(--primary);font-size:2rem;line-height:1.2}.definition{font-size:1.08rem;font-weight:600}.summary{margin-top:18px}.glossary-cta{display:inline-block;margin-top:24px;padding:10px 14px;background:var(--primary);color:#fff;text-decoration:none;border-radius:4px}@media(max-width:640px){article{padding:20px}.logo{width:60px}h1{font-size:1.65rem}}
</style>
</head>
<body>
<main class="wrap">
  <header class="top">
    <div><div class="brand"><a href="/">The Logistics Mindset</a></div><strong>Shipping Terms</strong></div>
    <a href="/"><img class="logo" src="/img/logo.png" alt="The Logistics Mindset logo"></a>
  </header>
  <div class="crumbs"><a href="/">Home</a> › <a href="/shipping-terms.html">Shipping Terms</a> › ${escapeHtml(term)}</div>
  <article>
    <h1>${escapeHtml(heading)}</h1>
    ${aliasesMarkup}
    <p class="definition">${escapeHtml(item.definition || "")}</p>
    ${item.summary ? `<div class="summary">${escapeHtml(item.summary)}</div>` : ""}
    ${imageMarkup}
    <a class="glossary-cta" href="/shipping-terms.html">Search the full Shipping Terms glossary</a>
    ${relatedNavigation(items, index)}
  </article>
</main>
</body>
</html>`;
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const slug = decodeURIComponent(String(context.params.slug || "")).trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) return render404(slug);

  try {
    const items = await loadGlossary(context.site.url);
    const index = items.findIndex((item) => String(item.id).toLowerCase() === slug);
    if (index === -1) return render404(slug);

    const html = renderPage(items[index], items, index);
    return new Response(req.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "x-robots-tag": "index, follow, max-image-preview:large",
      },
    });
  } catch (error) {
    console.error("shipping-term function failed", error);
    return new Response("Shipping term temporarily unavailable", { status: 503, headers: { "retry-after": "60" } });
  }
}

export const config: Config = {
  path: "/shipping-terms/:slug",
};
