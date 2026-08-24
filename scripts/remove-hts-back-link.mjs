import fs from "node:fs";

const file = "hts-duty-calculator.html";
const html = fs.readFileSync(file, "utf8");
let next = html;

next = next.replace(/\r?\n\.back-link\{margin:20px 0 0\}\.back-link a\{color:var\(--accent-color\);text-decoration:none;font-weight:600\}\.back-link a:hover\{text-decoration:underline\}/, "");
next = next.replace(/\r?\n<p class="back-link"><a href="customs\.html">← Back to Customs &amp; Trade Concepts<\/a><\/p>/, "");
next = next.replace(".tool-card,.back-link,.actions{display:none!important}", ".tool-card,.actions{display:none!important}");

if (next === html) {
  throw new Error("Expected HTS calculator back link was not found; no file was changed.");
}

fs.writeFileSync(file, next, "utf8");
console.log("Removed HTS calculator back link and its unused styling.");
