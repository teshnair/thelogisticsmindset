(() => {
    "use strict";

    const DATA_URL = "data/tracking-carriers.json";

    const oceanTab = document.getElementById("oceanTab");
    const airTab = document.getElementById("airTab");
    const oceanPanel = document.getElementById("oceanPanel");
    const airPanel = document.getElementById("airPanel");

    const oceanForm = document.getElementById("oceanForm");
    const oceanCarrier = document.getElementById("oceanCarrier");
    const containerNumber = document.getElementById("containerNumber");
    const oceanDetected = document.getElementById("oceanDetected");
    const oceanStatus = document.getElementById("oceanStatus");

    const airForm = document.getElementById("airForm");
    const awbNumber = document.getElementById("awbNumber");
    const airDetected = document.getElementById("airDetected");
    const airStatus = document.getElementById("airStatus");

    const oceanCoverage = document.getElementById("oceanCoverage");
    const airCoverage = document.getElementById("airCoverage");

    let data = { ocean: [], air: [] };
    let oceanById = new Map();
    let oceanByPrefix = new Map();
    let airByPrefix = new Map();

    const ISO_VALUES = {
        A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18,
        I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27,
        Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36,
        Y: 37, Z: 38
    };

    function setTab(mode) {
        const oceanActive = mode === "ocean";
        oceanTab.classList.toggle("active", oceanActive);
        airTab.classList.toggle("active", !oceanActive);
        oceanTab.setAttribute("aria-selected", String(oceanActive));
        airTab.setAttribute("aria-selected", String(!oceanActive));
        oceanPanel.hidden = !oceanActive;
        airPanel.hidden = oceanActive;
    }

    function setStatus(el, message = "", type = "") {
        el.textContent = message;
        el.className = "status";
        if (message) {
            el.classList.add("visible");
            if (type) el.classList.add(type);
        }
    }

    function normalizeContainer(value) {
        return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    function normalizeAwb(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function validateIso6346(number) {
        const value = normalizeContainer(number);
        if (!/^[A-Z]{4}\d{7}$/.test(value)) {
            return { valid: false, reason: "Container number must contain four letters followed by seven digits." };
        }

        let sum = 0;
        for (let i = 0; i < 10; i += 1) {
            const char = value[i];
            const numeric = /\d/.test(char) ? Number(char) : ISO_VALUES[char];
            if (numeric === undefined) {
                return { valid: false, reason: "Container number contains an invalid character." };
            }
            sum += numeric * (2 ** i);
        }

        const remainder = sum % 11;
        const expected = remainder === 10 ? 0 : remainder;
        const actual = Number(value[10]);

        if (actual !== expected) {
            return {
                valid: false,
                reason: `ISO 6346 check digit does not match. Expected ${expected}, but the number ends in ${actual}.`
            };
        }

        return { valid: true, normalized: value };
    }

    function validateAwb(value) {
        const digits = normalizeAwb(value);

        if (!/^\d{11}$/.test(digits)) {
            return { valid: false, reason: "AWB must contain 11 digits: a 3-digit airline prefix plus an 8-digit serial block." };
        }

        const prefix = digits.slice(0, 3);
        const serialSeven = digits.slice(3, 10);
        const actualCheck = Number(digits[10]);
        const expectedCheck = Number(serialSeven) % 7;

        if (actualCheck !== expectedCheck) {
            return {
                valid: false,
                reason: `AWB check digit does not match. Expected ${expectedCheck}, but the AWB ends in ${actualCheck}.`
            };
        }

        return {
            valid: true,
            normalized: digits,
            formatted: `${prefix}-${digits.slice(3)}`,
            prefix
        };
    }

    function buildOceanDirectUrl(carrier, number) {
        if (!carrier || !carrier.direct) return null;

        if (carrier.direct.type === "mscBase64") {
            const payload = `trackingNumber=${number}&trackingMode=0`;
            const encoded = btoa(payload);
            return `https://www.msc.com/en/track-a-shipment?params=${encodeURIComponent(encoded)}`;
        }

        const template = carrier.direct.template;
        if (!template) return null;
        return template.replace("{number}", encodeURIComponent(number));
    }

    function copyReference(value) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(value).catch(() => {});
            return;
        }

        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
        } catch (_) {
            // Fallback is best effort only.
        }
        textarea.remove();
    }

    function openTracker(url) {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) {
            window.location.href = url;
        }
    }

    function populateOceanCarriers() {
        const sorted = [...data.ocean].sort((a, b) => a.name.localeCompare(b.name));
        for (const carrier of sorted) {
            const option = document.createElement("option");
            option.value = carrier.id;
            option.textContent = carrier.direct ? `${carrier.name} — direct handoff` : carrier.name;
            oceanCarrier.appendChild(option);
        }
    }

    function rebuildIndexes() {
        oceanById = new Map(data.ocean.map(item => [item.id, item]));
        oceanByPrefix = new Map();
        for (const carrier of data.ocean) {
            for (const prefix of carrier.prefixes || []) {
                if (!oceanByPrefix.has(prefix)) oceanByPrefix.set(prefix, []);
                oceanByPrefix.get(prefix).push(carrier);
            }
        }
        airByPrefix = new Map(data.air.map(item => [item.prefix, item]));
    }

    function updateOceanSuggestion() {
        const normalized = normalizeContainer(containerNumber.value);
        const prefix = normalized.slice(0, 4);

        if (normalized.length < 4) {
            oceanDetected.className = "detected";
            oceanDetected.innerHTML = "";
            return;
        }

        const matches = oceanByPrefix.get(prefix) || [];
        if (!matches.length) {
            oceanDetected.className = "detected visible";
            oceanDetected.innerHTML = `<strong>Prefix ${prefix}</strong> is not mapped to one of the currently listed carriers. Select the actual ocean carrier manually.`;
            return;
        }

        const names = matches.map(item => item.name).join(", ");
        oceanDetected.className = "detected visible";
        oceanDetected.innerHTML = `<strong>Prefix match:</strong> ${names}. Container prefixes identify equipment ownership and may not identify the line carrying this shipment.`;

        if (!oceanCarrier.value && matches.length === 1) {
            oceanCarrier.value = matches[0].id;
        }
    }

    function updateAirDetection() {
        const digits = normalizeAwb(awbNumber.value);
        if (digits.length < 3) {
            airDetected.className = "detected";
            airDetected.innerHTML = "";
            return;
        }

        const prefix = digits.slice(0, 3);
        const carrier = airByPrefix.get(prefix);

        airDetected.className = "detected visible";
        if (carrier) {
            airDetected.innerHTML = `<strong>${carrier.name}</strong> · AWB prefix ${prefix}${carrier.iata ? ` · ${carrier.iata}` : ""}`;
        } else {
            airDetected.innerHTML = `<strong>Prefix ${prefix}</strong> is not in the current airline list.`;
        }
    }

    oceanTab.addEventListener("click", () => setTab("ocean"));
    airTab.addEventListener("click", () => setTab("air"));

    containerNumber.addEventListener("input", () => {
        containerNumber.value = normalizeContainer(containerNumber.value);
        setStatus(oceanStatus);
        updateOceanSuggestion();
    });

    awbNumber.addEventListener("input", () => {
        const digits = normalizeAwb(awbNumber.value).slice(0, 11);
        awbNumber.value = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
        setStatus(airStatus);
        updateAirDetection();
    });

    oceanForm.addEventListener("submit", event => {
        event.preventDefault();

        const validation = validateIso6346(containerNumber.value);
        if (!validation.valid) {
            setStatus(oceanStatus, validation.reason, "error");
            return;
        }

        const carrier = oceanById.get(oceanCarrier.value);
        if (!carrier) {
            setStatus(oceanStatus, "Select the ocean carrier handling the shipment.", "error");
            return;
        }

        const directUrl = buildOceanDirectUrl(carrier, validation.normalized);
        if (directUrl) {
            setStatus(oceanStatus, `Opening ${carrier.name}'s official tracker with ${validation.normalized}.`, "ok");
            openTracker(directUrl);
            return;
        }

        copyReference(validation.normalized);
        setStatus(
            oceanStatus,
            `${carrier.name} does not currently expose a verified URL that accepts the container number directly. The number has been copied and the official tracker is opening.`,
            "warn"
        );
        openTracker(carrier.trackerUrl);
    });

    airForm.addEventListener("submit", event => {
        event.preventDefault();

        const validation = validateAwb(awbNumber.value);
        if (!validation.valid) {
            setStatus(airStatus, validation.reason, "error");
            return;
        }

        const carrier = airByPrefix.get(validation.prefix);
        if (!carrier) {
            setStatus(airStatus, `AWB prefix ${validation.prefix} is valid in format but is not currently mapped in this tracker.`, "error");
            return;
        }

        if (carrier.direct && carrier.direct.template) {
            const directUrl = carrier.direct.template.replace("{number}", encodeURIComponent(validation.formatted));
            setStatus(airStatus, `Opening ${carrier.name}'s official tracker with ${validation.formatted}.`, "ok");
            openTracker(directUrl);
            return;
        }

        copyReference(validation.formatted);
        setStatus(
            airStatus,
            `${carrier.name} identified. Its current public tracker does not have a verified direct-link format, so ${validation.formatted} has been copied and the official cargo page is opening.`,
            "warn"
        );
        openTracker(carrier.trackerUrl);
    });

    async function init() {
        try {
            const response = await fetch(DATA_URL, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();

            rebuildIndexes();
            populateOceanCarriers();

            const oceanDirect = data.ocean.filter(item => item.direct).length;
            const airDirect = data.air.filter(item => item.direct).length;

            oceanCoverage.textContent = `${data.ocean.length} ocean carriers listed; ${oceanDirect} currently have verified direct-handoff URL patterns.`;
            airCoverage.textContent = `${data.air.length} AWB prefixes listed; ${airDirect} currently have verified direct-handoff URL patterns.`;

            updateOceanSuggestion();
            updateAirDetection();
        } catch (error) {
            console.error("Tracking data failed to load:", error);
            setStatus(oceanStatus, "Carrier tracking data could not be loaded. Please refresh the page.", "error");
            setStatus(airStatus, "Carrier tracking data could not be loaded. Please refresh the page.", "error");
            oceanForm.querySelector(".track-button").disabled = true;
            airForm.querySelector(".track-button").disabled = true;
            oceanCoverage.textContent = "Carrier data unavailable.";
            airCoverage.textContent = "Airline data unavailable.";
        }
    }

    init();
})();
