// Builds the link-preview image (assets/og-image.png, 1200×630) shown when a quiz link is shared.
//
//   node tools/og-image.mjs
//
// Draws the world map with a few countries highlighted in the game's colors and the wordmark on top,
// then screenshots it with headless Chrome (set CHROME to its path if it isn't in the usual place).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;

const topo = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const countries = feature(topo, topo.objects.countries).features.filter((f) => f.id !== '010'); // no Antarctica

// A game in progress: found first try (green), found later (amber), missed (red), and the current pick (blue).
const marks = { '076': '#3fae5a', 404: '#3fae5a', 356: '#3fae5a', '036': '#3fae5a', 840: '#f0b43c', 250: '#f0b43c', 566: '#e2574c', 156: '#5b8def' };

const projection = geoEqualEarth().fitExtent([[40, 40], [W - 40, H - 40]], { type: 'FeatureCollection', features: countries });
const draw = geoPath(projection);

const land = countries
  .map((f) => `<path d="${draw(f)}" fill="${marks[f.id] || '#f3e7c9'}" stroke="#9a8c70" stroke-width="0.6"/>`)
  .join('');

const pin =
  '<svg class="pin" viewBox="0 0 24 32"><path fill="#e0483e" d="M12 0C5.37 0 0 5.37 0 12c0 8.4 10.2 18.6 11.2 19.6a1.1 1.1 0 0 0 1.6 0C13.8 30.6 24 20.4 24 12 24 5.37 18.63 0 12 0z"/><circle cx="12" cy="12" r="4.6" fill="#fff"/></svg>';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #cfe6f3;
    font-family: system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1f2933; }
  svg.map { position: absolute; inset: 0; }
  .card { position: absolute; left: 56px; bottom: 56px; background: #fff; border-radius: 24px; padding: 32px 40px;
    box-shadow: 0 12px 40px rgba(31, 41, 51, 0.18); }
  .name { font-size: 76px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.015em; line-height: 1;
    display: flex; align-items: baseline; white-space: nowrap; }
  .pin { height: 0.82em; margin-left: 0.12em; }
  .tag { margin-top: 14px; font-size: 32px; color: #5b6670; }
</style></head><body>
  <svg class="map" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <path d="${draw(geoGraticule10())}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.8"/>
    ${land}
  </svg>
  <div class="card">
    <div class="name">Where Is It${pin}</div>
    <div class="tag">The place-finding game · free, no sign-up</div>
  </div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-image-'));
const page = path.join(tmp, 'og.html');
fs.writeFileSync(page, html);
const out = path.join(root, 'assets/og-image.png');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--window-size=${W},${H}`,
  `--screenshot=${out}`,
  `file://${page}`,
]);
fs.rmSync(tmp, { recursive: true });
console.log(`wrote ${path.relative(root, out)}`);
