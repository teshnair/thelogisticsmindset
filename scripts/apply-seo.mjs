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
  'news.html': {
    title: 'Logistics & Supply Chain News | The Logistics Mindset',
    description: 'Curated logistics, shipping, trade and supply chain news focused on developments that matter to real-world operations.'
  },
  'blog.html': {
    title: 'Logistics Insights & Commentary | The Logistics Mindset',
    description: 'Practical commentary on logistics, project cargo, shipping, trade, technology and supply chain operations.'
  },
  'about.html': {
    title: 'About | The Logistics Mindset',
    description: 'About The Logistics Mindset, a practical educational resource built from decades of experience in global logistics, project cargo and trade compliance.'
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

function canonicalFor(file) {
  return file === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${encodeURI(file)}`;
}

function upsert(html, matcher, tag) {
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function applyMetadata() {
  for (const [file, meta] of Object.entries(SEO)) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;

    let html = fs.readFileSync(fullPath, 'utf8');
    const canonical = canonicalFor(file);

    html = upsert(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
    html = upsert(html, /<meta\b[^>]*\bname=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(meta.description)}">`);
    html = upsert(html, /<link\b[^>]*\brel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
    html = upsert(html, /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(meta.title)}">`);
    html = upsert(html, /<meta\b[^>]*\bproperty=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(meta.description)}">`);
    html = upsert(html, /<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`);
    html = upsert(html, /<meta\b[^>]*\bproperty=["']og:type["'][^>]*>/i, `<meta property="og:type" content="website">`);

    if (file === 'index.html' && !/"@type"\s*:\s*"WebSite"/.test(html)) {
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

function addGlossaryTermLinks() {
  const file = path.join(ROOT, 'shipping-terms.html');
  if (!fs.existsSync(file)) return;

  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('View dedicated term page')) return;

  const needle = '${item.summary ? `<div class="summary">${item.summary}</div>` : ""}';
  const addition = '\n      ${item.id ? `<div class="summary"><a href="/shipping-terms/${encodeURIComponent(item.id)}">View dedicated term page →</a></div>` : ""}';

  if (!html.includes(needle)) {
    throw new Error('Could not find glossary summary template to add internal links.');
  }

  html = html.replace(needle, needle + addition);
  fs.writeFileSync(file, html);
}

applyMetadata();
addGlossaryTermLinks();
console.log('SEO metadata and glossary internal links applied.');
