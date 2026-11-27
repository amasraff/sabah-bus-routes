'use strict';

// Search across all route files. Uses helpers and state from script.js.
(() => {
  const box     = document.getElementById('searchBox');
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const MAX_RESULTS = 50;
  let indexPromise = null;

  // "1 Borneo", "1borneo" and "1-Borneo" all compare the same
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean = v => {
    const t = String(v || '').trim().replace(/^\[|\]$/g, '');
    return t.toLowerCase() === 'undef' ? '' : t;
  };
  const list = v => (Array.isArray(v) ? v : [v]).filter(Boolean);

  async function getJson(path) {
    const res = await fetchWithTimeout(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function buildIndex() {
    const files = state.cities[state.activeCity] || [];
    let failed = 0;
    const [aliases, perFile] = await Promise.all([
      getJson('Data/search_aliases.json').catch(() => []),
      Promise.all(files.map(async file => {
        try {
          const buses = normaliseData(await getJson(file.fileName)).flatMap(r => r.buses);
          // position matches the order the cards are drawn in
          return buses.map((bus, position) => {
            const towards = Array.isArray(bus.towards) ? bus.towards : [];
            const number = norm(clean(bus.busName));
            const fields = [
              clean(bus.operator),
              ...list(bus.tags),
              ...towards.flatMap(t => [...list(t.destination), ...list(t.tags)]),
            ].map(norm).filter(Boolean);
            return { file, position, bus, towards, number, fields };
          });
        } catch (err) {
          console.error('[sabah-bus] search could not read', file.fileName, err);
          failed++;
          return [];
        }
      })),
    ]);
    const groups = (Array.isArray(aliases) ? aliases : []).map(g => list(g).map(norm));
    return { entries: perFile.flat(), groups, failed };
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = buildIndex().then(index => {
        if (index.failed) indexPromise = null;   // try again next time
        return index;
      });
    }
    return indexPromise;
  }

  // The query plus its other spellings
  function variants(query, groups) {
    const out = new Set([query]);
    for (const group of groups) {
      for (const word of group) {
        if (query.includes(word)) group.forEach(other => out.add(query.replace(word, other)));
        // a half-typed name ("queen eliz") also finds the other spellings
        else if (query.length >= 4 && word.startsWith(query)) group.forEach(other => out.add(other));
      }
    }
    return [...out];
  }

  function find(query, { entries, groups }) {
    const terms = variants(query, groups);
    // bus numbers match from the start, so "1B" does not find 11B
    const hits = entries.filter(e => e.number.startsWith(query) ||
      e.fields.some(f => terms.some(t => f.includes(t))));
    // Exact bus number first, otherwise keep the file order
    return hits.sort((a, b) => (b.number === query) - (a.number === query));
  }

  function close() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function note(text) {
    const p = document.createElement('p');
    p.className = 'search-note';
    p.textContent = text;
    results.appendChild(p);
  }

  function resultButton(entry) {
    const { bus, towards, file } = entry;
    const badge = clean(bus.busName) || clean(bus.operator);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-result';
    const rows = towards.map(t => {
      const { cls, label } = statusInfo(t.notes);
      return `<span class="search-dir"><span>→ ${escHtml(list(t.destination).join(' · ') || 'Unknown')}</span>
        <span class="bus-status ${cls}">${label}</span></span>`;
    }).join('');
    btn.innerHTML = `
      <span class="search-top">
        ${badge ? `<span class="bus-badge" style="background:${resolveColour(bus.colour || bus.color)}">${escHtml(badge)}</span>` : ''}
        <span class="search-region">${escHtml(file.label)}</span>
      </span>${rows}`;
    btn.addEventListener('click', () => show(entry));
    return btn;
  }

  // Open the bus's tab and scroll to its card
  async function show({ file, position }) {
    close();
    input.blur();
    const index = (state.cities[state.activeCity] || []).findIndex(f => f.fileName === file.fileName);
    const tab = regionNav.querySelectorAll('.nav-btn')[index];
    if (!tab) return;

    if (state.activeRegionFile === file.fileName) { deselect(); hideMap(); }
    else await loadRegion(file.fileName, file.label, tab);
    if (state.activeRegionFile !== file.fileName) return;   // another tab was chosen meanwhile

    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const card = routeList.querySelectorAll('.bus-card')[position];
    if (!card) return;
    routeList.scrollTop += card.getBoundingClientRect().top - routeList.getBoundingClientRect().top - 8;
    routeList.querySelectorAll('.search-hit').forEach(c => c.classList.remove('search-hit'));
    card.classList.add('search-hit');
    setTimeout(() => card.classList.remove('search-hit'), 3000);
  }

  async function run() {
    const query = norm(input.value);
    if (query.length < 2) { close(); return; }
    const index = await loadIndex();
    if (query !== norm(input.value)) return;                 // still typing

    const hits = find(query, index);
    results.innerHTML = '';
    if (index.failed) note('Some route lists could not be loaded.');
    if (!hits.length) note('No match in our data.');
    hits.slice(0, MAX_RESULTS).forEach(h => results.appendChild(resultButton(h)));
    if (hits.length > MAX_RESULTS) note('More matches. Type more to narrow the list.');
    results.hidden = false;
    results.scrollTop = 0;
    input.setAttribute('aria-expanded', 'true');
  }

  // Used by the place tags on bus cards
  window.searchFor = async text => {
    input.value = text;
    await run();
    // focus a result, not the input, so phones don't open the keyboard
    results.querySelector('.search-result')?.focus();
  };

  input.addEventListener('input', run);
  input.addEventListener('focus', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !results.hidden) results.querySelector('.search-result')?.click();
  });
  box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('pointerdown', e => { if (!box.contains(e.target)) close(); });
  box.addEventListener('focusout', e => {
    if (e.relatedTarget && !box.contains(e.relatedTarget)) close();
  });
})();
