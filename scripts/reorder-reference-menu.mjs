import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const links = [
  ['U.S. HTS Duty Calculator', 'hts-duty-calculator.html'],
  ['Shipment Tracking', 'tracking.html'],
  ['Incoterms', 'incoterms.html'],
  ['Hazardous Materials Basics', 'hazmat.html'],
  ['Customs & Trade Concepts', 'Customs.html'],
  ['Shipping Terms Glossary', 'shipping-terms.html'],
  ['Containers', 'containers.html'],
  ['ULDs (Unit Load Devices)', 'uld.html']
];

const menu = links.map(([label, href]) => `                              <a href="${href}" role="menuitem">${label}</a>`).join('\n');
const pattern = /(<div class="reference-dropdown-menu" role="menu">)[\s\S]*?(\n\s*<\/div>\n\s*<\/span>)/;

let changed = 0;
for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(root, name);
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('reference-dropdown-menu')) continue;
  const next = html.replace(pattern, `$1\n${menu}$2`);
  if (next !== html) {
    fs.writeFileSync(file, next);
    changed += 1;
  }
}

console.log(`Reordered References dropdown on ${changed} pages.`);
