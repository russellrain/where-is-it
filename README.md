# [Where Is It](https://whereisit.earth) 📍

*The place-finding game.*

A find-it-on-the-map game for classrooms.

**Play it at [whereisit.earth](https://whereisit.earth)**. Teachers can build a quiz at [whereisit.earth/setup](https://whereisit.earth/setup).

- **Teachers** open `/setup`, pick a map (world countries or U.S. states), and choose regions, subregions, or individual places (from the list or by clicking the map). Then they copy a link to share.
- **Students** open the link and get one country at a time, with its name and flag, to find on the map. Each country allows 3 guesses (configurable). After that the answer is revealed and the student clicks it to continue, but it counts as missed. A timer runs and a score screen with **Copy score** appears at the end.

## Running it

There's no build step and no server needed. Open `/` (student) or `/setup` (teacher) in a browser.

To serve it locally (closer to how it behaves when hosted):

```sh
npm run serve   # http://localhost:8080
```

### Hosting on GitHub Pages

Push the repo to GitHub, then go to **Settings → Pages → Deploy from branch → `main` / root**. Everything is static and uses relative paths, so it works as-is.

### Electron later

All libraries, map data and flags are bundled locally. Nothing uses ES modules or `fetch()`, so the pages load fine from `file://` inside an Electron `BrowserWindow`.

## Quiz link format

`?t=Africa&c=NG,KE,EG&n=10&g=3&d=1&s=1` or, for U.S. states, `?m=us&c=CA,TX,NY`

| Param | Meaning | Default |
|---|---|---|
| `m` | Map: `us` for U.S. states (50 states, D.C. and the 5 inhabited territories, by postal code). Leave out for world countries | world |
| `c` | Comma-separated ISO 3166-1 alpha-2 country codes, or state postal codes with `m=us` | required |
| `t` | Quiz title | auto from region |
| `n` | Ask this many (random subset of `c`) each game | all |
| `g` | Guesses per country before the hint | 3 |
| `d` | Grey out and disable countries that aren't in the quiz | 1 |
| `s` | Show the running timer while playing (`0` hides it; the time still appears on the results) | 1 |
| `l` | Languages students may use, e.g. `es` or `en,es,fr`. With more than one, students get a language picker. The setup page always sets it, starting from the teacher's own page language. | all |

`/setup` accepts the same parameters. The **✎ Customize** link on a quiz's start and results screens opens it in `/setup` so anyone can change it and get their own link.

## Project layout

```
index.html, setup.html   pages
about.html               about page and privacy policy (linked from both footers)
privacy.html             redirect to about.html#privacy for old links
css/style.css            all styles
js/common.js             URL parsing, helpers
js/i18n.js               translations (English, Spanish, French), language picker
js/map.js                GeoMap: D3 map with pan/zoom, cursor label, tiny-country dots
js/game.js               student game
js/setup.js              teacher setup
js/common.js             also defines the maps (ATLASES): world countries, U.S. states
js/data/*.js             generated data (do not edit by hand)
assets/flags/            generated SVG flags
vendor/                  d3, d3-composite-projections, topojson-client, qrcode-generator, third-party licenses
tools/build-data.mjs     regenerates js/data, assets/flags, vendor from npm packages
```

To regenerate data (for example after upgrading a package): `npm install && npm run build-data`.

## Languages

The game, setup page and worksheet are available in English, Spanish and French. Students start in the language they last picked, or their device language, as long as the quiz allows it (`l` above). The setup page's own language is separate from the quiz's student languages. The About page (including the privacy policy) is English only.

To add a language: add it to `LANGUAGES` in `js/i18n.js` along with its `STRINGS` and `REGIONS` tables, add it to `TRANSLATIONS` in `tools/build-data.mjs` (and any name fixes to `RENAME_I18N`), then run `npm run build-data` to regenerate `js/data/country-names.js`. For the U.S. states map, also add the language's `VARIANTS.us` wording in `js/i18n.js`, the U.S. region names to its `REGIONS` table, and any state names that differ from English to `US_NAMES_I18N` in `tools/build-data.mjs`.

## Adding another map

Maps are defined in `ATLASES` in `js/common.js`. To add, say, Canadian provinces: generate a data file in `tools/build-data.mjs` like `js/data/us-states.js` (TopoJSON shapes with short ids, plus `places` with `code`, `name`, `region` and `subregion`), add an entry to `ATLASES` with its projection, add a button to the map picker in `setup.html`, add a `VARIANTS` entry in `js/i18n.js` for its wording ("province" instead of "country"), and add quick-play presets in `showWelcome()` in `js/game.js`.

## Credits & licenses

- Map shapes: [Natural Earth](https://www.naturalearthdata.com/) (public domain) via [world-atlas](https://github.com/topojson/world-atlas) (ISC)
- U.S. territory insets: [d3-composite-projections](https://github.com/rveciana/d3-composite-projections) (BSD-3-Clause)
- U.S. state shapes: [U.S. Census Bureau](https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html) (public domain) via [us-atlas](https://github.com/topojson/us-atlas) (ISC)
- Country metadata: [mledoze/countries](https://github.com/mledoze/countries) (ODbL 1.0)
- Flags: [flag-icons](https://github.com/lipis/flag-icons) (MIT)
- [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client) (ISC)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT)

License texts are in `vendor/licenses/`.

The original code in this project is released under the [MIT License](LICENSE). Bundled third-party files keep their own licenses as listed in [LICENSE](LICENSE). In particular, `js/data/countries.js` is a derived database under the ODbL 1.0.
