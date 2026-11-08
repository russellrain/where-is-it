// Loads the shapes of the one map the page shows, picked by the link's `m` parameter like ATLAS in common.js:
// js/data/us-shapes.js for ?m=us, js/data/counties/xx.js for ?m=counties-xx, otherwise the world (js/data/world.js,
// the biggest file by far). Runs while the page is parsing, after js/data/us-counties.js (which lists the states
// with counties), so the script it writes in runs before common.js.
(function () {
  'use strict';
  const m = (new URLSearchParams(location.search).get('m') || '').toLowerCase();
  document.write(`<script src="${shapesFile(m)}"><\/script>`);

  /** The shapes file of a map id ('us', 'counties-tx', anything else is the world). Setup uses it too (mapSaved). */
  function shapesFile(id) {
    const county = /^counties-([a-z]{2})$/.exec(id);
    if (id === 'us') return 'js/data/us-shapes.js';
    if (county && window.GEO_US_COUNTY_STATES && GEO_US_COUNTY_STATES[county[1].toUpperCase()]) return `js/data/counties/${county[1]}.js`;
    return 'js/data/world.js';
  }
  window.GEO_SHAPES_FILE = shapesFile;
})();
