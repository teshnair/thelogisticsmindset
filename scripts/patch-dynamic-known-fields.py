from pathlib import Path

p = Path('js/hts-import-screening-v2.js')
s = p.read_text()

s = s.replace('const BUILD = "2026-09-06-purpose-and-exclusive-metal-v4";', 'const BUILD = "2026-09-06-known-main-facts-v5";', 1)

marker = '''  let ruleLookupTimer = null;\n  let ruleLookupSeq = 0;\n  let lastRulePreview = null;\n'''
replacement = '''  let ruleLookupTimer = null;\n  let ruleLookupSeq = 0;\n  let lastRulePreview = null;\n\n  // Facts collected in the main questionnaire must never be rendered again as\n  // "additional" questions. The dynamic section is reserved for genuinely new,\n  // HTS-specific shipment facts.\n  const MAIN_FORM_FACTS = new Set([\n    "hts", "country", "customsValue", "mode", "quantity", "quantityUnit",\n    "importPurpose", "ftaQualification", "meltPourCountry"\n  ]);\n'''
if marker not in s:
    raise SystemExit('state marker not found')
s = s.replace(marker, replacement, 1)

old = '''    const facts = [...new Set([...ruleFacts, ...pgaFacts])];\n    syncExistingMeltField(facts);\n    const renderFacts = facts.filter(x => x !== "meltPourCountry" && x !== "importPurpose");\n'''
new = '''    const facts = [...new Set([...ruleFacts, ...pgaFacts])];\n    syncExistingMeltField(facts);\n    const renderFacts = facts.filter(x => !MAIN_FORM_FACTS.has(x));\n'''
if old not in s:
    raise SystemExit('renderFacts marker not found')
s = s.replace(old, new, 1)

old = '''    const seq = ++ruleLookupSeq;\n    try {\n      const res = await fetch(`/api/trade-rules?hts=${encodeURIComponent(hts)}&country=${encodeURIComponent(country)}`);\n      const data = await res.json();\n'''
new = '''    const seq = ++ruleLookupSeq;\n    try {\n      const previewPayload = {\n        hts,\n        country,\n        customsValue: document.getElementById("value")?.value || null,\n        mode: document.getElementById("mode")?.value || null,\n        quantity: document.getElementById("qty")?.value || null,\n        quantityUnit: document.getElementById("qtyUnit")?.value || null,\n        ...factsPayload()\n      };\n      const res = await fetch("/api/trade-rules", {\n        method:"POST",\n        headers:{"Content-Type":"application/json"},\n        body:JSON.stringify(previewPayload)\n      });\n      const data = await res.json();\n'''
if old not in s:
    raise SystemExit('preview fetch marker not found')
s = s.replace(old, new, 1)

old = '''      importPurpose: value("importPurpose"),\n      ftaQualification: value("dynamicFta"),\n      tscaStatus: value("tscaStatus"),\n'''
new = '''      importPurpose: value("importPurpose"),\n      // The main FTA checkbox is the single source of truth. Unchecked means\n      // not established, not an affirmative "no".\n      ftaQualification: document.getElementById("fta")?.checked ? "yes" : "unknown",\n      tscaStatus: value("tscaStatus"),\n'''
if old not in s:
    raise SystemExit('FTA payload marker not found')
s = s.replace(old, new, 1)

old = '''    country?.addEventListener("change", queueRulePreview);\n    document.getElementById("importPurpose")?.addEventListener("change", queueRulePreview);\n    watchResults();\n'''
new = '''    country?.addEventListener("change", queueRulePreview);\n    document.getElementById("value")?.addEventListener("input", queueRulePreview);\n    document.getElementById("value")?.addEventListener("change", queueRulePreview);\n    document.getElementById("meltPourCountry")?.addEventListener("change", queueRulePreview);\n    document.getElementById("fta")?.addEventListener("change", queueRulePreview);\n    document.getElementById("qty")?.addEventListener("change", queueRulePreview);\n    document.getElementById("qtyUnit")?.addEventListener("change", queueRulePreview);\n    document.getElementById("mode")?.addEventListener("change", queueRulePreview);\n    document.getElementById("importPurpose")?.addEventListener("change", queueRulePreview);\n    watchResults();\n'''
if old not in s:
    raise SystemExit('listener marker not found')
s = s.replace(old, new, 1)

p.write_text(s)
print('Patched dynamic question filtering and preview payload.')
