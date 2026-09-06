(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const COVERED_7321 = new Set([
    "73211110","73211130","73211160","73211200","73211900",
    "73218110","73218150","73218210","73218250","73218900",
    "73219010","73219020","73219040","73219050","73219060"
  ]);

  const digits = value => String(value ?? "").replace(/\D/g, "");
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function currentCode() {
    return digits(document.getElementById("hts")?.value || "");
  }

  function currentCountry() {
    return String(document.getElementById("country")?.value || "").toUpperCase();
  }

  function is7321Family(code) {
    return code.startsWith("7321");
  }

  function isCovered(code) {
    return code.length >= 8 && COVERED_7321.has(code.slice(0, 8));
  }

  function revealRelevantQuestions() {
    const code = currentCode();
    if (!is7321Family(code)) return;

    const meltSelect = document.getElementById("meltPourCountry");
    const meltWrap = meltSelect?.closest("div");
    if (meltWrap) meltWrap.style.display = "";

    if (!isCovered(code)) return;

    const origin = currentCountry();
    const melt = String(meltSelect?.value || origin).toUpperCase();
    const box = document.getElementById("extendedScreeningInputs");
    if (!box) return;

    let threshold = null;
    let id = null;
    let copy = null;

    if (melt === "US") {
      threshold = "85%";
      id = "steelContentQualifier7321";
      copy = "At least 85% of the steel content is composed of steel melted and poured in the United States";
    } else if (origin === "GB" && melt === "GB") {
      threshold = "95%";
      id = "steelContentQualifier7321";
      copy = "At least 95% of the steel content was melted and poured in the United Kingdom";
    }

    if (!threshold) {
      if (box.dataset.sec2327321 === "1") {
        box.classList.remove("visible");
        box.innerHTML = "";
        delete box.dataset.sec2327321;
      }
      return;
    }

    const previous = document.getElementById(id)?.value || "unknown";
    box.dataset.sec2327321 = "1";
    box.classList.add("visible");
    box.innerHTML = `
      <h3>Additional information for Section 232</h3>
      <p>HTS ${esc(document.getElementById("hts")?.value || code)} is a covered steel derivative. This fact can change the applicable Chapter 99 rate.</p>
      <div class="extended-screening-grid">
        <div>
          <label for="${id}">${esc(copy)}</label>
          <select id="${id}">
            <option value="unknown">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>`;
    const select = document.getElementById(id);
    if (select) select.value = previous;
  }

  function contentQualifier() {
    return document.getElementById("steelContentQualifier7321")?.value || "unknown";
  }

  function measureFor(data) {
    const code = digits(data?.query?.hts || currentCode());
    if (!isCovered(code)) return null;

    const origin = String(data?.query?.country || currentCountry()).toUpperCase();
    const melt = String(data?.query?.meltPourCountry || document.getElementById("meltPourCountry")?.value || origin).toUpperCase();
    const value = Number(data?.query?.customsValue || document.getElementById("value")?.value || 0);
    const qualifier = contentQualifier();

    let hts = "9903.82.09";
    let rate = 25;
    let ruleSource = "U.S. note 16(c)(vii); heading 9903.82.09";
    let treatment = "Covered derivative steel article under the current Section 232 metals schedule.";

    if (origin === "RU") {
      hts = "9903.82.16";
      rate = 25;
      ruleSource = "U.S. note 16(c)(vii); heading 9903.82.16";
      treatment = "Russian-origin derivative steel article covered by U.S. note 16(c)(vii).";
    }

    if (melt === "US" && qualifier === "yes") {
      hts = origin === "RU" ? "9903.82.15" : "9903.82.06";
      rate = 10;
      ruleSource = origin === "RU"
        ? "U.S. note 16(c)(vii) and 16(e); heading 9903.82.15"
        : "U.S. note 16(c)(vii) and 16(e); heading 9903.82.06";
      treatment = "Reduced Section 232 treatment based on the entered U.S. steel-content qualification.";
    } else if (origin === "GB" && melt === "GB" && qualifier === "yes") {
      hts = "9903.82.05";
      rate = 15;
      ruleSource = "U.S. note 16(c)(vii) and 16(d); heading 9903.82.05";
      treatment = "United Kingdom derivative-steel treatment based on the entered U.K. steel-content qualification.";
    }

    return {
      program: "Section 232",
      hts,
      applicableRate: `+${rate}%`,
      ratePercent: rate,
      amount: value * rate / 100,
      description: `HTS ${code.slice(0,4)}.${code.slice(4,6)}.${code.slice(6,8)} is listed as a covered derivative steel article in the current Section 232 schedule.`,
      tariffTreatment: treatment,
      ruleSource,
      client7321Rule: true
    };
  }

  function parseDisplayedMoney(id) {
    const raw = document.getElementById(id)?.textContent || "";
    const n = Number(raw.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function addCard(measure) {
    const review = document.getElementById("additionalReview");
    if (!review) return;
    if ([...review.querySelectorAll(".ch99")].some(el => (el.textContent || "").includes(measure.hts))) return;
    const div = document.createElement("div");
    div.className = "ch99";
    div.innerHTML = `<strong>Section 232 — ${esc(measure.hts)} — ${esc(measure.applicableRate)}</strong><br>${esc(measure.description)}<br><span class="tiny">Applicable treatment: ${esc(measure.tariffTreatment)}</span><br><span class="tiny">Estimated additional duty: <strong>${money(measure.amount)}</strong></span><br><span class="tiny">Rule source: ${esc(measure.ruleSource)}</span>`;
    review.appendChild(div);
  }

  function patchScreeningPanel() {
    const panel = document.getElementById("extendedScreeningPanel");
    if (!panel) return;
    for (const row of panel.querySelectorAll(".screening-row")) {
      const strong = row.querySelector("strong");
      if ((strong?.textContent || "").trim() !== "Section 232") continue;
      const status = row.querySelector(".status");
      const p = row.querySelector("p");
      if (status) {
        status.className = "status flag";
        status.textContent = "Review";
      }
      if (p) p.textContent = "A Section 232 measure was identified for this HTS/country combination and is shown in the duty section above.";
    }
  }

  function apply7321Measure() {
    const data = window.__lastResult;
    if (!data) return;
    const code = digits(data?.query?.hts || currentCode());
    if (!isCovered(code)) return;

    if (!data.review) data.review = {};
    if (!Array.isArray(data.review.applicableAdditionalMeasures)) data.review.applicableAdditionalMeasures = [];

    const measure = measureFor(data);
    if (!measure) return;

    const existing232 = data.review.applicableAdditionalMeasures.find(m => /232/i.test(String(m?.program || "")));
    if (existing232) return;

    data.review.applicableAdditionalMeasures.push(measure);

    const sec232 = document.getElementById("section232Duty");
    if (sec232) sec232.textContent = money(parseDisplayedMoney("section232Duty") + measure.amount);

    const total = document.getElementById("total");
    if (total) total.textContent = money(parseDisplayedMoney("total") + measure.amount);

    addCard(measure);
    setTimeout(patchScreeningPanel, 40);
  }

  function flagBroad7321() {
    const data = window.__lastResult;
    const code = digits(data?.query?.hts || currentCode());
    if (!is7321Family(code) || code.length >= 8) return;
    const panel = document.getElementById("extendedScreeningPanel");
    if (!panel) return;
    for (const row of panel.querySelectorAll(".screening-row")) {
      const strong = row.querySelector("strong");
      if ((strong?.textContent || "").trim() !== "Section 232") continue;
      const status = row.querySelector(".status");
      const p = row.querySelector("p");
      if (status) {
        status.className = "status flag";
        status.textContent = "Review";
      }
      if (p) p.textContent = "HTS heading 7321 contains Section 232-covered derivative steel subheadings. Enter the full 8- or 10-digit HTS code to resolve the applicable Chapter 99 line and rate.";
    }
  }

  function queueQuestionSync() {
    setTimeout(revealRelevantQuestions, 140);
  }

  function watchResults() {
    const result = document.getElementById("result");
    if (!result) return;
    const observer = new MutationObserver(() => {
      if (result.classList.contains("hidden")) return;
      setTimeout(() => {
        apply7321Measure();
        flagBroad7321();
      }, 80);
    });
    observer.observe(result, { attributes: true, attributeFilter: ["class"] });
  }

  function init() {
    const hts = document.getElementById("hts");
    const country = document.getElementById("country");
    const melt = document.getElementById("meltPourCountry");
    hts?.addEventListener("input", queueQuestionSync);
    hts?.addEventListener("change", queueQuestionSync);
    country?.addEventListener("change", queueQuestionSync);
    melt?.addEventListener("change", queueQuestionSync);
    queueQuestionSync();
    watchResults();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();