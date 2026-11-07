// Regenerates the bundled data files from npm packages.
//   npm install && npm run build-data
//
// Outputs (committed to the repo so the site runs with no build step):
//   js/data/world.js      window.GEO_WORLD     - TopoJSON country shapes, ids = ISO alpha-2 codes
//   js/data/countries.js  window.GEO_COUNTRIES - names, regions, sovereignty, capital, lat/lng
//   js/data/country-names.js  window.GEO_COUNTRY_NAMES, GEO_CAPITAL_NAMES - country and capital names in other app languages
//   js/data/us-states.js  window.GEO_US_STATES - U.S. state shapes (TopoJSON, ids = postal codes), regions, names, capitals
//   assets/flags/*.svg    flag images for every country on the map
//   vendor/*.js           d3 + d3-composite-projections + topojson-client + qrcode-generator
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

// Capitals that world-countries has outdated or in an unusual spelling (by country code).
const CAPITAL_RENAME = {
  KZ: 'Astana', // renamed back from Nur-Sultan in 2022
  MN: 'Ulaanbaatar',
  IS: 'Reykjavík',
  PF: 'Papeete',
  SM: 'San Marino',
  US: 'Washington, D.C.',
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
      capital: CAPITAL_RENAME[code] ?? c.capital?.[0] ?? '',
      latlng: c.latlng,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Country names in other app languages: app language code -> world-countries translation key.
const TRANSLATIONS = { es: 'spa', fr: 'fra', pt: 'por' };
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
  // The source data mixes in European Portuguese spellings; the app uses Brazilian Portuguese.
  pt: {
    AM: 'Armênia',
    AX: 'Ilhas Åland',
    AZ: 'Azerbaijão',
    BW: 'Botsuana',
    BY: 'Bielorrússia',
    CG: 'República do Congo',
    CW: 'Curaçao',
    CZ: 'Tchéquia',
    DJ: 'Djibuti',
    EE: 'Estônia',
    GL: 'Groenlândia',
    GS: 'Geórgia do Sul',
    HM: 'Ilhas Heard e McDonald',
    IR: 'Irã',
    KE: 'Quênia',
    KY: 'Ilhas Cayman',
    LV: 'Letônia',
    MC: 'Mônaco',
    MF: 'São Martinho (França)',
    MG: 'Madagascar',
    MK: 'Macedônia do Norte',
    MP: 'Ilhas Marianas do Norte',
    NC: 'Nova Caledônia',
    NL: 'Países Baixos',
    PE: 'Peru',
    PL: 'Polônia',
    RO: 'Romênia',
    SH: 'Santa Helena',
    SI: 'Eslovênia',
    SX: 'São Martinho (Países Baixos)',
    SZ: 'Essuatíni',
    TF: 'Terras Austrais Francesas',
    TJ: 'Tadjiquistão',
    TM: 'Turcomenistão',
    TT: 'Trinidad e Tobago',
    TW: 'Taiwan',
    VC: 'São Vicente e Granadinas',
    VG: 'Ilhas Virgens Britânicas',
    VI: 'Ilhas Virgens Americanas',
    VN: 'Vietnã',
    YE: 'Iêmen',
    ZW: 'Zimbábue',
  },
};
// Capital names in other app languages, where they differ from English (world-countries has no translations
// for capitals). Anything not listed shows its English name.
const CAPITALS_I18N = {
  es: {
    AE: 'Abu Dabi', AF: 'Kabul', AM: 'Ereván', AT: 'Viena', AZ: 'Bakú', BD: 'Daca', BE: 'Bruselas', BF: 'Uagadugú',
    BG: 'Sofía', BR: 'Brasilia', BS: 'Nasáu', BT: 'Timbu', CH: 'Berna', CM: 'Yaundé', CN: 'Pekín', CU: 'La Habana',
    CZ: 'Praga', DE: 'Berlín', DJ: 'Yibuti', DK: 'Copenhague', DZ: 'Argel', EE: 'Tallin', EG: 'El Cairo',
    ES: 'Madrid', ET: 'Adís Abeba', FR: 'París', GB: 'Londres', GE: 'Tiflis', GN: 'Conakri', GR: 'Atenas',
    GT: 'Ciudad de Guatemala', HT: 'Puerto Príncipe', ID: 'Yakarta', IE: 'Dublín', IL: 'Jerusalén', IN: 'Nueva Delhi',
    IQ: 'Bagdad', IR: 'Teherán', IS: 'Reikiavik', IT: 'Roma', JO: 'Amán', JP: 'Tokio', KG: 'Biskek', KH: 'Nom Pen',
    KP: 'Pionyang', KR: 'Seúl', KW: 'Ciudad de Kuwait', LA: 'Vientián', LU: 'Luxemburgo', LY: 'Trípoli',
    MC: 'Mónaco', MD: 'Chisináu', MK: 'Skopie', MM: 'Naipyidó', MN: 'Ulán Bator', MR: 'Nuakchot', MT: 'La Valeta',
    MW: 'Lilongüe', MX: 'Ciudad de México', NC: 'Numea', NG: 'Abuya', NL: 'Ámsterdam', NP: 'Katmandú',
    OM: 'Mascate', PA: 'Ciudad de Panamá', PL: 'Varsovia', PS: 'Ramala', PT: 'Lisboa', RO: 'Bucarest', RS: 'Belgrado',
    RU: 'Moscú', SA: 'Riad', SE: 'Estocolmo', SG: 'Singapur', SI: 'Liubliana', SO: 'Mogadiscio', SS: 'Yuba',
    ST: 'Santo Tomé', SD: 'Jartum', SY: 'Damasco', TJ: 'Dusambé', TM: 'Asjabad', TN: 'Túnez', TT: 'Puerto España',
    TW: 'Taipéi', UA: 'Kiev', US: 'Washington D. C.', UZ: 'Taskent', VA: 'Ciudad del Vaticano', VN: 'Hanói',
    YE: 'Saná',
  },
  fr: {
    AD: 'Andorre-la-Vieille', AE: 'Abou Dabi', AF: 'Kaboul', AM: 'Erevan', AT: 'Vienne', AZ: 'Bakou', BD: 'Dacca',
    BE: 'Bruxelles', BR: 'Brasilia', BT: 'Thimphou', CH: 'Berne', CN: 'Pékin', CO: 'Bogota', CU: 'La Havane',
    CY: 'Nicosie', DK: 'Copenhague', DZ: 'Alger', EG: 'Le Caire', ET: 'Addis-Abeba', GB: 'Londres', GE: 'Tbilissi',
    GR: 'Athènes', GT: 'Guatemala', IL: 'Jérusalem', IQ: 'Bagdad', IR: 'Téhéran', KG: 'Bichkek', KW: 'Koweït',
    LB: 'Beyrouth', MN: 'Oulan-Bator', MT: 'La Valette', MU: 'Port-Louis', MX: 'Mexico', NP: 'Katmandou',
    OM: 'Mascate', PA: 'Panama', PL: 'Varsovie', PT: 'Lisbonne', RO: 'Bucarest', RU: 'Moscou', SA: 'Riyad',
    SG: 'Singapour', SM: 'Saint-Marin', SO: 'Mogadiscio', SY: 'Damas', TD: 'N’Djaména', TJ: 'Douchanbé',
    TM: 'Achgabat', TT: 'Port-d’Espagne', UZ: 'Tachkent', VA: 'Cité du Vatican', VN: 'Hanoï', US: 'Washington',
    YE: 'Sanaa',
  },
  pt: {
    AD: 'Andorra-a-Velha', AF: 'Cabul', AM: 'Erevan', AT: 'Viena', BD: 'Daca', BE: 'Bruxelas', BF: 'Uagadugu',
    BG: 'Sófia', BT: 'Timbu', CH: 'Berna', CM: 'Iaundé', CN: 'Pequim', CY: 'Nicósia', CZ: 'Praga', DE: 'Berlim',
    DJ: 'Djibuti', DK: 'Copenhague', DZ: 'Argel', ES: 'Madri', ET: 'Adis Abeba', FI: 'Helsinque', GB: 'Londres',
    GN: 'Conacri', GR: 'Atenas', GT: 'Cidade da Guatemala', HT: 'Porto Príncipe', ID: 'Jacarta', IL: 'Jerusalém',
    IN: 'Nova Délhi', IQ: 'Bagdá', IR: 'Teerã', IT: 'Roma', JO: 'Amã', JP: 'Tóquio', KE: 'Nairóbi',
    KR: 'Seul', KW: 'Cidade do Kuwait', LB: 'Beirute', LU: 'Luxemburgo', LY: 'Trípoli', MC: 'Mônaco',
    MD: 'Chisinau', MN: 'Ulan Bator', MT: 'Valeta', MX: 'Cidade do México', NL: 'Amsterdã', NP: 'Catmandu',
    OM: 'Mascate', PA: 'Cidade do Panamá', PL: 'Varsóvia', PT: 'Lisboa', PY: 'Assunção', RO: 'Bucareste',
    RS: 'Belgrado', RU: 'Moscou', SA: 'Riad', SD: 'Cartum', SE: 'Estocolmo', SG: 'Singapura', SI: 'Liubliana',
    SM: 'São Marinho', SN: 'Dacar', SO: 'Mogadíscio', SY: 'Damasco', TJ: 'Duchambé', TN: 'Túnis',
    TT: 'Porto de Espanha', TW: 'Taipé', UA: 'Kiev', VA: 'Cidade do Vaticano', VN: 'Hanói', YE: 'Saná',
  },
};
const capitalNames = {};
for (const lang of Object.keys(TRANSLATIONS)) {
  capitalNames[lang] = {};
  for (const [code, name] of Object.entries(CAPITALS_I18N[lang] || {})) {
    const c = countries.find((x) => x.code === code);
    if (!c?.capital) throw new Error(`CAPITALS_I18N.${lang}.${code}: no such country, or it has no capital`);
    if (name !== c.capital) capitalNames[lang][code] = name;
  }
}

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
  `window.GEO_COUNTRY_NAMES=${JSON.stringify(countryNames).replace(/\},"/g, '},\n"')};\n` +
    `window.GEO_CAPITAL_NAMES=${JSON.stringify(capitalNames).replace(/\},"/g, '},\n"')};\n`,
);
fs.writeFileSync(path.join(root, 'js', 'data', 'world.js'), `window.GEO_WORLD=${JSON.stringify(world)};\n`);
fs.writeFileSync(
  path.join(root, 'js', 'data', 'countries.js'),
  `window.GEO_COUNTRIES=${JSON.stringify(countries, null, 0).replace(/\},\{/g, '},\n{')};\n`,
);

