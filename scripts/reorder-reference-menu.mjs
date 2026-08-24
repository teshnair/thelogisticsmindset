import fs from "node:fs";

const files = fs.readdirSync(".").filter(name => name.toLowerCase().endsWith(".html"));
let changed = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const menuMatch = original.match(/<div class="reference-dropdown-menu" role="menu">([\s\S]*?)<\/div>/);
  if (!menuMatch) continue;

  const menuInner = menuMatch[1];
  const anchors = [...menuInner.matchAll(/<a href="[^"]+" role="menuitem">[^<]*<\/a>/g)].map(match => match[0]);
  const htsIndex = anchors.findIndex(anchor => anchor.includes('href="hts-duty-calculator.html"'));
  const shippingIndex = anchors.findIndex(anchor => anchor.includes('href="shipping-terms.html"'));
  if (htsIndex < 0 || shippingIndex < 0) throw new Error(`${file}: required References links not found`);

  const shipping = anchors[shippingIndex];
  const reordered = anchors.filter((_, index) => index !== shippingIndex);
  const newHtsIndex = reordered.findIndex(anchor => anchor.includes('href="hts-duty-calculator.html"'));
  reordered.splice(newHtsIndex + 1, 0, shipping);

  if (anchors.join("|") === reordered.join("|")) continue;

  const firstAnchorPos = menuInner.indexOf(anchors[0]);
  const lastAnchorPos = menuInner.lastIndexOf(anchors[anchors.length - 1]) + anchors[anchors.length - 1].length;
  const before = menuInner.slice(0, firstAnchorPos);
  const after = menuInner.slice(lastAnchorPos);
  const indentMatch = before.match(/(?:^|\r?\n)([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : "";
  const rebuiltInner = before + reordered.join(newline + indent) + after;
  const updated = original.replace(menuMatch[0], `<div class="reference-dropdown-menu" role="menu">${rebuiltInner}</div>`);

  fs.writeFileSync(file, updated, "utf8");
  changed += 1;
}

if (!changed) throw new Error("No References menus were changed");
console.log(`Reordered References menu in ${changed} HTML pages.`);
