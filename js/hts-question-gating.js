(() => {
  if (!/\/hts-duty-calculator\.html$/i.test(window.location.pathname)) return;

  const digits = value => String(value ?? "").replace(/\D/g, "");
  const vehicleHeadings = ["8701", "8702", "8703", "8704", "8705"];

  function currentHts() {
    return digits(document.getElementById("hts")?.value || "");
  }

  function isWholeVehicleHts(hts) {
    return vehicleHeadings.some(prefix => hts.startsWith(prefix));
  }

  function resetVehicleFields() {
    const purpose = document.getElementById("importPurpose");
    const year = document.getElementById("vehicleManufactureYear");
    const engine = document.getElementById("vehicleEngineStatus");
    if (purpose) purpose.value = "standard";
    if (year) year.value = "";
    if (engine) engine.value = "unknown";
  }

  function syncQuestions() {
    const box = document.getElementById("extendedScreeningInputs");
    if (!box) return false;

    const hts = currentHts();
    const needsVehicleFacts = isWholeVehicleHts(hts);
    box.style.display = needsVehicleFacts ? "" : "none";

    const heading = box.querySelector("h3");
    const note = box.querySelector("p");
    if (needsVehicleFacts) {
      if (heading) heading.innerHTML = "Additional details required for this vehicle HTS <span class=\"tiny\">(when known)</span>";
      if (note) note.textContent = "Vehicle age, engine configuration and import purpose can change EPA, NHTSA/DOT and Chapter 99 treatment, so these questions are shown only for vehicle classifications that need them.";
    } else {
      resetVehicleFields();
    }
    return true;
  }

  function removeIrrelevantVehicleRows() {
    const hts = currentHts();
    if (isWholeVehicleHts(hts)) return;
    const panel = document.getElementById("extendedScreeningPanel");
    if (!panel) return;
    panel.querySelectorAll(".screening-row").forEach(row => {
      const text = row.textContent || "";
      if (/EPA vehicle requirements|NHTSA \/ DOT vehicle requirements|Special import purpose/i.test(text)) {
        row.remove();
      }
    });
  }

  function bind() {
    const hts = document.getElementById("hts");
    if (hts && !hts.dataset.questionGatingBound) {
      hts.dataset.questionGatingBound = "1";
      hts.addEventListener("input", () => setTimeout(syncQuestions, 0));
      hts.addEventListener("change", () => setTimeout(syncQuestions, 0));
      hts.addEventListener("blur", () => setTimeout(syncQuestions, 0));
    }

    syncQuestions();
    removeIrrelevantVehicleRows();
  }

  const observer = new MutationObserver(() => {
    bind();
    removeIrrelevantVehicleRows();
  });

  function init() {
    bind();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