// ---------------------------------------------------------------- U.S. states
// Census Bureau shapes via us-atlas, keyed by postal code, grouped into census regions and divisions.
// The inhabited territories are listed under their own "Territories" region. They only fit on the map with
// extra insets (geoAlbersUsaTerritories), so the pages switch to that layout when a quiz includes one.
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
  60: ['AS', 'Territories'], 66: ['GU', 'Territories'], 69: ['MP', 'Territories'], 72: ['PR', 'Territories'],
  78: ['VI', 'Territories'],
};
const US_RENAME = { 'Commonwealth of the Northern Mariana Islands': 'Northern Mariana Islands', 'United States Virgin Islands': 'U.S. Virgin Islands' };
const US_REGION_OF = {
  'New England': 'Northeast', 'Mid-Atlantic': 'Northeast',
  'East North Central': 'Midwest', 'West North Central': 'Midwest',
  'South Atlantic': 'South', 'East South Central': 'South', 'West South Central': 'South',
  Mountain: 'West', Pacific: 'West',
  Territories: 'Territories',
};
// State names that differ from English (by postal code).
const US_NAMES_I18N = {
  es: {
    DC: 'Distrito de Columbia', HI: 'Hawái', LA: 'Luisiana', MI: 'Míchigan', MS: 'Misisipi', MO: 'Misuri',
    NH: 'Nuevo Hampshire', NJ: 'Nueva Jersey', NM: 'Nuevo México', NY: 'Nueva York', NC: 'Carolina del Norte',
    ND: 'Dakota del Norte', PA: 'Pensilvania', SC: 'Carolina del Sur', SD: 'Dakota del Sur', WV: 'Virginia Occidental',
    AS: 'Samoa Americana', MP: 'Islas Marianas del Norte', VI: 'Islas Vírgenes de EE. UU.',
  },
  fr: {
    CA: 'Californie', NC: 'Caroline du Nord', SC: 'Caroline du Sud', ND: 'Dakota du Nord', SD: 'Dakota du Sud',
    DC: 'District de Columbia', FL: 'Floride', GA: 'Géorgie', HI: 'Hawaï', LA: 'Louisiane', NM: 'Nouveau-Mexique',
    PA: 'Pennsylvanie', VA: 'Virginie', WV: 'Virginie-Occidentale',
    AS: 'Samoa américaines', MP: 'Îles Mariannes du Nord', PR: 'Porto Rico', VI: 'Îles Vierges des États-Unis',
  },
  pt: {
    CA: 'Califórnia', NC: 'Carolina do Norte', SC: 'Carolina do Sul', ND: 'Dakota do Norte', SD: 'Dakota do Sul',
    DC: 'Distrito de Colúmbia', FL: 'Flórida', GA: 'Geórgia', HI: 'Havaí', LA: 'Luisiana', NM: 'Novo México',
    NJ: 'Nova Jérsei', NY: 'Nova York', PA: 'Pensilvânia', VA: 'Virgínia', WV: 'Virgínia Ocidental',
    AS: 'Samoa Americana', MP: 'Ilhas Marianas do Norte', PR: 'Porto Rico', VI: 'Ilhas Virgens Americanas',
  },
};

