const USITC_SEARCH = "https://hts.usitc.gov/reststop/search";
const COLUMN_2 = new Set(["BY", "CU", "KP", "RU"]);

const FTA_PROGRAM: Record<string, { symbol: string; name: string }> = {
  AU: { symbol: "AU", name: "U.S.-Australia FTA" },
  BH: { symbol: "BH", name: "U.S.-Bahrain FTA" },
  CA: { symbol: "S", name: "USMCA" },
  CL: { symbol: "CL", name: "U.S.-Chile FTA" },
  CO: { symbol: "CO", name: "U.S.-Colombia TPA" },
  CR: { symbol: "P", name: "CAFTA-DR" },
  DO: { symbol: "P", name: "CAFTA-DR" },
  SV: { symbol: "P", name: "CAFTA-DR" },
  GT: { symbol: "P", name: "CAFTA-DR" },
  HN: { symbol: "P", name: "CAFTA-DR" },
  NI: { symbol: "P", name: "CAFTA-DR" },
  IL: { symbol: "IL", name: "U.S.-Israel FTA" },
  JO: { symbol: "JO", name: "U.S.-Jordan FTA" },
  KR: { symbol: "KR", name: "KORUS FTA" },
  MA: { symbol: "MA", name: "U.S.-Morocco FTA" },
  MX: { symbol: "S", name: "USMCA" },
  OM: { symbol: "OM", name: "U.S.-Oman FTA" },
  PA: { symbol: "PA", name: "U.S.-Panama TPA" },
  PE: { symbol: "PE", name: "U.S.-Peru TPA" },
  SG: { symbol: "SG", name: "U.S.-Singapore FTA" },
};

// FY2026 import user-fee rates.
const MPF_RATE = 0.003464;
const MPF_MIN = 33.58;
const MPF_MAX = 651.50;
const HMF_RATE = 0.00125;

