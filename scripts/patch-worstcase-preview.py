from pathlib import Path

trade = Path('netlify/functions/trade-rules.mts')
text = trade.read_text()

marker = 'function calculationBase(ref:string,input:any,context:string,customsValue:number)'
if 'function applyWorstCaseEstimates(' not in text:
    inject = '''function applyWorstCaseEstimates(measures:EvaluatedMeasure[],input:any,customsValue:number,country:string){const enteredMeltPour=clean(fact(input,"meltPourCountry")).toUpperCase();for(const m of measures){const a=m as any;a.worstCaseEstimatedDuty=m.estimatedDuty;a.assumptions=[] as string[];if(m.applicability==="not-applicable"||m.ratePercent===null||m.ratePercent===0||m.rateMode!=="additional")continue;if(m.estimatedDuty===null&&customsValue>0){let base=customsValue;const contentSpecific=/only apply to the declared value of the (?:aluminum|steel|copper) content|duty.*value of the (?:aluminum|steel|copper) content/i.test(m.sourceContext);if(contentSpecific){const enteredContent=numberValue(fact(input,"metalContentValue"))??numberValue(fact(input,"nonUsContentValue"));base=enteredContent??customsValue;if(enteredContent===null)a.assumptions.push("Covered metal content value was not entered, so the full entered customs value was used for the quick estimate.");}a.worstCaseEstimatedDuty=base*m.ratePercent/100;}if(m.program==="Section 232"&&!enteredMeltPour)a.assumptions.push(`First melt/pour country was not entered, so the entered country of origin (${country}) was assumed to be the melt/pour country.`);if(m.applicability!=="applicable")a.assumptions.push("Any unresolved exclusion, exception, special program, or product-specific condition was assumed not to reduce the identified duty.");}}
'''
    if marker not in text:
        raise SystemExit('calculationBase marker not found')
    text = text.replace(marker, inject + marker, 1)

old = 'applyCompetingConditionPrecedence(evaluated,input);applyExplicitExceptions(evaluated);const visible='
new = 'applyCompetingConditionPrecedence(evaluated,input);applyExplicitExceptions(evaluated);applyWorstCaseEstimates(evaluated,input,customsValue,country);const visible='
if old in text:
    text = text.replace(old, new, 1)
elif 'applyWorstCaseEstimates(evaluated,input,customsValue,country);const visible=' not in text:
    raise SystemExit('evaluation pipeline marker not found')

old = 'requiredFacts=[...new Set(visible.flatMap(m=>m.requiredFacts))];let status="resolved";'
new = 'requiredFacts=[...new Set(visible.flatMap(m=>m.requiredFacts))],assumptions=[...new Set(visible.flatMap(m=>(m as any).assumptions||[]))];let status="resolved";'
if old in text:
    text = text.replace(old, new, 1)
elif 'assumptions=[...new Set(visible.flatMap' not in text:
    raise SystemExit('requiredFacts marker not found')

text = text.replace('measures:visible,requiredFacts,screenedOut:', 'measures:visible,requiredFacts,assumptions,screenedOut:', 1)
text = text.replace('"One or more current Chapter 99 candidates require additional facts or review before a definitive duty result can be stated.",safety:', '"A worst-case quick estimate is provided where a current rate can be identified. One or more Chapter 99 candidates still require additional facts or review before filing.",safety:', 1)
text = text.replace('unresolvedRulePolicy:"Unresolved origin, condition, exception, or rate logic is returned as needs-facts or review-required and is not added to the duty total."', 'unresolvedRulePolicy:"Unresolved origin, condition, exception, or rate logic remains flagged for review. When a current rate is identifiable, a worst-case quick estimate is also returned using stated assumptions."', 1)
trade.write_text(text)

js = Path('js/hts-import-screening-v2.js')
s = js.read_text()
s = s.replace('const BUILD = "2026-09-06-live-ch99-v1";', 'const BUILD = "2026-09-06-worst-case-v2";', 1)

