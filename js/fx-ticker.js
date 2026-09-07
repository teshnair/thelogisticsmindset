document.addEventListener("DOMContentLoaded", async () => {
  // Keep HTS calculator navigation rooted at the site root so the same link
  // works from root pages and nested/dynamic pages.
  document.querySelectorAll('a[href$="hts-duty-calculator.html"]').forEach(link => {
    link.setAttribute('href', '/hts-duty-calculator.html');
  });

  const ticker = document.getElementById("fxTicker");
  if (!ticker) return;

  // On pages that also have the world-time ticker, group the header and
  // both tickers into one sticky desktop/tablet block. CSS lets this
  // entire group scroll normally on mobile screens.
  const header = document.querySelector(".page-header");
  const timeTicker = document.getElementById("timeTicker");
  let stack = header ? header.closest(".sticky-header-stack") : null;

  if (header && timeTicker && !stack) {
    stack = document.createElement("div");
    stack.className = "sticky-header-stack";
    header.parentNode.insertBefore(stack, header);
    stack.append(header, ticker, timeTicker);
  }

  // Keep fixed overlays below the sticky header/ticker stack on larger
  // screens. The news editorial sheet uses these inline offsets; mobile
  // stays full-screen because the sticky stack scrolls normally there.
  function syncStickyOverlayOffset() {
    const largeScreen = window.matchMedia("(min-width: 769px)").matches;
    const offset = largeScreen && stack ? Math.ceil(stack.getBoundingClientRect().height) : 0;

    document.documentElement.style.setProperty("--sticky-header-stack-height", `${offset}px`);

    const editorialSheet = document.getElementById("editorialSheet");
    const sheetBackdrop = document.getElementById("sheetBackdrop");

    if (editorialSheet) {
      editorialSheet.style.top = `${offset}px`;
      editorialSheet.style.height = `calc(100% - ${offset}px)`;
    }

    if (sheetBackdrop) {
      sheetBackdrop.style.top = `${offset}px`;
    }
  }

  syncStickyOverlayOffset();
  window.addEventListener("resize", syncStickyOverlayOffset, { passive: true });

  if (stack && "ResizeObserver" in window) {
    const stickyStackObserver = new ResizeObserver(syncStickyOverlayOffset);
    stickyStackObserver.observe(stack);
  }

  // Keep the News page source and publication notices together on one line.
  const newsUpdatedLine = document.getElementById("updatedLine");
  if (newsUpdatedLine) {
    const noticeText = "Source links open the original publisher. I will attempt to publish this news section by 5:00AM Eastern every day.";
    const keepNewsNotice = () => {
      if (newsUpdatedLine.textContent.trim() !== noticeText) {
        newsUpdatedLine.textContent = noticeText;
      }
    };

    keepNewsNotice();

    const oldScheduleLine = document.getElementById("dailyNewsSchedule");
    if (oldScheduleLine) oldScheduleLine.remove();

    if ("MutationObserver" in window) {
      const newsUpdatedLineObserver = new MutationObserver(keepNewsNotice);
      newsUpdatedLineObserver.observe(newsUpdatedLine, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  const CACHE_KEY = "fxRatesCache";
  const CACHE_TIME_KEY = "fxRatesTimestamp";
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  let rates = null;
  let cachedTime = Number(localStorage.getItem(CACHE_TIME_KEY));

  // Use cached rates if they're less than 1 hour old
  if (cachedTime && Date.now() - cachedTime < CACHE_DURATION) {
    try {
      rates = JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      rates = null;
    }
  }

  // Fetch fresh rates if no valid cache
  if (!rates) {
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD");

      if (!res.ok) throw new Error("Failed to fetch FX rates");

      const data = await res.json();

      rates = data.rates;
      rates.USD = 1;

      localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
      localStorage.setItem(CACHE_TIME_KEY, Date.now());

      cachedTime = Date.now();
    } catch (err) {
      console.error(err);
      ticker.textContent = "FX data unavailable";
      return;
    }
  }

  const pairs = [
    ["USD", "EUR"],
    ["USD", "GBP"],
    ["USD", "JPY"],
    ["USD", "CNY"],
    ["USD", "INR"],
  ];

  const items = pairs
    .filter(([b, q]) => rates[b] && rates[q])
    .map(([b, q]) => {
      const value = (1 / rates[b]) * rates[q];
      return `<span>${b}/${q} ${value.toFixed(4)}</span>`;
    });

  ticker.innerHTML =
    items.join(" · ") +
    ` <span style="opacity:.6">| updated ${new Date(cachedTime).toLocaleTimeString()}</span>`;
});

// PR43 import / Chapter 99 / PGA screening layer.
// Detect the actual calculator DOM instead of relying on the browser pathname.
// This keeps the original PR43 screening logic intact while allowing Netlify
// pretty URLs and navigation from any page on the site.
const isHtsCalculatorPage = Boolean(
  document.getElementById("calcForm") &&
  document.getElementById("hts") &&
  document.getElementById("result")
);

if (isHtsCalculatorPage) {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) {
    history.replaceState(null, "", `/hts-duty-calculator.html${window.location.search}${window.location.hash}`);
  }

  if (!document.querySelector('script[data-pr43-hts-screening="true"]')) {
    const screeningScript = document.createElement("script");
    screeningScript.src = "/js/hts-import-screening-v2.js?v=20260907-8";
    screeningScript.async = false;
    screeningScript.dataset.pr43HtsScreening = "true";
    document.head.appendChild(screeningScript);
  }

  if (!document.querySelector('script[data-hts-rate-formula-fix="true"]')) {
    const formulaScript = document.createElement("script");
    formulaScript.src = "/js/hts-rate-formula-fix.js?v=20260907-1";
    formulaScript.async = false;
    formulaScript.dataset.htsRateFormulaFix = "true";
    document.head.appendChild(formulaScript);
  }

  if (!document.querySelector('script[data-hts-reverse-search="true"]')) {
    const reverseSearchScript = document.createElement("script");
    reverseSearchScript.src = "/js/hts-reverse-search.js?v=20260907-1";
    reverseSearchScript.async = false;
    reverseSearchScript.dataset.htsReverseSearch = "true";
    document.head.appendChild(reverseSearchScript);
  }

  if (!document.querySelector('script[data-hts-copy-print-fix="true"]')) {
    const copyPrintScript = document.createElement("script");
    copyPrintScript.src = "/js/hts-copy-print-fix.js?v=20260907-1";
    copyPrintScript.async = false;
    copyPrintScript.dataset.htsCopyPrintFix = "true";
    document.head.appendChild(copyPrintScript);
  }
}
