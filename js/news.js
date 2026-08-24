(() => {
    const els = {
        updatedLine: document.getElementById("updatedLine"),
        editorialTeaser: document.getElementById("editorialTeaser"),
        editorialTitle: document.getElementById("editorialTitle"),
        editorialDek: document.getElementById("editorialDek"),
        newsSearch: document.getElementById("newsSearch"),
        latestButton: document.getElementById("latestButton"),
        archiveButton: document.getElementById("archiveButton"),
        archivePanel: document.getElementById("archivePanel"),
        archiveCalendar: document.getElementById("archiveCalendar"),
        calendarTitle: document.getElementById("calendarTitle"),
        previousMonth: document.getElementById("previousMonth"),
        nextMonth: document.getElementById("nextMonth"),
        categoryFilter: document.getElementById("categoryFilter"),
        resultsTitle: document.getElementById("resultsTitle"),
        resultMeta: document.getElementById("resultMeta"),
        loadingState: document.getElementById("loadingState"),
        emptyState: document.getElementById("emptyState"),
        newsGrid: document.getElementById("newsGrid"),
        sheetBackdrop: document.getElementById("sheetBackdrop"),
        editorialSheet: document.getElementById("editorialSheet"),
        sheetClose: document.getElementById("sheetClose"),
        sheetTitle: document.getElementById("sheetTitle"),
        sheetDek: document.getElementById("sheetDek"),
        sheetDate: document.getElementById("sheetDate"),
        editorialBody: document.getElementById("editorialBody")
    };

    const state = {
        latest: null,
        archive: null,
        editorials: null,
        selectedDate: null,
        category: "All",
        query: "",
        archiveMode: false,
        viewYear: new Date().getUTCFullYear(),
        viewMonth: new Date().getUTCMonth(),
        activeEditorial: null,
        lastFocused: null
    };

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[char]));
    }

    function formatDateOnly(iso) {
        if (!iso) return "";
        const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return String(iso);
        const [, y, m, d] = match;
        return new Intl.DateTimeFormat("en-US", {
            month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
        }).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
    }

    function formatDateTime(iso) {
        if (!iso) return "Not yet updated";
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "Not yet updated";
        return new Intl.DateTimeFormat("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
            timeZone: "America/New_York", timeZoneName: "short"
        }).format(date);
    }

    async function fetchJson(url) {
        const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.json();
    }

    function itemSearchText(item) {
        return [
            item.title, item.summary, item.logisticsImpact, item.source, item.sourceDomain,
            item.sourceCountry, item.region, item.category, ...(Array.isArray(item.tags) ? item.tags : [])
        ].join(" ").toLowerCase();
    }

    function filteredItems() {
        const base = state.archiveMode && state.archive?.items ? state.archive.items : (state.latest?.items || []);
        const terms = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        return base.filter(item => {
            if (state.selectedDate && item.date !== state.selectedDate) return false;
            if (state.category !== "All" && item.category !== state.category) return false;
            if (terms.length && !terms.every(term => itemSearchText(item).includes(term))) return false;
            return true;
        }).sort((a, b) => {
            const dateSort = String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
            if (state.selectedDate || state.query) return dateSort || (b.score || 0) - (a.score || 0);
            return (b.score || 0) - (a.score || 0) || dateSort;
        });
    }

    function highlight(text) {
        const raw = escapeHtml(text);
        const terms = state.query.trim().split(/\s+/).filter(Boolean)
            .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        if (!terms.length) return raw;
        return raw.replace(new RegExp(`(${terms.join("|")})`, "ig"), "<mark>$1</mark>");
    }

    function riskLabel(item) {
        const risk = ["critical", "high", "watch", "normal"].includes(item.risk) ? item.risk : "normal";
        return `<span class="risk-badge ${risk}">${escapeHtml(risk)}</span>`;
    }

    function cardHtml(item) {
        const risk = ["critical", "high", "watch", "normal"].includes(item.risk) ? item.risk : "normal";
        const tags = (Array.isArray(item.tags) ? item.tags : []).slice(0, 8)
            .map(tag => `<span class="tag">${highlight(tag)}</span>`).join("");
        const sourceBits = [item.source, item.sourceCountry].filter(Boolean).map(escapeHtml).join(" · ");
        const score = Number.isFinite(Number(item.score)) ? ` · ${Math.round(Number(item.score))}/100` : "";
        return `
            <article class="news-card ${risk}">
                <div class="card-meta">
                    ${riskLabel(item)}
                    <span>${escapeHtml(item.category || "Supply Chain")}</span>
                    <span>·</span>
                    <span>${escapeHtml(item.region || "Global")}</span>
                    <span>·</span>
                    <span>${escapeHtml(formatDateOnly(item.date || item.publishedAt))}${score}</span>
                </div>
                <h3>${highlight(item.title)}</h3>
                <p class="summary">${highlight(item.summary)}</p>
                <div class="impact"><strong>Logistics impact:</strong> ${highlight(item.logisticsImpact)}</div>
                ${tags ? `<div class="tags">${tags}</div>` : ""}
                <a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original source: ${sourceBits || "Open article"} →</a>
            </article>`;
    }

    function editorialForCurrentView() {
        if (state.selectedDate && state.editorials?.items) {
            return state.editorials.items.find(item => item.date === state.selectedDate) || null;
        }
        return state.latest?.editorial || null;
    }

    function renderEditorial() {
        const editorial = editorialForCurrentView();
        state.activeEditorial = editorial;
        if (!editorial) {
            els.editorialTeaser.classList.add("hidden");
            return;
        }
        els.editorialTitle.textContent = editorial.title || "Today's Editorial";
        els.editorialDek.textContent = editorial.dek || "";
        els.editorialTeaser.classList.remove("hidden");
    }

    function renderNews() {
        const items = filteredItems();
        els.loadingState.classList.add("hidden");
        els.newsGrid.innerHTML = items.map(cardHtml).join("");
        els.emptyState.classList.toggle("hidden", items.length > 0);
        els.resultMeta.textContent = `${items.length} ${items.length === 1 ? "entry" : "entries"}`;

        if (state.selectedDate) {
            els.resultsTitle.textContent = `Archive · ${formatDateOnly(state.selectedDate)}`;
        } else if (state.query) {
            els.resultsTitle.textContent = `Search · ${state.query}`;
        } else if (state.category !== "All") {
            els.resultsTitle.textContent = state.category;
        } else {
            els.resultsTitle.textContent = "Latest News";
        }
        renderEditorial();
    }

    async function loadArchive() {
        if (state.archive && state.editorials) return;
        const [archive, editorials] = await Promise.all([
            fetchJson("data/news/archive.json"),
            fetchJson("data/news/editorials.json")
        ]);
        state.archive = archive;
        state.editorials = editorials;
        const newest = archive?.items?.[0]?.date;
        if (newest) {
            const [y, m] = newest.split("-").map(Number);
            state.viewYear = y;
            state.viewMonth = m - 1;
        }
    }

    function drawCalendar() {
        els.archiveCalendar.innerHTML = "";
        ["S","M","T","W","T","F","S"].forEach(day => {
            const node = document.createElement("div");
            node.className = "dow";
            node.textContent = day;
            els.archiveCalendar.appendChild(node);
        });

        els.calendarTitle.textContent = new Intl.DateTimeFormat("en-US", {
            month: "long", year: "numeric", timeZone: "UTC"
        }).format(new Date(Date.UTC(state.viewYear, state.viewMonth, 1)));

        const firstDay = new Date(Date.UTC(state.viewYear, state.viewMonth, 1)).getUTCDay();
        const days = new Date(Date.UTC(state.viewYear, state.viewMonth + 1, 0)).getUTCDate();
        const datesWithNews = new Set((state.archive?.items || []).map(item => item.date));

        for (let i = 0; i < firstDay; i++) {
            const blank = document.createElement("span");
            blank.className = "calendar-day empty";
            els.archiveCalendar.appendChild(blank);
        }
        for (let day = 1; day <= days; day++) {
            const iso = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "calendar-day";
            button.textContent = String(day);
            button.setAttribute("aria-label", formatDateOnly(iso));
            if (datesWithNews.has(iso)) button.classList.add("has-news");
            if (state.selectedDate === iso) button.classList.add("selected");
            button.addEventListener("click", () => {
                state.selectedDate = iso;
                state.archiveMode = true;
                state.query = "";
                els.newsSearch.value = "";
                renderNews();
                drawCalendar();
            });
            els.archiveCalendar.appendChild(button);
        }
    }

    async function openArchive() {
        const willOpen = !els.archivePanel.classList.contains("open");
        if (!willOpen) {
            els.archivePanel.classList.remove("open");
            els.archiveButton.classList.remove("active");
            els.archiveButton.textContent = "Archive ▾";
            els.archiveButton.setAttribute("aria-expanded", "false");
            return;
        }
        try {
            await loadArchive();
            state.archiveMode = true;
            els.archivePanel.classList.add("open");
            els.archiveButton.classList.add("active");
            els.archiveButton.textContent = "Archive ▴";
            els.archiveButton.setAttribute("aria-expanded", "true");
            drawCalendar();
        } catch (error) {
            console.error(error);
            els.resultMeta.textContent = "Archive temporarily unavailable";
        }
    }

    function openEditorial() {
        const editorial = state.activeEditorial;
        if (!editorial) return;
        state.lastFocused = document.activeElement;
        els.sheetTitle.textContent = editorial.title || "Editorial";
        els.sheetDek.textContent = editorial.dek || "";
        els.sheetDate.textContent = formatDateOnly(editorial.date);
        els.editorialBody.innerHTML = "";
        (Array.isArray(editorial.body) ? editorial.body : []).forEach(text => {
            const p = document.createElement("p");
            p.textContent = text;
            els.editorialBody.appendChild(p);
        });
        els.sheetBackdrop.classList.add("open");
        els.editorialSheet.classList.add("open");
        els.editorialSheet.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        els.sheetClose.focus();
    }

    function closeEditorial() {
        els.sheetBackdrop.classList.remove("open");
        els.editorialSheet.classList.remove("open");
        els.editorialSheet.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (state.lastFocused && typeof state.lastFocused.focus === "function") state.lastFocused.focus();
    }

    function setCategory(category) {
        state.category = category;
        els.categoryFilter.querySelectorAll("button[data-category]").forEach(button => {
            button.classList.toggle("active", button.dataset.category === category);
        });
        renderNews();
    }

    async function performSearch() {
        state.query = els.newsSearch.value.trim();
        state.selectedDate = null;
        if (state.query) {
            try {
                await loadArchive();
                state.archiveMode = true;
                drawCalendar();
            } catch (error) {
                console.error(error);
                state.archiveMode = false;
            }
        }
        renderNews();
    }

    function showLatest() {
        state.archiveMode = false;
        state.selectedDate = null;
        state.query = "";
        state.category = "All";
        els.newsSearch.value = "";
        els.archivePanel.classList.remove("open");
        els.archiveButton.classList.remove("active");
        els.archiveButton.textContent = "Archive ▾";
        els.archiveButton.setAttribute("aria-expanded", "false");
        setCategory("All");
    }

    els.editorialTeaser.addEventListener("click", openEditorial);
    els.editorialTeaser.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditorial();
        }
    });
    els.sheetClose.addEventListener("click", closeEditorial);
    els.sheetBackdrop.addEventListener("click", closeEditorial);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && els.editorialSheet.classList.contains("open")) closeEditorial();
    });

    els.archiveButton.addEventListener("click", openArchive);
    els.latestButton.addEventListener("click", showLatest);
    els.newsSearch.addEventListener("input", performSearch);
    els.previousMonth.addEventListener("click", () => {
        state.viewMonth -= 1;
        if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear -= 1; }
        drawCalendar();
    });
    els.nextMonth.addEventListener("click", () => {
        state.viewMonth += 1;
        if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear += 1; }
        drawCalendar();
    });
    els.categoryFilter.addEventListener("click", event => {
        const button = event.target.closest("button[data-category]");
        if (button) setCategory(button.dataset.category);
    });
    document.querySelectorAll("[data-news-query]").forEach(button => {
        button.addEventListener("click", async () => {
            els.newsSearch.value = button.dataset.newsQuery || "";
            await performSearch();
        });
    });

    async function init() {
        try {
            state.latest = await fetchJson("data/news/latest.json");
            const newest = state.latest?.items?.[0]?.date || state.latest?.editorial?.date;
            if (newest) {
                const [y, m] = newest.split("-").map(Number);
                state.viewYear = y;
                state.viewMonth = m - 1;
            }
            els.updatedLine.textContent = state.latest?.generatedAt
                ? `Global scan last updated ${formatDateTime(state.latest.generatedAt)} · Source links open the original publisher.`
                : "The automated global scan is being initialized.";
            renderNews();
        } catch (error) {
            console.error(error);
            els.loadingState.textContent = "News data is temporarily unavailable. The automated curator will try again on its next scheduled run.";
            els.updatedLine.textContent = "Automated scan temporarily unavailable.";
        }
    }

    init();
})();
