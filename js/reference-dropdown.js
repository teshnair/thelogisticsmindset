(() => {
  "use strict";

  const REFERENCE_LINKS = [
    ["Shipment Tracking", "tracking.html"],
    ["Incoterms", "incoterms.html"],
    ["Hazardous Materials Basics", "hazmat.html"],
    ["Customs & Trade Concepts", "Customs.html"],
    ["U.S. HTS Duty Calculator", "hts-duty-calculator.html"],
    ["Shipping Terms Glossary", "shipping-terms.html"],
    ["Containers", "containers.html"],
    ["ULDs (Unit Load Devices)", "uld.html"]
  ];

  function setupReferenceDropdown() {
    const nav = document.querySelector(".page-header nav");
    if (!nav || nav.querySelector(".reference-dropdown")) return;

    let referenceLink = Array.from(nav.querySelectorAll("a")).find(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      return href === "reference.html" || href.endsWith("/reference.html");
    });

    if (!referenceLink) {
      referenceLink = document.createElement("a");
      referenceLink.href = "reference.html";
      referenceLink.textContent = "References";

      const conversionsLink = Array.from(nav.querySelectorAll("a")).find(link =>
        (link.getAttribute("href") || "").toLowerCase().endsWith("conversion.html")
      );

      if (conversionsLink) {
        conversionsLink.insertAdjacentElement("afterend", referenceLink);
      } else {
        nav.appendChild(referenceLink);
      }
    }

    const wrapper = document.createElement("span");
    wrapper.className = "reference-dropdown";
    referenceLink.parentNode.insertBefore(wrapper, referenceLink);
    wrapper.appendChild(referenceLink);
    referenceLink.classList.add("reference-main-link");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "reference-dropdown-toggle";
    toggle.setAttribute("aria-label", "Show reference pages");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span aria-hidden="true">▼</span>';

    const menu = document.createElement("div");
    menu.className = "reference-dropdown-menu";
    menu.setAttribute("role", "menu");

    for (const [label, href] of REFERENCE_LINKS) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      link.setAttribute("role", "menuitem");
      menu.appendChild(link);
    }

    wrapper.appendChild(toggle);
    wrapper.appendChild(menu);

    function setOpen(open) {
      wrapper.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!wrapper.classList.contains("open"));
    });

    wrapper.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", event => {
      if (!wrapper.contains(event.target)) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupReferenceDropdown, { once: true });
  } else {
    setupReferenceDropdown();
  }
})();
