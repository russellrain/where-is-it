# Where Is It 📍

*The country-finding game.*

A find-the-country map game for classrooms.

**Play it at [whereisit.earth](https://whereisit.earth)**. Teachers can build a quiz at [whereisit.earth/setup.html](https://whereisit.earth/setup.html).

- **Teachers** open `setup.html` and choose regions, subregions, or individual countries (from the list or by clicking the map). Then they copy a link to share.
- **Students** open the link and get one country at a time, with its name and flag, to find on the map. Each country allows 3 guesses (configurable). After that the answer is revealed and the student clicks it to continue, but it counts as missed. A timer runs and a score screen with **Copy score** appears at the end.

## Running it

There's no build step and no server needed. Open `index.html` (student) or `setup.html` (teacher) in a browser.

To serve it locally (closer to how it behaves when hosted):

```sh
npm run serve   # http://localhost:8080
```

### Hosting on GitHub Pages

Push the repo to GitHub, then go to **Settings → Pages → Deploy from branch → `main` / root**. Everything is static and uses relative paths, so it works as-is.

### Electron later

All libraries, map data and flags are bundled locally. Nothing uses ES modules or `fetch()`, so the pages load fine from `file://` inside an Electron `BrowserWindow`.

## Quiz link format

`index.html?t=Africa&c=NG,KE,EG&n=10&g=3&d=1`

| Param | Meaning | Default |
|---|---|---|
| `c` | Comma-separated ISO 3166-1 alpha-2 country codes | required |
| `t` | Quiz title | auto from region |
| `n` | Ask this many (random subset of `c`) each game | all |
| `g` | Guesses per country before the hint | 3 |
| `d` | Grey out and disable countries that aren't in the quiz | 1 |

`setup.html` accepts the same parameters. The **✎ Customize** link on a quiz's start and results screens opens it in `setup.html` so anyone can change it and get their own link.

## Project layout

```
index.html, setup.html   pages
privacy.html             privacy policy (linked from both footers)
css/style.css            all styles
js/common.js             URL parsing, helpers
js/map.js                GeoMap: D3 map with pan/zoom, cursor label, tiny-country dots
js/game.js               student game
js/setup.js              teacher setup
js/data/*.js             generated data (do not edit by hand)
assets/flags/            generated SVG flags
vendor/                  d3, topojson-client, third-party licenses
tools/build-data.mjs     regenerates js/data, assets/flags, vendor from npm packages
```

To regenerate data (for example after upgrading a package): `npm install && npm run build-data`.

## Credits & licenses

- Map shapes: [Natural Earth](https://www.naturalearthdata.com/) (public domain) via [world-atlas](https://github.com/topojson/world-atlas) (ISC)
- Country metadata: [mledoze/countries](https://github.com/mledoze/countries) (ODbL 1.0)
- Flags: [flag-icons](https://github.com/lipis/flag-icons) (MIT)
- [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client) (ISC)

License texts are in `vendor/licenses/`.

The original code in this project is released under the [MIT License](LICENSE). Bundled third-party files keep their own licenses as listed in [LICENSE](LICENSE). In particular, `js/data/countries.js` is a derived database under the ODbL 1.0.
