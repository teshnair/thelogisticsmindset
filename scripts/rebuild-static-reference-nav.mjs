import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const menuItems = [
  ["Shipment Tracking", "tracking.html"],
  ["Incoterms", "incoterms.html"],
  ["Hazardous Materials Basics", "hazmat.html"],
  ["Customs & Trade Concepts", "Customs.html"],
  ["U.S. HTS Duty Calculator", "hts-duty-calculator.html"],
  ["Shipping Terms Glossary", "shipping-terms.html"],
  ["Containers", "containers.html"],
  ["ULDs (Unit Load Devices)", "uld.html"]
];

function dropdownMarkup(eol, indent = "            ") {
  const child = indent + "    ";
  const menu = menuItems
    .map(([label, href]) => `${child}${child}<a href="${href}" role="menuitem">${label}</a>`)
    .join(eol);

  return [
    `${indent}<span class="reference-dropdown">`,
    `${child}<a href="reference.html" class="reference-main-link">References</a>`,
    `${child}<button type="button" class="reference-dropdown-toggle" aria-label="Show reference pages" aria-expanded="false" onclick="event.stopPropagation(); const box=this.parentElement; const open=box.classList.toggle('open'); this.setAttribute('aria-expanded', String(open));">▼</button>`,
    `${child}<div class="reference-dropdown-menu" role="menu">`,
    menu,
    `${child}</div>`,
    `${indent}</span>`
  ].join(eol);
}

function rewriteNav(html, fileName) {
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const navMatch = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i);
  if (!navMatch) return { html, changed: false, reason: "no nav" };

  const originalNav = navMatch[0];
  let nav = originalNav;

  // Remove every plain References link so the rebuilt nav can contain exactly one.
  nav = nav.replace(/\s*<a\b[^>]*href=["'](?:\.\/)?reference\.html["'][^>]*>\s*References\s*<\/a>\s*/gi, eol);

  // Defensive cleanup in case a static dropdown is already present in a later rerun.
  nav = nav.replace(/\s*<span\s+class=["']reference-dropdown["'][\s\S]*?<\/span>\s*/gi, eol);

  const lines = nav.split(/\r?\n/);
  const currencyIndex = lines.findIndex(line => /href=["']currency\.html["']/i.test(line));
  const conversionIndex = lines.findIndex(line => /href=["']conversion\.html["']/i.test(line));

  let insertionIndex;
  if (currencyIndex >= 0) insertionIndex = currencyIndex;
  else if (conversionIndex >= 0) insertionIndex = conversionIndex + 1;
  else insertionIndex = Math.max(1, lines.length - 1);

  const nearby = lines[Math.max(0, insertionIndex - 1)] || "";
  const indent = (nearby.match(/^\s*/) || ["            "])[0] || "            ";
  lines.splice(insertionIndex, 0, dropdownMarkup(eol, indent));
  nav = lines.join(eol);

  const referencesCount = (nav.match(/>References<\/a>/g) || []).length;
  const dropdownCount = (nav.match(/class="reference-dropdown"/g) || []).length;
  if (referencesCount !== 1 || dropdownCount !== 1) {
    throw new Error(`${fileName}: rebuilt nav failed uniqueness check (${referencesCount} References, ${dropdownCount} dropdowns)`);
  }

  return { html: html.replace(originalNav, nav), changed: nav !== originalNav, reason: "rewritten" };
}

const htmlFiles = fs.readdirSync(root)
  .filter(name => name.toLowerCase().endsWith(".html"))
  .sort();

const changedFiles = [];
for (const fileName of htmlFiles) {
  const filePath = path.join(root, fileName);
  const source = fs.readFileSync(filePath, "utf8");
  const result = rewriteNav(source, fileName);
  if (result.changed) {
    fs.writeFileSync(filePath, result.html, "utf8");
    changedFiles.push(fileName);
  }
}

function removeDropdownLoader(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, "utf8");
  const before = source;

  // Remove only the small loader IIFE that injects reference-dropdown.js.
  source = source.replace(/^\(\(\) => \{[\s\S]*?reference-dropdown\.js(?:\?v=\d+)?[\s\S]*?\}\)\(\);\s*/m, match => {
    return match.includes("data-reference-dropdown") ? "" : match;
  });

  if (source !== before) {
    fs.writeFileSync(filePath, source, "utf8");
    return true;
  }
  return false;
}

const cleanedScripts = [];
for (const relative of ["js/fx-ticker.js", "js/tracking-bl-prefixes.js"]) {
  if (removeDropdownLoader(path.join(root, relative))) cleanedScripts.push(relative);
}

const injectedScript = path.join(root, "js/reference-dropdown.js");
if (fs.existsSync(injectedScript)) {
  fs.rmSync(injectedScript);
  cleanedScripts.push("js/reference-dropdown.js (removed)");
}

// This is a one-time repository migration. Remove the migration machinery from the final tree.
for (const relative of [
  "scripts/rebuild-static-reference-nav.mjs",
  ".github/workflows/static-reference-nav.yml"
]) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) fs.rmSync(target);
}

console.log(`Rebuilt static References navigation in ${changedFiles.length} HTML files:`);
for (const file of changedFiles) console.log(`  - ${file}`);
console.log("Cleaned dynamic dropdown code:");
for (const file of cleanedScripts) console.log(`  - ${file}`);
