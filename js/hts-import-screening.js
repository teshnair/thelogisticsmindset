(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const BUILD = "2026-09-06-import-screening-v2";
  const digits = value => String(value ?? "").replace(/\D/g, "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function currentFormFacts() {
    return {
      manufactureYear: Number(document.getElementById("vehicleManufactureYear")?.value || 0) || null,
      originalEngine: document.getElementById("vehicleOriginalEngine")?.value || "",
      importPurpose: document.getElementById("vehicleImportPurpose")?.value || "permanent"
    };
  }

  function addMeasure(data, measure) {
    data.review ||= {};
    data.review.applicableAdditionalMeasures ||= [];
    const list = data.review.applicableAdditionalMeasures;
    const key = `${measure.hts}|${measure.program}`;
    if (list.some(item => `${item?.hts || ""}|${item?.program || ""}` === key)) return;
    list.push(measure);
  }

  function moneyAmount(value, rate) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n * rate : null;
  }

  function vehicleRequirements(code, facts) {
    if (!code.startsWith("8703")) return [];
    const year = facts.manufactureYear;
    const nowYear = new Date().getFullYear();
    const nhtsa25 = year && year <= nowYear - 25;
    const epa21 = year && year <= nowYear - 21;
    const rows = [];

    rows.push({
      agency: "NHTSA / DOT",
      status: nhtsa25 ? "Age exemption indicated" : "Review required",
      detail: nhtsa25
        ? `Manufacture year ${year} is at least 25 years before ${nowYear}. Review the NHTSA 25-year provision and HS-7 declaration requirements.`
        : "Passenger vehicles generally require an HS-7 declaration. If the vehicle is not at least 25 years old, confirm FMVSS conformity, Registered Importer eligibility, or another applicable import basis."
    });

    let epaDetail = "EPA Form 3520-1 and emissions import requirements should be reviewed.";
    if (epa21) {
      if (facts.originalEngine === "yes") {
        epaDetail = `Manufacture year ${year} is at least 21 years old and the engine is reported as original/equivalent. Review the EPA age-based provision and Form 3520-1 declaration.`;
      } else if (facts.originalEngine === "no") {
        epaDetail = `Manufacture year ${year} meets the 21-year age threshold, but the engine is reported as changed. The EPA age-based provision may not apply; review the replacement-engine requirements before import.`;
      } else {
        epaDetail = `Manufacture year ${year} meets the 21-year age threshold, but original engine/configuration has not been confirmed. EPA eligibility depends on that fact.`;
      }
    }
    rows.push({ agency: "EPA", status: "Review required", detail: epaDetail });

    const purposeNotes = {
      testing: "Testing/research imports can require agency preapproval and temporary-import conditions.",
      display: "Show/display imports can require NHTSA eligibility/permission and EPA temporary-import treatment.",
      racing: "Competition-racing vehicles have separate EPA/NHTSA criteria; road-capable vehicles are not automatically exempt.",
      repair: "Repair/alteration imports can require temporary admission, agency authorization, and export after the approved activity.",
      nonresident: "Temporary nonresident-use provisions have time limits and documentary requirements.",
      permanent: "Permanent import requires the normal EPA/NHTSA compliance or an applicable exemption."
    };
    rows.push({
      agency: "Vehicle import purpose",
      status: "Shipment fact",
      detail: purposeNotes[facts.importPurpose] || purposeNotes.permanent
    });

    return rows;
  }

  function genericRequirements(code) {
    const chapter = Number(code.slice(0, 2));
    const rows = [];
    const add = (agency, status, detail) => rows.push({ agency, status, detail });

    if (chapter >= 2 && chapter <= 22) add("FDA", "Possible PGA filing", "Food, beverage, agricultural and related products can require FDA admissibility data, prior notice, facility/registration or other product-specific requirements.");
    if (chapter >= 1 && chapter <= 14) add("USDA / APHIS", "Possible PGA filing", "Animal, plant and agricultural products can require APHIS permits, certificates, inspection or admissibility review.");
    if ([29,32,38].includes(chapter)) add("EPA / TSCA", "Possible certification", "Chemical products can require TSCA import certification and may also be subject to EPA program-specific requirements.");
    if ([30,33].includes(chapter)) add("FDA", "Possible PGA filing", "Drugs, medical preparations, cosmetics or related goods can require FDA product and establishment data.");
    if ([44,92].includes(chapter)) add("USDA / APHIS / Lacey Act", "Possible declaration", "Wood, plant products and certain instruments can require Lacey Act or APHIS review depending on species, composition and use.");
    if (chapter === 85) add("FCC", "Conditional", "Radio-frequency or communications equipment may require FCC authorization or an applicable import condition.");
    if (code.startsWith("9503")) add("CPSC", "Likely review", "Toys and children's products can require CPSC compliance/certification and product-specific testing records.");

    return rows;
  }

  function augmentCalculation(data, requestPayload) {
    if (!data || typeof data !== "object") return data;
    data.query ||= {};
    const code = digits(requestPayload?.hts || data.query?.hts);
    const country = String(requestPayload?.country || data.query?.country || "").toUpperCase();
    const customsValue = Number(requestPayload?.customsValue ?? data.query?.customsValue ?? 0);
    const facts = currentFormFacts();

    data.review ||= {};
    data.review.screeningBuild = BUILD;

    if (country === "CN" && code.startsWith("870323")) {
      addMeasure(data, {
        program: "Section 301",
        hts: "9903.88.01",
        description: "Product of China classified under 8703.23.01 is included in the Section 301 List 1 action.",
        applicableRate: "+25%",
        amount: moneyAmount(customsValue, 0.25),
        tariffTreatment: "Section 301 additional duty for products of China",
        ruleSource: "USTR Section 301 List 1 / U.S. note 20",
        extendedScreening: true
      });
    }

    if (country === "CN" && code.startsWith("8703")) {
      addMeasure(data, {
        program: "China IEEPA — Synthetic Opioid",
        hts: "9903.01.24",
        description: "Current additional duty on covered products of China under the synthetic-opioid IEEPA action.",
        applicableRate: "+10%",
        amount: moneyAmount(customsValue, 0.10),
        tariffTreatment: "China synthetic-opioid IEEPA additional duty, subject to the applicable exclusions and U.S. notes",
        ruleSource: "Executive Order 14357 / U.S. note 2(u)",
        extendedScreening: true
      });
    }

    if (code.startsWith("8703")) {
      const nowYear = new Date().getFullYear();
      const oldVehicle = facts.manufactureYear && facts.manufactureYear <= nowYear - 25;
      if (oldVehicle) {
        addMeasure(data, {
          program: "Section 232 Automobiles",
          hts: "9903.94.04",
          description: `Passenger vehicle reported as manufactured in ${facts.manufactureYear}, at least 25 years before the year of entry.`,
          applicableRate: "0% additional (25-year exception)",
          amount: 0,
          tariffTreatment: "Automobile Section 232 age exception; verify manufacture year and eligibility at entry",
          ruleSource: "U.S. note 33(e), subchapter III, chapter 99",
          extendedScreening: true
        });
      } else {
        addMeasure(data, {
          program: "Section 232 Automobiles",
          hts: "9903.94.01",
          description: "Passenger vehicle covered by the automobile Section 232 action, unless a specific exception or alternative automobile provision applies.",
          applicableRate: "+25%",
          amount: moneyAmount(customsValue, 0.25),
          tariffTreatment: "Automobile Section 232 additional duty",
          ruleSource: "Proclamation 10908 / U.S. note 33",
          extendedScreening: true
        });
      }

      addMeasure(data, {
        program: "Reciprocal Tariff Exception",
        hts: "9903.01.33",
        description: "Passenger vehicles covered by the automobile Section 232 provisions are excluded from the reciprocal-tariff additional duty.",
        applicableRate: "0% additional (exception)",
        amount: 0,
        tariffTreatment: "Reciprocal tariff exception for covered passenger vehicles",
        ruleSource: "U.S. note 2(v) / heading 9903.01.33",
        extendedScreening: true
      });
    }

    data.review.importRequirementsScreening = [
      ...vehicleRequirements(code, facts),
      ...genericRequirements(code)
    ];
    data.review.importScreeningFacts = facts;
    return data;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const response = await nativeFetch(input, init);
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url.includes("/api/hts-duty") || !init?.body) return response;

      let requestPayload;
      try { requestPayload = JSON.parse(init.body); } catch { return response; }
      if (requestPayload?.action !== "calculate" || !response.ok) return response;

      const data = await response.clone().json();
      augmentCalculation(data, requestPayload);

      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn("Import screening augmentation skipped:", error);
      return response;
    }
  };

  function injectStyles() {
    if (document.getElementById("importScreeningStyles")) return;
    const style = document.createElement("style");
    style.id = "importScreeningStyles";
    style.textContent = `
      .import-screening-inputs{grid-column:1/-1;border:1px solid #d8dee6;border-radius:5px;background:#f8fafc;padding:16px;margin-top:2px}
      .import-screening-inputs h3{margin:0 0 5px;color:#1a2a3a;font-size:1rem}
      .import-screening-inputs p{margin:0 0 14px;color:#667085;font-size:.84rem}
      .import-screening-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .import-screening-panel{margin-top:24px}
      .import-screening-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .import-screening-card{border:1px solid #e1e6eb;border-radius:5px;background:#fff;padding:14px}
      .import-screening-card h4{margin:0 0 5px;color:#1a2a3a;font-size:.95rem}
      .import-screening-status{display:inline-block;margin-bottom:7px;padding:3px 8px;border-radius:999px;background:#fff3d6;color:#765000;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.35px}
      .import-screening-card p{margin:0;color:#444;font-size:.87rem}
      @media(max-width:760px){.import-screening-grid,.import-screening-cards{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectExtendedInputs() {
    if (document.getElementById("importScreeningInputs")) return;
    const grid = document.querySelector("#calcForm .grid");
    if (!grid) return;

    const block = document.createElement("div");
    block.className = "import-screening-inputs";
    block.id = "importScreeningInputs";
    block.innerHTML = `
      <h3>Import / PGA requirements screening <span class="tiny">(optional)</span></h3>
      <p>Additional shipment facts improve agency and vehicle-import screening. Duty calculation still works if these are left blank.</p>
      <div class="import-screening-grid">
        <div>
          <label for="vehicleManufactureYear">Vehicle manufacture year <span class="tiny">(if applicable)</span></label>
          <input id="vehicleManufactureYear" type="number" min="1900" max="${new Date().getFullYear()}" placeholder="e.g. 2000">
        </div>
        <div>
          <label for="vehicleOriginalEngine">Original / equivalent engine <span class="tiny">(if applicable)</span></label>
          <select id="vehicleOriginalEngine">
            <option value="">Unknown / not applicable</option>
            <option value="yes">Yes</option>
            <option value="no">No / replaced or modified</option>
          </select>
        </div>
        <div>
          <label for="vehicleImportPurpose">Import purpose</label>
          <select id="vehicleImportPurpose">
            <option value="permanent">Permanent import</option>
            <option value="testing">Testing / research</option>
            <option value="display">Show / display</option>
            <option value="racing">Competition / racing</option>
            <option value="repair">Repair / alteration</option>
            <option value="nonresident">Temporary nonresident use</option>
          </select>
        </div>
      </div>
    `;

    const fta = grid.querySelector(".checkbox");
    if (fta) fta.insertAdjacentElement("afterend", block);
    else grid.appendChild(block);
  }

  function updateHeader() {
    const title = document.querySelector(".page-header h1");
    const subtitle = document.querySelector(".page-header .subtitle");
    if (title) title.textContent = "U.S. Import Requirements & Duty Calculator";
    if (subtitle) subtitle.textContent = "Live HTS duty lookup with Chapter 99 tariff screening and import / PGA requirement checks";
    document.title = "U.S. Import Requirements & Duty Calculator | The Logistics Mindset";
  }

  function renderScreeningPanel() {
    const result = document.getElementById("result");
    const data = window.__lastResult;
    if (!result || !data || result.classList.contains("hidden")) return;

    let panel = document.getElementById("importRequirementsPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "importRequirementsPanel";
      panel.className = "import-screening-panel";
      const disclaimer = result.querySelector(".disclaimer-box");
      if (disclaimer) disclaimer.insertAdjacentElement("beforebegin", panel);
      else result.appendChild(panel);
    }

    const items = Array.isArray(data?.review?.importRequirementsScreening)
      ? data.review.importRequirementsScreening
      : [];

    panel.innerHTML = `
      <h3 class="section-title">Import / PGA requirements screening</h3>
      <div class="notice info">Screening is based on the HTS code and the shipment facts entered above. A PGA flag here is a prompt to review the agency requirement, not a substitute for ACE/PGA validation or shipment-specific broker review.</div>
      <div class="import-screening-cards">
        ${items.length ? items.map(item => `
          <div class="import-screening-card">
            <span class="import-screening-status">${esc(item.status || "Review")}</span>
            <h4>${esc(item.agency || "Requirement")}</h4>
            <p>${esc(item.detail || "")}</p>
          </div>
        `).join("") : `
          <div class="import-screening-card">
            <span class="import-screening-status">No specific flag</span>
            <h4>Additional agency screening</h4>
            <p>No specific PGA category was identified by this preliminary HTS screen. Shipment-specific requirements can still apply.</p>
          </div>
        `}
      </div>
    `;
  }

  function boot() {
    injectStyles();
    updateHeader();
    injectExtendedInputs();

    const result = document.getElementById("result");
    if (result && "MutationObserver" in window) {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(renderScreeningPanel, 0);
      });
      observer.observe(result, { attributes: true, childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();