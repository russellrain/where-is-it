// Regenerates the bundled data files from npm packages.
//   npm install && npm run build-data
//
// Outputs (committed to the repo so the site runs with no build step):
//   js/data/world.js      window.GEO_WORLD     - TopoJSON country shapes, ids = ISO alpha-2 codes
//   js/data/countries.js  window.GEO_COUNTRIES - names, regions, sovereignty, capital, lat/lng
//   js/data/country-names.js  window.GEO_COUNTRY_NAMES - country names in other app languages
//   js/data/us-states.js  window.GEO_US_STATES - U.S. state shapes (TopoJSON, ids = postal codes), regions, names
//   assets/flags/*.svg    flag images for every country on the map
//   vendor/*.js           d3 + topojson-client + qrcode-generator
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

// Country names in other app languages: app language code -> world-countries translation key.
const TRANSLATIONS = { es: 'spa', fr: 'fra' };
// Fixes for translated names that are awkward, outdated or too long for the game (by country code).
const RENAME_I18N = {
  es: {
    AX: 'Islas Åland',
    BH: 'Baréin',
    BN: 'Brunéi',
    BW: 'Botsuana',
    CD: 'República Democrática del Congo',
    CG: 'República del Congo',
    DJ: 'Yibuti',
    FO: 'Islas Feroe',
    GD: 'Granada',
    GS: 'Georgia del Sur',
    IR: 'Irán',
    KG: 'Kirguistán',
    MF: 'San Martín',
    SH: 'Santa Elena',
    SK: 'Eslovaquia',
    SL: 'Sierra Leona',
    SZ: 'Esuatini',
    TC: 'Islas Turcas y Caicos',
    TF: 'Tierras Australes Francesas',
    VG: 'Islas Vírgenes Británicas',
    ZA: 'Sudáfrica',
  },
  fr: {
    AX: 'Îles Åland',
    CD: 'République démocratique du Congo',
    CG: 'République du Congo',
    CV: 'Cap-Vert',
    GS: 'Géorgie du Sud',
    MM: 'Myanmar',
    PW: 'Palaos',
    SH: 'Sainte-Hélène',
    SX: 'Saint-Martin (Pays-Bas)',
    MF: 'Saint-Martin (France)',
    ST: 'Sao Tomé-et-Principe',
    SZ: 'Eswatini',
    TF: 'Terres australes françaises',
    TL: 'Timor-Leste',
    VA: 'Vatican',
    VN: 'Vietnam',
  },
};
const countryNames = {};
for (const [lang, key] of Object.entries(TRANSLATIONS)) {
  countryNames[lang] = {};
  for (const { code } of countries) {
    const name = RENAME_I18N[lang]?.[code] ?? byAlpha2.get(code).translations?.[key]?.common;
    if (name) countryNames[lang][code] = name;
  }
}

