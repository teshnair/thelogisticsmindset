(() => {
  "use strict";

  if (!document.querySelector('script[data-reference-dropdown]')) {
    const navScript = document.createElement("script");
    navScript.src = "js/reference-dropdown.js";
    navScript.defer = true;
    navScript.dataset.referenceDropdown = "true";
    document.head.appendChild(navScript);
  }
})();

(() => {
  "use strict";

  const BL_PREFIX_TO_CARRIER = {
    MAEU: "maersk", SEJJ: "maersk", MCPU: "maersk", SEAU: "maersk",
    MSCU: "msc", MEDU: "msc", MESU: "msc",
    CMDU: "cma-cgm", CGMU: "cma-cgm",
    COSU: "cosco", COEU: "cosco", CCMJ: "cosco",
    HLCU: "hapag-lloyd",
    ONEY: "one",
    EGLV: "evergreen", EVRG: "evergreen", EISU: "evergreen",
    HDMU: "hmm",
    YMLU: "yang-ming", YMJA: "yang-ming",
    ZIMU: "zim",
    OOLU: "oocl",
    WHLC: "wan-hai",
    PCIU: "pil", PABV: "pil",
    "12PD": "sitc",
    KMTC: "kmtc", KMTU: "kmtc",
    SKLU: "sinokor",
    TSYN: "ts-lines", "13DF": "ts-lines",
    MATS: "matson",
    CHVW: "swire",
    GRIU: "grimaldi",
    ACLU: "acl",
    GSLU: "gold-star", GOSU: "gold-star",
    ESPU: "emirates-shipping",
    RCLU: "rcl", REGU: "rcl",
    NSRU: "namsung",
    "12IH": "sinotrans",
    FESO: "fesco"
  };

  function normalize(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function detectCarrier(reference) {
    const value = normalize(reference);
    const prefixes = Object.keys(BL_PREFIX_TO_CARRIER).sort((a, b) => b.length - a.length);
    const prefix = prefixes.find(code => value.startsWith(code));
    return prefix ? { prefix, carrierId: BL_PREFIX_TO_CARRIER[prefix] } : null;
  }

  function applyDetection() {
    const typeEl = document.getElementById("oceanReferenceType");
    const referenceEl = document.getElementById("oceanReference");
    const carrierEl = document.getElementById("oceanCarrier");
    if (!typeEl || !referenceEl || !carrierEl) return;

    const explicitBl = typeEl.value === "bl";
    const autoBl = typeEl.value === "auto" && !/^[A-Z]{4}\d{7}$/.test(normalize(referenceEl.value));
    if (!explicitBl && !autoBl) return;

    const match = detectCarrier(referenceEl.value);
    if (!match) return;

    const option = carrierEl.querySelector(`option[value="${match.carrierId}"]`);
    if (!option) return;

    if (carrierEl.value !== match.carrierId) {
      carrierEl.value = match.carrierId;
      carrierEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function bind() {
    const typeEl = document.getElementById("oceanReferenceType");
    const referenceEl = document.getElementById("oceanReference");
    if (!typeEl || !referenceEl) return;

    referenceEl.addEventListener("input", applyDetection);
    typeEl.addEventListener("change", applyDetection);
    applyDetection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
