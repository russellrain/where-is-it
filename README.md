# [Where Is It](https://whereisit.earth) 📍

*The place-finding game.*

A free find-it-on-the-map game. No accounts, no sign-ups.

**Play it at [whereisit.earth](https://whereisit.earth)**. Build your own quiz at [whereisit.earth/setup](https://whereisit.earth/setup).

- **Build a quiz** at `/setup`: pick a map (world countries or U.S. states) and a quiz type (find each place by name or by its capital), and choose regions, subregions, or individual places (from the list or by clicking the map). Then copy a link to share it.
- **Play** by opening the link: you get one place at a time, with its name and flag, to find on the map. Each place allows 3 guesses (configurable). After that the answer is revealed and you click it to continue, but it counts as missed. A timer runs and a score screen with **Copy score** appears at the end.

## Running it

There's no build step and no server needed. Open `/` (the game) or `/setup` (quiz setup) in a browser.

To serve it locally (closer to how it behaves when hosted):

```sh
npm run serve   # http://localhost:8080
```

## Quiz link format

`?t=Africa&c=NG,KE,EG&n=10&g=3&d=1&s=1` or, for U.S. states, `?m=us&c=CA,TX,NY`, or for their capitals `?m=us&q=capitals&c=CA,TX,NY`, or for a state's counties `?m=counties-tx&c=all`

| Param | Meaning | Default |
|---|---|---|
| `m` | Map: `us` for U.S. states (50 states, D.C. and the 5 inhabited territories, by postal code), or `counties-xx` for the counties of one state (`xx` = its postal code; counties by 5-digit FIPS code). Leave out for world countries | world |
| `q` | Quiz type: `capitals` shows each place's capital (e.g. "Sacramento") and the learner finds the place. Places without a capital (D.C., Antarctica, Macau, Heard & McDonald Islands) are left out. On the U.S. map, answered capitals get a star where the city is. Leave out to find places by name | names |
| `c` | Comma-separated ISO 3166-1 alpha-2 country codes, state postal codes with `m=us`, or county FIPS codes with `m=counties-xx`. `all` picks every place on the map (not D.C. or territories) | required |
| `t` | Quiz title | auto from region |
| `n` | Ask this many (random subset of `c`) each game | all |
| `g` | Guesses per country before the hint | 3 |
| `d` | Grey out and disable countries that aren't in the quiz | 1 |
| `s` | Show the running timer while playing (`0` hides it; the time still appears on the results) | 1 |
| `l` | Languages players may use, e.g. `es` or `en,es,fr`. With more than one, players get a language picker. The setup page always sets it, starting from the setup page's own language. | all |

`/setup` accepts the same parameters. The **✎ Customize** link on a quiz's start and results screens opens it in `/setup` so anyone can change it and get their own link.

## Project layout

```
index.html, setup.html   pages
print.html               printable worksheet for a quiz
about.html               about page and privacy policy (linked from both footers)
css/style.css            all styles
js/common.js             URL parsing, helpers, the maps (ATLASES): world countries, U.S. states and counties, and the quiz types (names, capitals)
js/i18n.js               translations (English, Spanish, French, Portuguese), language picker
js/theme.js              light/dark theme, clean URLs
js/map.js                GeoMap: D3 map with pan/zoom, cursor label, tiny-country dots
js/game.js               the game
js/setup.js              quiz setup
js/print.js              the worksheet
js/data/*.js             generated data (do not edit by hand)
assets/flags/            generated SVG flags
vendor/                  d3, d3-composite-projections, topojson-client, qrcode-generator, third-party licenses
tools/build-data.mjs     regenerates js/data, assets/flags, vendor from npm packages
```

To regenerate data (for example after upgrading a package): `npm install && npm run build-data`.

## Languages

The game, setup page and worksheet are available in English, Spanish, French and Portuguese. Players start in the language they last picked, or their device language, as long as the quiz allows it (`l` above). The setup page's own language is separate from the quiz's player languages. The About page (including the privacy policy) is English only.

To add a language: add it to `LANGUAGES` in `js/i18n.js` along with its `STRINGS` and `REGIONS` tables, add it to `TRANSLATIONS` in `tools/build-data.mjs` (and any name fixes to `RENAME_I18N`, and capitals whose names differ from English to `CAPITALS_I18N`), then run `npm run build-data` to regenerate `js/data/country-names.js`. Add its capitals-quiz wording to `VARIANTS.capitals` in `js/i18n.js`. For the U.S. maps, also add the language's `VARIANTS.us`, `VARIANTS['capitals-us']` and `VARIANTS.counties` wording, the U.S. region names to its `REGIONS` table, and any state names that differ from English to `US_NAMES_I18N` in `tools/build-data.mjs`.

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
