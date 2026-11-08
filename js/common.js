// Shared helpers for the teacher setup page and the student game.
(function () {
  'use strict';

  // The maps a quiz can use. A page shows one map, picked by the link's `m` parameter (world by default);
  // COUNTRIES, byCode, countryName and friends below all refer to the places on that map.
  //   places     [{ code, name, region, subregion, ... }] from js/data
  //   core(p)    listed without ticking "include territories" (sovereign countries; states but not D.C.)
  //   flags      has flag images (otherwise a code badge stands in)
  //   sphere     a whole-globe map: draw the ocean and graticule, and rotate to keep the quiz in view
  //   credit     [name, url] of the map shapes' source
  //   inset(p)   only drawn in the extended layout (U.S. territories, which need extra insets);
  //              projection(rotate, extended) picks the layout, see usesExtended()
  const ATLASES = {
    world: {
      id: 'world',
      topo: window.GEO_WORLD,
      object: 'countries',
      places: window.GEO_COUNTRIES,
      names: window.GEO_COUNTRY_NAMES || {},
      capitalNames: window.GEO_CAPITAL_NAMES || {},
      regionOrder: ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctica'],
      core: (p) => p.sovereign,
      flags: true,
      sphere: true,
      credit: ['Natural Earth', 'https://www.naturalearthdata.com/'],
      projection: (rotate) => d3.geoNaturalEarth1().rotate([rotate || 0, 0]),
    },
  };
  // The places and names are always loaded (the home screen lists them); the shapes only for a ?m=us page (js/load-map.js).
  // The world map's shapes are likewise only there when it's the page's map.
  if (window.GEO_US_STATES) {
    ATLASES.us = {
      id: 'us',
      topo: window.GEO_US_SHAPES,
      object: 'states',
      places: GEO_US_STATES.places,
      names: GEO_US_STATES.names,
      regionOrder: ['Northeast', 'Midwest', 'South', 'West', 'Territories'],
      core: (p) => p.kind === 'state',
      inset: (p) => p.kind === 'territory',
      flags: false,
      sphere: false,
      credit: ['U.S. Census Bureau', 'https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html'],
      // Alaska and Hawaii as insets; the extended layout adds boxes for the territories.
      projection: (rotate, extended) => (extended ? d3.geoAlbersUsaTerritories() : d3.geoAlbersUsa()),
    };
  }
  // A state's counties (?m=counties-tx). js/load-map.js loads the one state's shapes the link names.
  if (window.GEO_US_COUNTIES && window.GEO_US_STATES) {
    const d = GEO_US_COUNTIES;
    const state = GEO_US_STATES.places.find((p) => p.code === d.state);
    const id = `counties-${d.state.toLowerCase()}`;
    ATLASES[id] = {
      id,
      // Wording: Louisiana has parishes and Alaska boroughs; everything else falls back to 'counties'.
      variants: [{ LA: 'parishes', AK: 'boroughs' }[d.state], 'counties'].filter(Boolean),
      state: d.state,
      topo: d.topo,
      object: 'counties',
      places: d.places,
      names: {},
      regionOrder: [state.name],
      core: () => true,
      flags: false,
      badge: false, // a code badge would only show the FIPS number
      sphere: false,
      credit: ['U.S. Census Bureau', 'https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html'],
      projection: () => d3.geoConicEqualArea().parallels(d.parallels).rotate(d.rotate),
    };
    // The state's name is the counties' region: translate it like a region ("Counties of Luisiana").
    const regionNames = {};
    for (const [lang, names] of Object.entries(GEO_US_STATES.names)) if (names[d.state]) regionNames[lang] = { [state.name]: names[d.state] };
    I18N.addRegions(regionNames);
  }
  const ATLAS = ATLASES[(new URLSearchParams(location.search).get('m') || '').toLowerCase()] || ATLASES.world;

  const COUNTRIES = ATLAS.places;
  const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
  const REGION_ORDER = ATLAS.regionOrder;

  // Quiz modes, picked by the link's `q` parameter: find each place by its name (the default), or, on maps
  // whose places have capitals (both, today), by its capital: "Sacramento" → click California.
  const HAS_CAPITALS = COUNTRIES.some((c) => c.capital);
  const MODES = HAS_CAPITALS ? ['places', 'capitals'] : ['places'];
  const urlMode = new URLSearchParams(location.search).get('q');
  let mode = MODES.includes(urlMode) ? urlMode : 'places';

  /** Switches the page's mode (setup does this in place). Wording follows, e.g. "Capitals of the West". */
  function setMode(next) {
    mode = MODES.includes(next) ? next : 'places';
    const own = ATLAS.variants || [ATLAS.id];
    I18N.setVariant(mode === 'capitals' ? [`capitals-${ATLAS.id}`, 'capitals', ...own] : own); // e.g. "Guesses per state"
    // The page's static text was translated before this script loaded (see I18N.init), so redo it in this wording.
    I18N.apply();
  }
  setMode(mode);

  /** Whether a place can be asked in the current mode (capitals quizzes skip places without one, like D.C. or Antarctica). */
  function askable(c) {
    return mode !== 'capitals' || Boolean(c.capital);
  }

  const DEFAULTS = { guesses: 3, dim: true, timer: true };

  /** Reads quiz settings from a query string. Unknown country codes are dropped. */
  function parseQuiz(search) {
    const p = new URLSearchParams(search);
    const seen = new Set();
    // c=all: every place on the map (but not the extras behind "include territories"). Used by the counties
    // menu, which doesn't load the counties of all 50 states just to list their codes.
    const all = (p.get('c') || '').trim().toLowerCase() === 'all';
    const codes = (all ? COUNTRIES.filter((c) => ATLAS.core(c)).map((c) => c.code).join(',') : p.get('c') || '')
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((c) => byCode.has(c) && askable(byCode.get(c)) && !seen.has(c) && seen.add(c));
    const int = (k) => {
      const v = parseInt(p.get(k), 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const bool = (k, d) => (p.has(k) ? p.get(k) !== '0' : d);
    return {
      map: ATLAS.id,
      mode,
      codes,
      title: (p.get('t') || '').trim().slice(0, 80),
      count: int('n'), // ask this many (random subset); null = all
      guesses: Math.min(int('g') || DEFAULTS.guesses, 10),
      dim: bool('d', DEFAULTS.dim),
      timer: bool('s', DEFAULTS.timer), // show the running timer while playing
      langs: I18N.parseLangs(p.get('l')), // languages students may use; null = all
    };
  }

  /** Builds a query string for a quiz. Only non-default options are included to keep links short. */
  function quizQuery(q) {
    const p = new URLSearchParams();
    const map = q.map || ATLAS.id;
    if (map !== 'world') p.set('m', map);
    if (q.mode && q.mode !== 'places') p.set('q', q.mode);
    if (q.title) p.set('t', q.title);
    // Every place on this map (e.g. all 254 Texas counties) is written as c=all, to keep the link and its QR code short.
    const core = map === ATLAS.id ? COUNTRIES.filter((c) => ATLAS.core(c) && askable(c)) : null;
    const everything = core && q.codes.length === core.length && core.every((c) => q.codes.includes(c.code));
    if (q.codes.length) p.set('c', everything ? 'all' : q.codes.join(','));
    if (q.count && q.count < q.codes.length) p.set('n', q.count);
    if (q.guesses && q.guesses !== DEFAULTS.guesses) p.set('g', q.guesses);
    if (q.dim === false) p.set('d', '0');
    if (q.timer === false) p.set('s', '0');
    // Always written when chosen, so a quiz keeps its languages as new ones are added to the app.
    // Left out (null) only for links that never chose, which allow every language.
    if (q.langs && q.langs.length) p.set('l', q.langs.join(','));
    // Keep commas readable in the link.
    return '?' + p.toString().replace(/%2C/g, ',');
  }

  /** Place name in the current language (falls back to English). */
  function countryName(code) {
    return ATLAS.names[I18N.lang]?.[code] || byCode.get(code).name;
  }

  /** The place's capital (capitals quizzes). */
  function capitalName(code) {
    return ATLAS.capitalNames?.[I18N.lang]?.[code] || byCode.get(code).capital || '';
  }

  /** What the game asks for: the place's name, or in a capitals quiz its capital. */
  function promptName(code) {
    return mode === 'capitals' ? capitalName(code) : countryName(code);
  }

  /** The place's name, followed in a capitals quiz by its capital: "California · Sacramento". */
  function fullName(code) {
    return mode === 'capitals' && capitalName(code) ? `${countryName(code)} · ${capitalName(code)}` : countryName(code);
  }

  /** Title used when a quiz doesn't set one, e.g. "Africa countries" or "Countries of the world" ("U.S. states"). */
  function defaultTitle(codes) {
    if (!codes.length) return 'Where Is It';
    const regions = new Set(codes.map((c) => byCode.get(c).region));
    if (regions.size !== 1) return I18N.t('worldTitle');
    const region = [...regions][0];
    return I18N.t('regionTitle', { region: I18N.region(region), key: region }); // key: the region's English name
  }

  /** Lowercase without accents, for forgiving search ("peru" finds "Perú"). */
  function fold(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Absolute URL for a page ('./', 'setup', 'print'). Extensionless on the web; .html added under file://. */
  function pageUrl(page, query) {
    if (location.protocol === 'file:') page = page === './' ? 'index.html' : `${page}.html`;
    return new URL(page + (query || ''), location.href).href;
  }

  function flagUrl(code) {
    return `assets/flags/${code.toLowerCase()}.svg`;
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for insecure contexts / older browsers.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {}
      ta.remove();
      return ok;
    }
  }

  /** Picks a map rotation so the selected countries aren't split by the map edge. */
  function rotationFor(codes) {
    if (!codes.length || !ATLAS.sphere) return 0;
    let x = 0, y = 0;
    for (const code of codes) {
      const lon = (byCode.get(code).latlng[1] * Math.PI) / 180;
      x += Math.cos(lon);
      y += Math.sin(lon);
    }
    if (Math.hypot(x, y) / codes.length < 0.3) return 0; // spread around the globe
    const mean = (Math.atan2(y, x) * 180) / Math.PI;
    return Math.abs(mean) < 40 ? 0 : -Math.round(mean / 10) * 10;
  }

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }

  const PIN_SVG = '<svg class="pin" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 10.2 18.6 11.2 19.6a1.1 1.1 0 0 0 1.6 0C13.8 30.6 24 20.4 24 12 24 5.37 18.63 0 12 0z"/><circle cx="12" cy="12" r="4.6"/></svg>';
  /** The "WHERE IS IT 📍" logo. opts.tagline adds the subtitle; opts.large for hero size; opts.home links it to the site root. */
  function wordmark(opts = {}) {
    const cls = `wordmark${opts.large ? ' large' : ''}`;
    const w = opts.home
      ? el('a', { class: cls, href: './', 'aria-label': 'Where Is It — home' })
      : el('span', { class: cls, role: 'img', 'aria-label': 'Where Is It' });
    w.innerHTML = `<span class="wm-name">Where Is It${PIN_SVG}</span>` + (opts.tagline ? '<span class="wm-tag"></span>' : '');
    if (opts.tagline) w.querySelector('.wm-tag').textContent = I18N.t('tagline');
    return w;
  }

  function pinIcon() {
    const s = el('span', { class: 'pin-icon' });
    s.innerHTML = PIN_SVG;
    return s;
  }

  // Five-pointed star centred on 0,0 with 6.5-unit points: capitals on the map and next to capital names.
  const STAR_PATH = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.7 : 6.5;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
    }
    return `M${pts.join('L')}Z`;
  })();

  /** A star icon, shown before a capital's name. */
  function starIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'capital-star');
    svg.setAttribute('viewBox', '-6.6 -6.9 13.2 13.2');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="${STAR_PATH}"/>`;
    return svg;
  }

  /** The place's flag, or on maps without flags a badge with its code (e.g. "TX"), or nothing (counties). */
  function flagImg(code, cls) {
    // Nothing to show (counties): an empty element, so callers can still put it in a list of nodes.
    if (ATLAS.badge === false) return el('span', { class: 'no-badge', 'aria-hidden': 'true' });
    if (!ATLAS.flags) return el('span', { class: `${cls || 'flag'} code-badge`, 'aria-hidden': 'true' }, code);
    return el('img', { class: cls || 'flag', src: flagUrl(code), alt: '', draggable: 'false' });
  }

  /** Whether a quiz of these places needs the extended layout (e.g. it includes a U.S. territory). */
  function usesExtended(codes) {
    return Boolean(ATLAS.inset) && codes.some((c) => ATLAS.inset(byCode.get(c)));
  }

  /** GeoJSON features of the current map's shapes; inset-only places are left out unless `extended`. */
  function features(extended) {
    const all = topojson.feature(ATLAS.topo, ATLAS.topo.objects[ATLAS.object]).features;
    if (!ATLAS.inset || extended) return all;
    return all.filter((f) => !byCode.has(f.id) || !ATLAS.inset(byCode.get(f.id)));
  }

  window.WhereIsIt = {
    ATLASES,
    ATLAS,
    COUNTRIES,
    MODES,
    get mode() {
      return mode;
    },
    setMode,
    askable,
    capitalName,
    promptName,
    fullName,
    byCode,
    REGION_ORDER,
    DEFAULTS,
    parseQuiz,
    quizQuery,
    pageUrl,
    flagUrl,
    flagImg,
    STAR_PATH,
    starIcon,
    features,
    usesExtended,
    wordmark,
    pinIcon,
    countryName,
    defaultTitle,
    fold,
    formatTime,
    shuffle,
    copyText,
    rotationFor,
    el,
  };
})();
