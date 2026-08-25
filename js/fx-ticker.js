document.addEventListener("DOMContentLoaded", async () => {
  const ticker = document.getElementById("fxTicker");
  if (!ticker) return;

  // On pages that also have the world-time ticker, group the header and
  // both tickers into one sticky desktop/tablet block. CSS lets this
  // entire group scroll normally on mobile screens.
  const header = document.querySelector(".page-header");
  const timeTicker = document.getElementById("timeTicker");

  if (header && timeTicker && !header.closest(".sticky-header-stack")) {
    const stack = document.createElement("div");
    stack.className = "sticky-header-stack";
    header.parentNode.insertBefore(stack, header);
    stack.append(header, ticker, timeTicker);
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
