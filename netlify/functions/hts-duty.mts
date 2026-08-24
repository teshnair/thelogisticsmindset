const USITC_SEARCH = "https://hts.usitc.gov/reststop/search";
const COLUMN_2 = new Set(["BY", "CU", "KP", "RU"]);
const BUILD_VERSION = "2026-08-24-sec232-v5";

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

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/<\/?il>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function formatHts(value: unknown): string | null {
  const d = digits(value);
  if (!d) return null;
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  if (d.length <= 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8, 10)}`;
}

function rowCode(row: any): string {
  return digits(row?.htsno);
}

function fullCode(row: any): string {
  const base = rowCode(row);
  const suffix = digits(row?.statisticalSuffix);

  if (base.length >= 10 || !suffix) return base;
  if (base.length === 8 && suffix.length <= 2) {
    return base + suffix.padStart(2, "0");
  }
  return base;
}

function isChapter99(row: any): boolean {
  return rowCode(row).startsWith("99") || row?.isChapter99 === true;
}

function dedupeRows(rows: any[]): any[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      rowCode(row),
      digits(row?.statisticalSuffix),
      cleanText(row?.description),
      row?.indent ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchUSITC(query: string): Promise<any[]> {
  const url = new URL(USITC_SEARCH);
  url.searchParams.set("keyword", query);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`USITC returned HTTP ${response.status}`);
  }

  const raw = await response.text();
  if (!raw.trim()) return [];

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("USITC returned a non-JSON response");
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function validSearchPrefix(target: string): string {
  if (target.length >= 10) return target.slice(0, 10);
  if (target.length >= 8) return target.slice(0, 8);
  if (target.length >= 6) return target.slice(0, 6);
  return target.slice(0, 4);
}

async function fetchSearchRows(target: string): Promise<any[]> {
  const attempts = [
    validSearchPrefix(target),
    target.length > 8 ? target.slice(0, 8) : "",
    target.length > 6 ? target.slice(0, 6) : "",
    target.length > 4 ? target.slice(0, 4) : "",
  ].filter(Boolean);

  const rows: any[] = [];
  for (const query of [...new Set(attempts)]) {
    try {
      rows.push(...await fetchUSITC(query));
      if (searchSuggestions(rows, target).length >= 10) break;
    } catch {
      // Broaden to the next prefix instead of exposing a transient API failure.
    }
  }
  return dedupeRows(rows);
}

async function fetchHierarchy(target: string): Promise<any[]> {
  const prefixes = new Set<string>();
  [4, 6, 8, 10].forEach((length) => {
    if (target.length >= length) prefixes.add(target.slice(0, length));
  });
  prefixes.add(validSearchPrefix(target));

  const settled = await Promise.allSettled(
    [...prefixes].map((prefix) => fetchUSITC(prefix))
  );

  return dedupeRows(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    )
  );
}

function pickTargetRow(rows: any[], target: string): any | null {
  const baseRows = rows.filter((row) => !isChapter99(row));

  const exactFull = baseRows.filter((row) => fullCode(row) === target);
  if (exactFull.length) {
    return exactFull.sort(
      (a, b) => Number(b?.indent ?? 0) - Number(a?.indent ?? 0)
    )[0];
  }

  const exactBase = baseRows.filter((row) => rowCode(row) === target);
  if (exactBase.length) {
    return exactBase.sort(
      (a, b) => Number(b?.indent ?? 0) - Number(a?.indent ?? 0)
    )[0];
  }

  return null;
}

function inheritedField(
  rows: any[],
  target: string,
  targetRow: any,
  field: string
): { row: any; code: string; value: string | null } {
  const candidates = rows
    .filter((row) => !isChapter99(row))
    .map((row) => ({
      row,
      code: rowCode(row),
      value: cleanText(row?.[field]),
    }))
    .filter(
      (item) => item.code && item.value && target.startsWith(item.code)
    )
    .sort(
      (a, b) =>
        b.code.length - a.code.length ||
        Number(b.row?.indent ?? 0) - Number(a.row?.indent ?? 0)
    );

  return (
    candidates[0] ?? {
      row: targetRow,
      code: rowCode(targetRow),
      value: cleanText(targetRow?.[field]),
    }
  );
}

function buildClassificationPath(rows: any[], target: string, selected: any) {
  const candidates = rows
    .filter((row) => !isChapter99(row))
    .map((row) => ({
      code: rowCode(row),
      full: fullCode(row),
      description: cleanText(row?.description),
      indent: Number(row?.indent ?? 0),
    }))
    .filter(
      (item) =>
        item.code &&
        item.description &&
        target.startsWith(item.code) &&
        (item.full || item.code) !== target
    )
    .sort(
      (a, b) =>
        a.code.length - b.code.length || a.indent - b.indent
    );

  const seen = new Set<string>();
  const path = candidates.filter((item) => {
    const key = `${item.code}|${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Some HTS headings do not appear as a standalone 4-digit API row.
  // In that case use the broadest returned parent description for the heading.
  const broadest = path[0] ?? null;
  const headingRow =
    path.find((item) => item.code.length === 4) ?? broadest;

  const subheadingRow =
    [...path]
      .filter((item) => item.code.length >= 6 && item.code.length <= 8)
      .sort((a, b) => b.code.length - a.code.length || b.indent - a.indent)[0] ??
    broadest;

  return {
    heading: headingRow
      ? {
          hts: target.slice(0, 4),
          displayHts: formatHts(target.slice(0, 4)),
          description: headingRow.description,
        }
      : null,
    subheading: subheadingRow
      ? {
          hts: subheadingRow.code,
          displayHts: formatHts(subheadingRow.code),
          description: subheadingRow.description,
        }
      : null,
    path: path.map((item) => ({
      hts: item.code,
      displayHts: formatHts(item.code),
      description: item.description,
    })),
    statistical: {
      hts: fullCode(selected) || rowCode(selected),
      displayHts: formatHts(fullCode(selected) || rowCode(selected)),
      description: cleanText(selected?.description),
    },
  };
}

