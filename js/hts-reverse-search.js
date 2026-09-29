(() => {
  const htsInput = document.getElementById('hts');
  const htsWrap = htsInput?.closest('.hts-wrap');
  const unitHint = document.getElementById('htsUnitHint');
  if (!htsInput || !htsWrap || !unitHint || document.getElementById('htsReverseSearch')) return;

  const style = document.createElement('style');
  style.id = 'htsReverseSearchStyles';
  style.textContent = `
    .hts-reverse-toggle{margin-top:9px;padding:0;border:0;background:transparent;color:#2c7be5;font-weight:700;font-size:.84rem;cursor:pointer;text-align:left}
    .hts-reverse-toggle:hover{text-decoration:underline}
    .hts-reverse-search{margin-top:10px;padding:14px;border:1px solid #d9e0e7;border-radius:5px;background:#f8fafc}
    .hts-reverse-search.hidden{display:none!important}
    .hts-reverse-search label{margin-bottom:6px}
    .hts-reverse-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}
    .hts-reverse-row input{min-width:0}
    .hts-reverse-row button{padding:10px 15px;background:#1a2a3a;color:#fff}
    .hts-reverse-help{margin-top:6px;color:#667085;font-size:.79rem}
    .hts-reverse-status{margin-top:9px;color:#667085;font-size:.82rem}
    .hts-reverse-results{margin-top:10px;border:1px solid #d7dde3;border-radius:4px;background:#fff;max-height:390px;overflow:auto}
    .hts-reverse-result{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #edf0f3;border-radius:0;background:#fff;color:#333;text-align:left;font-weight:400;cursor:pointer}
    .hts-reverse-result:last-child{border-bottom:0}
    .hts-reverse-result:hover,.hts-reverse-result:focus{background:#eef5ff;outline:none}
    .hts-reverse-code{display:block;color:#1a2a3a;font-weight:800;font-size:.9rem}
    .hts-reverse-desc{display:block;margin-top:2px;color:#4d5660;font-size:.82rem;line-height:1.35}
    .hts-reverse-unit{display:block;margin-top:3px;color:#667085;font-size:.76rem}
    .hts-reverse-empty{padding:12px;color:#7d2525;font-size:.84rem}
    @media(max-width:640px){.hts-reverse-row{grid-template-columns:1fr}.hts-reverse-row button{width:100%}}
  `;
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hts-reverse-toggle';
  toggle.textContent = "Don't know the HTS code? Search by product description";
  toggle.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.id = 'htsReverseSearch';
  panel.className = 'hts-reverse-search hidden';
  panel.innerHTML = `
    <label for="htsDescriptionSearch">Search current U.S. HTS by product description</label>
    <div class="hts-reverse-row">
      <input id="htsDescriptionSearch" type="search" autocomplete="off" placeholder="e.g. coffee, electric transformer, stainless steel bolt">
      <button id="htsDescriptionSearchBtn" type="button">Search HTS</button>
    </div>
    <div class="hts-reverse-help">Enter a product word or short description. Matching current USITC HTS lines will be listed; select a code to use it in the duty and import-requirements calculator.</div>
    <div id="htsReverseStatus" class="hts-reverse-status"></div>
    <div id="htsReverseResults" class="hts-reverse-results hidden" role="listbox"></div>
  `;

  unitHint.insertAdjacentElement('afterend', toggle);
  toggle.insertAdjacentElement('afterend', panel);

  const searchInput = document.getElementById('htsDescriptionSearch');
  const searchBtn = document.getElementById('htsDescriptionSearchBtn');
  const status = document.getElementById('htsReverseStatus');
  const resultsBox = document.getElementById('htsReverseResults');
  let requestSeq = 0;

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) searchInput?.focus();
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderResults(data) {
    const items = Array.isArray(data?.results) ? data.results : [];
    resultsBox.innerHTML = '';
    if (!items.length) {
      resultsBox.innerHTML = '<div class="hts-reverse-empty">No matching current HTS lines were returned. Try a broader product word or a different description.</div>';
      resultsBox.classList.remove('hidden');
      status.textContent = '';
      return;
    }

    status.textContent = data.truncated
      ? `Showing the first ${items.length} of ${data.totalMatches} matching HTS lines. Refine the description to narrow the list.`
      : `${data.totalMatches} matching HTS line${data.totalMatches === 1 ? '' : 's'} found.`;

    items.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hts-reverse-result';
      button.setAttribute('role', 'option');
      const units = Array.isArray(item.units) && item.units.length ? `Reporting unit: ${item.units.join(', ')}` : '';
      button.innerHTML = `<span class="hts-reverse-code">${escapeHtml(item.hts || item.code)}</span><span class="hts-reverse-desc">${escapeHtml(item.description || '')}</span>${units ? `<span class="hts-reverse-unit">${escapeHtml(units)}</span>` : ''}`;
      button.addEventListener('click', () => {
        htsInput.value = item.hts || item.code || '';
        htsInput.dispatchEvent(new Event('input', { bubbles: true }));
        htsInput.dispatchEvent(new Event('change', { bubbles: true }));
        panel.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
        resultsBox.classList.add('hidden');
        status.textContent = `Selected ${item.hts || item.code}.`;
        document.getElementById('country')?.focus();
      });
      resultsBox.appendChild(button);
    });
    resultsBox.classList.remove('hidden');
  }

  async function runSearch() {
    const query = String(searchInput?.value || '').replace(/\s+/g, ' ').trim();
    if (query.length < 2) {
      status.textContent = 'Enter at least 2 letters or words.';
      resultsBox.classList.add('hidden');
      return;
    }

    const seq = ++requestSeq;
    searchBtn.disabled = true;
    status.textContent = 'Searching the current USITC HTS schedule…';
    resultsBox.classList.add('hidden');

    try {
      const response = await fetch('/api/hts-reverse-search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      if (seq !== requestSeq) return;
      if (!response.ok) throw new Error(data.error || 'HTS description search failed.');
      renderResults(data);
    } catch (error) {
      if (seq !== requestSeq) return;
      status.textContent = error?.message || 'HTS description search failed.';
      resultsBox.innerHTML = '<div class="hts-reverse-empty">The live HTS description search could not be completed. Try again.</div>';
      resultsBox.classList.remove('hidden');
    } finally {
      if (seq === requestSeq) searchBtn.disabled = false;
    }
  }

  searchBtn.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });
})();
