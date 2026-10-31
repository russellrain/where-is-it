// Light/dark theme. Loaded in <head> so the theme is applied before the page paints.
// Follows the device setting until someone presses a .theme-toggle button; that choice
// (just "light" or "dark") is remembered in this browser's localStorage.
(function () {
  'use strict';

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
