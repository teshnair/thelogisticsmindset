(() => {
  if (!document.getElementById('result')) return;

  const style = document.createElement('style');
  style.id = 'htsCopyPrintStyles';
  style.textContent = `
    @media print {
      body.hts-printing { overflow: visible !important; background: #fff !important; }
      body.hts-printing > *:not(#htsPrintCopy) { display: none !important; }
      #htsPrintCopy {
        display: block !important;
        position: static !important;
        inset: auto !important;
        transform: none !important;
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 14px !important;
        background: #fff !important;
      }
      #htsPrintCopy .actions,
      #htsPrintCopy .hts-modal-close { display: none !important; }
      #htsPrintCopy * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
  document.head.appendChild(style);

  function cleanResultClone() {
    const result = document.getElementById('result');
    if (!result || result.classList.contains('hidden')) return null;
    const clone = result.cloneNode(true);
    clone.classList.remove('hidden', 'hts-result-modal');
    clone.querySelectorAll('.actions,.hts-modal-close').forEach(el => el.remove());
    return clone;
  }

  function resultText() {
    const clone = cleanResultClone();
    if (!clone) return '';
    return (clone.innerText || clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // Fall through to the legacy clipboard path.
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    area.remove();
    return ok;
  }

  async function handleCopy(button) {
    const text = resultText();
    if (!text) return;
    const original = button.textContent;
    const ok = await copyText(text);
    button.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => { button.textContent = original || 'Copy results'; }, 1400);
  }

  function handlePrint() {
    const clone = cleanResultClone();
    if (!clone) return;

    clone.id = 'htsPrintCopy';
    document.getElementById('htsPrintCopy')?.remove();
    document.body.appendChild(clone);
    document.body.classList.add('hts-printing');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('hts-printing');
      document.getElementById('htsPrintCopy')?.remove();
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(cleanup, 750);
      });
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const copyButton = target.closest('#copyBtn');
    if (copyButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleCopy(copyButton);
      return;
    }

    const printButton = target.closest('button[onclick*="window.print"]');
    if (printButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handlePrint();
    }
  }, true);
})();
