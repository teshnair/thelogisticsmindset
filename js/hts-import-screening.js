(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const BUILD = "2026-09-06-import-screening-v3";
  const digits = value => String(value ?? "").replace(/\D/g, "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const SEC232_PREFIXES = [
    "7206","7207","7208","7209","7210","7211","7212","7213","7214","7215","7216","7217","7218","7219","7220","7221","7222","7223","7224","7225","7226","7227","7228","7229",
    "7301","7302","7304","7305","7306","7307","7308","7309","7601","7604","7605","7606","7607","7608","7609","7610","7616",
    "8703","8704"
  ];

  function addStyles() {
    if (document.getElementById("htsExtendedStyles")) return;
    const style = document.createElement("style");
    style.id = "htsExtendedStyles";
    style.textContent = `
      body.hts-modal-open{overflow:hidden}
      #htsResultBackdrop{position:fixed;inset:0;background:rgba(10,20,30,.58);z-index:9998;display:none}
      #htsResultBackdrop.open{display:block}
      #result.hts-result-modal{position:fixed;z-index:9999;top:4vh;left:50%;transform:translateX(-50%);width:min(1120px,94vw);max-height:92vh;overflow:auto;margin:0;box-shadow:0 18px 60px rgba(0,0,0,.35);border:1px solid #cfd6de}
      .hts-modal-close{position:sticky;top:0;float:right;z-index:2;border:0;background:#1a2a3a;color:#fff;width:38px;height:38px;border-radius:999px;font-size:24px;line-height:1;cursor:pointer;margin:-8px -8px 8px 12px}
      .extended-screening-inputs{margin-top:18px;padding:16px;border:1px solid #d9e0e7;border-radius:5px;background:#f8fafc}
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
      @media(max-width:760px){.extended-screening-grid{grid-template-columns:1fr}#result.hts-result-modal{top:2vh;max-height:96vh;width:96vw}}
    `;
    document.head.appendChild(style);
  }

  function injectExtraInputs() {
    if (document.getElementById("extendedScreeningInputs")) return;
    const form = document.getElementById("calcForm");
    const grid = form?.querySelector(".grid");
    if (!grid) return;

    const box = document.createElement("div");
    box.id = "extendedScreeningInputs";
    box.className = "full extended-screening-inputs";
    box.innerHTML = `
      <h3>Additional import screening details <span class="tiny">(optional)</span></h3>
      <p>These details help screen for EPA, NHTSA/DOT and other special import requirements that cannot be determined from the HTS code alone.</p>
      <div class="extended-screening-grid">
        <div>
          <label for="importPurpose">Import purpose</label>
          <select id="importPurpose">
            <option value="standard">Standard import / consumption</option>
            <option value="temporary">Temporary import</option>
            <option value="repair">Repair / alteration</option>
            <option value="testing">Testing / research / prototype</option>
            <option value="show">Show / display / exhibition</option>
            <option value="racing">Racing / competition</option>
          </select>
        </div>
        <div>
          <label for="vehicleManufactureYear">Vehicle manufacture year</label>
          <input id="vehicleManufactureYear" type="number" min="1900" max="2100" placeholder="Only needed for vehicles">
        </div>
        <div>
          <label for="vehicleEngineStatus">Vehicle engine</label>
          <select id="vehicleEngineStatus">
            <option value="unknown">Not specified</option>
            <option value="original">Original / equivalent configuration</option>
            <option value="modified">Modified / replaced</option>
          </select>
        </div>
      </div>`;
    grid.appendChild(box);
  }

  function updateHeading() {
    const h1 = document.querySelector(".page-header h1");
    const sub = document.querySelector(".page-header .subtitle");
    if (h1) h1.textContent = "U.S. Import Requirements & Duty Calculator";
    if (sub) sub.textContent = "HTS duty, Chapter 99, trade-remedy and import-requirement screening";
    document.title = "U.S. Import Requirements & Duty Calculator | The Logistics Mindset";
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
    result.scrollTop = 0;
  }

  function closeModal() {
    const result = document.getElementById("result");
    result?.classList.remove("hts-result-modal");
    result?.classList.add("hidden");
    document.getElementById("htsResultBackdrop")?.classList.remove("open");
    document.body.classList.remove("hts-modal-open");
  }

  function facts() {
    return {
      purpose: document.getElementById("importPurpose")?.value || "standard",
      year: Number(document.getElementById("vehicleManufactureYear")?.value || 0) || null,
      engine: document.getElementById("vehicleEngineStatus")?.value || "unknown"
    };
  }

  function screeningRows(data) {
    const hts = digits(data?.classification?.hts || data?.query?.hts || document.getElementById("hts")?.value);
    const country = String(data?.query?.country || document.getElementById("country")?.value || "").toUpperCase();
    const chapter = hts.slice(0,2);
    const f = facts();
    const backend = Array.isArray(data?.review?.applicableAdditionalMeasures) ? data.review.applicableAdditionalMeasures : [];
    const rows = [];

    rows.push({name:"Chapter 99 / additional duties", status:backend.length ? "flag" : "ok", text:backend.length ? `${backend.length} additional trade-measure provision(s) were identified by the current rules. Review every Chapter 99 line shown in the duty results.` : "No additional Chapter 99 measure was identified by the current rule set. The weekly regulatory monitor still checks official sources for changes before production publication."});

    const has301 = backend.some(x => /301/i.test(String(x?.program || "")));
    if (country === "CN" && hts.startsWith("870323") && !has301) {
      rows.push({name:"Section 301",status:"flag",text:"China-origin passenger automobiles under 8703.23 require Section 301 screening. Current verified mapping includes Chapter 99 9903.88.01 at +25%, subject to current exclusions and entry-date rules."});
    } else {
      rows.push({name:"Section 301",status:has301 ? "flag" : "ok",text:has301 ? "A Section 301 measure was identified and is shown in the duty results." : "No Section 301 measure was identified for this HTS/country combination by the current rules. The weekly monitor checks USTR/Federal Register sources for new or modified actions."});
    }

    const has232 = backend.some(x => /232/i.test(String(x?.program || ""))) || SEC232_PREFIXES.some(p => hts.startsWith(p));
    rows.push({name:"Section 232",status:has232 ? "flag" : "ok",text:has232 ? "This classification falls within a product family that can be subject to Section 232. Review the Chapter 99 treatment, origin/content rules and any exemption or derivative-product rules shown above." : "No Section 232 product-family match was identified by the current screening rules."});

    if (country === "CN") {
      rows.push({name:"China IEEPA / other country-wide Chapter 99",status:"flag",text:"Country-wide China Chapter 99 measures must also be checked in addition to Section 301. The current screening includes the China synthetic-opioid tariff framework and reciprocal-tariff provisions/exceptions where applicable."});
    }

    if (chapter === "87") {
      const age = f.year ? new Date().getFullYear() - f.year : null;
      rows.push({name:"EPA vehicle requirements",status:"flag",text:`Motor vehicles require EPA emissions screening. ${age != null ? `Entered manufacture year indicates approximately ${age} years of age. ` : "Enter the manufacture year for age-based screening. "}${f.engine === "modified" ? "A modified or replaced engine can change eligibility and documentation requirements." : "Confirm emissions conformity or the applicable exemption/import provision."}`});
      rows.push({name:"NHTSA / DOT vehicle requirements",status:"flag",text:`Motor vehicles require NHTSA/DOT safety screening. ${age != null && age >= 25 ? "The entered year may qualify for the 25-year NHTSA age exception, subject to the actual manufacture date." : "Confirm FMVSS conformity, Registered Importer requirements, or an applicable exception."}`});
      if (f.purpose !== "standard") rows.push({name:"Special import purpose",status:"flag",text:`Selected purpose: ${f.purpose}. Temporary, testing, show/display, racing and repair imports can have separate eligibility, bond, declaration or re-export requirements.`});
    }

    if (["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","30","33"].includes(chapter)) {
      rows.push({name:"FDA / USDA screening",status:"flag",text:"This chapter can involve FDA and/or USDA/APHIS requirements. Confirm admissibility, prior notice, facility/registration, permits, inspections, labeling and commodity-specific restrictions as applicable."});
    }
    if (["28","29","30","31","32","33","34","35","36","37","38","39"].includes(chapter)) {
      rows.push({name:"EPA / TSCA screening",status:"flag",text:"Chemical or chemical-containing merchandise can require TSCA certification or other EPA review. Confirm substance identity, exclusions and shipment-specific certification requirements."});
    }
    if (hts.startsWith("8517") || hts.startsWith("8525") || hts.startsWith("8526") || hts.startsWith("8528")) {
      rows.push({name:"FCC screening",status:"flag",text:"Radiofrequency or communications equipment can require FCC authorization, equipment identification or an import-condition review."});
    }
    if (["44","47","48","94"].includes(chapter)) {
      rows.push({name:"Lacey Act / plant-product screening",status:"flag",text:"Wood, paper or products containing plant material may require Lacey Act declaration data and/or USDA/APHIS review depending on species, processing and product composition."});
    }

    rows.push({name:"AD/CVD, quota and other CBP requirements",status:"flag",text:"The calculator screens returned HTS data for AD/CVD, quota/TRQ and other notes, but scope and applicability can depend on producer/exporter, product description, country and shipment facts. Treat any hit as a review item, not a final legal determination."});
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
      const header = result.querySelector(".result-header");
      if (header) header.insertAdjacentElement("afterend", panel); else result.prepend(panel);
    }
    const rows = screeningRows(data);
    panel.innerHTML = `<h3>Import / regulatory screening</h3><div class="screening-note">Guidance based on the entered HTS code, country and optional shipment facts. The production rules are checked against official regulatory sources during the weekly release cycle.</div>${rows.map(r => `<div class="screening-row"><strong>${esc(r.name)}</strong><span class="status ${r.status}">${r.status === "flag" ? "Review" : "Checked"}</span><p>${esc(r.text)}</p></div>`).join("")}<div class="regulatory-freshness">Screening build: ${BUILD}. Always verify shipment-specific applicability before filing.</div>`;
  }

  function watchResults() {
    const result = document.getElementById("result");
    if (!result) return;
    const observer = new MutationObserver(() => {
      if (!result.classList.contains("hidden")) {
        setTimeout(() => {
          const data = window.__lastResult;
          if (data) addScreeningPanel(data);
          openModal();
        }, 60);
      }
    });
    observer.observe(result,{attributes:true,attributeFilter:["class"]});
  }

  function init() {
    addStyles();
    updateHeading();
    injectExtraInputs();
    ensureModal();
    watchResults();
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
