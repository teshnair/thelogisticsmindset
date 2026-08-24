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

  function isReferenceLink(link) {
    if (!link || link.tagName !== "A") return false;
    const href = (link.getAttribute("href") || "").toLowerCase().split("?")[0].split("#")[0];
    return href === "reference.html" || href.endsWith("/reference.html");
  }

  function removeDuplicateReferenceItems(nav, keepWrapper = null, keepLink = null) {
    Array.from(nav.children).forEach(child => {
      if (child === keepWrapper || child === keepLink) return;

      if (child.classList && child.classList.contains("reference-dropdown")) {
        child.remove();
        return;
      }

      if (isReferenceLink(child)) child.remove();
    });
  }

  function setupReferenceDropdown() {
    const nav = document.querySelector(".page-header nav");
    if (!nav) return;

    const existingWrapper = Array.from(nav.children).find(child =>
      child.classList && child.classList.contains("reference-dropdown")
    );

    if (existingWrapper) {
      const mainLink = Array.from(existingWrapper.children).find(isReferenceLink);
      if (mainLink) {
        mainLink.textContent = "References";
        mainLink.classList.add("reference-main-link");
      }
      removeDuplicateReferenceItems(nav, existingWrapper, null);
      return;
    }

    const directReferenceLinks = Array.from(nav.children).filter(isReferenceLink);
    let referenceLink = directReferenceLinks.shift();

    directReferenceLinks.forEach(link => link.remove());

    if (!referenceLink) {
      referenceLink = document.createElement("a");
      referenceLink.href = "reference.html";

      const conversionsLink = Array.from(nav.children).find(link =>
        link.tagName === "A" && (link.getAttribute("href") || "").toLowerCase().endsWith("conversion.html")
      );

      if (conversionsLink) {
        conversionsLink.insertAdjacentElement("afterend", referenceLink);
      } else {
        nav.appendChild(referenceLink);
      }
    }

    referenceLink.textContent = "References";

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

    removeDuplicateReferenceItems(nav, wrapper, referenceLink);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupReferenceDropdown, { once: true });
  } else {
    setupReferenceDropdown();
  }
})();
