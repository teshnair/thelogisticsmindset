(() => {
  const LINKEDIN_URL = "https://www.linkedin.com/in/riteshnair/";
  const ZELLE_URL = "https://enroll.zellepay.com/qr-codes?data=eyJ0b2tlbiI6InRlc2huYWlyQG1lLmNvbSIsIm5hbWUiOiJSaXRlc2gifQ==";
  const CASH_APP_URL = "https://cash.app/$teshnair";
  const VENMO_URL = "https://venmo.com/code?user_id=4671165251454051760&created=1787616068.4310908";

  function addStylesheet() {
    if (document.querySelector('link[href="css/support.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/support.css";
    document.head.appendChild(link);
  }

  function addHeaderLinkedIn() {
    const h1 = document.querySelector(".page-header .header-text h1");
    if (!h1 || document.querySelector(".support-linkedin-header")) return;

    const row = document.createElement("div");
    row.className = "support-header-title-row";
    h1.parentNode.insertBefore(row, h1);
    row.appendChild(h1);

    const linkedin = document.createElement("a");
    linkedin.className = "support-linkedin-header";
    linkedin.href = LINKEDIN_URL;
    linkedin.target = "_blank";
    linkedin.rel = "noopener noreferrer";
    linkedin.setAttribute("aria-label", "Ritesh Nair on LinkedIn");
    linkedin.title = "Ritesh Nair on LinkedIn";
    linkedin.textContent = "in";
    row.appendChild(linkedin);
  }

  function addSupportNavLink() {
    const nav = document.querySelector(".page-header .header-text nav");
    if (!nav || nav.querySelector(".support-site-nav-link")) return;

    const link = document.createElement("a");
    link.href = "#support-the-logistics-mindset";
    link.className = "support-site-nav-link";
    link.textContent = "Support This Site";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openSupport();
    });
    nav.appendChild(link);
  }

  function qrCard(name, image, alt, href, handle) {
    return `
      <div class="support-qr-card">
        <h4>${name}</h4>
        <a class="support-qr-link" href="${href}" target="_blank" rel="noopener noreferrer">
          <img class="support-qr-img" src="${image}" alt="${alt}">
        </a>
        <div class="support-qr-handle">${handle}</div>
      </div>`;
  }

  function buildDrawer() {
    if (document.getElementById("supportDrawer")) return;

    const overlay = document.createElement("div");
    overlay.className = "support-drawer-overlay";
    overlay.id = "supportDrawerOverlay";

    const drawer = document.createElement("aside");
    drawer.className = "support-drawer";
    drawer.id = "supportDrawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-label", "Support The Logistics Mindset");

    drawer.innerHTML = `
      <div class="support-drawer-inner">
        <div class="support-drawer-top">
          <div>
            <h2>Support The Logistics Mindset</h2>
            <p class="support-drawer-intro">
              The Logistics Mindset is individually created, researched, managed and updated by me.
              There is no team behind the site. It is time-consuming to maintain, and there are costs involved.
              If you find the tools and reference material useful and believe they contribute value to the industry,
              would you kindly consider supporting the continued development of the site?
            </p>
          </div>
          <button type="button" class="support-drawer-close" aria-label="Close support panel">×</button>
        </div>

        <div class="support-obligation">
          <strong>There is no obligation to contribute.</strong>
          The Logistics Mindset remains free to use regardless of whether you choose to support it.
        </div>

        <section class="support-section">
          <h3>Support from Anywhere</h3>
          <p class="support-section-note">Use card, Apple Pay or Google Pay from the United States or internationally.</p>
          <div class="support-global-card">
            <div class="support-global-title">Card · Apple Pay · Google Pay</div>
            <div class="support-global-copy">
              A secure hosted payment option will allow one-time support without sharing payment details with this website.
            </div>
            <button class="support-disabled-button" type="button" disabled>Support from anywhere →</button>
            <span class="support-coming-soon">Secure card support is being connected.</span>
          </div>
        </section>

        <section class="support-section">
          <h3>U.S. One-Time Support</h3>
          <p class="support-section-note">Prefer Zelle, Cash App or Venmo? Scan a QR code below or tap it on mobile.</p>
          <div class="support-qr-grid">
            ${qrCard("Zelle", "img/support/zelle.png", "Zelle QR code", ZELLE_URL, "Scan in your banking app")}
            ${qrCard("Cash App", "img/support/cash-app.png", "Cash App QR code", CASH_APP_URL, "$teshnair")}
            ${qrCard("Venmo", "img/support/venmo.png", "Venmo QR code", VENMO_URL, "@RiteshNair")}
          </div>
        </section>

        <section class="support-section">
          <h3>Support Monthly</h3>
          <p class="support-section-note">Support the ongoing research, maintenance and updating of this independent educational resource.</p>
          <div class="support-monthly-row">
            <button class="support-monthly-button" type="button" disabled>$3 / month</button>
            <button class="support-monthly-button" type="button" disabled>$5 / month</button>
          </div>
          <span class="support-coming-soon">Secure recurring support is being connected.</span>
        </section>

        <section class="support-section">
          <h3>Support by Following My Page and Sharing This Site</h3>
          <div class="support-linkedin-box">
            <div class="support-linkedin-mark" aria-hidden="true">in</div>
            <div>
              <strong>Follow my LinkedIn page and share The Logistics Mindset</strong>
              <p>
                I share logistics observations, trade and regulatory developments, practical lessons from the field,
                and updates to tools and reference material published on The Logistics Mindset.
                Following my LinkedIn page, reacting to or sharing my posts, and sharing this website with others
                helps the content reach more people across the logistics and supply-chain community.
              </p>
              <div class="support-linkedin-actions">
                <a class="support-action-button support-linkedin-button"
                   href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">
                   Follow Ritesh Nair on LinkedIn →
                </a>
                <button type="button" class="support-action-button support-share-button" id="supportShareButton">
                  Share This Site
                </button>
              </div>
              <div class="support-share-status" id="supportShareStatus" aria-live="polite"></div>
            </div>
          </div>
        </section>

        <div class="support-disclaimer">
          Support is voluntary. The Logistics Mindset is not a charitable organization and contributions are not tax-deductible.
        </div>
      </div>`;

    document.body.append(overlay, drawer);

    overlay.addEventListener("click", closeSupport);
    drawer.querySelector(".support-drawer-close").addEventListener("click", closeSupport);

    const shareButton = drawer.querySelector("#supportShareButton");
    shareButton.addEventListener("click", async () => {
      const status = drawer.querySelector("#supportShareStatus");
      const shareData = {
        title: "The Logistics Mindset",
        text: "Practical logistics, supply chain thinking, and real-world tools.",
        url: window.location.origin
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
          status.textContent = "";
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.origin);
          status.textContent = "Website link copied.";
        } else {
          status.textContent = window.location.origin;
        }
      } catch (error) {
        if (error && error.name === "AbortError") return;
        status.textContent = "Use this link to share: " + window.location.origin;
      }
    });
  }

  function openSupport() {
    const drawer = document.getElementById("supportDrawer");
    const overlay = document.getElementById("supportDrawerOverlay");
    if (!drawer || !overlay) return;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("support-drawer-open");
  }

  function closeSupport() {
    const drawer = document.getElementById("supportDrawer");
    const overlay = document.getElementById("supportDrawerOverlay");
    if (!drawer || !overlay) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("support-drawer-open");
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSupport();
  });

  document.addEventListener("DOMContentLoaded", () => {
    addStylesheet();
    addHeaderLinkedIn();
    buildDrawer();
    addSupportNavLink();
  });
})();
