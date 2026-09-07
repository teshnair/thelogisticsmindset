(() => {
  const money = value => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));

  const normalizeUnit = value => String(value || "")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[.\s]/g, "");

  const unitAliases = {
    no: ["no", "number", "unit", "units", "each", "ea", "piece", "pieces", "pc", "pcs"],
    kg: ["kg", "kilogram", "kilograms"],
    g: ["g", "gram", "grams"],
    lb: ["lb", "lbs", "pound", "pounds"],
    l: ["l", "liter", "liters", "litre", "litres"],
    m: ["m", "meter", "meters", "metre", "metres"],
    m2: ["m2", "sqm", "squaremeter", "squaremeters"],
    m3: ["m3", "cbm", "cubicmeter", "cubicmeters"]
  };

  function canonicalUnit(value) {
    const normalized = normalizeUnit(value);
    for (const [canonical, aliases] of Object.entries(unitAliases)) {
      if (aliases.includes(normalized)) return canonical;
    }
    return normalized;
  }

  function isCountUnit(value) {
    return canonicalUnit(value) === "no";
  }

  function unitsMatch(rateUnit, enteredUnit) {
    return canonicalUnit(rateUnit) === canonicalUnit(enteredUnit);
  }

  function parseFormula(rateText, customsValue, quantity, quantityUnit) {
    if (!rateText) return null;
    let raw = String(rateText)
      .replace(/(^|\s)\d+\/(?=\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/^free\b/i.test(raw)) {
      return { duty: 0, components: [{ type: "free", amount: 0 }], inferredUnit: null };
    }

    // Do not auto-calculate formulas whose text itself signals a condition,
    // minimum/maximum, proof-content basis, or other non-linear treatment.
    if (/\bsee\b|varies|depending|per proof|content|maximum|minimum|whichever|but not less|not less than|not more than/i.test(raw)) {
      return null;
    }

    const components = [];
    let duty = 0;
    let matched = false;

    const percentMatches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
    if (percentMatches.length > 1) return null;
    if (percentMatches.length === 1) {
      const percent = Number(percentMatches[0][1]);
      const amount = customsValue * percent / 100;
      duty += amount;
      components.push({ type: "ad_valorem", ratePercent: percent, amount });
      matched = true;
    }

    const specificPatterns = [
      { regex: /\$(\d+(?:\.\d+)?)\s*(?:\/|per\s+)\s*([A-Za-z0-9²³.]+)/gi, cents: false },
      { regex: /(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*(?:\/|per\s+)\s*([A-Za-z0-9²³.]+)/gi, cents: true },
      { regex: /\$(\d+(?:\.\d+)?)\s*(each|ea\.?|per\s+piece|per\s+unit)/gi, cents: false },
      { regex: /(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*(each|ea\.?|per\s+piece|per\s+unit)/gi, cents: true }
    ];

    const matches = [];
    for (const pattern of specificPatterns) {
      for (const match of raw.matchAll(pattern.regex)) {
        let unit = String(match[2] || "").replace(/^per\s+/i, "").trim();
        if (/^(each|ea\.?)$/i.test(unit) || /^piece$/i.test(unit) || /^unit$/i.test(unit)) unit = "each";
        matches.push({
          full: match[0],
          dollarsPerUnit: Number(match[1]) / (pattern.cents ? 100 : 1),
          unit
        });
      }
    }

    // De-duplicate a specific component if two permissive patterns happened to
    // recognize the same text.
    const seenSpecific = new Set();
    const specificMatches = matches.filter(match => {
      const key = `${match.full.toLowerCase()}|${match.dollarsPerUnit}|${canonicalUnit(match.unit)}`;
      if (seenSpecific.has(key)) return false;
      seenSpecific.add(key);
      return true;
    });

    let inferredUnit = null;
    for (const match of specificMatches) {
      if (!(Number.isFinite(quantity) && quantity > 0)) return null;

      if (isCountUnit(match.unit)) {
        // For an explicit “each” rate, the quantity field itself is sufficient.
        // The USITC row does not always publish a separate reporting-unit value.
        if (quantityUnit && !unitsMatch(match.unit, quantityUnit)) return null;
        inferredUnit = inferredUnit || "No.";
      } else {
        if (!quantityUnit || !unitsMatch(match.unit, quantityUnit)) return null;
      }

      const amount = match.dollarsPerUnit * quantity;
      duty += amount;
      components.push({
        type: "specific",
        dollarsPerUnit: match.dollarsPerUnit,
        unit: match.unit,
        quantity,
        amount
      });
      matched = true;
    }

    let stripped = raw.replace(/(\d+(?:\.\d+)?)\s*%/g, "");
    for (const match of specificMatches) stripped = stripped.replace(match.full, "");
    stripped = stripped.replace(/[+;,()\s-]/g, "");

    if (!matched || (stripped && !/^advalorem$/i.test(stripped))) return null;
    return { duty, components, inferredUnit };
  }

  function describeComponents(components) {
    return components.map(component => {
      if (component.type === "ad_valorem") {
        return `${money(component.amount)} from ${component.ratePercent}% of customs value`;
      }
      if (component.type === "specific") {
        const unit = isCountUnit(component.unit) ? "each" : component.unit;
        return `${money(component.amount)} from ${money(component.dollarsPerUnit)} per ${unit} × ${component.quantity}`;
      }
      return money(component.amount);
    }).join(" + ");
  }

  function exposeInferredCountUnit(inferredUnit) {
    if (!inferredUnit) return;
    const select = document.getElementById("qtyUnit");
    if (!select) return;

    let option = [...select.options].find(o => canonicalUnit(o.value) === "no");
    if (!option) {
      option = document.createElement("option");
      option.value = "No.";
      option.textContent = "No. / each (from duty formula)";
      select.appendChild(option);
    }
    if (!select.value) select.value = option.value;

    const help = document.getElementById("qtyUnitHelp");
    if (help) help.textContent = "Duty formula is assessed per piece / each; the entered quantity is used as the number of pieces.";
  }

  function applyFormulaFallback() {
    const data = window.__lastResult;
    if (!data?.estimate || data.estimate.baseDutySupported || data.estimate.baseDuty != null) return false;

    const customsValue = Number(data?.query?.customsValue ?? document.getElementById("value")?.value);
    const quantity = Number(data?.query?.quantity ?? document.getElementById("qty")?.value);
    const enteredUnit = data?.query?.quantityUnit || document.getElementById("qtyUnit")?.value || "";
    if (!(customsValue > 0)) return false;

    const parsed = parseFormula(data?.rates?.appliedRate, customsValue, quantity, enteredUnit);
    if (!parsed) return false;

    data.estimate.baseDuty = parsed.duty;
    data.estimate.baseDutySupported = true;
    data.estimate.baseDutyReason = null;
    data.estimate.baseDutyComponents = parsed.components;
    if (parsed.inferredUnit && !data.query.quantityUnit) data.query.quantityUnit = parsed.inferredUnit;

    exposeInferredCountUnit(parsed.inferredUnit);

    const baseDutyEl = document.getElementById("baseDuty");
    if (baseDutyEl) baseDutyEl.textContent = money(parsed.duty);

    const knownAdditional = Number(data.estimate.knownAdditionalDuty ?? 0);
    const mpf = Number(data.estimate.mpf ?? 0);
    const hmf = Number(data.estimate.hmf ?? 0);
    const initialTotal = parsed.duty + knownAdditional + mpf + hmf;
    data.estimate.totalEstimatedImportCharges = initialTotal;

    const totalEl = document.getElementById("total");
    if (totalEl) totalEl.textContent = money(initialTotal);

    const notice = document.getElementById("calcNotice");
    if (notice) {
      notice.className = "notice info";
      notice.textContent = `Applicable base tariff: ${data.rates.appliedRate}. Calculated base duty: ${money(parsed.duty)} (${describeComponents(parsed.components)}). ${data.estimate.mpfNote || ""}`.trim();
    }

    return true;
  }

  function init() {
    const result = document.getElementById("result");
    if (!result) return;

    const observer = new MutationObserver(() => {
      if (!result.classList.contains("hidden")) applyFormulaFallback();
    });
    observer.observe(result, { attributes: true, attributeFilter: ["class"] });

    // Also cover cases where another PR43 layer has already made the result
    // visible before this script finished loading.
    if (!result.classList.contains("hidden")) applyFormulaFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