// Capitals for the capitals quiz: [name, lat, lng] of the capitol building. D.C. has none (it's a federal
// district, not a state), so it's left out of capitals quizzes.
const US_CAPITALS = {
  AL: ['Montgomery', 32.377, -86.301], AK: ['Juneau', 58.302, -134.411], AZ: ['Phoenix', 33.448, -112.097],
  AR: ['Little Rock', 34.747, -92.289], CA: ['Sacramento', 38.577, -121.494], CO: ['Denver', 39.739, -104.985],
  CT: ['Hartford', 41.764, -72.682], DE: ['Dover', 39.157, -75.520], FL: ['Tallahassee', 30.438, -84.281],
  GA: ['Atlanta', 33.749, -84.388], HI: ['Honolulu', 21.307, -157.857], ID: ['Boise', 43.618, -116.200],
  IL: ['Springfield', 39.798, -89.655], IN: ['Indianapolis', 39.768, -86.163], IA: ['Des Moines', 41.591, -93.604],
  KS: ['Topeka', 39.048, -95.678], KY: ['Frankfort', 38.187, -84.875], LA: ['Baton Rouge', 30.457, -91.187],
  ME: ['Augusta', 44.307, -69.782], MD: ['Annapolis', 38.979, -76.491], MA: ['Boston', 42.358, -71.064],
  MI: ['Lansing', 42.734, -84.555], MN: ['Saint Paul', 44.955, -93.102], MS: ['Jackson', 32.304, -90.182],
  MO: ['Jefferson City', 38.579, -92.173], MT: ['Helena', 46.586, -112.018], NE: ['Lincoln', 40.808, -96.700],
  NV: ['Carson City', 39.164, -119.766], NH: ['Concord', 43.207, -71.538], NJ: ['Trenton', 40.221, -74.770],
  NM: ['Santa Fe', 35.682, -105.940], NY: ['Albany', 42.653, -73.757], NC: ['Raleigh', 35.780, -78.639],
  ND: ['Bismarck', 46.821, -100.783], OH: ['Columbus', 39.961, -82.999], OK: ['Oklahoma City', 35.492, -97.503],
  OR: ['Salem', 44.938, -123.030], PA: ['Harrisburg', 40.264, -76.884], RI: ['Providence', 41.831, -71.415],
  SC: ['Columbia', 34.000, -81.033], SD: ['Pierre', 44.367, -100.346], TN: ['Nashville', 36.166, -86.784],
  TX: ['Austin', 30.275, -97.740], UT: ['Salt Lake City', 40.777, -111.888], VT: ['Montpelier', 44.262, -72.581],
  VA: ['Richmond', 37.539, -77.433], WA: ['Olympia', 47.036, -122.905], WV: ['Charleston', 38.336, -81.612],
  WI: ['Madison', 43.075, -89.384], WY: ['Cheyenne', 41.140, -104.820],
  AS: ['Pago Pago', -14.279, -170.701], GU: ['Hagåtña', 13.476, 144.750], MP: ['Saipan', 15.212, 145.754],
  PR: ['San Juan', 18.466, -66.106], VI: ['Charlotte Amalie', 18.342, -64.932],
};

