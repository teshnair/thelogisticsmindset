from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{label} marker not found')
    p.write_text(s.replace(old, new, 1))

# Backend: normalize classification units too, not only autocomplete units.
replace_once(
    'netlify/functions/hts-duty.mts',
    '          units: Array.isArray(selected?.units) ? selected.units : [],',
    '          units: Array.isArray(selected?.units)\n            ? selected.units.map((unit: any) => cleanUnit(unit)).filter(Boolean)\n            : [],',
    'classification units'
)

# UI: make quantity unit a selector driven by the published HTS units.
replace_once(
    'hts-duty-calculator.html',
    '''    <label for="qtyUnit">Quantity unit <span class="tiny">(optional)</span></label>\n    <input id="qtyUnit" placeholder="kg, No., L, m²...">''',
    '''    <label for="qtyUnit">Quantity unit <span class="tiny">(optional)</span></label>\n    <select id="qtyUnit"><option value="">Select HTS reporting unit</option></select>\n    <div class="helper" id="qtyUnitHelp">The published HTS reporting unit will be offered here when identified.</div>''',
    'quantity unit field'
)

replace_once(
    'hts-duty-calculator.html',
    '''function suggestionUnits(item) {\n  return Array.isArray(item?.units)\n    ? [...new Set(item.units.map(unit => String(unit || '').trim()).filter(Boolean))]\n    : [];\n}\n''',
    '''function normalizeHtsUnit(value) {\n  return String(value ?? '')\n    .replace(/<\\s*sup[^>]*>\\s*2\\s*<\\s*\\/\\s*sup\\s*>/gi, '²')\n    .replace(/<\\s*sup[^>]*>\\s*3\\s*<\\s*\\/\\s*sup\\s*>/gi, '³')\n    .replace(/&sup2;|&#178;/gi, '²')\n    .replace(/&sup3;|&#179;/gi, '³')\n    .replace(/<[^>]+>/g, '')\n    .replace(/&nbsp;|&#160;/gi, ' ')\n    .replace(/&amp;/gi, '&')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n\nfunction suggestionUnits(item) {\n  return Array.isArray(item?.units)\n    ? [...new Set(item.units.map(normalizeHtsUnit).filter(Boolean))]\n    : [];\n}\n\nfunction setQuantityUnitOptions(units, message = '') {\n  const select = $('qtyUnit');\n  const help = $('qtyUnitHelp');\n  if (!select) return;\n  const normalized = [...new Set((Array.isArray(units) ? units : []).map(normalizeHtsUnit).filter(Boolean))];\n  const previous = normalizeHtsUnit(select.value);\n  select.innerHTML = '';\n  const first = document.createElement('option');\n  first.value = '';\n  first.textContent = normalized.length ? 'Select HTS reporting unit' : 'No reporting unit identified';\n  select.appendChild(first);\n  normalized.forEach(unit => {\n    const option = document.createElement('option');\n    option.value = unit;\n    option.textContent = unit;\n    select.appendChild(option);\n  });\n  if (normalized.length === 1) select.value = normalized[0];\n  else if (previous && normalized.includes(previous)) select.value = previous;\n  if (help) help.textContent = message || (normalized.length\n    ? `Published HTS unit${normalized.length > 1 ? 's' : ''}: ${normalized.join(', ')}.`\n    : 'The published HTS reporting unit will be offered here when identified.');\n}\n''',
    'unit helper functions'
)

replace_once(
    'hts-duty-calculator.html',
    '''  if (d.length < 4) {\n    hint.textContent = 'Start with at least 4 digits. Matching HTS lines will narrow automatically as you type. The HTS reporting unit will appear here when it can be identified.';\n    return;\n  }''',
    '''  if (d.length < 4) {\n    hint.textContent = 'Start with at least 4 digits. Matching HTS lines will narrow automatically as you type. The HTS reporting unit will appear here when it can be identified.';\n    setQuantityUnitOptions([]);\n    return;\n  }''',
    'short hts unit reset'
)

replace_once(
    'hts-duty-calculator.html',
    '''  if (!pool.length) {\n    hint.textContent = `HTS reporting unit: not identified yet for ${formatInput(d)}.`;\n    return;\n  }''',
    '''  if (!pool.length) {\n    hint.textContent = `HTS reporting unit: not identified yet for ${formatInput(d)}.`;\n    setQuantityUnitOptions([]);\n    return;\n  }''',
    'empty unit pool'
)

replace_once(
    'hts-duty-calculator.html',
    '''  if (signatures.length !== 1) {\n    hint.innerHTML = `<strong>HTS reporting unit:</strong> varies within ${escapeHtml(formatInput(d))}. Select the full HTS line to see the required unit.`;\n    return;\n  }''',
    '''  if (signatures.length !== 1) {\n    hint.innerHTML = `<strong>HTS reporting unit:</strong> varies within ${escapeHtml(formatInput(d))}. Select the full HTS line to see the required unit.`;\n    setQuantityUnitOptions([], 'Select the full HTS code first because the reporting unit varies within this classification.');\n    return;\n  }''',
    'varying units'
)

replace_once(
    'hts-duty-calculator.html',
    '''  if (!units.length) {\n    hint.innerHTML = `<strong>HTS reporting unit:</strong> none listed for the selected HTS line.`;\n    return;\n  }\n  hint.innerHTML = `<strong>HTS reporting unit${units.length > 1 ? 's' : ''}:</strong> ${units.map(escapeHtml).join(', ')}. Use the published unit when entering quantity for a specific-duty formula.`;\n  if (units.length === 1 && $('qtyUnit')) $('qtyUnit').placeholder = `HTS unit: ${units[0]}`;''',
    '''  if (!units.length) {\n    hint.innerHTML = `<strong>HTS reporting unit:</strong> none listed for the selected HTS line.`;\n    setQuantityUnitOptions([]);\n    return;\n  }\n  hint.innerHTML = `<strong>HTS reporting unit${units.length > 1 ? 's' : ''}:</strong> ${units.map(escapeHtml).join(', ')}. Use the published unit when entering quantity for a specific-duty formula.`;\n  setQuantityUnitOptions(units);''',
    'identified units'
)

replace_once(
    'hts-duty-calculator.html',
    "  $('units').textContent = Array.isArray(data.classification.units) && data.classification.units.length ? data.classification.units.join(', ') : '—';",
    "  const resultUnits = Array.isArray(data.classification.units) ? [...new Set(data.classification.units.map(normalizeHtsUnit).filter(Boolean))] : [];\n  $('units').textContent = resultUnits.length ? resultUnits.join(', ') : '—';\n  setQuantityUnitOptions(resultUnits);",
    'result unit display'
)

replace_once(
    'hts-duty-calculator.html',
    "  $('calcForm').reset(); $('result').classList.add('hidden'); $('status').textContent=''; closeSuggestions(); updateHtsUnitHint([], '');",
    "  $('calcForm').reset(); $('result').classList.add('hidden'); $('status').textContent=''; closeSuggestions(); updateHtsUnitHint([], ''); setQuantityUnitOptions([]);",
    'reset units'
)

print('HTS unit UI patch complete.')