function digits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function cleanText(v: unknown) {
  const s = String(v ?? "")
    .replace(/<\/?il>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

function fullCode(row: any) {
  const base = digits(row?.htsno);
  const suffix = digits(row?.statisticalSuffix);
  if (base.length >= 10 || !suffix) return base;
  if (base.length === 8 && suffix.length <= 2) return base + suffix.padStart(2, "0");
  return base;
}

function rowCode(row: any) {
  return digits(row?.htsno);
}

function isChapter99(row: any) {
  return rowCode(row).startsWith("99") || row?.isChapter99 === true;
}

function pickTargetRow(rows: any[], target: string) {
  const baseRows = rows.filter(r => !isChapter99(r));
  const exactFull = baseRows.filter(r => fullCode(r) === target);
  if (exactFull.length) return exactFull.sort((a, b) => Number(b.indent ?? 0) - Number(a.indent ?? 0))[0];

  const exactBase = baseRows.filter(r => rowCode(r) === target);
  if (exactBase.length) return exactBase.sort((a, b) => Number(b.indent ?? 0) - Number(a.indent ?? 0))[0];

  const prefix = baseRows.filter(r => {
    const c = rowCode(r);
    return c && (target.startsWith(c) || c.startsWith(target));
  });
  if (!prefix.length) return null;
  return prefix.sort((a, b) => rowCode(b).length - rowCode(a).length)[0];
}

function inheritedField(rows: any[], targetRow: any, field: string) {
  const target = fullCode(targetRow) || rowCode(targetRow);
  const candidates = rows
    .filter(r => !isChapter99(r))
    .map(r => ({ row: r, code: rowCode(r), value: cleanText(r?.[field]) }))
    .filter(x => x.code && x.value && target.startsWith(x.code))
    .sort((a, b) => b.code.length - a.code.length);
  return candidates[0] ?? { row: targetRow, code: rowCode(targetRow), value: null };
}

function unitMatches(rateUnit: string, userUnit: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[.\s]/g, "");
  const a = norm(rateUnit);
  const b = norm(userUnit);
  if (!a || !b) return false;
  const aliases: Record<string, string[]> = {
    kg: ["kg", "kilogram", "kilograms"],
    g: ["g", "gram", "grams"],
    lb: ["lb", "lbs", "pound", "pounds"],
    no: ["no", "number", "unit", "units", "each", "ea"],
    l: ["l", "liter", "liters", "litre", "litres"],
    m: ["m", "meter", "meters", "metre", "metres"],
    m2: ["m2", "sqm", "squaremeter", "squaremeters"],
    m3: ["m3", "cbm", "cubicmeter", "cubicmeters"],
  };
  const canonical = (x: string) => Object.entries(aliases).find(([, vals]) => vals.includes(x))?.[0] ?? x;
  return canonical(a) === canonical(b);
}

function parseRate(rateText: string | null, customsValue: number, quantity?: number, quantityUnit?: string) {
  if (!rateText) return { supported: false, duty: null, components: [], reason: "No rate text was returned." };
  const raw = rateText.replace(/(^|\s)\d+\/(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
  if (/^free\b/i.test(raw)) return { supported: true, duty: 0, components: [{ type: "free", amount: 0 }], reason: null };
  if (/see\s|varies|depending|per proof|content|maximum|minimum/i.test(raw)) {
    return { supported: false, duty: null, components: [], reason: "The published rate uses a special or conditional formula." };
  }

  const components: any[] = [];
  let duty = 0;
  let matched = false;

  const pctMatches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (pctMatches.length === 1) {
    const pct = Number(pctMatches[0][1]);
    const amount = customsValue * pct / 100;
    duty += amount;
    components.push({ type: "ad_valorem", ratePercent: pct, amount });
    matched = true;
  } else if (pctMatches.length > 1) {
    return { supported: false, duty: null, components: [], reason: "The published rate contains multiple percentage conditions." };
  }

  const dollarSpecificRegex = /\$(\d+(?:\.\d+)?)\s*\/\s*([A-Za-z0-9²³.]+)/gi;
  const centSpecificRegex = /(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*\/\s*([A-Za-z0-9²³.]+)/gi;
  const specificMatches = [
    ...[...raw.matchAll(dollarSpecificRegex)].map(m => ({ dollarsPerUnit: Number(m[1]), unit: m[2] })),
    ...[...raw.matchAll(centSpecificRegex)].map(m => ({ dollarsPerUnit: Number(m[1]) / 100, unit: m[2] })),
  ];

  if (specificMatches.length) {
    if (!(quantity && quantity > 0 && quantityUnit)) {
      return { supported: false, duty: null, components, reason: "Quantity and matching unit are required for the specific-duty component." };
    }
    for (const m of specificMatches) {
      if (!unitMatches(m.unit, quantityUnit)) {
        return { supported: false, duty: null, components, reason: `Published rate is per ${m.unit}; entered quantity unit is ${quantityUnit}.` };
      }
      const amount = m.dollarsPerUnit * quantity;
      duty += amount;
      components.push({ type: "specific", dollarsPerUnit: m.dollarsPerUnit, unit: m.unit, quantity, amount });
      matched = true;
    }
  }

  const stripped = raw
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "")
    .replace(dollarSpecificRegex, "")
    .replace(centSpecificRegex, "")
    .replace(/[+;,()\s-]/g, "");

  if (!matched || (stripped && !/^advalorem$/i.test(stripped))) {
    return { supported: false, duty: null, components, reason: "This duty formula cannot be safely converted to a dollar amount automatically." };
  }

  return { supported: true, duty, components, reason: null };
}

function symbolRegex(symbol: string) {
  return new RegExp(`(^|[\\s,(;])${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[+*])?(?=[\\s,);]|$)`, "i");
}

function preferentialRateForCountry(special: string | null, country: string) {
  const program = FTA_PROGRAM[country];
  if (!special || !program) return { program, rate: null };
  const re = symbolRegex(program.symbol);
  if (!re.test(special)) return { program, rate: null };

  const segments = special.split(/;(?=\s*[^)])/);
  for (const seg of segments) {
    if (re.test(seg)) {
      const m = seg.match(/^\s*(Free|[^()]*?(?:%|\/\s*[A-Za-z0-9²³.]+))/i);
      if (m) return { program, rate: m[1].trim() };
    }
  }

  const prefix = special.split("(")[0].trim();
  return { program, rate: prefix || null };
}

function flattenFootnotes(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenFootnotes);
  if (typeof value === "object") return Object.values(value).flatMap(flattenFootnotes);
  return [];
}

function chapter99Refs(texts: string[]) {
  const refs = new Set<string>();
  for (const t of texts) {
    for (const m of String(t).matchAll(/\b99\d{2}(?:\.\d{2}){1,3}\b/g)) refs.add(m[0]);
  }
  return [...refs];
}

async function fetchUSITC(query: string) {
  const url = new URL(USITC_SEARCH);
  url.searchParams.set("keyword", query);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!res.ok) throw new Error(`USITC returned HTTP ${res.status}`);

  const data: any = await res.json();
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data)
        ? data.data
        : null;

  if (!rows) throw new Error("USITC returned an unexpected response format");
  return rows;
}

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await req.json();
    const hts = digits(body.hts);
    const country = String(body.country ?? "").toUpperCase().trim();
    const customsValue = Number(body.customsValue);
    const mode = String(body.mode ?? "air").toLowerCase();
    const quantity = body.quantity === "" || body.quantity == null ? undefined : Number(body.quantity);
    const quantityUnit = cleanText(body.quantityUnit) ?? undefined;
    const ftaQualified = body.ftaQualified === true;

    if (hts.length < 4 || hts.length > 10) return Response.json({ error: "Enter a 4- to 10-digit HTS number." }, { status: 400 });
    if (!/^[A-Z]{2}$/.test(country)) return Response.json({ error: "Select a country of origin." }, { status: 400 });
    if (!Number.isFinite(customsValue) || customsValue <= 0) return Response.json({ error: "Enter a customs value greater than zero." }, { status: 400 });
    if (!new Set(["ocean", "air", "land"]).has(mode)) return Response.json({ error: "Invalid mode of transport." }, { status: 400 });

    const rows = await fetchUSITC(hts);
    const selected = pickTargetRow(rows, hts);
    if (!selected) return Response.json({ error: "No matching HTS line was found in the current USITC schedule." }, { status: 404 });

    const generalSource = inheritedField(rows, selected, "general");
    const specialSource = inheritedField(rows, selected, "special");
    const otherSource = inheritedField(rows, selected, "other");
    const additionalSource = inheritedField(rows, selected, "additionalDuties");

    const column2 = COLUMN_2.has(country);
    let appliedRateText = column2 ? otherSource.value : generalSource.value;
    let appliedBasis = column2 ? "Column 2" : "Column 1 General";

    const pref = preferentialRateForCountry(specialSource.value, country);
    let preferenceUsed = false;
    if (!column2 && ftaQualified && pref.rate) {
      appliedRateText = pref.rate;
      appliedBasis = `${pref.program?.name ?? "Special tariff program"} (claimed as qualifying)`;
      preferenceUsed = true;
    }

    const baseCalc = parseRate(appliedRateText, customsValue, quantity, quantityUnit);
    const additionalCalc = parseRate(additionalSource.value, customsValue, quantity, quantityUnit);
    const additionalIncluded = Boolean(additionalSource.value && additionalCalc.supported);

    let mpf = Math.min(MPF_MAX, Math.max(MPF_MIN, customsValue * MPF_RATE));
    let mpfNote = "FY2026 formal-entry MPF: 0.3464%, subject to $33.58 minimum and $651.50 maximum.";
    if (preferenceUsed && ["CA", "MX"].includes(country)) {
      mpf = 0;
      mpfNote = "USMCA-qualified goods are treated here as MPF-exempt; confirm the claim requirements on the entry.";
    }

    const hmf = mode === "ocean" ? customsValue * HMF_RATE : 0;
    const footnotes = [...new Set(flattenFootnotes(selected.footnotes).map(t => cleanText(t)).filter(Boolean))] as string[];
    const refs = chapter99Refs(footnotes);
    const ch99Rows = rows.filter(isChapter99).slice(0, 25).map(r => ({
      hts: cleanText(r.htsno),
      description: cleanText(r.description),
      general: cleanText(r.general),
      special: cleanText(r.special),
      other: cleanText(r.other),
      additionalDuties: cleanText(r.additionalDuties),
    }));

    const baseDuty = baseCalc.supported ? Number(baseCalc.duty ?? 0) : null;
    const additionalDuty = additionalIncluded ? Number(additionalCalc.duty ?? 0) : 0;
    const estimatedTotal = baseDuty == null ? null : baseDuty + additionalDuty + mpf + hmf;

    return Response.json({
      query: { hts, country, customsValue, mode, quantity: quantity ?? null, quantityUnit: quantityUnit ?? null, ftaQualified },
      classification: {
        hts: fullCode(selected) || rowCode(selected),
        displayHts: cleanText(selected.htsno),
        statisticalSuffix: cleanText(selected.statisticalSuffix),
        description: cleanText(selected.description),
        units: Array.isArray(selected.units) ? selected.units : [],
        effectivePeriod: selected.effectivePeriod ?? null,
      },
      rates: {
        general: generalSource.value,
        special: specialSource.value,
        column2: otherSource.value,
        additionalDutiesField: additionalSource.value,
        appliedRate: appliedRateText,
        appliedBasis,
        potentialPreference: pref.program ? { ...pref.program, publishedRate: pref.rate, qualificationRequired: true } : null,
      },
      estimate: {
        baseDuty,
        baseDutySupported: baseCalc.supported,
        baseDutyReason: baseCalc.reason,
        baseDutyComponents: baseCalc.components,
        additionalDutyIncluded: additionalIncluded ? additionalDuty : null,
        additionalDutyFieldSupported: additionalCalc.supported,
        mpf,
        mpfNote,
        hmf,
        hmfRatePercent: mode === "ocean" ? 0.125 : 0,
        totalEstimatedImportCharges: estimatedTotal,
        totalScope: "Base HTS duty + any parseable per-line additionalDuties field + MPF + HMF. Unresolved Chapter 99, AD/CVD, excise, quota, and special-program conditions are excluded.",
      },
      review: {
        footnotes,
        chapter99References: refs,
        chapter99Rows: ch99Rows,
        additionalTariffReviewRequired: refs.length > 0 || ch99Rows.length > 0 || Boolean(additionalSource.value && !additionalCalc.supported),
        adCvdNotIncluded: true,
        stateLocalTaxNotIncluded: true,
      },
      source: {
        name: "U.S. International Trade Commission Harmonized Tariff Schedule",
        endpoint: USITC_SEARCH,
        publicUrl: "https://hts.usitc.gov/",
        retrievedAt: new Date().toISOString(),
      },
      disclaimer: "Screening estimate only. HTS classification, origin, eligibility for preferential treatment, Chapter 99 measures, exclusions, quotas, antidumping/countervailing duties, excise taxes, and entry-specific facts can change the amount legally owed. Verify before filing an entry.",
    }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" },
    });
  } catch (err: any) {
    console.error("HTS duty lookup failed", err);
    return Response.json({
      error: "The live USITC lookup could not be completed. Please try again.",
      detail: err?.message ?? null,
    }, { status: 502 });
  }
};

export const config = {
  path: "/api/hts-duty",
  method: "POST",
};