// Service worker: keeps the game working when the network drops (classroom Wi-Fi), never at the cost of freshness.
//
// Every request goes to the network first, and each good response is saved. The saved copy is used only when the
// network fails, or is so slow (TIMEOUT) that a saved copy is better than waiting. So a new deploy shows up on the
// next load, as without a service worker, and nothing here needs bumping when the site changes.
//
// The pages, code and the world and U.S. states maps are saved up front (SHELL), so any page and either main map
// opens offline once the site has been visited. A state's counties and flags are saved as they're used: a quiz
// played once can be played again offline, without every visitor downloading all 50 states' counties. A page whose
// map isn't saved says so (WhereIsIt.mapUnavailable), and setup won't switch to one while offline (mapSaved).
'use strict';

const CACHE = 'whereisit-v1'; // bump only to change how things are cached (old caches are deleted)
const TIMEOUT = 4000; // ms to wait for the network before falling back to a saved copy

const SHELL = [
  './',
  'setup',
  'print',
  'about',
  'manifest.webmanifest',
  'css/style.css',
  'assets/icons/icon.svg',
  'js/i18n.js',
  'js/theme.js',
  'js/common.js',
  'js/map.js',
  'js/game.js',
  'js/setup.js',
  'js/print.js',
  'js/load-map.js',
  'js/data/countries.js',
  'js/data/country-names.js',
  'js/data/us-states.js',
  'js/data/us-counties.js',
  'js/data/world.js',
  'js/data/us-shapes.js',
  'vendor/d3.min.js',
  'vendor/d3-composite-projections.min.js',
  'vendor/topojson-client.min.js',
  'vendor/qrcode.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new service worker doesn't save stale files.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('whereisit-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(networkFirst(req, cacheKey(req, url)));
});

/**
 * Pages are saved without their query (a quiz is all in the ?query; the page is the same), and under their clean
 * path: /setup.html and /index.html are saved as /setup and /.
 */
function cacheKey(req, url) {
  if (req.mode !== 'navigate') return req;
  const path = url.pathname.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
  return new URL(path, url.origin).href;
}

function networkFirst(req, key) {
  const saved = caches.match(key, { ignoreSearch: req.mode === 'navigate' });
  const network = fetch(req).then((res) => {
    // Only whole, successful responses (not 404s, or the 206 partial responses media can get).
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(key, copy));
    }
    return res;
  });
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (res) => {
      if (!done && res) {
        done = true;
        resolve(res);
      }
    };
    // Slow network: use the saved copy if there is one (the network response still updates it in the background).
    const timer = setTimeout(() => saved.then(finish), TIMEOUT);
    network.then(
      (res) => {
        clearTimeout(timer);
        finish(res);
      },
      // Offline: the saved copy, or failing that the error.
      (err) => {
        clearTimeout(timer);
        saved.then((res) => {
          if (res) finish(res);
          else if (!done) {
            done = true;
            reject(err);
          }
        });
      },
    );
  });
}