fs.mkdirSync(path.join(root, 'js', 'data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'js', 'data', 'country-names.js'),
  `window.GEO_COUNTRY_NAMES=${JSON.stringify(countryNames).replace(/\},"/g, '},\n"')};\n`,
);
fs.writeFileSync(path.join(root, 'js', 'data', 'world.js'), `window.GEO_WORLD=${JSON.stringify(world)};\n`);
fs.writeFileSync(
  path.join(root, 'js', 'data', 'countries.js'),
  `window.GEO_COUNTRIES=${JSON.stringify(countries, null, 0).replace(/\},\{/g, '},\n{')};\n`,
);

// ---------------------------------------------------------------- U.S. states
// Census Bureau shapes via us-atlas, keyed by postal code, grouped into census regions and divisions.
// Territories are left out: the Albers USA projection only covers the 50 states and D.C.
const US_STATES = {
  // fips: [postal, division]
  '09': ['CT', 'New England'], 23: ['ME', 'New England'], 25: ['MA', 'New England'],
  33: ['NH', 'New England'], 44: ['RI', 'New England'], 50: ['VT', 'New England'],
  34: ['NJ', 'Mid-Atlantic'], 36: ['NY', 'Mid-Atlantic'], 42: ['PA', 'Mid-Atlantic'],
  17: ['IL', 'East North Central'], 18: ['IN', 'East North Central'], 26: ['MI', 'East North Central'],
  39: ['OH', 'East North Central'], 55: ['WI', 'East North Central'],
  19: ['IA', 'West North Central'], 20: ['KS', 'West North Central'], 27: ['MN', 'West North Central'],
  29: ['MO', 'West North Central'], 31: ['NE', 'West North Central'], 38: ['ND', 'West North Central'],
  46: ['SD', 'West North Central'],
  10: ['DE', 'South Atlantic'], 11: ['DC', 'South Atlantic'], 12: ['FL', 'South Atlantic'],
  13: ['GA', 'South Atlantic'], 24: ['MD', 'South Atlantic'], 37: ['NC', 'South Atlantic'],
  45: ['SC', 'South Atlantic'], 51: ['VA', 'South Atlantic'], 54: ['WV', 'South Atlantic'],
  '01': ['AL', 'East South Central'], 21: ['KY', 'East South Central'], 28: ['MS', 'East South Central'],
  47: ['TN', 'East South Central'],
  '05': ['AR', 'West South Central'], 22: ['LA', 'West South Central'], 40: ['OK', 'West South Central'],
  48: ['TX', 'West South Central'],
  '04': ['AZ', 'Mountain'], '08': ['CO', 'Mountain'], 16: ['ID', 'Mountain'], 30: ['MT', 'Mountain'],
  32: ['NV', 'Mountain'], 35: ['NM', 'Mountain'], 49: ['UT', 'Mountain'], 56: ['WY', 'Mountain'],
  '02': ['AK', 'Pacific'], '06': ['CA', 'Pacific'], 15: ['HI', 'Pacific'], 41: ['OR', 'Pacific'], 53: ['WA', 'Pacific'],
};
const US_REGION_OF = {
  'New England': 'Northeast', 'Mid-Atlantic': 'Northeast',
  'East North Central': 'Midwest', 'West North Central': 'Midwest',
  'South Atlantic': 'South', 'East South Central': 'South', 'West South Central': 'South',
  Mountain: 'West', Pacific: 'West',
};
// State names that differ from English (by postal code).
const US_NAMES_I18N = {
  es: {
    DC: 'Distrito de Columbia', HI: 'Hawái', LA: 'Luisiana', MI: 'Míchigan', MS: 'Misisipi', MO: 'Misuri',
    NH: 'Nuevo Hampshire', NJ: 'Nueva Jersey', NM: 'Nuevo México', NY: 'Nueva York', NC: 'Carolina del Norte',
    ND: 'Dakota del Norte', PA: 'Pensilvania', SC: 'Carolina del Sur', SD: 'Dakota del Sur', WV: 'Virginia Occidental',
  },
  fr: {
    CA: 'Californie', NC: 'Caroline du Nord', SC: 'Caroline du Sud', ND: 'Dakota du Nord', SD: 'Dakota du Sud',
    DC: 'District de Columbia', FL: 'Floride', GA: 'Géorgie', HI: 'Hawaï', LA: 'Louisiane', NM: 'Nouveau-Mexique',
    PA: 'Pennsylvanie', VA: 'Virginie', WV: 'Virginie-Occidentale',
  },
};

const usTopo = readJson(nm('us-atlas', 'states-10m.json'));
const usGeoms = usTopo.objects.states.geometries.filter((g) => US_STATES[g.id]);
const usPlaces = usGeoms
  .map((g) => {
    const [code, subregion] = US_STATES[g.id];
    // `state` is false for D.C., which setup lists only when "Include Washington, D.C." is ticked.
    return { code, name: g.properties.name, region: US_REGION_OF[subregion], subregion, state: code !== 'DC' };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const usStates = {
  topo: {
    type: 'Topology',
    bbox: usTopo.bbox,
    transform: usTopo.transform,
    arcs: usTopo.arcs,
    objects: {
      states: { type: 'GeometryCollection', geometries: usGeoms.map((g) => ({ type: g.type, arcs: g.arcs, id: US_STATES[g.id][0] })) },
    },
  },
  places: usPlaces,
  names: US_NAMES_I18N,
};
if (usPlaces.length !== 51) throw new Error(`expected 50 states + DC, got ${usPlaces.length}`);
fs.writeFileSync(path.join(root, 'js', 'data', 'us-states.js'), `window.GEO_US_STATES=${JSON.stringify(usStates)};\n`);

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
fs.copyFileSync(nm('qrcode-generator', 'qrcode.js'), path.join(vendor, 'qrcode.js'));
// qrcode-generator has no LICENSE file; its MIT notice is in the header of qrcode.js.
fs.writeFileSync(
  path.join(vendor, 'licenses', 'qrcode-generator.txt'),
  'qrcode-generator, Copyright (c) 2009 Kazuhiko Arase. Licensed under the MIT license:\n' +
    'http://www.opensource.org/licenses/mit-license.php\n\n' +
    'The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.\n',
);
for (const pkg of ['d3', 'topojson-client', 'world-atlas', 'us-atlas', 'flag-icons', 'world-countries']) {
  const lic = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((f) => nm(pkg, f)).find((f) => fs.existsSync(f));
  if (lic) fs.copyFileSync(lic, path.join(vendor, 'licenses', `${pkg}.txt`));
}

console.log(`countries: ${countries.length} (${countries.filter((c) => c.sovereign).length} sovereign)`);
console.log(`unassigned shapes: ${other.map((g) => g.properties?.name).join(', ')}`);
console.log(`U.S.: ${usPlaces.filter((p) => p.state).length} states + D.C.`);
if (missingFlags.length) console.log(`missing flags: ${missingFlags.join(', ')}`);
