(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const BUILD = "2026-09-06-live-ch99-v1";
  const digits = value => String(value ?? "").replace(/\D/g, "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => value == null ? "Review required" : new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(Number(value || 0));

  let ruleLookupTimer = null;
  let ruleLookupSeq = 0;
  let lastRulePreview = null;

  function addStyles() {
    if (document.getElementById("htsLiveRuleStyles")) return;
    const style = document.createElement("style");
    style.id = "htsLiveRuleStyles";
    style.textContent = `
      body.hts-modal-open{overflow:hidden!important}
      #htsResultBackdrop{position:fixed;inset:0;background:rgba(10,20,30,.62);z-index:9998;display:none}
      #htsResultBackdrop.open{display:block}
      #result.hts-result-modal{position:fixed!important;z-index:9999!important;top:3vh!important;bottom:3vh!important;left:50%!important;transform:translateX(-50%)!important;width:min(1120px,95vw)!important;max-height:none!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;margin:0!important;background:#fff!important;box-shadow:0 18px 60px rgba(0,0,0,.38)!important;pointer-events:auto!important}
      .hts-modal-close{position:sticky;top:0;float:right;z-index:10;border:0;background:#1a2a3a;color:#fff;width:40px;height:40px;border-radius:999px;font-size:25px;line-height:1;cursor:pointer;margin:-8px -8px 8px 12px}
      .dynamic-questions{display:none;margin-top:18px;padding:16px;border:1px solid #d9e0e7;border-radius:5px;background:#f8fafc}
      .dynamic-questions.visible{display:block}
      .dynamic-questions h3{margin:0 0 6px;color:#1a2a3a;font-size:1rem}
      .dynamic-questions p{margin:0 0 12px;color:#667085;font-size:.84rem}
      .dynamic-question-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .live-rule-panel{margin-top:18px;padding:16px;border:1px solid #d9e0e7;border-radius:5px;background:#fff}
      .live-rule-panel h3{margin:0 0 6px;color:#1a2a3a}
      .live-rule-line{padding:10px 12px;border:1px solid #e5e9ee;border-radius:4px;margin:8px 0;background:#fafbfc}
      .live-rule-line strong{color:#1a2a3a}
      .live-rule-line p{margin:5px 0 0;font-size:.84rem;color:#4d5660}
      .rule-badge{display:inline-block;margin-left:8px;font-size:.72rem;font-weight:800;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:#fff3d6;color:#765000}
      .rule-badge.checked{background:#e8f6ee;color:#22633e}
      .rule-warning{padding:10px 12px;margin:10px 0;border-radius:4px;background:#fff3d6;color:#614800;font-size:.86rem}
      .rule-source-note{font-size:.78rem;color:#667085;margin-top:10px}
      @media(max-width:760px){.dynamic-question-grid{grid-template-columns:1fr}#result.hts-result-modal{top:1.5vh!important;bottom:1.5vh!important;width:97vw!important}}
    `;
    document.head.appendChild(style);
  }

  function updateHeading() {
    const h1 = document.querySelector(".page-header h1");
    const sub = document.querySelector(".page-header .subtitle");
    if (h1) h1.textContent = "U.S. Import Requirements & Duty Calculator";
    if (sub) sub.textContent = "Live HTS duty, Chapter 99, trade-remedy and import-requirement screening";
    document.title = "U.S. Import Requirements & Duty Calculator | The Logistics Mindset";
  }

  function ensureQuestionBox() {
    let box = document.getElementById("dynamicRuleQuestions");
    if (box) return box;
    const grid = document.getElementById("calcForm")?.querySelector(".grid");
    if (!grid) return null;
    box = document.createElement("div");
    box.id = "dynamicRuleQuestions";
    box.className = "full dynamic-questions";
    grid.appendChild(box);
    return box;
  }

  function highConfidencePgaFacts(hts) {
    const code = digits(hts);
    const facts = [];
    if (/^870[1-5]/.test(code)) facts.push("vehicleManufactureYear", "vehicleEngineStatus", "importPurpose");
    if (/^(28|29|30|31|32|33|34|35|36|37|38)/.test(code)) facts.push("tscaStatus");
    if (/^(8517|8525|8526)/.test(code)) facts.push("rfCapability");
    if (/^(44|4401|4403|4407|4408|4409|4412|4418)/.test(code)) facts.push("plantMaterial");
    return facts;
  }

  function questionLabel(key) {
    return ({
      meltPourCountry: "Steel first melt / pour country",
      metalContentValue: "Value of covered metal content (USD)",
      vehicleManufactureYear: "Vehicle manufacture year",
      vehicleEngineStatus: "Vehicle engine configuration",
      importPurpose: "Import purpose",
      ftaQualification: "FTA / special-program qualification",
      tscaStatus: "TSCA status",
      rfCapability: "Radiofrequency transmitting capability",
      plantMaterial: "Contains plant or wood material"
    })[key] || key;
  }

  function fieldHtml(key) {
    if (key === "meltPourCountry") return ""; // existing field is revealed instead of duplicated
    if (key === "metalContentValue") return `<div><label for="metalContentValue">${questionLabel(key)}</label><input id="metalContentValue" type="number" min="0" step="0.01" placeholder="Only the covered metal content"></div>`;
    if (key === "vehicleManufactureYear") return `<div><label for="vehicleManufactureYear">${questionLabel(key)}</label><input id="vehicleManufactureYear" type="number" min="1900" max="2100" placeholder="e.g. 2021"></div>`;
    if (key === "vehicleEngineStatus") return `<div><label for="vehicleEngineStatus">${questionLabel(key)}</label><select id="vehicleEngineStatus"><option value="unknown">Not specified</option><option value="original">Original / equivalent configuration</option><option value="modified">Modified / replaced</option></select></div>`;
    if (key === "importPurpose") return `<div><label for="importPurpose">${questionLabel(key)}</label><select id="importPurpose"><option value="standard">Standard import / consumption</option><option value="temporary">Temporary import</option><option value="repair">Repair / alteration</option><option value="testing">Testing / research / prototype</option><option value="show">Show / display / exhibition</option><option value="racing">Racing / competition</option></select></div>`;
    if (key === "ftaQualification") return `<div><label for="dynamicFta">${questionLabel(key)}</label><select id="dynamicFta"><option value="unknown">Not sure</option><option value="yes">Qualifies</option><option value="no">Does not qualify</option></select></div>`;
    if (key === "tscaStatus") return `<div><label for="tscaStatus">${questionLabel(key)}</label><select id="tscaStatus"><option value="unknown">Not sure</option><option value="positive">Positive certification expected</option><option value="negative">Negative certification expected</option><option value="exempt">Claimed exemption / not subject</option></select></div>`;
    if (key === "rfCapability") return `<div><label for="rfCapability">${questionLabel(key)}</label><select id="rfCapability"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    if (key === "plantMaterial") return `<div><label for="plantMaterial">${questionLabel(key)}</label><select id="plantMaterial"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    return "";
  }

  function syncExistingMeltField(requiredFacts) {
    const meltWrap = document.getElementById("meltPourCountry")?.closest("div");
    if (meltWrap) meltWrap.style.display = requiredFacts.includes("meltPourCountry") ? "" : "none";
  }

  function renderQuestions(ruleData) {
    const box = ensureQuestionBox();
    if (!box) return;
    const hts = document.getElementById("hts")?.value || "";
    const code = digits(hts);
    const ruleFacts = Array.isArray(ruleData?.requiredFacts) ? ruleData.requiredFacts : [];
    const pgaFacts = highConfidencePgaFacts(code);
    const facts = [...new Set([...ruleFacts, ...pgaFacts])];
    syncExistingMeltField(facts);
    const renderFacts = facts.filter(x => x !== "meltPourCountry");
    if (!renderFacts.length) {
      box.classList.remove("visible");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<h3>Additional information needed for this HTS</h3><p>These questions are shown only because the entered HTS triggered a rule or agency requirement where the answer can change the result.</p><div class="dynamic-question-grid">${renderFacts.map(fieldHtml).join("")}</div>`;
    box.classList.add("visible");
  }

  async function fetchRulePreview() {
    const hts = digits(document.getElementById("hts")?.value || "");
    const country = document.getElementById("country")?.value || "";
    if (hts.length < 8 || !country) {
      lastRulePreview = null;
      renderQuestions(null);
      return;
    }
    const seq = ++ruleLookupSeq;
    try {
      const res = await fetch(`/api/trade-rules?hts=${encodeURIComponent(hts)}&country=${encodeURIComponent(country)}`);
      const data = await res.json();
      if (seq !== ruleLookupSeq) return;
      if (!res.ok) throw new Error(data.error || "Trade-rule lookup failed");
      lastRulePreview = data;
      renderQuestions(data);
    } catch {
      if (seq !== ruleLookupSeq) return;
      lastRulePreview = null;
      renderQuestions(null);
    }
  }

  function queueRulePreview() {
    clearTimeout(ruleLookupTimer);
    ruleLookupTimer = setTimeout(fetchRulePreview, 450);
  }

  function factsPayload() {
    const value = id => document.getElementById(id)?.value ?? null;
    return {
      meltPourCountry: value("meltPourCountry"),
      metalContentValue: value("metalContentValue"),
      vehicleManufactureYear: value("vehicleManufactureYear"),
      vehicleEngineStatus: value("vehicleEngineStatus"),
      importPurpose: value("importPurpose"),
      ftaQualification: value("dynamicFta"),
      tscaStatus: value("tscaStatus"),
      rfCapability: value("rfCapability"),
      plantMaterial: value("plantMaterial")
    };
  }

  function ensureModal() {
    if (!document.getElementById("htsResultBackdrop")) {
      const backdrop = document.createElement("div");
      backdrop.id = "htsResultBackdrop";
      backdrop.addEventListener("click", closeModal);
      document.body.appendChild(backdrop);
    }
    const result = document.getElementById("result");
    if (result && !document.getElementById("htsModalClose")) {
      const close = document.createElement("button");
      close.type = "button";
      close.id = "htsModalClose";
      close.className = "hts-modal-close";
      close.setAttribute("aria-label", "Close results");
      close.textContent = "×";
      close.addEventListener("click", closeModal);
      result.prepend(close);
    }
  }

  function openModal() {
    const result = document.getElementById("result");
    if (!result || result.classList.contains("hidden")) return;
    ensureModal();
    result.classList.add("hts-result-modal");
    document.getElementById("htsResultBackdrop")?.classList.add("open");
    document.body.classList.add("hts-modal-open");
    requestAnimationFrame(() => { result.scrollTop = 0; });
  }

  function closeModal() {
    const result = document.getElementById("result");
    result?.classList.remove("hts-result-modal");
    result?.classList.add("hidden");
    document.getElementById("htsResultBackdrop")?.classList.remove("open");
    document.body.classList.remove("hts-modal-open");
  }

  function removeLegacyProgramCards(program) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    review.querySelectorAll(".ch99").forEach(el => {
      if ((el.textContent || "").toLowerCase().includes(program.toLowerCase())) el.remove();
    });
  }

  function addMeasureCard(measure) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    const exists = [...review.querySelectorAll(".ch99")].some(el => (el.textContent || "").includes(measure.hts));
    if (exists) return;
    const div = document.createElement("div");
    div.className = "ch99 live-ch99";
    const duty = measure.estimatedDuty == null ? "Amount requires additional facts" : `Estimated additional duty: <strong>${esc(money(measure.estimatedDuty))}</strong>`;
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.rateText || "See current provision")}</strong>${measure.description ? `<br>${esc(measure.description)}` : ""}<br><span class="tiny">${duty}</span><br><span class="tiny">Source: current USITC HTS / Chapter 99</span>`;
    review.appendChild(div);
  }

  function setMetric(id, value, status) {
    const el = document.getElementById(id);
    if (!el) return;
    if (status === "source-unavailable") el.textContent = "Source unavailable";
    else if (status === "review-required" && value == null) el.textContent = "Review required";
    else el.textContent = money(value || 0);
  }

  function recalcTotal(baseData, sec232, sec301) {
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

  function renderLiveRulePanel(ruleData) {
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
    const rev = ruleData?.currentHts?.label ? `${ruleData.currentHts.label}${ruleData.currentHts.date ? ` (${ruleData.currentHts.date})` : ""}` : "current HTS source";
    const sourceWarning = !ruleData?.chapter99SourceAvailable ? `<div class="rule-warning">Current Chapter 99 legal text could not be read. The calculator will not treat missing trade-remedy hits as a definitive “not applicable” result.</div>` : "";
    const unresolvedWarning = unresolved.length ? `<div class="rule-warning">The current Chapter 99 text references this HTS in a rule that could not be resolved automatically. Manual review is required before filing.</div>` : "";
    const lines = measures.length ? measures.map(m => `<div class="live-rule-line"><strong>${esc(m.program)} — ${esc(m.hts)}</strong><span class="rule-badge">Review</span><p>${esc(m.description || m.rateText || "Current Chapter 99 provision identified.")}${m.requiredFacts?.length ? ` Missing/conditional facts: ${esc(m.requiredFacts.map(questionLabel).join(", "))}.` : ""}</p></div>`).join("") : `<div class="live-rule-line"><strong>Chapter 99 / trade remedies</strong><span class="rule-badge checked">Checked</span><p>No Chapter 99 provision was identified by the current live-source scan for the entered HTS and origin. This is not presented as a legal guarantee.</p></div>`;
    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="rule-source-note">Checked against ${esc(rev)} and current Chapter 99 source. Screening build ${BUILD}.</div>${sourceWarning}${unresolvedWarning}${lines}`;
  }

  async function resolveAndRender(baseData) {
    const payload = {
      hts: baseData?.query?.hts || document.getElementById("hts")?.value,
      country: baseData?.query?.country || document.getElementById("country")?.value,
      customsValue: baseData?.query?.customsValue || document.getElementById("value")?.value,
      ...factsPayload()
    };
    try {
      const res = await fetch("/api/trade-rules", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const ruleData = await res.json();
      if (!res.ok) throw new Error(ruleData.error || "Trade-rule lookup failed");
      lastRulePreview = ruleData;
      renderQuestions(ruleData);

      removeLegacyProgramCards("Section 232");
      removeLegacyProgramCards("Section 301");
      const measures = Array.isArray(ruleData.measures) ? ruleData.measures : [];
      measures.forEach(addMeasureCard);

      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
      const sec301Measures = measures.filter(m => String(m.program).toLowerCase() === "section 301");
      const sumKnown = list => list.length && list.every(m => m.estimatedDuty != null) ? list.reduce((s,m) => s + Number(m.estimatedDuty || 0), 0) : (list.length ? null : 0);
      const sec232 = sumKnown(sec232Measures);
      const sec301 = sumKnown(sec301Measures);
      const status = ruleData.status;
      setMetric("section232Duty", sec232, status);
      setMetric("section301Duty", sec301, status);
      recalcTotal(baseData, sec232, sec301);
      renderLiveRulePanel(ruleData);
    } catch (error) {
      setMetric("section232Duty", null, "source-unavailable");
      setMetric("section301Duty", null, "source-unavailable");
      const total = document.getElementById("total");
      if (total) total.textContent = "Review required";
      renderLiveRulePanel({status:"source-unavailable",chapter99SourceAvailable:false,measures:[],unresolvedMatches:[],currentHts:lastRulePreview?.currentHts});
    }
    openModal();
  }

  function watchResults() {
    const result = document.getElementById("result");
    if (!result) return;
    let busy = false;
    const observer = new MutationObserver(() => {
      if (busy || result.classList.contains("hidden") || result.classList.contains("hts-result-modal")) return;
      const data = window.__lastResult;
      if (!data) return;
      busy = true;
      resolveAndRender(data).finally(() => { busy = false; });
    });
    observer.observe(result, {attributes:true,attributeFilter:["class"]});
  }

  function init() {
    addStyles();
    updateHeading();
    ensureQuestionBox();
    ensureModal();
    const hts = document.getElementById("hts");
    const country = document.getElementById("country");
    hts?.addEventListener("input", queueRulePreview);
    hts?.addEventListener("change", queueRulePreview);
    country?.addEventListener("change", queueRulePreview);
    watchResults();
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    queueRulePreview();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
})();
