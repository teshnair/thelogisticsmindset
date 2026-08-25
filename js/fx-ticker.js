document.addEventListener("DOMContentLoaded", async () => {
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

  // Show the intended daily publication target without presenting it as a guarantee.
  const newsUpdatedLine = document.getElementById("updatedLine");
  if (newsUpdatedLine) {
    const sourceLineText = "Source links open the original publisher.";
    const keepSourceLinkNoticeOnly = () => {
      const currentText = newsUpdatedLine.textContent.trim();
      if (
        currentText.startsWith("Global scan last updated") ||
        currentText === "The automated global scan is being initialized."
      ) {
        newsUpdatedLine.textContent = sourceLineText;
      }
    };

    keepSourceLinkNoticeOnly();

    if ("MutationObserver" in window) {
      const newsUpdatedLineObserver = new MutationObserver(keepSourceLinkNoticeOnly);
      newsUpdatedLineObserver.observe(newsUpdatedLine, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  if (newsUpdatedLine && !document.getElementById("dailyNewsSchedule")) {
    const scheduleLine = document.createElement("div");
    scheduleLine.id = "dailyNewsSchedule";
    scheduleLine.className = "updated-line";
    scheduleLine.textContent = "I will attempt to publish this news section by 5:00AM Eastern every day.";
    newsUpdatedLine.insertAdjacentElement("afterend", scheduleLine);
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
