import fs from "node:fs";

// One-time static cleanup. This file removes itself after the workflow succeeds.
function replaceOrThrow(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Could not apply ${label}`);
  return next;
}

let blog = fs.readFileSync("blog.html", "utf8");
blog = replaceOrThrow(
  blog,
  /\n    <main class="container">[\s\S]*?\n    <footer>/,
  `\n    <main class="container">\n        <div class="page-title">\n            <h1>Blog</h1>\n            <p>\n                Observations from the field, practical logistics thinking, and commentary on how supply chains\n                actually work when theory meets reality.\n            </p>\n        </div>\n    </main>\n\n    <footer>`,
  "Blog content cleanup"
);
fs.writeFileSync("blog.html", blog, "utf8");

let tracking = fs.readFileSync("tracking.html", "utf8");
tracking = tracking.replace(
  "Enter the shipment reference once and continue to the carrier's official tracking site",
  "Continue to the carrier's official tracking site"
);
tracking = tracking.replace(
  /<p>Track an ocean shipment by <strong>container number or Bill of Lading<\/strong>, or identify an air carrier from an Air Waybill\. Where the carrier supports a direct tracking link, your reference is passed automatically\.<\/p>/,
  '<p>Track an ocean shipment by <strong>container number or Bill of Lading</strong>, or enter an airline code to open that airline\'s official Air Waybill tracking page.</p>'
);
tracking = replaceOrThrow(
  tracking,
  /        <section id="airPanel" class="panel" role="tabpanel" aria-labelledby="airTab" hidden>[\s\S]*?        <\/section>\n\n        <div class="coverage">/,
  `        <section id="airPanel" class="panel" role="tabpanel" aria-labelledby="airTab" hidden>\n            <form id="airForm" novalidate>\n                <div class="field">\n                    <label for="airlineCode">Airline code</label>\n                    <input id="airlineCode" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="8" placeholder="e.g. 020 or LH" required>\n                    <span class="field-help">Enter the airline's 3-digit AWB prefix or 2-letter IATA code. We will open the airline's official cargo tracking page.</span>\n                    <input id="awbNumber" type="hidden" value="">\n                </div>\n                <div id="airDetected" class="detected" aria-live="polite"></div>\n                <button class="track-button" type="submit">Track Air Waybill</button>\n                <div id="airStatus" class="status" aria-live="polite"></div>\n            </form>\n        </section>\n\n        <div class="coverage">`,
  "Air tracking form"
);
tracking = tracking.replace(
  "This tool does not retrieve or store shipment status. It validates references where a standard check exists, identifies the carrier where possible, and hands the reference to the carrier's public tracking service. If a carrier does not permit a reference to be preloaded, the reference is copied before its official tracker opens.",
  "This tool does not retrieve or store shipment status. Ocean references are validated where a standard check exists and then handed to the carrier's public tracking service. For air cargo, the airline code is used only to open the airline's official Air Waybill tracking page."
);
tracking = tracking.replace(
  '<script src="js/tracking-bl-prefixes.js" defer></script>',
  '<script src="js/tracking-bl-prefixes.js" defer></script>\n<script src="js/tracking-air-simple.js" defer></script>'
);
fs.writeFileSync("tracking.html", tracking, "utf8");

const carrierFile = "data/tracking-carriers.json";
const carriers = JSON.parse(fs.readFileSync(carrierFile, "utf8"));
const before = carriers.ocean.length;
carriers.ocean = carriers.ocean.filter(carrier => carrier.id !== "bahri");
if (carriers.ocean.length !== before - 1) throw new Error("Bahri carrier entry was not found exactly once");
carriers.notes = "Carrier links are official public carrier tracking or cargo pages. Carriers requiring login for tracking are excluded. Direct handoff is used only where a public URL pattern is configured.";
fs.writeFileSync(carrierFile, JSON.stringify(carriers), "utf8");

console.log("Applied Blog cleanup, simplified Air tracking, and removed Bahri.");
