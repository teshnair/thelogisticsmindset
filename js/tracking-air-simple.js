(() => {
    "use strict";

    const DATA_URL = "data/tracking-carriers.json";
    const form = document.getElementById("airForm");
    const input = document.getElementById("airlineCode");
    const detected = document.getElementById("airDetected");
    const status = document.getElementById("airStatus");
    const coverage = document.getElementById("airCoverage");

    if (!form || !input) return;

    let airlines = [];

    function setStatus(message = "", type = "") {
        status.textContent = message;
        status.className = "status";
        if (message) {
            status.classList.add("visible");
            if (type) status.classList.add(type);
        }
    }

    function normalize(value) {
        return String(value || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    }

    function iataCodes(airline) {
        return String(airline.iata || "")
            .toUpperCase()
            .split(/[^A-Z0-9]+/)
            .map(code => code.trim())
            .filter(Boolean);
    }

    function findAirline(value) {
        const code = normalize(value);
        if (!code) return null;
        return airlines.find(airline => airline.prefix === code || iataCodes(airline).includes(code)) || null;
    }

    function updateDetection() {
        const code = normalize(input.value);
        setStatus();
        if (!code) {
            detected.className = "detected";
            detected.innerHTML = "";
            return;
        }

        const airline = findAirline(code);
        detected.className = "detected visible";

        if (!airline) {
            detected.innerHTML = `<strong>${code}</strong> is not in the current airline list. Try the 3-digit AWB prefix or 2-letter IATA code.`;
            return;
        }

        const codes = iataCodes(airline);
        const iata = codes.length ? ` · IATA ${codes.join(" / ")}` : "";
        detected.innerHTML = `<strong>${airline.name}</strong> · AWB prefix ${airline.prefix}${iata}<br>The airline's official cargo tracking page will open in a new tab.`;
    }

    function openTracker(url) {
        const opened = window.open(url, "_blank");
        if (opened) {
            try { opened.opener = null; } catch (_) {}
            return true;
        }
        return false;
    }

    // Take over Air submit before the older AWB-number handler runs.
    form.addEventListener("submit", event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const code = normalize(input.value);
        if (!code) {
            setStatus("Enter the airline's 3-digit AWB prefix or 2-letter IATA code.", "error");
            return;
        }

        const airline = findAirline(code);
        if (!airline) {
            setStatus(`Airline code ${code} is not in the current list.`, "error");
            return;
        }

        const opened = openTracker(airline.trackerUrl);
        setStatus(
            opened
                ? `${airline.name}'s official Air Waybill tracking page opened in a new tab.`
                : "Your browser blocked the new tab. Allow pop-ups for this site and try again.",
            opened ? "ok" : "warn"
        );
    }, true);

    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
        updateDetection();
    });

    fetch(DATA_URL, { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(payload => {
            airlines = Array.isArray(payload.air) ? payload.air : [];
            if (coverage) {
                coverage.textContent = `${airlines.length} airline codes listed. Enter the 3-digit AWB prefix or 2-letter IATA code to open the airline's official tracking page.`;
            }
            updateDetection();
        })
        .catch(error => {
            console.error("Airline tracking data failed to load:", error);
            setStatus("Airline tracking data could not be loaded. Please refresh the page.", "error");
            form.querySelector(".track-button").disabled = true;
        });
})();
