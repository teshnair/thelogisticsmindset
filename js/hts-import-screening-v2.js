(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const BUILD = "2026-09-07-pga-screening-v6";
  const digits = value => String(value ?? "").replace(/\D/g, "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => value == null ? "Review required" : new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(Number(value || 0));

  let ruleLookupTimer = null;
  let ruleLookupSeq = 0;
  let lastRulePreview = null;

  // Facts collected in the main questionnaire must never be rendered again as
  // "additional" questions. The dynamic section is reserved for genuinely new,
  // HTS-specific shipment facts.
  const MAIN_FORM_FACTS = new Set([
    "hts", "country", "customsValue", "mode", "quantity", "quantityUnit",
    "importPurpose", "ftaQualification", "meltPourCountry"
  ]);

  const FOOD_AGRI_CHAPTERS = new Set(["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"]);
  const PLANT_AGRI_CHAPTERS = new Set(["06","07","08","09","10","11","12","13","14"]);
  const ANIMAL_AGRI_CHAPTERS = new Set(["01","02","03","04","05","16"]);
  const CHEM_CHAPTERS = new Set(["28","29","30","31","32","33","34","35","36","37","38","39"]);
  const LACEY_CHAPTERS = new Set(["44","47","48","94"]);
  const FCC_PREFIXES = ["8517","8525","8526","8528"];
  const MEDICAL_DEVICE_PREFIXES = ["9018","9019","9020","9021","9022"];
  const ENGINE_PREFIXES = ["8407","8408"];
  const VEHICLE_PREFIXES = ["8701","8702","8703","8704","8705"];
  const VEHICLE_EQUIPMENT_PREFIXES = ["8706","8707","8708"];

  const PGA_SOURCE_LABELS = {
    CBP:"CBP", FDA:"FDA", USDA:"USDA / APHIS", FSIS:"USDA / FSIS", EPA:"EPA", DOT:"NHTSA / DOT", FCC:"FCC", LACEY:"Lacey Act / APHIS", TTB:"TTB", ATF:"ATF"
  };

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
      .estimate-review-flag{display:block;margin-top:4px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:#ffd27a}
      .rule-fact-note small{color:#667085}
      .clearance-panel{margin-top:18px;padding:16px;border:1px solid #cfd8e3;border-radius:5px;background:#f7faff}
      .clearance-panel h3{margin:0 0 8px;color:#1a2a3a}
      .clearance-option{padding:10px 12px;margin-top:8px;border-left:4px solid #2c7be5;background:#fff;font-size:.86rem}
      .clearance-option strong{color:#1a2a3a}
      .clearance-caution{margin-top:10px;padding:10px 12px;background:#fff3d6;color:#614800;border-radius:4px;font-size:.84rem}
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
    const chapter = code.slice(0,2);
    const facts = [];
    if (VEHICLE_PREFIXES.some(p => code.startsWith(p))) facts.push("vehicleManufactureYear", "vehicleEngineStatus");
    if (CHEM_CHAPTERS.has(chapter)) facts.push("tscaStatus");
    if (FOOD_AGRI_CHAPTERS.has(chapter)) facts.push("foodUse");
    if (FCC_PREFIXES.some(p => code.startsWith(p))) facts.push("rfCapability");
    if (LACEY_CHAPTERS.has(chapter)) facts.push("plantMaterial");
    return facts;
  }

  function questionLabel(key) {
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
      plantMaterial: "Contains plant or wood material",
      foodUse: "Intended use / product type"
    })[k] || k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
  }

  function fieldHtml(key) {
    if (key === "meltPourCountry") return ""; // existing field is revealed instead of duplicated
    if (key === "metalContentValue") return `<div><label for="metalContentValue">${questionLabel(key)}</label><input id="metalContentValue" type="number" min="0" step="0.01" placeholder="Only the covered metal content"></div>`;
    if (key === "usMetalContentQualification") return `<div><label for="usMetalContentQualification">${questionLabel(key)}</label><select id="usMetalContentQualification"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    if (key === "vehicleManufactureYear") return `<div><label for="vehicleManufactureYear">${questionLabel(key)}</label><input id="vehicleManufactureYear" type="number" min="1900" max="2100" placeholder="e.g. 2021"></div>`;
    if (key === "vehicleEngineStatus") return `<div><label for="vehicleEngineStatus">${questionLabel(key)}</label><select id="vehicleEngineStatus"><option value="unknown">Not specified</option><option value="original">Original / equivalent configuration</option><option value="modified">Modified / replaced</option></select></div>`;
    if (key === "importPurpose") return ""; // main questionnaire field
    if (key === "ftaQualification") return `<div><label for="dynamicFta">${questionLabel(key)}</label><select id="dynamicFta"><option value="unknown">Not sure</option><option value="yes">Qualifies</option><option value="no">Does not qualify</option></select></div>`;
    if (key === "tscaStatus") return `<div><label for="tscaStatus">${questionLabel(key)}</label><select id="tscaStatus"><option value="unknown">Not sure</option><option value="positive">Positive certification expected</option><option value="negative">Negative certification expected</option><option value="exempt">Claimed exemption / not subject</option></select></div>`;
    if (key === "rfCapability") return `<div><label for="rfCapability">${questionLabel(key)}</label><select id="rfCapability"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    if (key === "plantMaterial") return `<div><label for="plantMaterial">${questionLabel(key)}</label><select id="plantMaterial"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    if (key === "foodUse") return `<div><label for="foodUse">${questionLabel(key)}</label><select id="foodUse"><option value="unknown">Not sure</option><option value="human">Human food / beverage</option><option value="animal">Animal food / feed</option><option value="plant">Plant / seed / agricultural use</option><option value="drug">Drug / pharmaceutical</option><option value="cosmetic">Cosmetic / personal care</option><option value="other">Other</option></select></div>`;
    const factId = `ruleFact_${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const numericFacts = new Set(["subjectMetalWeightPercent", "nonUsVehicleContentValue", "nonUsContentValue", "usContentValue"]);
    if (numericFacts.has(key)) return `<div><label for="${factId}">${esc(questionLabel(key))}</label><input id="${factId}" data-rule-fact="${esc(key)}" type="number" min="0" step="any" placeholder="Enter value if known"></div>`;
    const booleanFact = key.startsWith("productCondition:") || new Set(["containsAluminumSteelCopper","ukMetalContentQualification","column2CountryStatus","quotaEligibility","approvalStatus","commerceApproval","productSpecificCondition"]).has(key);
    if (booleanFact) return `<div><label for="${factId}">${esc(questionLabel(key))}</label><select id="${factId}" data-rule-fact="${esc(key)}"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
    return `<div><label for="${factId}">${esc(questionLabel(key))}</label><input id="${factId}" data-rule-fact="${esc(key)}" placeholder="Enter if known"><small>Leave blank to use the higher-duty quick-estimate assumption.</small></div>`;
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
    const renderFacts = facts.filter(x => !MAIN_FORM_FACTS.has(x));
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
      const previewPayload = {
        hts,
        country,
        customsValue: document.getElementById("value")?.value || null,
        mode: document.getElementById("mode")?.value || null,
        quantity: document.getElementById("qty")?.value || null,
        quantityUnit: document.getElementById("qtyUnit")?.value || null,
        ...factsPayload()
      };
      const res = await fetch("/api/trade-rules", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(previewPayload)
      });
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
    const payload = {
      meltPourCountry: value("meltPourCountry"),
      metalContentValue: value("metalContentValue"),
      usMetalContentQualification: value("usMetalContentQualification"),
      vehicleManufactureYear: value("vehicleManufactureYear"),
      vehicleEngineStatus: value("vehicleEngineStatus"),
      importPurpose: value("importPurpose"),
      // The main FTA checkbox is the single source of truth. Unchecked means
      // not established, not an affirmative "no".
      ftaQualification: document.getElementById("fta")?.checked ? "yes" : "unknown",
      tscaStatus: value("tscaStatus"),
      rfCapability: value("rfCapability"),
      plantMaterial: value("plantMaterial"),
      foodUse: value("foodUse")
    };
    document.querySelectorAll('[data-rule-fact]').forEach(el => {
      const key = el.getAttribute('data-rule-fact');
      if (key) payload[key] = el.value || null;
    });
    return payload;
  }

  function normalizePublishedUnit(value) {
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

  function pgaScreeningRows(baseData) {
    const code = digits(baseData?.query?.hts || document.getElementById("hts")?.value || "");
    const chapter = code.slice(0,2);
    const rows = [];
    const value = id => document.getElementById(id)?.value || "unknown";
    const year = Number(value("vehicleManufactureYear")) || null;
    const engine = value("vehicleEngineStatus");
    const purpose = value("importPurpose");
    const foodUse = value("foodUse");
    const tsca = value("tscaStatus");
    const rf = value("rfCapability");
    const plant = value("plantMaterial");
    const age = year ? new Date().getFullYear() - year : null;

    const add = (agency, title, status, text) => rows.push({agency, title, status, text});

    // CBP always remains the primary entry/classification agency. PGA rows below
    // identify likely partner-agency programs from HTS + entered facts; they are
    // deliberately phrased as screening flags when HTS alone cannot prove scope.
    add("CBP", "CBP entry / classification", "checked", "CBP entry requirements, valuation, classification, country of origin, marking and any applicable Chapter 98/99 treatment remain subject to the shipment facts and current entry rules.");

    if (VEHICLE_PREFIXES.some(p => code.startsWith(p))) {
      add("EPA", "EPA motor-vehicle emissions", "review", `Motor vehicles require EPA emissions eligibility screening. ${age != null ? `Entered manufacture year indicates approximately ${age} years of age. ` : "Manufacture year was not entered. "}${engine === "modified" ? "A modified or replaced engine can change the available conformity or exemption route." : "Confirm conformity or the applicable exemption/import provision."}`);
      add("DOT", "NHTSA / DOT motor-vehicle safety", "review", age != null && age >= 25 ? "The entered year may qualify for the NHTSA 25-year age exception, subject to the actual manufacture date and proper declaration. EPA treatment is separate." : "Confirm FMVSS conformity, Registered Importer requirements, HS-7 declaration, or an applicable exception such as temporary/testing/show/competition where the facts support it.");
    } else if (VEHICLE_EQUIPMENT_PREFIXES.some(p => code.startsWith(p))) {
      add("DOT", "NHTSA / DOT vehicle equipment", "review", "This HTS can include motor-vehicle equipment subject to FMVSS or other NHTSA import requirements. Applicability depends on the actual component and intended use.");
    }

    if (ENGINE_PREFIXES.some(p => code.startsWith(p))) {
      add("EPA", "EPA engine emissions", "review", "Internal-combustion engines can be subject to EPA emissions conformity, labeling and import declaration requirements depending on engine type, use and exemption status.");
    }

    if (FOOD_AGRI_CHAPTERS.has(chapter)) {
      add("FDA", "FDA food / regulated-product screening", "review", `This HTS is in a food/agricultural chapter. Intended-use answer: ${foodUse}. FDA requirements can include facility registration, Prior Notice, FSVP, admissibility, labeling or other product-specific controls. Some commodities are primarily regulated by USDA instead.`);
      if (PLANT_AGRI_CHAPTERS.has(chapter) || foodUse === "plant") add("USDA", "USDA / APHIS plant and agricultural requirements", "review", "Plants, seeds, produce and other plant products can require APHIS admissibility review, permits, phytosanitary documentation, treatment or inspection depending on commodity and origin.");
      if (ANIMAL_AGRI_CHAPTERS.has(chapter) || foodUse === "animal") add("USDA", "USDA / APHIS animal-product requirements", "review", "Live animals and animal-derived products can require APHIS admissibility review, permits, health certificates or other disease-control documentation depending on species, processing and origin.");
      if (["02","04","16"].includes(chapter)) add("FSIS", "USDA / FSIS screening", "review", "Meat, poultry and certain egg products can fall under FSIS import inspection and foreign-establishment eligibility rules. Chapter 16 also includes products that may instead be FDA-regulated, so confirm the actual commodity.");
    }

    if (chapter === "22") add("TTB", "TTB alcohol requirements", "review", "Alcoholic beverages can require TTB permits, formula/label approvals, excise-tax treatment and other import requirements in addition to FDA/CBP requirements.");
    if (chapter === "24") add("TTB", "TTB tobacco requirements", "review", "Tobacco products can involve TTB excise-tax and permit requirements as well as FDA tobacco-product requirements.");

    if (CHEM_CHAPTERS.has(chapter)) {
      add("EPA", "EPA / TSCA chemical screening", "review", `This HTS can contain chemical substances or mixtures subject to TSCA import certification or an exclusion/exemption. Current TSCA answer: ${tsca}. Product use matters because foods, drugs, cosmetics and pesticides can be governed under other statutes.`);
    }
    if (code.startsWith("3808")) add("EPA", "EPA / FIFRA pesticide requirements", "review", "Pesticides and pesticide devices can require EPA registration, Notice of Arrival and labeling/compliance review under FIFRA. Confirm the actual product and intended use.");

    if (chapter === "30") add("FDA", "FDA drug / pharmaceutical requirements", "review", "Drugs and pharmaceutical products can require FDA registration/listing, admissibility, labeling, approval/status and other product-specific import requirements.");
    if (chapter === "33") add("FDA", "FDA cosmetic / personal-care screening", "review", "Cosmetics and certain personal-care products can be subject to FDA facility/product, ingredient, labeling and admissibility requirements depending on the actual product and claims.");
    if (MEDICAL_DEVICE_PREFIXES.some(p => code.startsWith(p))) add("FDA", "FDA medical-device screening", "review", "This HTS can include medical devices. Confirm FDA device classification, establishment registration/listing, premarket status where required, labeling and import admissibility for the actual product.");

    if (FCC_PREFIXES.some(p => code.startsWith(p))) {
      add("FCC", "FCC radiofrequency / communications equipment", "review", `This HTS can include radiofrequency or communications equipment. RF transmitting capability answer: ${rf}. Confirm equipment authorization, labeling and import conditions for the actual device; HTS alone does not determine FCC authorization status.`);
    }

    if (LACEY_CHAPTERS.has(chapter)) {
      add("LACEY", "Lacey Act / plant-product screening", "review", `This chapter can include wood or other plant material. Plant/wood answer: ${plant}. A Lacey Act declaration and/or APHIS requirements may apply depending on the exact HTS, plant material, species and country of harvest/origin.`);
    }

    if (chapter === "93") add("ATF", "ATF firearms / ammunition requirements", "review", "Firearms, ammunition and related articles can require ATF import permits, licensing and other controls. Confirm the specific article and any other applicable federal restrictions before shipment.");

    if (!rows.some(r => r.agency !== "CBP")) {
      add("PGA", "Partner Government Agency screening", "checked", "No high-confidence PGA flag was identified from the HTS alone. This is not confirmation that no PGA applies; product composition, intended use, claims, technology, species/material and other shipment facts can trigger agency requirements outside an HTS-only screen.");
    }

    return rows;
  }

  function renderPgaPanel(baseData) {
    const result = document.getElementById("result");
    if (!result) return;
    let panel = document.getElementById("pgaScreeningPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "pgaScreeningPanel";
      panel.className = "live-rule-panel";
      const live = document.getElementById("liveTradeRulePanel");
      if (live) live.after(panel);
      else { const disclaimer = result.querySelector(".disclaimer-box"); if (disclaimer) result.insertBefore(panel, disclaimer); else result.appendChild(panel); }
    }
    const rows = pgaScreeningRows(baseData);
    panel.innerHTML = `<h3>Partner Government Agency / import requirements</h3><div class="rule-source-note">HTS-based screening only. Agency applicability can depend on product composition, use, claims, technology, species/material, origin and other shipment facts.</div>${rows.map(r => `<div class="live-rule-line"><strong>${esc(PGA_SOURCE_LABELS[r.agency] || r.agency)} — ${esc(r.title)}</strong><span class="rule-badge ${r.status === "checked" ? "checked" : ""}">${r.status === "checked" ? "Checked" : "Review"}</span><p>${esc(r.text)}</p></div>`).join("")}<div class="rule-source-note"><strong>Quick-read reminder:</strong> These notes identify likely agency touchpoints; they do not replace the agency's current admissibility, permit, certification or filing rules. Confirm shipment-specific requirements with the customs broker and the responsible agency before import.</div>`;
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

  function removeLegacyTradeMeasureNotice() {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    review.querySelectorAll(".notice").forEach(el => {
      const text = (el.textContent || "").toLowerCase();
      if (text.includes("no additional trade-measure rate could be resolved automatically") || text.includes("no additional chapter 99 trade measure was identified by the current rule set")) el.remove();
    });
  }

  function addMeasureCard(measure) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    const exists = [...review.querySelectorAll(".ch99")].some(el => (el.textContent || "").includes(measure.hts));
    if (exists) return;
    const div = document.createElement("div");
    div.className = "ch99 live-ch99";
    const exclusiveAlternative = !!measure.mutuallyExclusiveGroup && measure.mutuallyExclusiveSelected === false;
    const exclusiveSelected = !!measure.mutuallyExclusiveGroup && measure.mutuallyExclusiveSelected === true;
    const estimated = exclusiveAlternative ? null : (measure.estimatedDuty ?? measure.worstCaseEstimatedDuty);
    const assumed = measure.estimatedDuty == null && measure.worstCaseEstimatedDuty != null;
    const duty = exclusiveAlternative
      ? "<strong>ALTERNATIVE — NOT ADDED.</strong> U.S. note 16(a) allows no more than one heading in 9903.82.02 through 9903.82.26."
      : estimated == null
        ? "Dollar amount could not be estimated automatically"
        : `${exclusiveSelected ? "USED FOR WORST-CASE ESTIMATE" : assumed ? "Worst-case quick estimate" : "Estimated additional duty"}: <strong>${esc(money(estimated))}</strong>`;
    const facts = Array.isArray(measure.requiredFacts) && measure.requiredFacts.length ? `<br><span class="tiny"><strong>Facts that could change this estimate:</strong> ${esc(measure.requiredFacts.map(questionLabel).join(", "))}</span>` : (measure.applicability !== "applicable" && measure.reason ? `<br><span class="tiny"><strong>Why review is still required:</strong> ${esc(measure.reason)}</span>` : "");
    const assumptions = Array.isArray(measure.assumptions) && measure.assumptions.length ? `<br><span class="assumption-note"><strong>Assumptions:</strong> ${esc(measure.assumptions.join(" "))}</span>` : "";
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.rateText || "See current provision")}</strong>${measure.description ? `<br>${esc(measure.description)}` : ""}<br><span class="tiny">${duty}</span>${facts}${assumptions}<br><span class="tiny">Source: current USITC HTS / Chapter 99</span>`;
    review.appendChild(div);
  }

  function setMetric(id, value, status) {
    const el = document.getElementById(id);
    if (!el) return;
    if (status === "source-unavailable") el.textContent = "Source unavailable";
    else if (status === "review-required" && value == null) el.textContent = "Review required";
    else el.textContent = money(value || 0);
  }

  function recalcTotal(baseData, sec232, sec301, liveOther) {
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
  }

  function setEstimateReviewFlag(ruleData) {
    const total = document.getElementById("total");
    const card = total?.closest(".metric");
    if (!card) return;
    let flag = card.querySelector(".estimate-review-flag");
    const assumptionsUsed = Array.isArray(ruleData?.assumptions) && ruleData.assumptions.length > 0;
    const needsReview = ["needs-facts", "review-required"].includes(ruleData?.status) || assumptionsUsed;
    if (!needsReview) { flag?.remove(); return; }
    if (!flag) {
      flag = document.createElement("small");
      flag.className = "estimate-review-flag";
      card.appendChild(flag);
    }
    flag.textContent = ["needs-facts", "review-required"].includes(ruleData?.status)
      ? "Review required • worst-case assumptions used"
      : "Estimate uses assumptions • broker confirmation recommended";
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
    const assumptions = Array.isArray(ruleData?.assumptions) ? ruleData.assumptions : [];
    const exclusiveMetal = measures.filter(isExclusiveMetalMeasure);
    const exclusiveMetalWarning = exclusiveMetal.length > 1 ? `<div class="rule-warning"><strong>Mutually exclusive Section 232 headings.</strong> U.S. note 16(a) permits no more than one of headings 9903.82.02 through 9903.82.26 to apply to an article. These candidates are shown for review, but they are not added together in the quick estimate.</div>` : "";
    const rev = ruleData?.currentHts?.label ? `${ruleData.currentHts.label}${ruleData.currentHts.date ? ` (${ruleData.currentHts.date})` : ""}` : "current HTS source";
    const sourceWarning = ruleData?.status === "source-unavailable" ? `<div class="rule-warning">Current Chapter 99 legal text could not be read. The calculator will not treat missing trade-remedy hits as a definitive “not applicable” result.</div>` : "";
    const reviewWarning = ["needs-facts", "review-required"].includes(ruleData?.status) ? `<div class="rule-warning"><strong>Review required.</strong> The dollar estimate below uses the higher-duty path where shipment facts are missing or a potential exception/exclusion has not been established.</div>` : "";
    const unresolvedWarning = unresolved.length ? `<div class="rule-warning">The current Chapter 99 text references this HTS in a rule that could not be resolved automatically. Manual review is required before filing.</div>` : "";
    const assumptionWarning = assumptions.length ? `<div class="rule-warning"><strong>Quick-estimate assumptions:</strong><br>${assumptions.map(a => `• ${esc(a)}`).join("<br>")}</div>` : "";
    const lines = measures.length ? measures.map(m => {
      const badge = exclusiveMetal.length > 1 && isExclusiveMetalMeasure(m) ? `<span class="rule-badge">Alternative</span>` : (m.applicability === "applicable" && m.estimatedDuty != null ? `<span class="rule-badge checked">Applied</span>` : `<span class="rule-badge">Review</span>`);
      const facts = m.requiredFacts?.length ? ` Facts that could change the estimate: ${m.requiredFacts.map(questionLabel).join(", ")}.` : (m.reason ? ` Review reason: ${m.reason}` : "");
      const estimate = m.estimatedDuty ?? m.worstCaseEstimatedDuty;
      const estimateText = estimate != null ? ` Quick estimate: ${money(estimate)}${m.estimatedDuty == null ? " using worst-case assumptions." : "."}` : "";
      return `<div class="live-rule-line"><strong>${esc(m.program)} — ${esc(m.hts)}</strong>${badge}<p>${esc(m.description || m.rateText || "Current Chapter 99 provision identified.")}${esc(estimateText)}${esc(facts)}</p></div>`;
    }).join("") : `<div class="live-rule-line"><strong>Chapter 99 / trade remedies</strong><span class="rule-badge checked">Checked</span><p>No Chapter 99 provision was identified by the current live-source scan for the entered HTS and origin. This is not presented as a legal guarantee.</p></div>`;
    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="rule-source-note">Checked against ${esc(rev)} and current Chapter 99 source. Screening build ${BUILD}.</div>${sourceWarning}${reviewWarning}${unresolvedWarning}${assumptionWarning}${exclusiveMetalWarning}${lines}<div class="rule-source-note"><strong>Quick-read reminder:</strong> This site provides a quick estimate of duties, not a filing determination. Confirm shipment facts, classification, exclusions and final rates with your customs broker before entry.</div>`;
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
      if (ruleData?.revisionVerified === true && !["source-unavailable", "source-stale"].includes(ruleData?.status)) removeLegacyTradeMeasureNotice();

      removeLegacyProgramCards("Section 232");
      removeLegacyProgramCards("Section 301");
      const measures = Array.isArray(ruleData.measures) ? ruleData.measures : [];
      measures.forEach(addMeasureCard);

      const sec232Measures = measures.filter(m => String(m.program).toLowerCase() === "section 232");
      const sec301Measures = measures.filter(m => String(m.program).toLowerCase() === "section 301");
      const otherLiveMeasures = measures.filter(m => !["section 232", "section 301"].includes(String(m.program).toLowerCase()));
      const groupWorstCase = list => {
        if (!list.length) return 0;
        const exclusive = list.filter(isExclusiveMetalMeasure);
        const ordinary = list.filter(m => !isExclusiveMetalMeasure(m));
        const exclusiveValues = exclusive.map(quickMeasureAmount).filter(v => v != null);
        const exclusiveAmount = exclusiveValues.length ? Math.max(...exclusiveValues, 0) : 0;
        const applied = ordinary.filter(m => m.applicability === "applicable" && m.estimatedDuty != null).reduce((sum,m) => sum + Number(m.estimatedDuty || 0), 0);
        const unresolved = ordinary.filter(m => m.applicability !== "applicable").map(m => m.worstCaseEstimatedDuty).filter(v => v != null).map(Number);
        const ordinaryAmount = unresolved.length ? Math.max(applied, ...unresolved, 0) : applied;
        return exclusiveAmount + ordinaryAmount;
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
      setEstimateReviewFlag(ruleData);
      renderLiveRulePanel(ruleData);
      renderPgaPanel(baseData);
      renderClearanceOptions(baseData);
    } catch (error) {
      setMetric("section232Duty", null, "source-unavailable");
      setMetric("section301Duty", null, "source-unavailable");
      const total = document.getElementById("total");
      if (total) total.textContent = "Review required";
      renderLiveRulePanel({status:"source-unavailable",chapter99SourceAvailable:false,measures:[],unresolvedMatches:[],currentHts:lastRulePreview?.currentHts});
      renderPgaPanel(baseData);
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
    hookUnitHint();
    ensureQtyUnitAssist();
    ensureQuestionBox();
    ensureModal();
    const hts = document.getElementById("hts");
    const country = document.getElementById("country");
    hts?.addEventListener("input", queueRulePreview);
    hts?.addEventListener("change", queueRulePreview);
    country?.addEventListener("change", queueRulePreview);
    document.getElementById("value")?.addEventListener("input", queueRulePreview);
    document.getElementById("value")?.addEventListener("change", queueRulePreview);
    document.getElementById("meltPourCountry")?.addEventListener("change", queueRulePreview);
    document.getElementById("fta")?.addEventListener("change", queueRulePreview);
    document.getElementById("qty")?.addEventListener("change", queueRulePreview);
    document.getElementById("qtyUnit")?.addEventListener("change", queueRulePreview);
    document.getElementById("mode")?.addEventListener("change", queueRulePreview);
    document.getElementById("importPurpose")?.addEventListener("change", queueRulePreview);
    watchResults();
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    queueRulePreview();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
})();