start = s.index('  function questionLabel(key) {')
end = s.index('\n\n  function fieldHtml(key) {', start)
s = s[:start] + '''  function questionLabel(key) {
    const k = String(key || "");
    if (k.startsWith("productCondition:")) return `Product-specific exclusion / condition for ${k.slice("productCondition:".length)}`;
    return ({
      meltPourCountry: "Steel first melt / pour country",
      metalContentValue: "Value of covered metal content (USD)",
      containsAluminumSteelCopper: "Whether the article contains aluminum, steel, or copper",
      subjectMetalWeightPercent: "Percentage by weight of the subject metal",
      usMetalContentQualification: "Whether the U.S.-metal-content qualification is met",
      ukMetalContentQualification: "Whether the U.K. metal-content qualification is met",
      vehicleManufactureYear: "Vehicle manufacture year",
      vehicleEngineStatus: "Vehicle engine configuration",
      vehicleType: "Vehicle type",
      importPurpose: "Import purpose",
      ftaQualification: "FTA / special-program qualification",
      commerceApproval: "Commerce approval for the special vehicle treatment",
      nonUsVehicleContentValue: "Non-U.S. vehicle content value",
      column2CountryStatus: "Whether the origin is subject to Column 2 treatment",
      quotaEligibility: "Quota / tariff-rate quota eligibility",
      approvalStatus: "Required agency or program approval status",
      productSpecificCondition: "Product-specific exclusion / condition",
      tscaStatus: "TSCA status",
      rfCapability: "Radiofrequency transmitting capability",
      plantMaterial: "Contains plant or wood material"
    })[k] || k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
  }''' + s[end:]

fallback_old = '    return "";\n  }\n\n  function syncExistingMeltField'
fallback_new = '    return `<div class="rule-fact-note"><strong>${esc(questionLabel(key))}</strong><br><small>Not entered. The quick estimate uses the higher-duty assumption until this fact is confirmed.</small></div>`;\n  }\n\n  function syncExistingMeltField'
if fallback_old not in s:
    raise SystemExit('fieldHtml fallback marker not found')
s = s.replace(fallback_old, fallback_new, 1)

start = s.index('  function addMeasureCard(measure) {')
end = s.index('\n\n  function setMetric(', start)
s = s[:start] + '''  function addMeasureCard(measure) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    const exists = [...review.querySelectorAll(".ch99")].some(el => (el.textContent || "").includes(measure.hts));
    if (exists) return;
    const div = document.createElement("div");
    div.className = "ch99 live-ch99";
    const estimated = measure.estimatedDuty ?? measure.worstCaseEstimatedDuty;
    const assumed = measure.estimatedDuty == null && measure.worstCaseEstimatedDuty != null;
    const duty = estimated == null ? "Dollar amount could not be estimated automatically" : `${assumed ? "Worst-case quick estimate" : "Estimated additional duty"}: <strong>${esc(money(estimated))}</strong>`;
    const facts = Array.isArray(measure.requiredFacts) && measure.requiredFacts.length ? `<br><span class="tiny"><strong>Facts that could change this estimate:</strong> ${esc(measure.requiredFacts.map(questionLabel).join(", "))}</span>` : (measure.applicability !== "applicable" && measure.reason ? `<br><span class="tiny"><strong>Why review is still required:</strong> ${esc(measure.reason)}</span>` : "");
    const assumptions = Array.isArray(measure.assumptions) && measure.assumptions.length ? `<br><span class="assumption-note"><strong>Assumptions:</strong> ${esc(measure.assumptions.join(" "))}</span>` : "";
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.rateText || "See current provision")}</strong>${measure.description ? `<br>${esc(measure.description)}` : ""}<br><span class="tiny">${duty}</span>${facts}${assumptions}<br><span class="tiny">Source: current USITC HTS / Chapter 99</span>`;
    review.appendChild(div);
  }''' + s[end:]

start = s.index('  function recalcTotal(baseData, sec232, sec301) {')
end = s.index('\n\n  function renderLiveRulePanel(', start)
s = s[:start] + '''  function recalcTotal(baseData, sec232, sec301) {
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
  }

  function setEstimateReviewFlag(ruleData) {
    const total = document.getElementById("total");
    const card = total?.closest(".metric");
    if (!card) return;
    let flag = card.querySelector(".estimate-review-flag");
    const needsReview = ["needs-facts", "review-required"].includes(ruleData?.status);
    if (!needsReview) { flag?.remove(); return; }
    if (!flag) {
      flag = document.createElement("small");
      flag.className = "estimate-review-flag";
      card.appendChild(flag);
    }
    flag.textContent = "Review required • worst-case assumptions used";
  }''' + s[end:]

