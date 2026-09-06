from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{label}: marker not found in {path}')
    p.write_text(s.replace(old, new, 1))

# 1. Normalize published HTS unit markup in the backend.
path = 'netlify/functions/hts-duty.mts'
p = Path(path)
s = p.read_text()
old = '''function cleanText(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\\/?il>/gi, "")
    .replace(/\\s+/g, " ")
    .trim();
  return text || null;
}
'''
new = '''function cleanText(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\\/?il>/gi, "")
    .replace(/\\s+/g, " ")
    .trim();
  return text || null;
}

function cleanUnit(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\\s*sup[^>]*>\\s*2\\s*<\\s*\\/\\s*sup\\s*>/gi, "²")
    .replace(/<\\s*sup[^>]*>\\s*3\\s*<\\s*\\/\\s*sup\\s*>/gi, "³")
    .replace(/&sup2;|&#178;/gi, "²")
    .replace(/&sup3;|&#179;/gi, "³")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\\s+/g, " ")
    .trim();
  return text || null;
}
'''
if old not in s: raise SystemExit('cleanText marker not found')
s = s.replace(old, new, 1)
old = '''      units: Array.isArray(row?.units)
        ? row.units.map((unit: any) => cleanText(unit)).filter(Boolean)
        : [],'''
new = '''      units: Array.isArray(row?.units)
        ? row.units.map((unit: any) => cleanUnit(unit)).filter(Boolean)
        : [],'''
if old not in s: raise SystemExit('unit mapping marker not found')
s = s.replace(old, new, 1)
old = '''  const normalize = (value: string) =>
    value.toLowerCase().replace(/[.\\s]/g, "");'''
new = '''  const normalize = (value: string) =>
    value.toLowerCase().replace(/²/g, "2").replace(/³/g, "3").replace(/[.\\s]/g, "");'''
