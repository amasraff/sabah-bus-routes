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
const mapLabel      = document.getElementById('mapLabel');
const mapMessage    = document.getElementById('mapMessage');
const mapActions    = document.getElementById('mapActions');
const mapGoogleLink = document.getElementById('mapGoogleLink');
const mapGpxLink    = document.getElementById('mapGpxLink');
const mapCloseBtn   = document.getElementById('mapCloseBtn');

mapCloseBtn.addEventListener('click', () => { deselect(); hideMap(); });

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
const KK_CENTRE = [5.975, 116.073];
let map = null;
let routeLayer = null;
let mapRequest = 0;

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches;
}

// Only accept web links for Google Maps and repo files for GPX
function googleUrl(url) {
  const t = (url || '').trim();
  return /^https:\/\//i.test(t) ? t : null;
}

function gpxPath(path) {
  const t = (path || '').trim();
  return /^Data\/gpx\/(?!.*\.\.).+\.gpx$/i.test(t) ? t : null;
}

// Create the map the first time it is shown, then keep reusing it
function ensureMap() {
  if (!window.L) return false;
  if (!map) {
    map = L.map('map').setView(KK_CENTRE, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }
  map.invalidateSize();
  return true;
}

function clearRoute() {
  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }
}

function showMessage(msg) {
  mapMessage.textContent = msg;
  mapMessage.hidden = !msg;
}

// Returns a list of lines, each a list of [lat, lon]
function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('Invalid GPX');

  const all = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  const toPoint = el => [parseFloat(el.getAttribute('lat')), parseFloat(el.getAttribute('lon'))];
  const valid = line => line.filter(p => p.every(Number.isFinite));

  // Tracks: one line per segment
  const lines = all(xml, 'trkseg').map(seg => valid(all(seg, 'trkpt').map(toPoint)));

  // Routes: each point, followed by any Garmin in-between points (<gpxx:rpt>)
  for (const rte of all(xml, 'rte')) {
    lines.push(valid(all(rte, 'rtept').flatMap(pt => [pt, ...all(pt, 'rpt')]).map(toPoint)));
  }

  return lines.filter(line => line.length > 1);
}

