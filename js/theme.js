// Light/dark theme. Loaded in <head> so the theme is applied before the page paints.
// Follows the device setting until someone presses a .theme-toggle button; that choice
// (just "light" or "dark") is remembered in this browser's localStorage.
(function () {
  'use strict';

  // Show clean URLs (/setup, not /setup.html; / not /index.html) even if someone arrives via an old link.
  // Skipped for file:// where extensionless paths don't resolve.
  if (location.protocol !== 'file:' && /\.html$/.test(location.pathname)) {
    const clean = location.pathname.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
    history.replaceState(history.state, '', clean + location.search + location.hash);
  }
  // From file:// (e.g. Electron) there is no server to map /setup to setup.html, so put the extension
  // back on internal page links as they're clicked.
  if (location.protocol === 'file:') {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.protocol !== 'file:') return;
      const url = new URL(a.href);
      if (/\/$/.test(url.pathname)) url.pathname += 'index.html';
      else if (!/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '.html';
      else return;
      a.href = url.href;
    }, true);
  }

  const KEY = 'whereisit-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null; // storage blocked (private mode, school policies): just follow the device
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      const key = theme === 'dark' ? 'themeToLight' : 'themeToDark';
      const label = window.I18N ? I18N.t(key) : theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      btn.title = label;
      btn.setAttribute('aria-label', label);
    });
  }

  apply(saved() || (media.matches ? 'dark' : 'light'));

  media.addEventListener('change', (e) => {
    if (!saved()) apply(e.matches ? 'dark' : 'light');
  });

  document.addEventListener('langchange', () => apply(root.dataset.theme));

  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(KEY, next); } catch (e) { /* still switches for this page */ }
        apply(next);
      });
    });
  });
})();
