// Regenerates the bundled data files from npm packages.
//   npm install && npm run build-data
//
// Outputs (committed to the repo so the site runs with no build step):
//   js/data/world.js      window.GEO_WORLD     - TopoJSON country shapes, ids = ISO alpha-2 codes
//   js/data/countries.js  window.GEO_COUNTRIES - names, regions, sovereignty, capital, lat/lng
//   assets/flags/*.svg    flag images for every country on the map
//   vendor/*.js           d3 + topojson-client
//
// Data is emitted as .js (not .json) so pages work from file:// (and in Electron) without fetch().

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeArcs } from 'topojson-client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const topo = readJson(nm('world-atlas', 'countries-50m.json'));
const wc = readJson(nm('world-countries', 'countries.json'));

// Recognised states that are not UN members but should count as "countries".
const EXTRA_SOVEREIGN = new Set(['XK', 'TW', 'PS', 'VA']);
// Natural Earth features without an ISO numeric code.
const NAME_TO_CODE = { Kosovo: 'XK' };
// Breakaway areas merged into the internationally recognised country.
const MERGE_INTO = { Somaliland: 'SO', 'N. Cyprus': 'CY' };
// Friendlier display names.
const RENAME = {
  'Saint Helena, Ascension and Tristan da Cunha': 'Saint Helena',
  'French Southern and Antarctic Lands': 'French Southern Lands',
  'Heard Island and McDonald Islands': 'Heard & McDonald Islands',
  'United States Virgin Islands': 'U.S. Virgin Islands',
};

const byNumeric = new Map(wc.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
const byAlpha2 = new Map(wc.map((c) => [c.cca2, c]));

const groups = new Map(); // code -> [geometry]
const other = [];
for (const g of topo.objects.countries.geometries) {
  const name = g.properties?.name;
  const code = byNumeric.get(g.id)?.cca2 ?? NAME_TO_CODE[name] ?? MERGE_INTO[name];
  if (!code) {
    other.push(g);
    continue;
  }
  if (!groups.has(code)) groups.set(code, []);
  groups.get(code).push(g);
}

const geometries = [];
for (const [code, gs] of groups) {
  const geom = gs.length === 1 ? { type: gs[0].type, arcs: gs[0].arcs } : mergeArcs(topo, gs);
  geometries.push({ ...geom, id: code });
}
other.forEach((g, i) => geometries.push({ type: g.type, arcs: g.arcs, id: `_${i}` }));

const world = {
  type: 'Topology',
  bbox: topo.bbox,
  transform: topo.transform,
  arcs: topo.arcs,
  objects: { countries: { type: 'GeometryCollection', geometries } },
};

const countries = [...groups.keys()]
  .map((code) => {
    const c = byAlpha2.get(code);
    return {
      code,
      name: RENAME[c.name.common] ?? c.name.common,
      region: c.region === 'Antarctic' ? 'Antarctica' : c.region,
      subregion: c.subregion || (c.region === 'Antarctic' ? 'Antarctica' : c.region),
      sovereign: Boolean(c.unMember || EXTRA_SOVEREIGN.has(code)),
      capital: c.capital?.[0] ?? '',
      latlng: c.latlng,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.join(root, 'js', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'js', 'data', 'world.js'), `window.GEO_WORLD=${JSON.stringify(world)};\n`);
fs.writeFileSync(
  path.join(root, 'js', 'data', 'countries.js'),
  `window.GEO_COUNTRIES=${JSON.stringify(countries, null, 0).replace(/\},\{/g, '},\n{')};\n`,
);

// Flags
const flagDir = path.join(root, 'assets', 'flags');
fs.rmSync(flagDir, { recursive: true, force: true });
fs.mkdirSync(flagDir, { recursive: true });
const missingFlags = [];
for (const { code } of countries) {
  const src = nm('flag-icons', 'flags', '4x3', `${code.toLowerCase()}.svg`);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(flagDir, `${code.toLowerCase()}.svg`));
  else missingFlags.push(code);
}

// Vendor libraries + licenses
const vendor = path.join(root, 'vendor');
fs.mkdirSync(path.join(vendor, 'licenses'), { recursive: true });
fs.copyFileSync(nm('d3', 'dist', 'd3.min.js'), path.join(vendor, 'd3.min.js'));
fs.copyFileSync(nm('topojson-client', 'dist', 'topojson-client.min.js'), path.join(vendor, 'topojson-client.min.js'));
for (const pkg of ['d3', 'topojson-client', 'world-atlas', 'flag-icons', 'world-countries']) {
  const lic = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((f) => nm(pkg, f)).find((f) => fs.existsSync(f));
  if (lic) fs.copyFileSync(lic, path.join(vendor, 'licenses', `${pkg}.txt`));
}

console.log(`countries: ${countries.length} (${countries.filter((c) => c.sovereign).length} sovereign)`);
console.log(`unassigned shapes: ${other.map((g) => g.properties?.name).join(', ')}`);
if (missingFlags.length) console.log(`missing flags: ${missingFlags.join(', ')}`);
