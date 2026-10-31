// Shared helpers for the teacher setup page and the student game.
(function () {
  'use strict';

  const COUNTRIES = window.GEO_COUNTRIES;
  const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

  const REGION_ORDER = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctica'];

  const DEFAULTS = { guesses: 3, dim: true };

  /** Reads quiz settings from a query string. Unknown country codes are dropped. */
  function parseQuiz(search) {
    const p = new URLSearchParams(search);
    const seen = new Set();
    const codes = (p.get('c') || '')
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((c) => byCode.has(c) && !seen.has(c) && seen.add(c));
    const int = (k) => {
      const v = parseInt(p.get(k), 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const bool = (k, d) => (p.has(k) ? p.get(k) !== '0' : d);
    return {
      codes,
      title: (p.get('t') || '').trim().slice(0, 80),
      count: int('n'), // ask this many (random subset); null = all
      guesses: Math.min(int('g') || DEFAULTS.guesses, 10),
      dim: bool('d', DEFAULTS.dim),
      langs: I18N.parseLangs(p.get('l')), // languages students may use; null = all
    };
  }

  /** Builds a query string for a quiz. Only non-default options are included to keep links short. */
  function quizQuery(q) {
    const p = new URLSearchParams();
    if (q.title) p.set('t', q.title);
    p.set('c', q.codes.join(','));
    if (q.count && q.count < q.codes.length) p.set('n', q.count);
    if (q.guesses && q.guesses !== DEFAULTS.guesses) p.set('g', q.guesses);
    if (q.dim === false) p.set('d', '0');
    // Always written when chosen, so a quiz keeps its languages as new ones are added to the app.
    // Left out (null) only for links that never chose, which allow every language.
    if (q.langs && q.langs.length) p.set('l', q.langs.join(','));
    // Keep commas readable in the link.
    return '?' + p.toString().replace(/%2C/g, ',');
  }

  /** Country name in the current language (falls back to English). */
  function countryName(code) {
    return (window.GEO_COUNTRY_NAMES || {})[I18N.lang]?.[code] || byCode.get(code).name;
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
    if (!codes.length) return 0;
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

  function flagImg(code, cls) {
    return el('img', { class: cls || 'flag', src: flagUrl(code), alt: '', draggable: 'false' });
  }

  window.WhereIsIt = {
    COUNTRIES,
    byCode,
    REGION_ORDER,
    DEFAULTS,
    parseQuiz,
    quizQuery,
    pageUrl,
    flagUrl,
    flagImg,
    wordmark,
    pinIcon,
    countryName,
    fold,
    formatTime,
    shuffle,
    copyText,
    rotationFor,
    el,
  };
})();