if old not in s: raise SystemExit('unitMatches normalize marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 2. Put Import purpose in the main questionnaire.
path = 'hts-duty-calculator.html'
p = Path(path)
s = p.read_text()
old = '''  <div>
    <label for="mode">Mode of import</label>
    <select id="mode"><option value="ocean">Ocean</option><option value="air">Air</option><option value="land">Land / rail</option></select>
  </div>
  <div>
    <label for="qty">Quantity <span class="tiny">(optional)</span></label>'''
new = '''  <div>
    <label for="mode">Mode of import</label>
    <select id="mode"><option value="ocean">Ocean</option><option value="air">Air</option><option value="land">Land / rail</option></select>
  </div>
  <div>
    <label for="importPurpose">Import purpose</label>
    <select id="importPurpose">
      <option value="standard">Standard import / consumption</option>
      <option value="temporary">Temporary import / re-export</option>
      <option value="testing">Prototype / testing / research</option>
      <option value="repair">Repair / alteration / processing</option>
      <option value="tools">Professional tools / equipment</option>
      <option value="show">Exhibition / trade show / display</option>
      <option value="samples">Commercial samples / taking orders</option>
      <option value="racing">Racing / competition</option>
    </select>
    <div class="helper">Used to flag possible Chapter 98, TIB or ATA Carnet alternatives. Eligibility depends on the shipment facts.</div>
  </div>
  <div>
    <label for="qty">Quantity <span class="tiny">(optional)</span></label>'''
if old not in s: raise SystemExit('import purpose insertion marker not found')
s = s.replace(old, new, 1)
# Ensure main duty payload carries purpose as well.
old = '''      quantity:$('qty').value, quantityUnit:$('qtyUnit').value,
      ftaQualified:$('fta').checked'''
new = '''      quantity:$('qty').value, quantityUnit:$('qtyUnit').value,
      importPurpose:$('importPurpose').value,
      ftaQualified:$('fta').checked'''
if old not in s: raise SystemExit('payload purpose marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 3. Enforce U.S. note 16 mutual exclusivity in the Chapter 99 resolver.
path = 'netlify/functions/trade-rules.mts'
p = Path(path)
s = p.read_text()
marker = 'function applyWorstCaseEstimates(measures:EvaluatedMeasure[],input:any,customsValue:number,country:string)'
if marker not in s: raise SystemExit('worst case function marker not found')
insert = '''function isMutuallyExclusiveMetalHeading(ref:string){const m=String(ref||"").match(/^9903\\.82\\.(\\d{2})$/);if(!m)return false;const n=Number(m[1]);return n>=2&&n<=26;}
function enforceMetalMutualExclusivity(measures:EvaluatedMeasure[]){const candidates=measures.filter(m=>isMutuallyExclusiveMetalHeading(m.hts)&&m.applicability!=="not-applicable");if(candidates.length<=1)return;const reason="U.S. note 16(a) makes headings 9903.82.02 through 9903.82.26 mutually exclusive. More than one candidate was identified, but only one of these headings may apply; the rates must not be added together.";for(const m of candidates){m.applicability="needs-facts";m.estimatedDuty=null;m.replacementDutyEstimate=null;m.reason=reason;}}
'''
s = s.replace(marker, insert + marker, 1)
old = 'applyCompetingConditionPrecedence(evaluated,input);applyExplicitExceptions(evaluated);applyWorstCaseEstimates(evaluated,input,customsValue,country);'
new = 'applyCompetingConditionPrecedence(evaluated,input);applyExplicitExceptions(evaluated);enforceMetalMutualExclusivity(evaluated);applyWorstCaseEstimates(evaluated,input,customsValue,country);'
if old not in s: raise SystemExit('handler precedence marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 4. Update overlay: unit choices, purpose guidance, prototype treatment notice, and exclusive 9903.82 total.
path = 'js/hts-import-screening-v2.js'
p = Path(path)
s = p.read_text()
s = s.replace('const BUILD = "2026-09-06-global-worst-case-v3";', 'const BUILD = "2026-09-06-purpose-and-exclusive-metal-v4";', 1)
s = s.replace('if (/^870[1-5]/.test(code)) facts.push("vehicleManufactureYear", "vehicleEngineStatus", "importPurpose");', 'if (/^870[1-5]/.test(code)) facts.push("vehicleManufactureYear", "vehicleEngineStatus");', 1)
s = s.replace('    if (key === "importPurpose") return `<div><label for="importPurpose">${questionLabel(key)}</label><select id="importPurpose"><option value="standard">Standard import / consumption</option><option value="temporary">Temporary import</option><option value="repair">Repair / alteration</option><option value="testing">Testing / research / prototype</option><option value="show">Show / display / exhibition</option><option value="racing">Racing / competition</option></select></div>`;', '    if (key === "importPurpose") return ""; // main questionnaire field', 1)
old = '''    const renderFacts = facts.filter(x => x !== "meltPourCountry");'''
new = '''    const renderFacts = facts.filter(x => x !== "meltPourCountry" && x !== "importPurpose");'''
if old not in s: raise SystemExit('renderFacts marker not found')
s = s.replace(old, new, 1)
# Styles for clearance guidance.
old = '''      .rule-fact-note small{color:#667085}
      @media(max-width:760px){'''
new = '''      .rule-fact-note small{color:#667085}
      .clearance-panel{margin-top:18px;padding:16px;border:1px solid #cfd8e3;border-radius:5px;background:#f7faff}
      .clearance-panel h3{margin:0 0 8px;color:#1a2a3a}
      .clearance-option{padding:10px 12px;margin-top:8px;border-left:4px solid #2c7be5;background:#fff;font-size:.86rem}
      .clearance-option strong{color:#1a2a3a}
      .clearance-caution{margin-top:10px;padding:10px 12px;background:#fff3d6;color:#614800;border-radius:4px;font-size:.84rem}
      @media(max-width:760px){'''
if old not in s: raise SystemExit('style marker not found')
s = s.replace(old, new, 1)
# Insert helpers before ensureModal.
marker = '  function ensureModal() {'
if marker not in s: raise SystemExit('ensureModal marker not found')
helpers = r'''  function normalizePublishedUnit(value) {
    return String(value ?? "")
      .replace(/<\s*sup[^>]*>\s*2\s*<\s*\/\s*sup\s*>/gi, "²")
      .replace(/<\s*sup[^>]*>\s*3\s*<\s*\/\s*sup\s*>/gi, "³")
      .replace(/&sup2;|&#178;/gi, "²")
      .replace(/&sup3;|&#179;/gi, "³")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function ensureQtyUnitAssist() {
    const input = document.getElementById("qtyUnit");
    if (!input) return;
    input.setAttribute("list", "qtyUnitOptions");
    let list = document.getElementById("qtyUnitOptions");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "qtyUnitOptions";
      input.after(list);
    }
  }

  function syncQtyUnitChoices(items, target) {
    ensureQtyUnitAssist();
    const input = document.getElementById("qtyUnit");
    const list = document.getElementById("qtyUnitOptions");
    if (!input || !list) return;
    const d = digits(target);
    const matches = (Array.isArray(items) ? items : []).filter(item => digits(item?.code || item?.hts || "").startsWith(d));
    const exact = matches.filter(item => digits(item?.code || item?.hts || "") === d);
    const pool = exact.some(item => Array.isArray(item?.units) && item.units.length) ? exact : matches;
    const units = [...new Set(pool.flatMap(item => Array.isArray(item?.units) ? item.units : []).map(normalizePublishedUnit).filter(Boolean))];
    list.innerHTML = units.map(unit => `<option value="${esc(unit)}"></option>`).join("");
    if (!units.length) {
      input.placeholder = "kg, No., L, m²...";
      if (input.dataset.autoUnit === "true") input.value = "";
      input.dataset.autoUnit = "false";
      return;
    }
    if (units.length === 1) {
      const oldAuto = input.dataset.autoUnit === "true";
      if (!input.value || oldAuto) {
        input.value = units[0];
        input.dataset.autoUnit = "true";
      }
      input.placeholder = `HTS unit: ${units[0]}`;
    } else {
      if (input.dataset.autoUnit === "true") input.value = "";
      input.dataset.autoUnit = "false";
      input.placeholder = `Select HTS unit: ${units.join(" or ")}`;
    }
  }

  function hookUnitHint() {
    ensureQtyUnitAssist();
    if (typeof window.updateHtsUnitHint !== "function" || window.updateHtsUnitHint.__unitAssist) return;
    const original = window.updateHtsUnitHint;
    const wrapped = function(items, target) {
      const normalized = (Array.isArray(items) ? items : []).map(item => ({...item, units:Array.isArray(item?.units) ? item.units.map(normalizePublishedUnit) : []}));
      original(normalized, target);
      syncQtyUnitChoices(normalized, target);
    };
    wrapped.__unitAssist = true;
    window.updateHtsUnitHint = wrapped;
  }

  function isExclusiveMetalMeasure(m) {
    const match = String(m?.hts || "").match(/^9903\.82\.(\d{2})$/);
    if (!match) return false;
    const n = Number(match[1]);
    return n >= 2 && n <= 26;
  }

  function quickMeasureAmount(m) {
    const value = m?.estimatedDuty ?? m?.worstCaseEstimatedDuty;
    return value == null ? null : Number(value);
  }

  function clearanceOptions(purpose, hts) {
    const code = digits(hts);
    const vehicle = /^870[1-5]/.test(code);
    const options = [];
    let caution = "";
    if (purpose === "testing") {
      options.push(["9817.85.01 — qualifying prototype", "A qualifying prototype imported in limited noncommercial quantities exclusively for development, testing, product evaluation or quality control may receive duty-free ordinary customs treatment. Eligibility is fact-specific."]);
      options.push(["9813.00.30 — Temporary Importation under Bond", "An article imported solely for testing, experimental or review purposes and intended for export or destruction may qualify for TIB treatment instead of a consumption entry."]);
      caution = "If 9817.85.01 qualifies, the ordinary/base duty shown in the standard consumption estimate may be reduced to $0. Chapter 99 duties, fees and agency requirements must still be checked separately.";
      if (vehicle) caution += " For vehicles, prototype/testing treatment does not by itself eliminate an otherwise applicable automobile Section 232 Chapter 99 duty, and NHTSA/EPA requirements are separate.";
    } else if (purpose === "temporary") {
      options.push(["Temporary Importation under Bond (TIB)", "A qualifying temporary-use article may enter under the appropriate 9813 provision without regular duty, subject to bond, time limits and export/destruction requirements."]);
      options.push(["ATA Carnet", "A carnet can replace the normal customs entry/bond for eligible temporary-use goods that will be re-exported. It is not a blanket exemption and is not suitable for goods consumed or given away."]);
    } else if (purpose === "repair") {
      options.push(["9813.00.05 — TIB for repair / alteration / processing", "Foreign goods imported temporarily for repair, alteration or processing and then exported may qualify for this TIB provision."]);
      options.push(["9802.00.40 / 9802.00.50 — returned U.S. goods", "If U.S.-origin goods return after foreign repair or alteration, a Chapter 98 returned-goods provision may change the dutiable amount, depending on the facts."]);
    } else if (purpose === "tools") {
      options.push(["9813.00.50 — professional equipment / tools of trade", "Professional equipment or tools imported temporarily for use and re-export may qualify for TIB treatment when the statutory conditions are met."]);
      options.push(["ATA Carnet", "Eligible professional equipment can often travel under a carnet instead of a regular consumption entry."]);
    } else if (purpose === "show") {
      options.push(["TIB or ATA Carnet", "Goods imported temporarily for exhibition or a trade show may qualify for a TIB or carnet route rather than a normal consumption entry."]);
      if (vehicle) caution = "Vehicle show/display imports can also require specific NHTSA and EPA eligibility or approval. A carnet or TIB does not replace those agency requirements.";
    } else if (purpose === "samples") {
      options.push(["9813.00.20 — samples solely for taking orders", "Commercial samples used solely to solicit orders and intended for re-export may qualify for TIB treatment."]);
      options.push(["ATA Carnet", "Eligible commercial samples may use a carnet when they will be re-exported; goods consumed or given away generally do not fit the carnet route."]);
    } else if (purpose === "racing") {
      if (vehicle) options.push(["Competition vehicle temporary pathway", "A vehicle imported solely for competition may have separate NHTSA/EPA temporary or exemption procedures. The applicable agency requirements must be confirmed before shipment."]);
      caution = "Competition use is not automatically the same as a qualifying prototype under 9817.85.01. Do not treat the normal duty as zero merely because the vehicle will be raced.";
    }
    return {options, caution};
  }

  function renderClearanceOptions(baseData) {
    const result = document.getElementById("result");
    if (!result) return;
    let panel = document.getElementById("alternateClearancePanel");
    const purpose = document.getElementById("importPurpose")?.value || "standard";
    const {options, caution} = clearanceOptions(purpose, baseData?.query?.hts || document.getElementById("hts")?.value || "");
    if (!options.length && !caution) { panel?.remove(); return; }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "alternateClearancePanel";
      panel.className = "clearance-panel";
      const live = document.getElementById("liveTradeRulePanel");
      if (live) live.after(panel); else result.appendChild(panel);
    }
    panel.innerHTML = `<h3>Possible alternate clearance based on import purpose</h3>${options.map(([title,body]) => `<div class="clearance-option"><strong>${esc(title)}</strong><br>${esc(body)}</div>`).join("")}${caution ? `<div class="clearance-caution">${esc(caution)}</div>` : ""}<div class="rule-source-note">These are screening suggestions, not automatic exemptions. The selected route must meet the applicable Chapter 98, CBP and partner-agency conditions.</div>`;
  }

'''
s = s.replace(marker, helpers + marker, 1)
# Add metal exclusivity warning in live panel.
old = '''    const assumptions = Array.isArray(ruleData?.assumptions) ? ruleData.assumptions : [];
    const rev = ruleData?.currentHts?.label'''
new = '''    const assumptions = Array.isArray(ruleData?.assumptions) ? ruleData.assumptions : [];
    const exclusiveMetal = measures.filter(isExclusiveMetalMeasure);
    const exclusiveMetalWarning = exclusiveMetal.length > 1 ? `<div class="rule-warning"><strong>Mutually exclusive Section 232 headings.</strong> U.S. note 16(a) permits no more than one of headings 9903.82.02 through 9903.82.26 to apply to an article. These candidates are shown for review, but they are not added together in the quick estimate.</div>` : "";
    const rev = ruleData?.currentHts?.label'''
if old not in s: raise SystemExit('panel assumptions marker not found')
s = s.replace(old, new, 1)
old = '''    const lines = measures.length ? measures.map(m => {
      const badge = m.applicability === "applicable" && m.estimatedDuty != null ? `<span class="rule-badge checked">Applied</span>` : `<span class="rule-badge">Review</span>`;'''
new = '''    const lines = measures.length ? measures.map(m => {
      const badge = exclusiveMetal.length > 1 && isExclusiveMetalMeasure(m) ? `<span class="rule-badge">Alternative</span>` : (m.applicability === "applicable" && m.estimatedDuty != null ? `<span class="rule-badge checked">Applied</span>` : `<span class="rule-badge">Review</span>`);'''
if old not in s: raise SystemExit('panel badge marker not found')
s = s.replace(old, new, 1)
old = '''    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="rule-source-note">Checked against ${esc(rev)} and current Chapter 99 source. Screening build ${BUILD}.</div>${sourceWarning}${reviewWarning}${unresolvedWarning}${assumptionWarning}${lines}'''
new = '''    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="rule-source-note">Checked against ${esc(rev)} and current Chapter 99 source. Screening build ${BUILD}.</div>${sourceWarning}${reviewWarning}${unresolvedWarning}${assumptionWarning}${exclusiveMetalWarning}${lines}'''
if old not in s: raise SystemExit('panel html marker not found')
s = s.replace(old, new, 1)
# Replace groupWorstCase with one that never stacks 9903.82.02-.26.
old = '''      const groupWorstCase = list => {
        if (!list.length) return 0;
        const applied = list.filter(m => m.applicability === "applicable" && m.estimatedDuty != null).reduce((sum,m) => sum + Number(m.estimatedDuty || 0), 0);
        const unresolved = list.filter(m => m.applicability !== "applicable").map(m => m.worstCaseEstimatedDuty).filter(v => v != null).map(Number);
        if (!unresolved.length) return applied;
        return Math.max(applied, ...unresolved, 0);
      };'''
new = '''      const groupWorstCase = list => {
        if (!list.length) return 0;
        const exclusive = list.filter(isExclusiveMetalMeasure);
        const ordinary = list.filter(m => !isExclusiveMetalMeasure(m));
        const exclusiveValues = exclusive.map(quickMeasureAmount).filter(v => v != null);
        const exclusiveAmount = exclusiveValues.length ? Math.max(...exclusiveValues, 0) : 0;
        const applied = ordinary.filter(m => m.applicability === "applicable" && m.estimatedDuty != null).reduce((sum,m) => sum + Number(m.estimatedDuty || 0), 0);
        const unresolved = ordinary.filter(m => m.applicability !== "applicable").map(m => m.worstCaseEstimatedDuty).filter(v => v != null).map(Number);
        const ordinaryAmount = unresolved.length ? Math.max(applied, ...unresolved, 0) : applied;
        return exclusiveAmount + ordinaryAmount;
      };'''
if old not in s: raise SystemExit('groupWorstCase marker not found')
s = s.replace(old, new, 1)
# Render purpose suggestions after live panel.
old = '''      setEstimateReviewFlag(ruleData);
      renderLiveRulePanel(ruleData);'''
new = '''      setEstimateReviewFlag(ruleData);
      renderLiveRulePanel(ruleData);
      renderClearanceOptions(baseData);'''
if old not in s: raise SystemExit('renderLiveRulePanel call marker not found')
s = s.replace(old, new, 1)
# Init unit hook and purpose listeners.
old = '''    addStyles();
    updateHeading();
    ensureQuestionBox();'''
new = '''    addStyles();
    updateHeading();
    hookUnitHint();
    ensureQtyUnitAssist();
    ensureQuestionBox();'''
if old not in s: raise SystemExit('init marker not found')
s = s.replace(old, new, 1)
old = '''    country?.addEventListener("change", queueRulePreview);
    watchResults();'''
new = '''    country?.addEventListener("change", queueRulePreview);
    document.getElementById("importPurpose")?.addEventListener("change", queueRulePreview);
    watchResults();'''
if old not in s: raise SystemExit('purpose listener marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 5. Strengthen smoke tests with generic mutual-exclusivity and unit-markup invariants.
path = '.github/workflows/hts-calculator-smoke.yml'
p = Path(path)
s = p.read_text()
old = '''          assert any(s.get('units') for s in suggestions), suggestions

          # China passenger automobile'''
new = '''          assert any(s.get('units') for s in suggestions), suggestions
          assert all('<sup' not in str(u).lower() for s in suggestions for u in s.get('units', [])), suggestions

          # China passenger automobile'''
if old not in s: raise SystemExit('unit smoke marker not found')
s = s.replace(old, new, 1)
old = '''          def quick_amount(m):
              return m.get('estimatedDuty') if m.get('estimatedDuty') is not None else m.get('worstCaseEstimatedDuty')

          # 4/6-digit classifications'''
new = '''          def quick_amount(m):
              return m.get('estimatedDuty') if m.get('estimatedDuty') is not None else m.get('worstCaseEstimatedDuty')

          def assert_metal_mutual_exclusivity(data):
              metal = []
              for m in data.get('measures', []):
                  ref = str(m.get('hts',''))
                  if ref.startswith('9903.82.'):
                      try: suffix = int(ref.rsplit('.',1)[1])
                      except Exception: continue
                      if 2 <= suffix <= 26: metal.append(m)
              assert len([m for m in metal if m.get('applicability') == 'applicable']) <= 1, metal

          # 4/6-digit classifications'''
if old not in s: raise SystemExit('mutual helper marker not found')
s = s.replace(old, new, 1)
# Insert assertions after each current full lookup by replacing assert_current occurrences with following line once globally in script text.
s = s.replace('          assert_current(china_auto)\n', '          assert_current(china_auto)\n          assert_metal_mutual_exclusivity(china_auto)\n', 1)
s = s.replace('          assert_current(india_auto)\n', '          assert_current(india_auto)\n          assert_metal_mutual_exclusivity(india_auto)\n', 1)
s = s.replace('          assert_current(old_china_auto)\n', '          assert_current(old_china_auto)\n          assert_metal_mutual_exclusivity(old_china_auto)\n', 1)
s = s.replace('          assert_current(ru_unknown)\n', '          assert_current(ru_unknown)\n          assert_metal_mutual_exclusivity(ru_unknown)\n', 1)
s = s.replace('          assert_current(ru_default)\n', '          assert_current(ru_default)\n          assert_metal_mutual_exclusivity(ru_default)\n', 1)
s = s.replace('          assert_current(ru_reduced)\n', '          assert_current(ru_reduced)\n          assert_metal_mutual_exclusivity(ru_reduced)\n', 1)
s = s.replace('          assert_current(ca_steel)\n', '          assert_current(ca_steel)\n          assert_metal_mutual_exclusivity(ca_steel)\n', 1)
p.write_text(s)

print('Patch completed successfully.')