async function drawGpx(path, request) {
  showMessage('Loading route…');
  try {
    const res = await fetchWithTimeout(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lines = parseGpx(await res.text());
    if (request !== mapRequest) return;      // another route was tapped meanwhile
    if (!lines.length) throw new Error('No route points');

    routeLayer = L.featureGroup(lines.map(l => L.polyline(l, { color: '#2563a8', weight: 5 })));
    routeLayer.addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
    showMessage('');
  } catch (err) {
    console.error('[sabah-bus] GPX failed:', err);
    if (request === mapRequest) showMessage('Could not load the route preview.');
  }
}

function openMap({ route, gpx, label }) {
  const request = ++mapRequest;
  mapPanel.hidden = false;
  mapLabel.textContent = label;

  mapGoogleLink.hidden = !route;
  if (route) mapGoogleLink.href = route;
  mapGpxLink.hidden = !gpx;
  if (gpx) mapGpxLink.href = gpx;
  mapActions.hidden = !route && !gpx;

  const hasMap = ensureMap();
  clearRoute();
  if (!hasMap) {
    showMessage('The map could not be loaded.');
  } else if (gpx) {
    drawGpx(gpx, request);
  } else {
    map.setView(KK_CENTRE, 12);
    showMessage('Map preview not available yet.');
  }

  // On mobile, leave room so the bottom sheet doesn't hide the end of the page
  if (!isDesktop()) {
    map?.invalidateSize();
    routeList.style.paddingBottom = `${mapPanel.offsetHeight}px`;
    // Keep the tapped row visible above the bottom sheet
    const row = state.selectedDir?.row;
    if (row) {
      const hidden = row.getBoundingClientRect().bottom - mapPanel.getBoundingClientRect().top;
      if (hidden > 0) routeList.scrollTop += hidden + 8;
    }
  }
}

// Desktop keeps a general KK view; mobile hides the panel
function hideMap() {
  mapRequest++;
  clearRoute();
  showMessage('');
  mapActions.hidden = true;
  mapLabel.textContent = 'Kota Kinabalu';
  routeList.style.paddingBottom = '';
  mapPanel.hidden = !isDesktop();
  if (isDesktop() && ensureMap()) map.setView(KK_CENTRE, 12);
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
  if (first.busName !== undefined) {
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
    `;
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
  const clean   = v => {
    const t = (v || '').trim().replace(/^\[|\]$/g, '');
    return t.toLowerCase() === 'undef' ? '' : t;
  };
  const busName  = clean(bus.busName);
  const operator = clean(bus.operator);
  const badge    = busName || operator;      // no badge when both are empty
  const remark  = bus.remark || '';
  const towards = Array.isArray(bus.towards) ? bus.towards : [];

  // Per-direction GPX files take priority over the bus-level (round trip) file
  const perDirection = towards.some(t => gpxPath(t.gpx));
  const linksFor = dir => ({
    route: googleUrl(dir.route),
    gpx:   gpxPath(perDirection ? dir.gpx : bus.gpx),
  });
  const hasAny  = towards.some(t => { const l = linksFor(t); return l.route || l.gpx; });

  const card = document.createElement('div');
  card.className = 'bus-card' + (hasAny ? '' : ' no-route');

  // Badge + UID + remark
  const top = document.createElement('div');
  top.className = 'bus-card-top';
  top.innerHTML = `
    <div class="bus-badge-wrap">
      ${badge ? `<span class="bus-badge" style="background:${colour}">${escHtml(badge)}</span>` : ''}
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
    // destination is one name, or a list of places (loop: first entry is the start)
    const isList = Array.isArray(dir.destination);
    const destination = isList ? dir.destination.join(' · ') : dir.destination;
    const { route, gpx } = linksFor(dir);
    const hasRoute = Boolean(route || gpx);
    const { cls, label } = statusInfo(dir.notes);

    const row = document.createElement('div');
    row.className = 'bus-dir-row' + (hasRoute ? ' clickable' : '');
    if (hasRoute) {
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
    }
    row.innerHTML = `
      <span class="dir-arrow">→</span>
      <span class="dir-dest${isList ? ' dir-dest-list' : ''}">${escHtml(destination || 'Unknown')}</span>
      ${gpx ? '<span class="link-badge link-gpx">GPX</span>' : ''}
      ${route ? '<span class="link-badge link-gmap">GMAP</span>' : ''}
      <span class="bus-status ${cls}">${label}</span>
    `;

    if (hasRoute) {
      const activate = () => {
        deselect();
        row.classList.add('selected');
        state.selectedDir = { card, row };
        openMap({ route, gpx, label: `${badge ? `[${badge}] ` : ''}→ ${destination}` });
      };
      row.addEventListener('click', activate);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    }

    dirList.appendChild(row);
  }

  card.appendChild(dirList);
  const places = buildPlaces(bus.tags);
  if (places) card.appendChild(places);
  return card;
}

// ─── Places of interest ───────────────────────────────────────────────────────
let placesCount = 0;

// A collapsed list of the bus's tags; null when it has none
function buildPlaces(tags) {
  const seen = new Set();
  const names = (Array.isArray(tags) ? tags : [])
    .map(t => String(t || '').trim())
    .filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  if (!names.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'places';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'places-toggle';
  toggle.textContent = `Places of interest (${names.length})`;

  const panel = document.createElement('div');
  panel.className = 'places-panel';
  panel.id = `places-${++placesCount}`;
  panel.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panel.id);

  panel.innerHTML = '<p class="places-note">Places along or near the route; not confirmed bus stops.</p>';
  const chips = document.createElement('div');
  chips.className = 'places-chips';
  for (const name of names) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'place-chip';
    chip.textContent = name;
    chip.title = `Search for ${name}`;
    chip.addEventListener('click', () => window.searchFor?.(name));
    chips.appendChild(chip);
  }
  panel.appendChild(chips);

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });

  wrap.append(toggle, panel);
  return wrap;
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
