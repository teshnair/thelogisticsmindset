import fs from "node:fs";

function replaceOrThrow(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Could not apply ${label}`);
  return next;
}

{
  const file = "blog.html";
  let html = fs.readFileSync(file, "utf8");
  html = replaceOrThrow(
    html,
    /\n    <main class="container">[\s\S]*?\n    <footer>/,
    `\n    <main class="container">\n        <div class="page-title">\n            <h1>Blog</h1>\n            <p>\n                Observations from the field, practical logistics thinking, and commentary on how supply chains\n                actually work when theory meets reality.\n            </p>\n        </div>\n    </main>\n\n    <footer>`,
    "Blog content cleanup"
  );
  fs.writeFileSync(file, html, "utf8");
}

{
  const file = "tracking.html";
  let html = fs.readFileSync(file, "utf8");

  html = html.replace(
    "Enter the shipment reference once and continue to the carrier's official tracking site",
    "Continue to the carrier's official tracking site"
  );

  html = html.replace(
    /<p>Track an ocean shipment by <strong>container number or Bill of Lading<\/strong>, or identify an air carrier from an Air Waybill\. Where the carrier supports a direct tracking link, your reference is passed automatically\.<\/p>/,
    '<p>Track an ocean shipment by <strong>container number or Bill of Lading</strong>, or enter an airline code to open that airline\'s official Air Waybill tracking page.</p>'
  );

  html = replaceOrThrow(
    html,
    /        <section id="airPanel" class="panel" role="tabpanel" aria-labelledby="airTab" hidden>[\s\S]*?        <\/section>\n\n        <div class="coverage">/,
    `        <section id="airPanel" class="panel" role="tabpanel" aria-labelledby="airTab" hidden>\n            <form id="airForm" novalidate>\n                <div class="field">\n                    <label for="airlineCode">Airline code</label>\n                    <input id="airlineCode" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="8" placeholder="e.g. 020 or LH" required>\n                    <span class="field-help">Enter the airline's 3-digit AWB prefix or 2-letter IATA code. We will open the airline's official cargo tracking page.</span>\n                    <input id="awbNumber" type="hidden" value="">\n                </div>\n                <div id="airDetected" class="detected" aria-live="polite"></div>\n                <button class="track-button" type="submit">Track Air Waybill</button>\n                <div id="airStatus" class="status" aria-live="polite"></div>\n            </form>\n        </section>\n\n        <div class="coverage">`,
    "Air tracking form"
  );

  html = html.replace(
    "This tool does not retrieve or store shipment status. It validates references where a standard check exists, identifies the carrier where possible, and hands the reference to the carrier's public tracking service. If a carrier does not permit a reference to be preloaded, the reference is copied before its official tracker opens.",
    "This tool does not retrieve or store shipment status. Ocean references are validated where a standard check exists and then handed to the carrier's public tracking service. For air cargo, the airline code is used only to open the airline's official Air Waybill tracking page."
  );

  html = html.replace(
    '<script src="js/tracking-bl-prefixes.js" defer></script>',
    '<script src="js/tracking-bl-prefixes.js" defer></script>\n<script src="js/tracking-air-simple.js" defer></script>'
  );

  fs.writeFileSync(file, html, "utf8");
}

{
  const file = "data/tracking-carriers.json";
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = data.ocean.length;
  data.ocean = data.ocean.filter(carrier => carrier.id !== "bahri");
  if (data.ocean.length !== before - 1) throw new Error("Bahri carrier entry was not found exactly once");
  data.notes = "Carrier links are official public carrier tracking or cargo pages. Carriers requiring login for tracking are excluded. Direct handoff is used only where a public URL pattern is configured.";
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
}

{
  const file = "js/tracking-air-simple.js";
  const js = `(() => {\n    \"use strict\";\n\n    const DATA_URL = \"data/tracking-carriers.json\";\n    const form = document.getElementById(\"airForm\");\n    const input = document.getElementById(\"airlineCode\");\n    const detected = document.getElementById(\"airDetected\");\n    const status = document.getElementById(\"airStatus\");\n    const coverage = document.getElementById(\"airCoverage\");\n\n    if (!form || !input) return;\n\n    let airlines = [];\n\n    function setStatus(message = \"\", type = \"\") {\n        status.textContent = message;\n        status.className = \"status\";\n        if (message) {\n            status.classList.add(\"visible\");\n            if (type) status.classList.add(type);\n        }\n    }\n\n    function normalize(value) {\n        return String(value || \"\").toUpperCase().trim().replace(/[^A-Z0-9]/g, \"\");\n    }\n\n    function iataCodes(airline) {\n        return String(airline.iata || \"\")\n            .toUpperCase()\n            .split(/[^A-Z0-9]+/)\n            .map(code => code.trim())\n            .filter(Boolean);\n    }\n\n    function findAirline(value) {\n        const code = normalize(value);\n        if (!code) return null;\n        return airlines.find(airline => airline.prefix === code || iataCodes(airline).includes(code)) || null;\n    }\n\n    function updateDetection() {\n        const code = normalize(input.value);\n        setStatus();\n        if (!code) {\n            detected.className = \"detected\";\n            detected.innerHTML = \"\";\n            return;\n        }\n        const airline = findAirline(code);\n        detected.className = \"detected visible\";\n        if (!airline) {\n            detected.innerHTML = \\`<strong>\\\${code}</strong> is not in the current airline list. Try the 3-digit AWB prefix or 2-letter IATA code.\\`;\n            return;\n        }\n        const iata = iataCodes(airline).length ? \\` · IATA \\${iataCodes(airline).join(\" / \")}\\` : \"\";\n        detected.innerHTML = \\`<strong>\\\${airline.name}</strong> · AWB prefix \\${airline.prefix}\\\${iata}<br>The airline's official cargo tracking page will open in a new tab.\\`;\n    }\n\n    function openTracker(url) {\n        const opened = window.open(url, \"_blank\");\n        if (opened) {\n            try { opened.opener = null; } catch (_) {}\n            return true;\n        }\n        return false;\n    }\n\n    form.addEventListener(\"submit\", event => {\n        event.preventDefault();\n        event.stopImmediatePropagation();\n\n        const code = normalize(input.value);\n        if (!code) {\n            setStatus(\"Enter the airline's 3-digit AWB prefix or 2-letter IATA code.\", \"error\");\n            return;\n        }\n\n        const airline = findAirline(code);\n        if (!airline) {\n            setStatus(\\`Airline code \\${code} is not in the current list.\\`, \"error\");\n            return;\n        }\n\n        const opened = openTracker(airline.trackerUrl);\n        setStatus(\n            opened\n                ? \\`\\\${airline.name}'s official Air Waybill tracking page opened in a new tab.\\`\n                : \"Your browser blocked the new tab. Allow pop-ups for this site and try again.\",\n            opened ? \"ok\" : \"warn\"\n        );\n    }, true);\n\n    input.addEventListener(\"input\", () => {\n        input.value = input.value.toUpperCase();\n        updateDetection();\n    });\n\n    fetch(DATA_URL, { cache: \"no-store\" })\n        .then(response => {\n            if (!response.ok) throw new Error(\\`HTTP \\${response.status}\\`);\n            return response.json();\n        })\n        .then(data => {\n            airlines = Array.isArray(data.air) ? data.air : [];\n            if (coverage) coverage.textContent = \\`\\\${airlines.length} airline codes listed. Enter the 3-digit AWB prefix or 2-letter IATA code to open the airline's official tracking page.\\`;\n            updateDetection();\n        })\n        .catch(error => {\n            console.error(\"Airline tracking data failed to load:\", error);\n            setStatus(\"Airline tracking data could not be loaded. Please refresh the page.\", \"error\");\n            form.querySelector(\".track-button\").disabled = true;\n        });\n})();\n`;
  fs.writeFileSync(file, js, "utf8");
}

console.log("Applied Blog cleanup, simplified Air tracking, and removed Bahri.");
