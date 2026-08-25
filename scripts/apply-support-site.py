from pathlib import Path
import qrcode

ROOT = Path(".")
HTML_FILES = sorted(ROOT.glob("*.html"))

SUPPORT_CSS = r"""
.support-header-title-row {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
}
.support-header-title-row > h1 {
    margin-top: 0;
    margin-bottom: 0;
}
.support-linkedin-header {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    background: #0a66c2;
    color: #fff !important;
    text-decoration: none !important;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 18px;
    line-height: 1;
    font-weight: 700;
}
.support-linkedin-header:hover {
    filter: brightness(.94);
}
.support-site-nav-link {
    /* Deliberately inherits nav font size and weight. */
}
.support-drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(14, 24, 34, .42);
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease;
}
.support-drawer-overlay.is-open {
    opacity: 1;
    pointer-events: auto;
}
.support-drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 9999;
    width: min(720px, 100%);
    height: 100vh;
    background: #fff;
    color: #333;
    transform: translateX(100%);
    transition: transform .25s ease;
    box-shadow: -12px 0 30px rgba(0, 0, 0, .18);
    overflow-y: auto;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}
.support-drawer.is-open {
    transform: translateX(0);
}
body.support-drawer-open {
    overflow: hidden;
}
.support-drawer-inner {
    padding: 28px 30px 42px;
}
.support-drawer-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
}
.support-drawer h2,
.support-drawer h3,
.support-drawer h4 {
    color: #1a2a3a;
}
.support-drawer h2 {
    margin: 0;
    font-size: 1.8rem;
}
.support-drawer-intro {
    margin: 14px 0 6px;
    color: #475467;
    line-height: 1.55;
}
.support-drawer-close {
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 50%;
    background: #eef2f6;
    color: #334155;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    flex: 0 0 auto;
}
.support-obligation {
    margin: 16px 0 24px;
    padding: 12px 14px;
    background: #f7f9fb;
    border-left: 4px solid #1a2a3a;
    font-size: .95rem;
    line-height: 1.5;
}
.support-section {
    padding: 24px 0;
    border-top: 1px solid #d8dee6;
}
.support-section h3 {
    margin: 0 0 5px;
}
.support-section-note {
    margin: 0 0 16px;
    color: #667085;
    font-size: .94rem;
}
.support-global-card {
    border: 1px solid #d8dee6;
    border-radius: 10px;
    padding: 18px;
    background: #fbfcfd;
}
.support-global-title {
    font-weight: 700;
    color: #1a2a3a;
}
.support-global-copy {
    margin-top: 5px;
    color: #667085;
    font-size: .93rem;
}
.support-disabled-button,
.support-action-button {
    display: inline-block;
    margin-top: 11px;
    padding: 10px 15px;
    border-radius: 7px;
    border: 0;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
}
.support-disabled-button {
    background: #e7ebf0;
    color: #667085;
    cursor: not-allowed;
}
.support-coming-soon {
    display: block;
    margin-top: 8px;
    color: #7b8794;
    font-size: .84rem;
}
.support-qr-grid {
    display: grid;
    grid-template-columns: repeat(3, 150px);
    gap: 14px;
    justify-content: start;
}
.support-qr-card {
    border: 1px solid #d8dee6;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
    background: #fff;
}
.support-qr-card h4 {
    margin: 0 0 8px;
    font-size: .95rem;
}
.support-qr-link {
    display: block;
    text-decoration: none;
    color: inherit;
}
.support-qr-img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: contain;
    display: block;
    background: #fff;
}
.support-qr-handle {
    margin-top: 7px;
    color: #667085;
    font-size: .8rem;
}
.support-monthly-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.support-monthly-button {
    padding: 10px 15px;
    border: 1px solid #aab4c0;
    border-radius: 7px;
    background: #eef2f6;
    color: #667085;
    font: inherit;
    font-weight: 700;
    cursor: not-allowed;
}
.support-linkedin-box {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    background: #f7fbff;
    border: 1px solid #d7e9fb;
    border-radius: 10px;
    padding: 17px;
}
.support-linkedin-mark {
    width: 44px;
    height: 44px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    background: #0a66c2;
    color: #fff;
    font: 700 28px/1 Arial, Helvetica, sans-serif;
}
.support-linkedin-box p {
    margin: 4px 0 12px;
    color: #475467;
    line-height: 1.5;
}
.support-linkedin-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
}
.support-action-button {
    margin-top: 0;
    cursor: pointer;
}
.support-linkedin-button {
    background: #0a66c2;
    color: #fff !important;
}
.support-share-button {
    background: #1a2a3a;
    color: #fff;
}
.support-share-status {
    min-height: 1.2em;
    margin-top: 8px;
    color: #667085;
    font-size: .84rem;
}
.support-disclaimer {
    margin-top: 22px;
    color: #7b8794;
    font-size: .82rem;
    line-height: 1.45;
}
@media (max-width: 700px) {
    .support-drawer-inner {
        padding: 22px 18px 34px;
    }
    .support-qr-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    .support-qr-card {
        padding: 7px;
    }
    .support-qr-card h4 {
        font-size: .82rem;
    }
    .support-qr-handle {
        font-size: .72rem;
    }
    .support-linkedin-box {
        flex-direction: column;
    }
}
@media (max-width: 430px) {
    .support-qr-grid {
        grid-template-columns: 1fr;
    }
    .support-qr-card {
        width: min(230px, 100%);
    }
}
"""

SUPPORT_JS = r"""
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
"""

def write_qr(url, path):
    img = qrcode.make(url)
    img.save(path)

def main():
    (ROOT / "css").mkdir(exist_ok=True)
    (ROOT / "js").mkdir(exist_ok=True)
    (ROOT / "img" / "support").mkdir(parents=True, exist_ok=True)

    (ROOT / "css" / "support.css").write_text(SUPPORT_CSS.strip() + "\n", encoding="utf-8")
    (ROOT / "js" / "support.js").write_text(SUPPORT_JS.strip() + "\n", encoding="utf-8")

    write_qr(
        "https://enroll.zellepay.com/qr-codes?data=eyJ0b2tlbiI6InRlc2huYWlyQG1lLmNvbSIsIm5hbWUiOiJSaXRlc2gifQ==",
        ROOT / "img" / "support" / "zelle.png",
    )
    write_qr("https://cash.app/$teshnair", ROOT / "img" / "support" / "cash-app.png")
    write_qr(
        "https://venmo.com/code?user_id=4671165251454051760&created=1787616068.4310908",
        ROOT / "img" / "support" / "venmo.png",
    )

    marker = '<script src="js/support.js" defer></script>'
    for path in HTML_FILES:
        text = path.read_text(encoding="utf-8")
        if marker in text:
            continue
        if "</body>" not in text:
            raise RuntimeError(f"{path} has no closing body tag")
        text = text.replace("</body>", f"{marker}\n</body>", 1)
        path.write_text(text, encoding="utf-8")

if __name__ == "__main__":
    main()
