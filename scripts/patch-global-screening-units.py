from pathlib import Path

# 1) Include USITC reporting units in autocomplete search results.
p = Path('netlify/functions/hts-duty.mts')
s = p.read_text()
old = '''    .map((row) => ({
      code: fullCode(row) || rowCode(row),
      description: cleanText(row?.description),
      indent: Number(row?.indent ?? 0),
    }))'''
new = '''    .map((row) => ({
      code: fullCode(row) || rowCode(row),
      description: cleanText(row?.description),
      indent: Number(row?.indent ?? 0),
      units: Array.isArray(row?.units)
        ? row.units.map((unit: any) => cleanText(unit)).filter(Boolean)
        : [],
    }))'''
if old not in s:
    raise SystemExit('search suggestion source map not found')
s = s.replace(old, new, 1)
old = '''    .map((item) => ({
      hts: formatHts(item.code),
      code: item.code,
      description: item.description,
    }));'''
new = '''    .map((item) => ({
      hts: formatHts(item.code),
      code: item.code,
      description: item.description,
      units: item.units,
    }));'''
if old not in s:
    raise SystemExit('search suggestion response map not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Show the reporting unit while the HTS is being entered/selected.
p = Path('hts-duty-calculator.html')
s = p.read_text()
old = '<div class="helper">Start with at least 4 digits. Matching HTS lines will narrow automatically as you type.</div>'
new = '<div class="helper" id="htsUnitHint">Start with at least 4 digits. Matching HTS lines will narrow automatically as you type. The HTS reporting unit will appear here when it can be identified.</div>'
if old not in s:
    raise SystemExit('HTS helper not found')
s = s.replace(old, new, 1)

marker = '''function formatInput(value) {
  const d = String(value || '').replace(/\\D/g,'').slice(0,10);
  if (d.length > 6) return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6)}`;
  if (d.length > 4) return `${d.slice(0,4)}.${d.slice(4)}`;
  return d;
}
'''
insert = marker + '''
function suggestionUnits(item) {
  return Array.isArray(item?.units)
    ? [...new Set(item.units.map(unit => String(unit || '').trim()).filter(Boolean))]
    : [];
}

function updateHtsUnitHint(items, target) {
  const hint = $('htsUnitHint');
  if (!hint) return;
  const d = String(target || '').replace(/\\D/g, '');
  if (d.length < 4) {
    hint.textContent = 'Start with at least 4 digits. Matching HTS lines will narrow automatically as you type. The HTS reporting unit will appear here when it can be identified.';
    return;
  }
  const matches = (Array.isArray(items) ? items : []).filter(item => String(item?.code || '').startsWith(d));
  const exact = matches.filter(item => String(item?.code || '') === d);
  const pool = exact.length ? exact : matches;
  if (!pool.length) {
    hint.textContent = `HTS reporting unit: not identified yet for ${formatInput(d)}.`;
    return;
  }
  const signatures = [...new Set(pool.map(item => suggestionUnits(item).join('|')))];
  if (signatures.length !== 1) {
    hint.innerHTML = `<strong>HTS reporting unit:</strong> varies within ${escapeHtml(formatInput(d))}. Select the full HTS line to see the required unit.`;
    return;
  }
  const units = suggestionUnits(pool[0]);
  if (!units.length) {
    hint.innerHTML = `<strong>HTS reporting unit:</strong> none listed for the selected HTS line.`;
    return;
  }
  hint.innerHTML = `<strong>HTS reporting unit${units.length > 1 ? 's' : ''}:</strong> ${units.map(escapeHtml).join(', ')}. Use the published unit when entering quantity for a specific-duty formula.`;
  if (units.length === 1 && $('qtyUnit')) $('qtyUnit').placeholder = `HTS unit: ${units[0]}`;
}
'''
if marker not in s:
    raise SystemExit('formatInput marker not found')
s = s.replace(marker, insert, 1)

old = '''  if (digits.length < 4) {
    closeSuggestions();
    return;
  }'''
new = '''  if (digits.length < 4) {
    closeSuggestions();
    updateHtsUnitHint([], digits);
    return;
  }'''
if old not in s:
    raise SystemExit('HTS input threshold block not found')
s = s.replace(old, new, 1)

old = '''  if (!items.length) {
    box.innerHTML = `<div class="no-match">No current HTS lines begin with ${escapeHtml(formatInput(digits))}.</div>`;
    box.classList.remove('hidden');
    $('hts').setAttribute('aria-expanded','true');
    return;
  }'''
new = '''  if (!items.length) {
    box.innerHTML = `<div class="no-match">No current HTS lines begin with ${escapeHtml(formatInput(digits))}.</div>`;
    box.classList.remove('hidden');
    $('hts').setAttribute('aria-expanded','true');
    updateHtsUnitHint([], digits);
    return;
  }'''
if old not in s:
    raise SystemExit('empty suggestion block not found')
s = s.replace(old, new, 1)

old = '''    div.innerHTML = `<strong>${escapeHtml(item.hts || item.code)}</strong><span>${escapeHtml(item.description || '')}</span>`;
    div.addEventListener('click', () => {
      $('hts').value = item.hts || formatInput(item.code);
      closeSuggestions();
      $('country').focus();
    });'''
new = '''    const units = suggestionUnits(item);
    const unitText = units.length ? ` • Unit${units.length > 1 ? 's' : ''}: ${units.join(', ')}` : ' • No reporting unit listed';
    div.innerHTML = `<strong>${escapeHtml(item.hts || item.code)}</strong><span>${escapeHtml(item.description || '')}${escapeHtml(unitText)}</span>`;
    div.addEventListener('click', () => {
      $('hts').value = item.hts || formatInput(item.code);
      updateHtsUnitHint([item], item.code);
      closeSuggestions();
      $('country').focus();
    });'''
if old not in s:
    raise SystemExit('suggestion row block not found')
s = s.replace(old, new, 1)

old = '''  box.classList.remove('hidden');
  $('hts').setAttribute('aria-expanded','true');
}'''
new = '''  box.classList.remove('hidden');
  $('hts').setAttribute('aria-expanded','true');
  updateHtsUnitHint(items, digits);
}'''
# Only replace first renderSuggestions occurrence after its definition.
pos = s.find('function renderSuggestions(items, digits)')
idx = s.find(old, pos)
if idx < 0:
    raise SystemExit('renderSuggestions tail not found')
s = s[:idx] + s[idx:].replace(old, new, 1)

old = "  $('calcForm').reset(); $('result').classList.add('hidden'); $('status').textContent=''; closeSuggestions();"
new = "  $('calcForm').reset(); $('result').classList.add('hidden'); $('status').textContent=''; closeSuggestions(); updateHtsUnitHint([], '');"
if old not in s:
    raise SystemExit('reset block not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 3) Make live Chapter 99 estimates global, not Section-232/301-only, and make generated rule facts answerable.
p = Path('js/hts-import-screening-v2.js')
s = p.read_text()
s = s.replace('const BUILD = "2026-09-06-worst-case-v2";', 'const BUILD = "2026-09-06-global-worst-case-v3";', 1)

# Expand dynamic fields for generic rule facts.
old = '''    if (key === "plantMaterial") return `<div><label for="plantMaterial">${questionLabel(key)}</label><select id="plantMaterial"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    return `<div class="rule-fact-note"><strong>${esc(questionLabel(key))}</strong><br><small>Not entered. The quick estimate uses the higher-duty assumption until this fact is confirmed.</small></div>`;'''
new = '''    if (key === "plantMaterial") return `<div><label for="plantMaterial">${questionLabel(key)}</label><select id="plantMaterial"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    const factId = `ruleFact_${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const numericFacts = new Set(["subjectMetalWeightPercent", "nonUsVehicleContentValue", "nonUsContentValue", "usContentValue"]);
    if (numericFacts.has(key)) return `<div><label for="${factId}">${esc(questionLabel(key))}</label><input id="${factId}" data-rule-fact="${esc(key)}" type="number" min="0" step="any" placeholder="Enter value if known"></div>`;
    const booleanFact = key.startsWith("productCondition:") || new Set(["containsAluminumSteelCopper","ukMetalContentQualification","column2CountryStatus","quotaEligibility","approvalStatus","commerceApproval","productSpecificCondition"]).has(key);
    if (booleanFact) return `<div><label for="${factId}">${esc(questionLabel(key))}</label><select id="${factId}" data-rule-fact="${esc(key)}"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    return `<div><label for="${factId}">${esc(questionLabel(key))}</label><input id="${factId}" data-rule-fact="${esc(key)}" placeholder="Enter if known"><small>Leave blank to use the higher-duty quick-estimate assumption.</small></div>`;'''
if old not in s:
    raise SystemExit('generic field fallback not found')
s = s.replace(old, new, 1)

old = '''  function factsPayload() {
    const value = id => document.getElementById(id)?.value ?? null;
    return {
      meltPourCountry: value("meltPourCountry"),
      metalContentValue: value("metalContentValue"),
      usMetalContentQualification: value("usMetalContentQualification"),
      vehicleManufactureYear: value("vehicleManufactureYear"),
      vehicleEngineStatus: value("vehicleEngineStatus"),
      importPurpose: value("importPurpose"),
      ftaQualification: value("dynamicFta"),
      tscaStatus: value("tscaStatus"),
      rfCapability: value("rfCapability"),
      plantMaterial: value("plantMaterial")
    };
  }'''
new = '''  function factsPayload() {
    const value = id => document.getElementById(id)?.value ?? null;
    const payload = {
      meltPourCountry: value("meltPourCountry"),
      metalContentValue: value("metalContentValue"),
      usMetalContentQualification: value("usMetalContentQualification"),
      vehicleManufactureYear: value("vehicleManufactureYear"),
      vehicleEngineStatus: value("vehicleEngineStatus"),
      importPurpose: value("importPurpose"),
      ftaQualification: value("dynamicFta"),
      tscaStatus: value("tscaStatus"),
      rfCapability: value("rfCapability"),
      plantMaterial: value("plantMaterial")
    };
    document.querySelectorAll('[data-rule-fact]').forEach(el => {
      const key = el.getAttribute('data-rule-fact');
      if (key) payload[key] = el.value || null;
    });
    return payload;
  }'''
if old not in s:
    raise SystemExit('factsPayload block not found')
s = s.replace(old, new, 1)

old = '''  function recalcTotal(baseData, sec232, sec301) {
    const totalEl = document.getElementById("total");
    if (!totalEl) return;
    if (sec232 == null || sec301 == null || baseData?.estimate?.baseDuty == null) {
      totalEl.textContent = "Review required";
      return;
    }
    const base = Number(baseData.estimate.baseDuty || 0);
    const other = Number(baseData.estimate.otherAdditionalDuty || 0);
    const mpf = Number(baseData.estimate.mpf || 0);
    const hmf = Number(baseData.estimate.hmf || 0);
    totalEl.textContent = money(base + other + mpf + hmf + sec232 + sec301);
  }'''
new = '''  function recalcTotal(baseData, sec232, sec301, liveOther) {
    const totalEl = document.getElementById("total");
    if (!totalEl) return;
    if (sec232 == null || sec301 == null || liveOther == null || baseData?.estimate?.baseDuty == null) {
      totalEl.textContent = "Review required";
      return;
    }
    const base = Number(baseData.estimate.baseDuty || 0);
    const legacyOther = Number(baseData.estimate.otherAdditionalDuty || 0);
    const mpf = Number(baseData.estimate.mpf || 0);
    const hmf = Number(baseData.estimate.hmf || 0);
    const otherEl = document.getElementById("otherAdditionalDuty");
    if (otherEl) otherEl.textContent = money(legacyOther + liveOther);
    totalEl.textContent = money(base + legacyOther + liveOther + mpf + hmf + sec232 + sec301);
  }'''
if old not in s:
    raise SystemExit('recalcTotal block not found')
s = s.replace(old, new, 1)

old = '''    const needsReview = ["needs-facts", "review-required"].includes(ruleData?.status);
    if (!needsReview) { flag?.remove(); return; }
    if (!flag) {
      flag = document.createElement("small");
      flag.className = "estimate-review-flag";
      card.appendChild(flag);
    }
    flag.textContent = "Review required • worst-case assumptions used";'''
new = '''    const assumptionsUsed = Array.isArray(ruleData?.assumptions) && ruleData.assumptions.length > 0;
    const needsReview = ["needs-facts", "review-required"].includes(ruleData?.status) || assumptionsUsed;
    if (!needsReview) { flag?.remove(); return; }
    if (!flag) {
      flag = document.createElement("small");
      flag.className = "estimate-review-flag";
      card.appendChild(flag);
    }
    flag.textContent = ["needs-facts", "review-required"].includes(ruleData?.status)
      ? "Review required • worst-case assumptions used"
      : "Estimate uses assumptions • broker confirmation recommended";'''
if old not in s:
    raise SystemExit('review flag block not found')
s = s.replace(old, new, 1)

old = '''      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
      const sec301Measures = measures.filter(m => String(m.program).toLowerCase() === "section 301");
      const programEstimate = list => {
        if (!list.length) return 0;
        const applied = list.filter(m => m.applicability === "applicable" && m.estimatedDuty != null).reduce((sum,m) => sum + Number(m.estimatedDuty || 0), 0);
        const available = list.map(m => m.estimatedDuty ?? m.worstCaseEstimatedDuty).filter(v => v != null).map(Number);
        if (!available.length && applied === 0) return null;
        return Math.max(applied, ...available, 0);
      };
      const sec232 = programEstimate(sec232Measures);
      const sec301 = programEstimate(sec301Measures);
      const status = ruleData.status;
      setMetric("section232Duty", sec232, status);
      setMetric("section301Duty", sec301, status);
      recalcTotal(baseData, sec232, sec301);
      setEstimateReviewFlag(ruleData);'''
new = '''      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
      const sec301Measures = measures.filter(m => String(m.program).toLowerCase() === "section 301");
      const otherLiveMeasures = measures.filter(m => !["section 232", "section 301"].includes(String(m.program).toLowerCase()));
      const groupWorstCase = list => {
        if (!list.length) return 0;
        const applied = list.filter(m => m.applicability === "applicable" && m.estimatedDuty != null).reduce((sum,m) => sum + Number(m.estimatedDuty || 0), 0);
        const unresolved = list.filter(m => m.applicability !== "applicable").map(m => m.worstCaseEstimatedDuty).filter(v => v != null).map(Number);
        if (!unresolved.length) return applied;
        return Math.max(applied, ...unresolved, 0);
      };
      const sec232 = groupWorstCase(sec232Measures);
      const sec301 = groupWorstCase(sec301Measures);
      const otherGroups = new Map();
      otherLiveMeasures.forEach(m => {
        const noteFamily = Array.isArray(m.noteTargets) && m.noteTargets.length ? String(m.noteTargets[0]).split(':')[0] : String(m.hts || '').slice(0,7);
        const key = `${m.program}|${noteFamily}`;
        if (!otherGroups.has(key)) otherGroups.set(key, []);
        otherGroups.get(key).push(m);
      });
      const liveOther = [...otherGroups.values()].reduce((sum, group) => {
        const estimate = groupWorstCase(group);
        return estimate == null ? sum : sum + Number(estimate);
      }, 0);
      const status = ruleData.status;
      setMetric("section232Duty", sec232, status);
      setMetric("section301Duty", sec301, status);
      recalcTotal(baseData, sec232, sec301, liveOther);
      setEstimateReviewFlag(ruleData);'''
if old not in s:
    raise SystemExit('program estimate block not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 4) Cache-bust the screening script so browsers load this version.
p = Path('js/fx-ticker.js')
s = p.read_text()
s = s.replace('js/hts-import-screening-v2.js?v=20260906-1', 'js/hts-import-screening-v2.js?v=20260906-4')
p.write_text(s)
