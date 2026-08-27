import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_URL = 'https://riteshnair.com';

const SEO = {
  'index.html': {
    title: 'The Logistics Mindset | Practical Shipping & Logistics Reference',
    description: 'Practical shipping and logistics reference tools, calculators, terminology, container specifications, Incoterms, customs concepts, trade information and industry insights.'
  },
  'shipping-terms.html': {
    title: 'Shipping & Logistics Glossary | The Logistics Mindset',
    description: 'Search plain-language definitions of shipping, freight, maritime, chartering, customs and logistics terminology, with practical explanations for everyday use.'
  },
  'hts-duty-calculator.html': {
    title: 'U.S. HTS Duty & Tariff Calculator | The Logistics Mindset',
    description: 'Estimate U.S. import duties, tariffs and user fees by HTS code, country of origin, customs value, transport mode and optional quantity information.'
  },
  'containers.html': {
    title: 'Shipping Container Dimensions & Specifications | The Logistics Mindset',
    description: 'Compare dimensions, door openings, capacity, tare weight and payload for common 20-foot, 40-foot, high-cube, open-top and flat-rack shipping containers.'
  },
  'conversion.html': {
    title: 'Freight & Logistics Conversion Calculators | The Logistics Mindset',
    description: 'Use practical freight conversion tools for dimensional weight, volume, CBM, cubic feet, area, density and other common logistics calculations.'
  },
  'incoterms.html': {
    title: 'Incoterms 2020 Explained | The Logistics Mindset',
    description: 'Understand Incoterms 2020 rules, responsibilities, costs and risk transfer points with practical explanations for international shipping and trade.'
  },
  'hazmat.html': {
    title: 'Hazardous Materials Shipping Basics | The Logistics Mindset',
    description: 'Learn foundational hazardous materials shipping concepts, classifications, documentation and handling considerations for logistics operations.'
  },
  'Customs.html': {
    title: 'Customs & International Trade Concepts | The Logistics Mindset',
    description: 'Plain-language explanations of customs, import, export and international trade concepts for logistics professionals and learners.'
  },
  'uld.html': {
    title: 'Air Cargo ULD Guide | The Logistics Mindset',
    description: 'Reference common air cargo unit load devices (ULDs), their uses and practical considerations for aircraft cargo planning and handling.'
  },
  'tracking.html': {
    title: 'Shipment Tracking | Ocean, Air & Container Tracking',
    description: 'Access shipment tracking links for major ocean and air carriers using bill of lading, container and air waybill references.'
  },
  'reference.html': {
    title: 'Logistics Reference Library | The Logistics Mindset',
    description: 'Explore shipping, customs, Incoterms, containers, ULDs, hazardous materials, tracking and other practical logistics reference resources.'
  },
  'currency.html': {
    title: 'Currency Converter for Logistics & Trade | The Logistics Mindset',
    description: 'Convert major global currencies using current exchange-rate data for shipping, logistics, procurement and international trade calculations.'
  },
  'clock.html': {
    title: 'World Time for Global Logistics | The Logistics Mindset',
    description: 'Check current time across major logistics hubs and coordinate shipments, calls and operations across international time zones.'
  },
  'world-clock.html': {
    title: 'World Time for Global Logistics | The Logistics Mindset',
    description: 'Check current time across major logistics hubs and coordinate shipments, calls and operations across international time zones.'
  },
  'time.html': {
    title: 'World Time Zone Reference | The Logistics Mindset',
    description: 'Coordinate international logistics operations with practical world time and time-zone references for major global hubs.'
  },
  'news.html': {
    title: 'Logistics & Supply Chain News | The Logistics Mindset',
    description: 'Curated logistics, shipping, trade and supply chain news focused on developments that matter to real-world operations.'
  },
  'blog.html': {
    title: 'Logistics Insights & Commentary | The Logistics Mindset',
    description: 'Practical commentary on logistics, project cargo, shipping, trade, technology and supply chain operations.'
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, max = 158) {
  const clean = stripHtml(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
}

function slugify(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'term';
}

function canonicalForRootFile(file) {
  return file === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${encodeURI(file)}`;
}

function upsertHeadTag(html, matcher, tag) {
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function optimizeRootPages() {
  for (const [file, meta] of Object.entries(SEO)) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;

    let html = fs.readFileSync(fullPath, 'utf8');
    const canonical = canonicalForRootFile(file);

    html = upsertHeadTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
    html = upsertHeadTag(html, /<meta\b[^>]*\bname=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(meta.description)}">`);
    html = upsertHeadTag(html, /<link\b[^>]*\brel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
    html = upsertHeadTag(html, /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(meta.title)}">`);
    html = upsertHeadTag(html, /<meta\b[^>]*\bproperty=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(meta.description)}">`);
    html = upsertHeadTag(html, /<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`);
    html = upsertHeadTag(html, /<meta\b[^>]*\bproperty=["']og:type["'][^>]*>/i, `<meta property="og:type" content="website">`);

    if (file === 'index.html' && !html.includes('"@type":"WebSite"')) {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'The Logistics Mindset',
        url: `${SITE_URL}/`
      });
      html = html.replace(/<\/head>/i, `  <script type="application/ld+json">${jsonLd}</script>\n</head>`);
    }

    fs.writeFileSync(fullPath, html);
  }
}

function loadTerms() {
  const source = path.join(ROOT, 'data', 'glossary-data.json');
  const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
  const terms = Array.isArray(parsed) ? parsed : parsed.terms;
  if (!Array.isArray(terms)) throw new Error('Glossary data must be an array or { terms: [] }.');

  const seen = new Set();
  return terms
    .filter(item => item && item.term)
    .map(item => {
      const slug = slugify(item.id || item.term);
      if (seen.has(slug)) throw new Error(`Duplicate glossary slug: ${slug}`);
      seen.add(slug);
      return { ...item, slug };
    })
    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
}

function termTitle(term) {
  const abbr = term.abbreviation && !term.term.toLowerCase().includes(String(term.abbreviation).toLowerCase())
    ? ` (${term.abbreviation})`
    : '';
  return `${term.term}${abbr} | Shipping Glossary | The Logistics Mindset`;
}

function termDescription(term) {
  const source = term.definition || term.summary || `${term.term} explained in the shipping and logistics glossary.`;
  return truncate(source, 158);
}

function termPage(term, previous, next) {
  const title = termTitle(term);
  const description = termDescription(term);
  const canonical = `${SITE_URL}/glossary/${term.slug}/`;
  const aliases = Array.isArray(term.aliases) ? term.aliases.filter(Boolean) : [];
  const imageUrl = term.image_url || (Array.isArray(term.images) && term.images[0]?.url) || '';
  const imageAlt = term.image_alt || (Array.isArray(term.images) && term.images[0]?.alt) || term.term;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Shipping Terms', item: `${SITE_URL}/shipping-terms.html` },
      { '@type': 'ListItem', position: 3, name: term.term, item: canonical }
    ]
  };
  const definedTerm = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.term,
    description: stripHtml(term.definition || term.summary || ''),
    inDefinedTermSet: `${SITE_URL}/shipping-terms.html`
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<link rel="stylesheet" href="/css/header.css">
<style>
:root{--primary:#1a2a3a;--accent:#2c7be5;--bg:#f4f4f4;--card:#fff;--text:#333}
body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.container{max-width:900px;margin:40px auto;padding:0 20px}.term-card{background:var(--card);padding:24px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.08)}
h1{color:var(--primary);margin-bottom:6px}.abbr{color:#555;font-size:1.05rem}.definition{font-weight:600;margin-top:22px}.summary{margin-top:14px;color:#444}
.aliases{margin-top:18px;color:#555}.term-image{display:block;max-width:100%;height:auto;margin:24px auto}.breadcrumbs,.term-nav{font-size:.95rem;margin:18px 0}.term-nav{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
a{color:var(--accent)}footer{text-align:center;color:#666;margin:45px 0 20px;font-size:.9rem}
</style>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<script type="application/ld+json">${JSON.stringify(definedTerm)}</script>
</head>
<body>
<div class="container">
<header class="page-header">
  <img src="/img/logo.png" alt="The Logistics Mindset" class="page-logo">
  <div class="header-text">
    <h1>${escapeHtml(term.term)}</h1>
    ${term.abbreviation ? `<div class="abbr">${escapeHtml(term.abbreviation)}</div>` : ''}
    <nav><a href="/">Home</a> <a href="/shipping-terms.html">Shipping Terms</a> <a href="/reference.html">References</a></nav>
  </div>
</header>
<div class="breadcrumbs"><a href="/">Home</a> › <a href="/shipping-terms.html">Shipping Terms</a> › ${escapeHtml(term.term)}</div>
<main class="term-card">
  <div class="definition">${escapeHtml(stripHtml(term.definition || ''))}</div>
  ${term.summary ? `<div class="summary">${escapeHtml(stripHtml(term.summary))}</div>` : ''}
  ${aliases.length ? `<div class="aliases"><strong>Also searched as:</strong> ${aliases.map(escapeHtml).join(', ')}</div>` : ''}
  ${imageUrl ? `<img class="term-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy">` : ''}
</main>
<nav class="term-nav" aria-label="Glossary term navigation">
  <span>${previous ? `← <a href="/glossary/${previous.slug}/">${escapeHtml(previous.term)}</a>` : ''}</span>
  <span><a href="/glossary/">Browse all terms</a></span>
  <span>${next ? `<a href="/glossary/${next.slug}/">${escapeHtml(next.term)}</a> →` : ''}</span>
</nav>
<footer>© The Logistics Mindset — Personal educational project</footer>
</div>
<script src="/js/support.js" defer></script>
</body>
</html>`;
}

function glossaryIndexPage(terms) {
  const grouped = new Map();
  for (const term of terms) {
    const letter = /^[A-Z]/i.test(term.term) ? term.term[0].toUpperCase() : '#';
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter).push(term);
  }

  const sections = [...grouped.entries()].map(([letter, items]) => `
<section>
<h2>${escapeHtml(letter)}</h2>
<ul>${items.map(t => `<li><a href="/glossary/${t.slug}/">${escapeHtml(t.term)}${t.abbreviation ? ` (${escapeHtml(t.abbreviation)})` : ''}</a></li>`).join('')}</ul>
</section>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Shipping & Logistics Glossary Index | The Logistics Mindset</title>
<meta name="description" content="Browse the complete A-Z index of shipping, freight, maritime, customs and logistics terms from The Logistics Mindset.">
<link rel="canonical" href="${SITE_URL}/glossary/">
<link rel="stylesheet" href="/css/header.css">
<style>body{font-family:Segoe UI,Tahoma,sans-serif;background:#f4f4f4;color:#333;margin:0}.container{max-width:1000px;margin:40px auto;padding:0 20px}h1,h2{color:#1a2a3a}section{background:#fff;margin:18px 0;padding:18px 24px;border-radius:4px}ul{columns:2;column-gap:40px}li{break-inside:avoid;margin:6px 0}a{color:#2c7be5}@media(max-width:700px){ul{columns:1}}</style>
</head><body><div class="container"><header class="page-header"><img src="/img/logo.png" alt="The Logistics Mindset" class="page-logo"><div class="header-text"><h1>Shipping & Logistics Glossary Index</h1><nav><a href="/">Home</a> <a href="/shipping-terms.html">Search Glossary</a></nav></div></header>${sections}<footer style="text-align:center;color:#666;margin:40px 0">© The Logistics Mindset — Personal educational project</footer></div><script src="/js/support.js" defer></script></body></html>`;
}

function generateGlossaryPages(terms) {
  const base = path.join(ROOT, 'glossary');
  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(base, { recursive: true });

  terms.forEach((term, index) => {
    const dir = path.join(base, term.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), termPage(term, terms[index - 1], terms[index + 1]));
  });

  fs.writeFileSync(path.join(base, 'index.html'), glossaryIndexPage(terms));
}

function addGlossaryLinksToSearchPage() {
  const file = path.join(ROOT, 'shipping-terms.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/glossary/${')) {
    const needle = '${item.summary ? `<div class="summary">${item.summary}</div>` : ""}';
    const replacement = `${needle}\n      \${item.id ? \`<div class="summary"><a href="/glossary/\${String(item.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}/">Open dedicated term page →</a></div>\` : ""}`;
    if (html.includes(needle)) html = html.replace(needle, replacement);
  }
  fs.writeFileSync(file, html);
}

function generateSitemap(terms) {
  const urls = new Set();
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map(entry => entry.name)
    .filter(name => !/^google.*\.html$/i.test(name) && name.toLowerCase() !== '404.html');

  for (const file of rootFiles) urls.add(canonicalForRootFile(file));
  urls.add(`${SITE_URL}/glossary/`);
  for (const term of terms) urls.add(`${SITE_URL}/glossary/${term.slug}/`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].sort().map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function main() {
  optimizeRootPages();
  const terms = loadTerms();
  generateGlossaryPages(terms);
  addGlossaryLinksToSearchPage();
  generateSitemap(terms);
  console.log(`SEO build complete: ${terms.length} glossary pages generated.`);
}

main();
