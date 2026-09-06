(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const BUILD = "2026-09-06-import-screening-v5";
  const digits = value => String(value ?? "").replace(/\D/g, "");
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const AUTO_232_6 = new Set([
    "870322","870323","870324","870331","870332","870333","870340","870350","870360","870370","870380","870390",
    "870421","870431","870441","870451","870460"
  ]);
  const CHINA_301_LIST1_AUTO_6 = new Set([
    "870321","870322","870323","870324","870331","870332","870333","870340","870350","870360","870370","870380","870390"
  ]);
  const WHOLE_VEHICLE_HEADINGS = ["8701","8702","8703","8704","8705"];
  const STEEL_ALUMINUM_PREFIXES = [
    "7206","7207","7208","7209","7210","7211","7212","7213","7214","7215","7216","7217","7218","7219","7220","7221","7222","7223","7224","7225","7226","7227","7228","7229",
    "7301","7302","7304","7305","7306","7307","7308","7309","7310","7311","7312","7313","7314","7315","7316","7317","7318","7319","7320","7325","7326",
    "7601","7604","7605","7606","7607","7608","7609","7610","7616"
  ];
  const FOOD_AGRI_CHAPTERS = new Set(["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"]);
  const CHEM_CHAPTERS = new Set(["28","29","30","31","32","33","34","35","36","37","38","39"]);
  const LACEY_CHAPTERS = new Set(["44","47","48","94"]);
  const FCC_PREFIXES = ["8517","8525","8526","8528"];

  function addStyles() {
    if (document.getElementById("htsExtendedStyles")) return;
    const style = document.createElement("style");
    style.id = "htsExtendedStyles";
    style.textContent = `
      body.hts-modal-open{overflow:hidden!important}
      #htsResultBackdrop{position:fixed;inset:0;background:rgba(10,20,30,.62);z-index:9998;display:none}
      #htsResultBackdrop.open{display:block}
      #result.hts-result-modal{position:fixed!important;z-index:9999!important;top:3vh!important;bottom:3vh!important;left:50%!important;transform:translateX(-50%)!important;width:min(1120px,95vw)!important;max-height:none!important;height:auto!important;overflow-y:scroll!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;margin:0!important;box-shadow:0 18px 60px rgba(0,0,0,.38)!important;border:1px solid #cfd6de!important;background:#fff!important;pointer-events:auto!important}
      .hts-modal-close{position:sticky;top:0;float:right;z-index:5;border:0;background:#1a2a3a;color:#fff;width:40px;height:40px;border-radius:999px;font-size:25px;line-height:1;cursor:pointer;margin:-8px -8px 8px 12px}
      .extended-screening-inputs{display:none;margin-top:18px;padding:16px;border:1px solid #d9e0e7;border-radius:5px;background:#f8fafc}
      .extended-screening-inputs.visible{display:block}
      .extended-screening-inputs h3{margin:0 0 6px;color:#1a2a3a;font-size:1rem}
      .extended-screening-inputs p{margin:0 0 14px;color:#667085;font-size:.84rem}
      .extended-screening-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .screening-panel{margin-top:18px;padding:16px;border:1px solid #d9e0e7;border-radius:5px;background:#fff}
      .screening-panel h3{margin:0 0 5px;color:#1a2a3a}
      .screening-note{font-size:.82rem;color:#667085;margin-bottom:12px}
      .screening-row{padding:10px 12px;border:1px solid #e5e9ee;border-radius:4px;margin:8px 0;background:#fafbfc}
      .screening-row strong{color:#1a2a3a}
      .screening-row .status{display:inline-block;margin-left:8px;font-size:.72rem;font-weight:800;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:#e9f2ff;color:#285b91}
      .screening-row .status.flag{background:#fff3d6;color:#765000}
      .screening-row .status.ok{background:#e8f6ee;color:#22633e}
      .screening-row p{margin:5px 0 0;font-size:.84rem;color:#4d5660}
      .regulatory-freshness{margin-top:12px;font-size:.8rem;color:#667085}
      @media(max-width:760px){.extended-screening-grid{grid-template-columns:1fr}#result.hts-result-modal{top:1.5vh!important;bottom:1.5vh!important;width:97vw!important}}
    `;
    document.head.appendChild(style);
  }

  function currentHts() { return digits(document.getElementById("hts")?.value || ""); }
  function currentCountry() { return String(document.getElementById("country")?.value || "").toUpperCase(); }
  function isWholeVehicle(code) { return WHOLE_VEHICLE_HEADINGS.some(p => code.startsWith(p)); }
  function isMetal232Family(code) { return STEEL_ALUMINUM_PREFIXES.some(p => code.startsWith(p)); }
  function isAuto232(code) { return code.length >= 6 && AUTO_232_6.has(code.slice(0,6)); }
  function isChina301Auto(code, country) { return country === "CN" && code.length >= 6 && CHINA_301_LIST1_AUTO_6.has(code.slice(0,6)); }

  function updateHeading() {
    const h1 = document.querySelector(".page-header h1");
    const sub = document.querySelector(".page-header .subtitle");
    if (h1) h1.textContent = "U.S. Import Requirements & Duty Calculator";
    if (sub) sub.textContent = "HTS duty, Chapter 99, trade-remedy and import-requirement screening";
    document.title = "U.S. Import Requirements & Duty Calculator | The Logistics Mindset";
  }

  function ensureQuestionBox() {
    let box = document.getElementById("extendedScreeningInputs");
    if (box) return box;
    const grid = document.getElementById("calcForm")?.querySelector(".grid");
    if (!grid) return null;
    box = document.createElement("div");
    box.id = "extendedScreeningInputs";
    box.className = "full extended-screening-inputs";
    grid.appendChild(box);
    return box;
  }

  function questionProfile(code) {
    if (code.length < 4) return null;
    const chapter = code.slice(0,2);
    if (isWholeVehicle(code)) return "vehicle";
    if (CHEM_CHAPTERS.has(chapter)) return "chemical";
    if (FOOD_AGRI_CHAPTERS.has(chapter)) return "food";
    if (FCC_PREFIXES.some(p => code.startsWith(p))) return "fcc";
    if (LACEY_CHAPTERS.has(chapter)) return "plant";
    return null;
  }

  function syncConditionalQuestions() {
    const code = currentHts();
    const profile = questionProfile(code);
    const box = ensureQuestionBox();
    if (!box) return;

    const melt = document.getElementById("meltPourCountry")?.closest("div");
    if (melt) melt.style.display = isMetal232Family(code) ? "" : "none";

    const key = `${profile || "none"}|${code.slice(0,6)}`;
    if (box.dataset.profileKey === key) return;
    box.dataset.profileKey = key;

    if (!profile) {
      box.classList.remove("visible");
      box.innerHTML = "";
      return;
    }

    const commonStart = `<h3>Additional information for HTS ${esc(document.getElementById("hts")?.value || code)}</h3>`;
    if (profile === "vehicle") {
      box.innerHTML = `${commonStart}<p>These questions are shown because this HTS is a whole-vehicle classification. Vehicle age, configuration and import purpose can change EPA, NHTSA/DOT and Chapter 99 treatment.</p><div class="extended-screening-grid">
        <div><label for="vehicleManufactureYear">Vehicle manufacture year</label><input id="vehicleManufactureYear" type="number" min="1900" max="2100" placeholder="e.g. 2021"></div>
        <div><label for="vehicleEngineStatus">Engine configuration</label><select id="vehicleEngineStatus"><option value="unknown">Not specified</option><option value="original">Original / equivalent configuration</option><option value="modified">Modified / replaced</option></select></div>
        <div><label for="importPurpose">Import purpose</label><select id="importPurpose"><option value="standard">Standard import / consumption</option><option value="temporary">Temporary import</option><option value="repair">Repair / alteration</option><option value="testing">Testing / research / prototype</option><option value="show">Show / display / exhibition</option><option value="racing">Racing / competition</option></select></div>
      </div>`;
    } else if (profile === "chemical") {
      box.innerHTML = `${commonStart}<p>This HTS can involve EPA/TSCA requirements. The answer helps guide the import-requirement screening.</p><div class="extended-screening-grid"><div><label for="tscaStatus">TSCA status</label><select id="tscaStatus"><option value="unknown">Not sure</option><option value="positive">Positive certification expected</option><option value="negative">Negative certification expected</option><option value="exempt">Claimed exemption / not subject</option></select></div></div>`;
    } else if (profile === "food") {
      box.innerHTML = `${commonStart}<p>This HTS can involve FDA and/or USDA/APHIS requirements. Select the intended use so the guidance is more relevant.</p><div class="extended-screening-grid"><div><label for="foodUse">Intended use</label><select id="foodUse"><option value="unknown">Not sure</option><option value="human">Human food / beverage</option><option value="animal">Animal food / feed</option><option value="plant">Plant / seed / agricultural use</option><option value="other">Other</option></select></div></div>`;
    } else if (profile === "fcc") {
      box.innerHTML = `${commonStart}<p>This HTS can include radiofrequency or communications equipment. FCC requirements can depend on transmitting capability.</p><div class="extended-screening-grid"><div><label for="rfCapability">Radiofrequency transmitting capability</label><select id="rfCapability"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div></div>`;
    } else if (profile === "plant") {
      box.innerHTML = `${commonStart}<p>This HTS can involve Lacey Act or USDA/APHIS review when plant or wood material is present.</p><div class="extended-screening-grid"><div><label for="plantMaterial">Contains plant or wood material</label><select id="plantMaterial"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div></div>`;
    }
    box.classList.add("visible");
  }

  function facts() {
    return {
      year: Number(document.getElementById("vehicleManufactureYear")?.value || 0) || null,
      engine: document.getElementById("vehicleEngineStatus")?.value || "unknown",
      purpose: document.getElementById("importPurpose")?.value || "standard",
      tsca: document.getElementById("tscaStatus")?.value || "unknown",
      foodUse: document.getElementById("foodUse")?.value || "unknown",
      rf: document.getElementById("rfCapability")?.value || "unknown",
      plant: document.getElementById("plantMaterial")?.value || "unknown"
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
    if (!result || result.classList.contains("hidden") || result.classList.contains("hts-result-modal")) return;
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

  function parseDisplayedMoney(id) {
    const raw = document.getElementById(id)?.textContent || "";
    const n = Number(raw.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function addMeasureToData(data, measure) {
    if (!data.review) data.review = {};
    if (!Array.isArray(data.review.applicableAdditionalMeasures)) data.review.applicableAdditionalMeasures = [];
    const exists = data.review.applicableAdditionalMeasures.some(m => String(m?.program) === measure.program && String(m?.hts) === measure.hts);
    if (!exists) data.review.applicableAdditionalMeasures.push(measure);
    return !exists;
  }

  function addMeasureCard(measure) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    const exists = [...review.querySelectorAll(".ch99")].some(el => (el.textContent || "").includes(measure.hts));
    if (exists) return;
    const div = document.createElement("div");
    div.className = "ch99";
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.applicableRate)}</strong><br>${esc(measure.description)}<br><span class="tiny">Estimated additional duty: <strong>${money(measure.amount)}</strong></span><br><span class="tiny">Rule source: ${esc(measure.ruleSource)}</span>`;
    review.appendChild(div);
  }

  function applyAutomobileTradeRemedies(data) {
    const code = digits(data?.query?.hts || currentHts());
    const country = String(data?.query?.country || currentCountry()).toUpperCase();
    const value = Number(data?.query?.customsValue || document.getElementById("value")?.value || 0);
    const f = facts();
    let addedTotal = 0;

    if (isChina301Auto(code, country)) {
      const measure = {
        program: "Section 301",
        hts: "9903.88.01",
        applicableRate: "+25%",
        ratePercent: 25,
        amount: value * 0.25,
        description: `China-origin merchandise under the entered 8703 passenger-vehicle subheading is covered by the original Section 301 List 1 action, subject to current exclusions and entry-date rules.`,
        ruleSource: "U.S. note 20(b), subchapter III, chapter 99; USTR List 1"
      };
      if (addMeasureToData(data, measure)) {
        const existing = parseDisplayedMoney("section301Duty");
        document.getElementById("section301Duty").textContent = money(existing + measure.amount);
        addedTotal += measure.amount;
      }
      addMeasureCard(measure);
    }

    if (isAuto232(code)) {
      const currentYear = new Date().getFullYear();
      const age = f.year ? currentYear - f.year : null;
      const exempt25 = age != null && age >= 25;
      const measure = exempt25 ? {
        program: "Section 232",
        hts: "9903.94.04",
        applicableRate: "0% additional",
        ratePercent: 0,
        amount: 0,
        description: "The entered manufacture year indicates the vehicle may qualify for the 25-year automobile exception. Confirm the actual manufacture date and eligibility at entry.",
        ruleSource: "U.S. note 33, subchapter III, chapter 99"
      } : {
        program: "Section 232",
        hts: "9903.94.01",
        applicableRate: "+25%",
        ratePercent: 25,
        amount: value * 0.25,
        description: "The entered HTS falls within the automobile classifications covered by the Section 232 automobile tariff. Country-specific exceptions or approved content treatment must be reviewed separately.",
        ruleSource: "Presidential Proclamation 10908; U.S. note 33, subchapter III, chapter 99"
      };
      if (addMeasureToData(data, measure)) {
        const existing = parseDisplayedMoney("section232Duty");
        document.getElementById("section232Duty").textContent = money(existing + measure.amount);
        addedTotal += measure.amount;
      }
      addMeasureCard(measure);
    }

    if (addedTotal) {
      const currentTotal = parseDisplayedMoney("total");
      document.getElementById("total").textContent = money(currentTotal + addedTotal);
    }
  }

  function screeningRows(data) {
    const code = digits(data?.query?.hts || currentHts());
    const country = String(data?.query?.country || currentCountry()).toUpperCase();
    const chapter = code.slice(0,2);
    const f = facts();
    const backend = Array.isArray(data?.review?.applicableAdditionalMeasures) ? data.review.applicableAdditionalMeasures : [];
    const rows = [];

    const has301 = backend.some(x => /301/i.test(String(x?.program || "")));
    const has232 = backend.some(x => /232/i.test(String(x?.program || "")));
    rows.push({name:"Chapter 99 / additional duties",status:backend.length ? "flag" : "ok",text:backend.length ? `${backend.length} Chapter 99 / trade-measure provision(s) were identified. Review each line shown above before filing.` : "No Chapter 99 trade measure was identified by the current rules for the entered facts. This is a screening result, not a legal conclusion."});
    rows.push({name:"Section 301",status:has301 ? "flag" : "ok",text:has301 ? "A Section 301 measure was identified and is shown in the duty section above." : "No Section 301 measure was identified for this HTS/country combination by the current rule set."});
    rows.push({name:"Section 232",status:has232 ? "flag" : "ok",text:has232 ? "A Section 232 measure was identified and is shown in the duty section above." : "No Section 232 measure was identified for this HTS/country combination by the current rule set."});

    if (isWholeVehicle(code)) {
      const age = f.year ? new Date().getFullYear() - f.year : null;
      rows.push({name:"EPA vehicle requirements",status:"flag",text:`Motor vehicles require EPA emissions screening. ${age != null ? `Entered manufacture year indicates approximately ${age} years of age. ` : "Manufacture year was not entered. "}${f.engine === "modified" ? "A modified or replaced engine can change eligibility and documentation requirements." : "Confirm emissions conformity or the applicable exemption/import provision."}`});
      rows.push({name:"NHTSA / DOT vehicle requirements",status:"flag",text:`Motor vehicles require NHTSA/DOT safety screening. ${age != null && age >= 25 ? "The entered year may qualify for the 25-year NHTSA age exception, subject to the actual manufacture date." : "Confirm FMVSS conformity, Registered Importer requirements, or an applicable exception."}`});
    }
    if (FOOD_AGRI_CHAPTERS.has(chapter)) rows.push({name:"FDA / USDA screening",status:"flag",text:`This HTS can involve FDA and/or USDA/APHIS requirements. Intended-use answer: ${f.foodUse}. Confirm the specific admissibility, registration, prior-notice, permit, inspection and labeling rules that apply.`});
    if (CHEM_CHAPTERS.has(chapter)) rows.push({name:"EPA / TSCA screening",status:"flag",text:`This HTS can involve TSCA or other EPA requirements. TSCA answer: ${f.tsca}. Confirm substance identity and the appropriate certification/exemption before entry.`});
    if (FCC_PREFIXES.some(p => code.startsWith(p))) rows.push({name:"FCC screening",status:"flag",text:`This HTS can include radiofrequency equipment. RF capability answer: ${f.rf}. Confirm equipment authorization/import conditions when applicable.`});
    if (LACEY_CHAPTERS.has(chapter)) rows.push({name:"Lacey Act / plant-product screening",status:"flag",text:`This HTS can involve plant/wood material. Plant-material answer: ${f.plant}. Confirm declaration and USDA/APHIS requirements when applicable.`});
    rows.push({name:"AD/CVD, quota and other requirements",status:"flag",text:"Producer/exporter, product scope, country, value, quantity and other shipment facts can trigger AD/CVD, quota/TRQ or agency requirements that an HTS code alone cannot conclusively resolve."});
    return rows;
  }

  function addScreeningPanel(data) {
    const result = document.getElementById("result");
    if (!result) return;
    let panel = document.getElementById("extendedScreeningPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "extendedScreeningPanel";
      panel.className = "screening-panel";
      const disclaimer = result.querySelector(".disclaimer-box");
      if (disclaimer) result.insertBefore(panel, disclaimer); else result.appendChild(panel);
    }
    const rows = screeningRows(data);
    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="screening-note">Duty and tax calculations are shown above. These are the additional requirements identified for this HTS, country and the shipment facts supplied.</div>${rows.map(r => `<div class="screening-row"><strong>${esc(r.name)}</strong><span class="status ${r.status}">${r.status === "flag" ? "Review" : "Checked"}</span><p>${esc(r.text)}</p></div>`).join("")}<div class="regulatory-freshness">Screening build: ${BUILD}. Regulatory sources are checked before the weekly production release.</div>`;
  }

  function processResult() {
    const result = document.getElementById("result");
    const data = window.__lastResult;
    if (!result || result.classList.contains("hidden") || !data) return;
    applyAutomobileTradeRemedies(data);
    addScreeningPanel(data);
    openModal();
  }

  function watchResults() {
    const result = document.getElementById("result");
    if (!result) return;
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (result.classList.contains("hidden") || result.classList.contains("hts-result-modal") || scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; processResult(); }, 0);
    });
    observer.observe(result, { attributes:true, attributeFilter:["class"] });
  }

  function init() {
    addStyles();
    updateHeading();
    ensureQuestionBox();
    ensureModal();
    syncConditionalQuestions();
    const hts = document.getElementById("hts");
    const country = document.getElementById("country");
    let timer = null;
    const queueSync = () => { clearTimeout(timer); timer = setTimeout(syncConditionalQuestions, 80); };
    hts?.addEventListener("input", queueSync);
    hts?.addEventListener("change", queueSync);
    country?.addEventListener("change", queueSync);
    watchResults();
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();