function searchSuggestions(rows: any[], query: string) {
  const target = digits(query);
  const seen = new Set<string>();

  return rows
    .filter((row) => !isChapter99(row))
    .map((row) => ({
      code: fullCode(row) || rowCode(row),
      description: cleanText(row?.description),
      indent: Number(row?.indent ?? 0),
    }))
    .filter(
      (item) =>
        item.code &&
        item.description &&
        item.code.startsWith(target)
    )
    .sort(
      (a, b) =>
        a.code.localeCompare(b.code) || a.indent - b.indent
    )
    .filter((item) => {
      const key = `${item.code}|${item.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((item) => ({
      hts: formatHts(item.code),
      code: item.code,
      description: item.description,
    }));
}

function unitMatches(rateUnit: string, userUnit: string): boolean {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[.\s]/g, "");

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

  const canonical = (value: string) => {
    const normalized = normalize(value);
    return (
      Object.entries(aliases).find(([, values]) =>
        values.includes(normalized)
      )?.[0] ?? normalized
    );
  };

  return canonical(rateUnit) === canonical(userUnit);
}

function parseRate(
  rateText: string | null,
  customsValue: number,
  quantity?: number,
  quantityUnit?: string
) {
  if (!rateText) {
    return {
      supported: false,
      duty: null,
      components: [],
      reason: "No applicable duty rate was returned.",
    };
  }

  const raw = rateText
    .replace(/(^|\s)\d+\/(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^free\b/i.test(raw)) {
    return {
      supported: true,
      duty: 0,
      components: [{ type: "free", amount: 0 }],
      reason: null,
    };
  }

  if (/see\s|varies|depending|per proof|content|maximum|minimum/i.test(raw)) {
    return {
      supported: false,
      duty: null,
      components: [],
      reason: "The published rate uses a special or conditional formula.",
    };
  }

  const components: any[] = [];
  let duty = 0;
  let matched = false;

  const percentMatches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (percentMatches.length === 1) {
    const percent = Number(percentMatches[0][1]);
    const amount = (customsValue * percent) / 100;
    duty += amount;
    components.push({
      type: "ad_valorem",
      ratePercent: percent,
      amount,
    });
    matched = true;
  } else if (percentMatches.length > 1) {
    return {
      supported: false,
      duty: null,
      components: [],
      reason: "The published rate contains multiple percentage conditions.",
    };
  }

  const dollarSpecificRegex =
    /\$(\d+(?:\.\d+)?)\s*\/\s*([A-Za-z0-9²³.]+)/gi;
  const centSpecificRegex =
    /(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*\/\s*([A-Za-z0-9²³.]+)/gi;

  const specificMatches = [
    ...[...raw.matchAll(dollarSpecificRegex)].map((match) => ({
      dollarsPerUnit: Number(match[1]),
      unit: match[2],
    })),
    ...[...raw.matchAll(centSpecificRegex)].map((match) => ({
      dollarsPerUnit: Number(match[1]) / 100,
      unit: match[2],
    })),
  ];

  if (specificMatches.length) {
    if (!(quantity && quantity > 0 && quantityUnit)) {
      return {
        supported: false,
        duty: null,
        components,
        reason:
          "Quantity and matching unit are required for the specific-duty component.",
      };
    }

    for (const match of specificMatches) {
      if (!unitMatches(match.unit, quantityUnit)) {
        return {
          supported: false,
          duty: null,
          components,
          reason: `Published rate is per ${match.unit}; entered quantity unit is ${quantityUnit}.`,
        };
      }

      const amount = match.dollarsPerUnit * quantity;
      duty += amount;
      components.push({
        type: "specific",
        dollarsPerUnit: match.dollarsPerUnit,
        unit: match.unit,
        quantity,
        amount,
      });
      matched = true;
    }
  }

  const stripped = raw
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "")
    .replace(dollarSpecificRegex, "")
    .replace(centSpecificRegex, "")
    .replace(/[+;,()\s-]/g, "");

  if (!matched || (stripped && !/^advalorem$/i.test(stripped))) {
    return {
      supported: false,
      duty: null,
      components,
      reason:
        "This duty formula cannot be safely converted to a dollar amount automatically.",
    };
  }

  return { supported: true, duty, components, reason: null };
}

function symbolRegex(symbol: string): RegExp {
  return new RegExp(
    `(^|[\\s,(;])${symbol.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )}(?:[+*])?(?=[\\s,);]|$)`,
    "i"
  );
}

function preferentialRateForCountry(
  special: string | null,
  country: string
) {
  const program = FTA_PROGRAM[country];
  if (!special || !program) return { program, rate: null };

  const regex = symbolRegex(program.symbol);
  if (!regex.test(special)) return { program, rate: null };

  const segments = special.split(/;(?=\s*[^)])/);
  for (const segment of segments) {
    if (regex.test(segment)) {
      const match = segment.match(
        /^\s*(Free|[^()]*?(?:%|\/\s*[A-Za-z0-9²³.]+))/i
      );
      if (match) return { program, rate: match[1].trim() };
    }
  }

  const prefix = special.split("(")[0].trim();
  return { program, rate: prefix || null };
}

function flattenFootnotes(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenFootnotes);
  if (typeof value === "object") {
    return Object.values(value).flatMap(flattenFootnotes);
  }
  return [];
}

function chapter99Refs(texts: string[]): string[] {
  const refs = new Set<string>();
  for (const text of texts) {
    for (const match of String(text).matchAll(
      /\b99\d{2}(?:\.\d{2}){1,3}\b/g
    )) {
      refs.add(match[0]);
    }
  }
  return [...refs];
}


// Section 232 steel coverage under the April 6, 2026 U.S. Note 16 structure.
// For the lists below, 9903.82.02 generally adds 50% to the full customs value.
// Russia uses 9903.82.14 for these same steel categories, also at 50%.
const SECTION_232_STEEL_PREFIXES = [
  // U.S. Note 16(c)(iii) - articles of steel
  "7206","7207","7208","7209","7210","7211","7212","7213","7214","7215",
  "72161000","72162100","72162200","72163100","72163200","72163300",
  "72164000","72165000","72169900",
  "7217","7218","7219","7220","7221","7222","7223","7224","7225",
  "7226","7227","7228","7229",
  "73011000","730210","73024000","730290","7304","7305","7306",

  // U.S. Note 16(c)(iv) - derivative steel articles
  "7216910010","73012010","73012050","73023000",
  "73071930","73071990","73072110","73072150","73072210","73072250","73072300","73072900",
  "73079110","73079130","73079150","73079230","73079290","73079330","73079360","73079390",
  "73079910","73079930","73079950","73081000","73082000","73083010","73083050","73084000",
  "73089030","73089060","73089070","73089095","73090000",
  "73101000","73102100","73102900","73110000",
  "73121005","73121010","73121020","73121030","73121050","73121060","73121070","73121080","73121090",
  "73129000","73130000",
  "73141210","73141220","73141230","73141260","73141290",
  "73141410","73141420","73141430","73141460","73141490","73141901","73142000",
  "73143110","73143150","73143900","73144100","73144200","73144930","73144960","73145000",
  "73151100","73151200","73151900","73152010","73152050","73158100","73158210","73158230",
  "73158250","73158270","73158910","73158930","73158950","73159000","73160000",
  "73170010","73170020","73170030","73170055","73170065","73170075",
  "73181100","73181200","73181300","73181410","73181450","73181520","73181540","73181550",
  "73181560","73181580","73181600","73181900","73182100","73182200","73182300","73182400","73182900",
  "73194020","73194030","73194050","73199010","73199090",
  "73201030","73201060","73201090","73202010","7320205045","73209010","73209050",
  "7325100010","7325100020","7325100025","7325100030","7325100080",
  "73259100","73259910","73259950","73261100","73261900","7326200090",
  "73269010","73269025","73269060","7326908605","7326908610","7326908630",
  "7326908635","7326908645","7326908688"
];

function isSection232Steel(hts: string): boolean {
  const code = digits(hts);
  return SECTION_232_STEEL_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function section232Measures(
  hts: string,
  country: string,
  customsValue: number
): any[] {
  if (!isSection232Steel(hts)) return [];

  const chapter99 = country === "RU" ? "9903.82.14" : "9903.82.02";
  const ratePercent = 50;

  return [{
    program: "Section 232",
    hts: chapter99,
    description:
      "Steel article or derivative steel article covered by U.S. Note 16(c)(iii) or (iv).",
    applicableRate: "+50%",
    ratePercent,
    amount: customsValue * ratePercent / 100,
    rawRate: "The duty provided in the applicable subheading + 50%",
    tariffTreatment: "Section 232 steel tariff on full customs value",
    automaticallyIncludedInTotal: true,
    ruleSource:
      country === "RU"
        ? "U.S. Note 16(c)(iii)-(iv); heading 9903.82.14"
        : "U.S. Note 16(c)(iii)-(iv); heading 9903.82.02"
  }];
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action ?? "calculate").toLowerCase();
    const hts = digits(body?.hts);

    if (action === "search") {
      if (hts.length < 4 || hts.length > 10) {
        return Response.json({ suggestions: [] });
      }

      const rows = await fetchSearchRows(hts);
      return Response.json(
        { suggestions: searchSuggestions(rows, hts) },
        {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=3600",
          },
        }
      );
    }

    const country = String(body?.country ?? "").toUpperCase().trim();
    const customsValue = Number(body?.customsValue);
    const mode = String(body?.mode ?? "air").toLowerCase();
    const quantity =
      body?.quantity === "" || body?.quantity == null
        ? undefined
        : Number(body.quantity);
    const quantityUnit = cleanText(body?.quantityUnit) ?? undefined;
    const ftaQualified = body?.ftaQualified === true;

    if (hts.length < 4 || hts.length > 10) {
      return Response.json(
        { error: "Enter a 4- to 10-digit HTS number." },
        { status: 400 }
      );
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      return Response.json(
        { error: "Select a country of origin." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(customsValue) || customsValue <= 0) {
      return Response.json(
        { error: "Enter a customs value greater than zero." },
        { status: 400 }
      );
    }
    if (!new Set(["ocean", "air", "land"]).has(mode)) {
      return Response.json(
        { error: "Invalid mode of transport." },
        { status: 400 }
      );
    }

    const rows = await fetchHierarchy(hts);
    const selected = pickTargetRow(rows, hts);

    if (!selected) {
      const suggestionRows = rows.length ? rows : await fetchSearchRows(hts);
      return Response.json(
        {
          error:
            "That exact HTS number was not found in the current USITC schedule.",
          suggestions: searchSuggestions(suggestionRows, hts),
        },
        { status: 404 }
      );
    }

    const selectedCode = fullCode(selected) || rowCode(selected);

    const generalSource = inheritedField(
      rows,
      selectedCode,
      selected,
      "general"
    );
    const specialSource = inheritedField(
      rows,
      selectedCode,
      selected,
      "special"
    );
    const column2Source = inheritedField(
      rows,
      selectedCode,
      selected,
      "other"
    );
    const additionalSource = inheritedField(
      rows,
      selectedCode,
      selected,
      "additionalDuties"
    );

    const usesColumn2 = COLUMN_2.has(country);
    let appliedRate = usesColumn2
      ? column2Source.value
      : generalSource.value;
    let appliedBasis = usesColumn2
      ? "Column 2"
      : "Column 1 General";
    let appliedRateSource = usesColumn2
      ? column2Source.code
      : generalSource.code;

    const preference = preferentialRateForCountry(
      specialSource.value,
      country
    );
    let preferenceUsed = false;

    if (!usesColumn2 && ftaQualified && preference.rate) {
      appliedRate = preference.rate;
      appliedBasis = `${
        preference.program?.name ?? "Special tariff program"
      } (qualifying claim)`;
      appliedRateSource = specialSource.code;
      preferenceUsed = true;
    }

    const baseCalculation = parseRate(
      appliedRate,
      customsValue,
      quantity,
      quantityUnit
    );

    const additionalCalculation = parseRate(
      additionalSource.value,
      customsValue,
      quantity,
      quantityUnit
    );
    const additionalIncluded = Boolean(
      additionalSource.value && additionalCalculation.supported
    );

    let mpf = Math.min(
      MPF_MAX,
      Math.max(MPF_MIN, customsValue * MPF_RATE)
    );
    let mpfNote =
      "FY2026 formal-entry MPF: 0.3464%, subject to $33.58 minimum and $651.50 maximum.";

    if (preferenceUsed && ["CA", "MX"].includes(country)) {
      mpf = 0;
      mpfNote =
        "USMCA-qualified goods are treated here as MPF-exempt; confirm the claim requirements on the entry.";
    }

    const hmf = mode === "ocean" ? customsValue * HMF_RATE : 0;

    const footnotes = [
      ...new Set(
        rows
          .flatMap((row) => flattenFootnotes(row?.footnotes))
          .map((text) => cleanText(text))
          .filter(Boolean)
      ),
    ] as string[];

    const chapter99References = chapter99Refs(footnotes);
    const chapter99Rows = rows
      .filter(isChapter99)
      .slice(0, 25)
      .map((row) => ({
        hts: cleanText(row?.htsno),
        description: cleanText(row?.description),
        general: cleanText(row?.general),
        additionalDuties: cleanText(row?.additionalDuties),
      }));

    // Do not rely on base-HTS footnotes to discover Section 232. The legal
    // product lists are in Chapter 99 U.S. Note 16, so test the entered HTS
    // directly against those lists.
    const ruleBasedMeasures = section232Measures(
      hts,
      country,
      customsValue
    );
    const applicableAdditionalMeasures = [...ruleBasedMeasures];

    const baseDuty = baseCalculation.supported
      ? Number(baseCalculation.duty ?? 0)
      : null;
    const additionalDuty = additionalIncluded
      ? Number(additionalCalculation.duty ?? 0)
      : 0;

    const ruleBasedAdditionalDuty = ruleBasedMeasures
      .filter((measure: any) => measure.automaticallyIncludedInTotal === true)
      .reduce(
        (sum: number, measure: any) => sum + Number(measure.amount ?? 0),
        0
      );

    const knownAdditionalDuty = additionalDuty + ruleBasedAdditionalDuty;

    const totalEstimatedImportCharges =
      baseDuty == null
        ? null
        : baseDuty + knownAdditionalDuty + mpf + hmf;

    const hierarchy = buildClassificationPath(
      rows,
      selectedCode,
      selected
    );

    return Response.json(
      {
        query: {
          hts,
          country,
          customsValue,
          mode,
          quantity: quantity ?? null,
          quantityUnit: quantityUnit ?? null,
          ftaQualified,
        },
        classification: {
          hts: selectedCode,
          displayHts: formatHts(selectedCode),
          description: cleanText(selected?.description),
          units: Array.isArray(selected?.units) ? selected.units : [],
          heading: hierarchy.heading,
          subheading: hierarchy.subheading,
          path: hierarchy.path,
          statistical: hierarchy.statistical,
        },
        rates: {
          appliedRate,
          appliedBasis,
          appliedRateSourceHts: formatHts(appliedRateSource),
          rateInherited: Boolean(
            appliedRateSource && appliedRateSource.length < selectedCode.length
          ),
          potentialPreference: preference.program
            ? {
                ...preference.program,
                publishedRate: preference.rate,
                qualificationRequired: true,
              }
            : null,
        },
        estimate: {
          baseDuty,
          baseDutySupported: baseCalculation.supported,
          baseDutyReason: baseCalculation.reason,
          baseDutyComponents: baseCalculation.components,
          additionalDutyIncluded: additionalIncluded
            ? additionalDuty
            : null,
          ruleBasedAdditionalDuty,
          knownAdditionalDuty,
          section232Duty: ruleBasedAdditionalDuty,
          mpf,
          mpfNote,
          hmf,
          hmfRatePercent: mode === "ocean" ? 0.125 : 0,
          totalEstimatedImportCharges,
        },
        review: {
          footnotes,
          chapter99References,
          chapter99Rows,
          applicableAdditionalMeasures,
          additionalTariffReviewRequired:
            applicableAdditionalMeasures.length > 0 ||
            chapter99References.length > 0 ||
            chapter99Rows.length > 0 ||
            Boolean(
              additionalSource.value && !additionalCalculation.supported
            ) ||
            country === "CN",
          chinaOrigin: country === "CN",
          adCvdNotIncluded: true,
        },
        source: {
          name:
            "U.S. International Trade Commission Harmonized Tariff Schedule",
          publicUrl: "https://hts.usitc.gov/",
          retrievedAt: new Date().toISOString(),
          buildVersion: BUILD_VERSION,
          section232RuleBasis:
            "2026 U.S. Note 16(c)(iii)-(iv); headings 9903.82.02 / 9903.82.14",
        },
        diagnostics: {
          buildVersion: BUILD_VERSION,
          enteredHts: hts,
          selectedCode,
          section232Matched: isSection232Steel(hts),
          section232MeasureCount: ruleBasedMeasures.length,
        },
        disclaimer:
          "Screening estimate only. Verify classification, origin, Chapter 99 measures, exclusions, quotas, AD/CVD and entry-specific facts before filing.",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=3600",
        },
      }
    );
  } catch (error: any) {
    console.error("HTS duty lookup failed", error);
    return Response.json(
      {
        error:
          "The live USITC lookup could not be completed. Please try again.",
        detail: error?.message ?? null,
      },
      { status: 502 }
    );
  }
};

export const config = {
  path: "/api/hts-duty",
  method: "POST",
};
