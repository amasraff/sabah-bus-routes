'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  cities: {},
  activeCity: null,
  activeRegionFile: null,
  selectedDir: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const cityNav       = document.getElementById('cityNav');
const regionNav     = document.getElementById('regionNav');
const routeList     = document.getElementById('routeList');
const mapPanel      = document.getElementById('mapPanel');
const mapFrame      = document.getElementById('mapFrame');
const mapLabel      = document.getElementById('mapLabel');
const mapExtLink    = document.getElementById('mapExternalLink');
const mapNoEmbed    = document.getElementById('mapNoEmbed');
const mapNoEmbedBtn = document.getElementById('mapNoEmbedBtn');
const mapEmpty      = document.getElementById('mapEmpty');

// ─── Colour map ───────────────────────────────────────────────────────────────
const COLOURS = {
  blue:   '#1b4f8a',
  red:    '#b91c1c',
  green:  '#15803d',
  yellow: '#a16207',
  orange: '#c2610a',
  purple: '#7c3aed',
  brown:  '#78350f',
  pink:   '#be185d',
  teal:   '#0f766e',
  grey:   '#4b5563',
  gray:   '#4b5563',
  white:  '#4b5563',
  black:  '#1f2937',
};

function resolveColour(val) {
  if (!val) return '#1b4f8a';
  return COLOURS[val.trim().toLowerCase()] || '#1b4f8a';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showSpinner(msg = 'Loading routes…') {
  routeList.innerHTML = `
    <div class="spinner-wrap">
      <div class="spinner"></div>
      ${msg}
    </div>`;
}

function showError(msg) {
  routeList.innerHTML = `<p class="error-msg">⚠️ ${msg}</p>`;
}

function showPlaceholder(msg) {
  routeList.innerHTML = `<p class="state-msg">${msg}</p>`;
}

// ─── Map helpers ──────────────────────────────────────────────────────────────
function resolveMapUrl(url) {
  if (!url) return { embedUrl: null, externalUrl: null };
  const t = url.trim();
  if (['undef','partial','incomplete'].includes(t.toLowerCase())) {
    return { embedUrl: null, externalUrl: null };
  }
  if (t.includes('/maps/embed')) return { embedUrl: t, externalUrl: t };
  if (t.includes('google.com/maps')) {
    const sep = t.includes('?') ? '&' : '?';
    return { embedUrl: t + sep + 'output=embed', externalUrl: t };
  }
  // Short links (maps.app.goo.gl, goo.gl) cannot be embedded
  return { embedUrl: null, externalUrl: t };
}

function openMap(rawUrl, label) {
  const { embedUrl, externalUrl } = resolveMapUrl(rawUrl);
  mapPanel.hidden = false;
  mapEmpty.hidden = true;
  mapLabel.textContent = label;

  if (externalUrl) {
    mapExtLink.href = externalUrl;
    mapExtLink.hidden = false;
    mapNoEmbedBtn.href = externalUrl;
  } else {
    mapExtLink.hidden = true;
  }

  if (embedUrl) {
    mapFrame.src = embedUrl;
    mapFrame.hidden = false;
    mapNoEmbed.hidden = true;
  } else {
    mapFrame.src = 'about:blank';
    mapFrame.hidden = true;
    mapNoEmbed.hidden = false;
  }

  if (window.matchMedia('(max-width: 767px)').matches) {
    mapPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function hideMap() {
  mapFrame.src = 'about:blank';
  mapFrame.hidden = true;
  mapNoEmbed.hidden = true;
  mapEmpty.hidden = false;
  mapLabel.textContent = 'Map';
  mapExtLink.hidden = true;
  // On mobile, hide the whole panel; on desktop keep it visible with empty state
  if (!isDesktop()) mapPanel.hidden = true;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function statusInfo(notes) {
  if (!notes) return { cls: 'status-undef', label: 'Undef' };
  switch (notes.trim().toLowerCase()) {
    case 'complete':   return { cls: 'status-complete', label: 'Complete' };
    case 'partial':    return { cls: 'status-partial',  label: 'Partial'  };
    case 'incomplete': return { cls: 'status-partial',  label: 'Partial'  };
    default:           return { cls: 'status-undef',    label: 'Undef'    };
  }
}

// ─── Normalise JSON ───────────────────────────────────────────────────────────
function normaliseData(raw) {
  const arr = Array.isArray(raw) ? raw : [raw];
  if (!arr.length) return [];

  const first = arr[0];

  // Shape A: region-grouped
  if (first.buses || first.routes) {
    return arr.map(r => ({
      region:      r.region || r.label || 'Routes',
      description: r.description || r.desc || '',
      map:         r.map || null,
      buses:       r.buses || r.routes || [],
    }));
  }

  // Shape B: flat bus list
  if (first.busNumber !== undefined) {
    const map = new Map();
    for (const bus of arr) {
      const key = bus.region || 'Routes';
      if (!map.has(key)) map.set(key, { region: key, description: '', map: null, buses: [] });
      map.get(key).buses.push(bus);
    }
    return [...map.values()];
  }

  console.warn('[sabah-bus] unrecognised JSON shape:', first);
  return [];
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderRoutes(rawData) {
  const regions = normaliseData(rawData);
  if (!regions.length) { showPlaceholder('No route data found.'); return; }

  routeList.innerHTML = '';
  state.selectedDir = null;
  hideMap();
  // On desktop always show the panel (with empty state)
  if (isDesktop()) mapPanel.hidden = false;

  // Auto-load the first region that has an area map
  const firstWithMap = regions.find(r => r.map);
  if (firstWithMap) {
    openMap(firstWithMap.map, `${firstWithMap.region} — Area overview`);
  }

  for (const region of regions) {
    const group = document.createElement('div');
    group.className = 'region-group';

    // Region header
    const header = document.createElement('div');
    header.className = 'region-header';
    header.innerHTML = `
      <div class="region-bar" aria-hidden="true"></div>
      <div class="region-meta">
        <div class="region-name">${escHtml(region.region)}</div>
        ${region.description ? `<div class="region-desc">${escHtml(region.description)}</div>` : ''}
      </div>
      ${region.map ? `<button class="region-map-btn">Area map</button>` : ''}
    `;
    if (region.map) {
      header.querySelector('.region-map-btn').addEventListener('click', () => {
        deselect();
        openMap(region.map, `${region.region} — Area overview`);
      });
    }
    group.appendChild(header);

    // Bus cards
    const buses = region.buses || [];
    if (!buses.length) {
      const p = document.createElement('p');
      p.className = 'state-msg';
      p.textContent = 'No bus data yet.';
      group.appendChild(p);
    } else {
      const grid = document.createElement('div');
      grid.className = 'bus-grid';
      for (const bus of buses) grid.appendChild(buildBusCard(bus));
      group.appendChild(grid);
    }

    routeList.appendChild(group);
  }
}

function buildBusCard(bus) {
  const colour  = resolveColour(bus.colour || bus.color);
  const busNum  = (bus.busNumber || '?').replace(/^\[|\]$/g, '');
  const remark  = bus.remark || '';
  const towards = Array.isArray(bus.towards) ? bus.towards : [];
  const hasAny  = towards.some(t => t.route && t.route !== 'undef');

  const card = document.createElement('div');
  card.className = 'bus-card' + (hasAny ? '' : ' no-route');

  // Badge + UID + remark
  const top = document.createElement('div');
  top.className = 'bus-card-top';
  top.innerHTML = `
    <div class="bus-badge-wrap">
      <span class="bus-badge" style="background:${colour}">${escHtml(busNum)}</span>
      ${bus.uid ? `<span class="bus-uid">UID: ${escHtml(bus.uid)}</span>` : ''}
    </div>
    ${remark ? `<span class="bus-remark">${escHtml(remark)}</span>` : ''}
  `;
  card.appendChild(top);

  if (!towards.length) {
    const p = document.createElement('p');
    p.className = 'bus-no-dir';
    p.textContent = 'No direction data.';
    card.appendChild(p);
    return card;
  }

  // Direction rows (one per towards entry)
  const dirList = document.createElement('div');
  dirList.className = 'bus-dir-list';

  for (const dir of towards) {
    const hasRoute = dir.route && dir.route !== 'undef';
    const { cls, label } = statusInfo(dir.notes);

    const row = document.createElement('div');
    row.className = 'bus-dir-row' + (hasRoute ? ' clickable' : '');
    if (hasRoute) {
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
    }
    row.innerHTML = `
      <span class="dir-arrow">→</span>
      <span class="dir-dest">${escHtml(dir.destination || 'Unknown')}</span>
      <span class="bus-status ${cls}">${label}</span>
    `;

    if (hasRoute) {
      const activate = () => {
        deselect();
        row.classList.add('selected');
        state.selectedDir = { card, row };
        openMap(dir.route, `[${busNum}] → ${dir.destination}`);
      };
      row.addEventListener('click', activate);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    }

    dirList.appendChild(row);
  }

  card.appendChild(dirList);
  return card;
}

function deselect() {
  if (state.selectedDir) {
    state.selectedDir.row.classList.remove('selected');
    state.selectedDir = null;
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') throw new Error(`Timed out fetching ${url}`);
    throw err;
  }
}

async function loadRegion(fileName, label, btn) {
  regionNav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (state.activeRegionFile === fileName) return;
  state.activeRegionFile = fileName;

  showSpinner(`Loading ${label}…`);

  try {
    console.log('[sabah-bus] fetching:', fileName);
    const res = await fetchWithTimeout(fileName);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[sabah-bus] loaded sample entry:', data[0] || data);
    renderRoutes(data);
  } catch (err) {
    console.error('[sabah-bus] loadRegion failed:', err);
    showError(`Could not load "${label}". ${err.message}`);
  }
}

function selectCity(cityName) {
  state.activeCity = cityName;
  state.activeRegionFile = null;

  const regions = state.cities[cityName] || [];
  const labelEl = regionNav.querySelector('.nav-strip-label');
  regionNav.innerHTML = '';
  if (labelEl) regionNav.appendChild(labelEl);

  if (!regions.length) {
    regionNav.hidden = true;
    showPlaceholder('No regions available for this city.');
    return;
  }

  regionNav.hidden = false;
  regions.forEach((region, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.textContent = region.label;
    btn.addEventListener('click', () => loadRegion(region.fileName, region.label, btn));
    regionNav.appendChild(btn);
    if (i === 0) requestAnimationFrame(() => btn.click());
  });
}

async function init() {
  try {
    console.log('[sabah-bus] fetching city.json');
    const res = await fetchWithTimeout('city.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[sabah-bus] city.json:', data);

    state.cities = data.city || {};
    const cityNames = Object.keys(state.cities);

    if (!cityNames.length) { showError('No cities found in city.json.'); return; }

    if (cityNames.length === 1) {
      selectCity(cityNames[0]);
    } else {
      cityNav.hidden = false;
      cityNames.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.textContent = name;
        btn.addEventListener('click', () => {
          cityNav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectCity(name);
        });
        cityNav.appendChild(btn);
        if (i === 0) requestAnimationFrame(() => btn.click());
      });
    }
  } catch (err) {
    console.error('[sabah-bus] init failed:', err);
    showError(`Could not load city data. ${err.message}`);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