const usTopo = readJson(nm('us-atlas', 'states-10m.json'));
const usGeoms = usTopo.objects.states.geometries.filter((g) => US_STATES[g.id]);
const usPlaces = usGeoms
  .map((g) => {
    const [code, subregion] = US_STATES[g.id];
    const name = US_RENAME[g.properties.name] ?? g.properties.name;
    // kind: 'state', 'district' (D.C.) or 'territory'. Setup lists the last two only when they're included.
    const kind = code === 'DC' ? 'district' : subregion === 'Territories' ? 'territory' : 'state';
    const place = { code, name, region: US_REGION_OF[subregion], subregion, kind };
    if (US_CAPITALS[code]) {
      const [capital, lat, lng] = US_CAPITALS[code];
      Object.assign(place, { capital, capitalLatlng: [lat, lng] });
    }
    return place;
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
if (usPlaces.filter((p) => p.capital).length !== 55) throw new Error('expected a capital for every state and territory');
if (usPlaces.length !== 56) throw new Error(`expected 50 states, D.C. and 5 territories, got ${usPlaces.length}`);
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
fs.copyFileSync(nm('d3-composite-projections', 'd3-composite-projections.min.js'), path.join(vendor, 'd3-composite-projections.min.js'));
// qrcode-generator has no LICENSE file; its MIT notice is in the header of qrcode.js.
fs.writeFileSync(
  path.join(vendor, 'licenses', 'qrcode-generator.txt'),
  'qrcode-generator, Copyright (c) 2009 Kazuhiko Arase. Licensed under the MIT license:\n' +
    'http://www.opensource.org/licenses/mit-license.php\n\n' +
    'The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.\n',
);
for (const pkg of ['d3', 'topojson-client', 'world-atlas', 'us-atlas', 'd3-composite-projections', 'flag-icons', 'world-countries']) {
  const lic = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE'].map((f) => nm(pkg, f)).find((f) => fs.existsSync(f));
  if (lic) fs.copyFileSync(lic, path.join(vendor, 'licenses', `${pkg}.txt`));
}

console.log(`countries: ${countries.length} (${countries.filter((c) => c.sovereign).length} sovereign)`);
console.log(`unassigned shapes: ${other.map((g) => g.properties?.name).join(', ')}`);
console.log(`U.S.: ${usPlaces.filter((p) => p.kind === 'state').length} states, D.C., ${usPlaces.filter((p) => p.kind === 'territory').length} territories`);
if (missingFlags.length) console.log(`missing flags: ${missingFlags.join(', ')}`);