start = s.index('  function renderLiveRulePanel(ruleData) {')
end = s.index('\n\n  async function resolveAndRender(', start)
s = s[:start] + '''  function renderLiveRulePanel(ruleData) {
    const result = document.getElementById("result");
    if (!result) return;
    let panel = document.getElementById("liveTradeRulePanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "liveTradeRulePanel";
      panel.className = "live-rule-panel";
      const disclaimer = result.querySelector(".disclaimer-box");
      if (disclaimer) result.insertBefore(panel, disclaimer); else result.appendChild(panel);
    }
    const measures = Array.isArray(ruleData?.measures) ? ruleData.measures : [];
    const unresolved = Array.isArray(ruleData?.unresolvedMatches) ? ruleData.unresolvedMatches : [];
    const assumptions = Array.isArray(ruleData?.assumptions) ? ruleData.assumptions : [];
    const rev = ruleData?.currentHts?.label ? `${ruleData.currentHts.label}${ruleData.currentHts.date ? ` (${ruleData.currentHts.date})` : ""}` : "current HTS source";
    const sourceWarning = ruleData?.status === "source-unavailable" ? `<div class="rule-warning">Current Chapter 99 legal text could not be read. The calculator will not treat missing trade-remedy hits as a definitive “not applicable” result.</div>` : "";
    const reviewWarning = ["needs-facts", "review-required"].includes(ruleData?.status) ? `<div class="rule-warning"><strong>Review required.</strong> The dollar estimate below uses the higher-duty path where shipment facts are missing or a potential exception/exclusion has not been established.</div>` : "";
    const unresolvedWarning = unresolved.length ? `<div class="rule-warning">The current Chapter 99 text references this HTS in a rule that could not be resolved automatically. Manual review is required before filing.</div>` : "";
    const assumptionWarning = assumptions.length ? `<div class="rule-warning"><strong>Quick-estimate assumptions:</strong><br>${assumptions.map(a => `• ${esc(a)}`).join("<br>")}</div>` : "";
    const lines = measures.length ? measures.map(m => {
      const badge = m.applicability === "applicable" && m.estimatedDuty != null ? `<span class="rule-badge checked">Applied</span>` : `<span class="rule-badge">Review</span>`;
      const facts = m.requiredFacts?.length ? ` Facts that could change the estimate: ${m.requiredFacts.map(questionLabel).join(", ")}.` : (m.reason ? ` Review reason: ${m.reason}` : "");
      const estimate = m.estimatedDuty ?? m.worstCaseEstimatedDuty;
      const estimateText = estimate != null ? ` Quick estimate: ${money(estimate)}${m.estimatedDuty == null ? " using worst-case assumptions." : "."}` : "";
      return `<div class="live-rule-line"><strong>${esc(m.program)} — ${esc(m.hts)}</strong>${badge}<p>${esc(m.description || m.rateText || "Current Chapter 99 provision identified.")}${esc(estimateText)}${esc(facts)}</p></div>`;
    }).join("") : `<div class="live-rule-line"><strong>Chapter 99 / trade remedies</strong><span class="rule-badge checked">Checked</span><p>No Chapter 99 provision was identified by the current live-source scan for the entered HTS and origin. This is not presented as a legal guarantee.</p></div>`;
    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="rule-source-note">Checked against ${esc(rev)} and current Chapter 99 source. Screening build ${BUILD}.</div>${sourceWarning}${reviewWarning}${unresolvedWarning}${assumptionWarning}${lines}<div class="rule-source-note"><strong>Quick-read reminder:</strong> This site provides a quick estimate of duties, not a filing determination. Confirm shipment facts, classification, exclusions and final rates with your customs broker before entry.</div>`;
  }''' + s[end:]

old = '''      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
      const sec301Measures = measures.filter(m => String(m.program).toLowerCase() === "section 301");
      const sumKnown = list => list.length && list.every(m => m.estimatedDuty != null) ? list.reduce((s,m) => s + Number(m.estimatedDuty || 0), 0) : (list.length ? null : 0);
      const sec232 = sumKnown(sec232Measures);
      const sec301 = sumKnown(sec301Measures);
      const status = ruleData.status;
      setMetric("section232Duty", sec232, status);
      setMetric("section301Duty", sec301, status);
      recalcTotal(baseData, sec232, sec301);
      renderLiveRulePanel(ruleData);'''
new = '''      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
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
      setEstimateReviewFlag(ruleData);
      renderLiveRulePanel(ruleData);'''
if old not in s:
    raise SystemExit('program total block not found')
s = s.replace(old, new, 1)

style_marker = '.rule-source-note{font-size:.78rem;color:#667085;margin-top:10px}'
if style_marker in s and '.estimate-review-flag{' not in s:
    s = s.replace(style_marker, style_marker + '\n      .estimate-review-flag{display:block;margin-top:4px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:#ffd27a}\n      .rule-fact-note small{color:#667085}', 1)

js.write_text(s)

fx = Path('js/fx-ticker.js')
f = fx.read_text().replace('hts-import-screening-v2.js?v=20260906-1', 'hts-import-screening-v2.js?v=20260906-2')
fx.write_text(f)
