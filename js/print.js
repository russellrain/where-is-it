// Printable worksheet: a map cropped to the quiz countries, each marked with a number,
// plus an alphabetical word bank. Students write the matching number next to each name.
//
// Sheets are sized in inches so the on-screen preview lays out exactly like the printout;
// the map is drawn after layout so it can fill whatever space the word bank leaves.
(function () {
  'use strict';
  const { el, countryName } = WhereIsIt;
  const { t } = I18N;
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Printable area (inches) that fits both US Letter and A4 with 0.4in margins.
  const SHEET = { landscape: [10, 7.2], portrait: [7.2, 10] };
  const BADGE_R = 9; // px; numbered marker radius
  const BADGE_R_WIDE = 11.5; // px; for 3-digit numbers
  const SMALL_AREA = 500; // px²; countries smaller than this get a pointer line instead of a centered number

  const quiz = WhereIsIt.parseQuiz(location.search);
  $('back').href = WhereIsIt.pageUrl('setup', location.search);
  $('print').onclick = () => window.print();

  // ---------------------------------------------------------------- geography

  const projection = d3
    .geoNaturalEarth1()
    .rotate([WhereIsIt.rotationFor(quiz.codes), 0])
    .fitWidth(1000, { type: 'Sphere' });
  const path = d3.geoPath(projection);
  const sphere = path({ type: 'Sphere' });
  const topo = window.GEO_WORLD;
  const shapes = [];
  const shapeByCode = new Map();
  for (const f of topojson.feature(topo, topo.objects.countries).features) {
    const d = path(f);
    if (!d) continue;
    const s = { code: String(f.id), d, f };
    shapes.push(s);
    shapeByCode.set(s.code, s);
  }

  const codes = quiz.codes.filter((c) => shapeByCode.has(c));
  const info = new Map(codes.map((c) => [c, GeoMap.measure(path, shapeByCode.get(c).f)]));

  // Selection bounds, padded, with a minimum size so a single small country still shows its neighbours.
  const bounds = (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { bounds: b } of info.values()) {
      x0 = Math.min(x0, b[0][0]);
      y0 = Math.min(y0, b[0][1]);
      x1 = Math.max(x1, b[1][0]);
      y1 = Math.max(y1, b[1][1]);
    }
    const w = Math.max(x1 - x0, 40), h = Math.max(y1 - y0, 24);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { cx, cy, w: w * 1.12, h: h * 1.12 };
  })();

  // Number countries in reading order (top-to-bottom bands, then left-to-right) so they're easy to find.
  const numbered = (() => {
    const band = Math.max(bounds.h / 5, 1);
    const top = bounds.cy - bounds.h / 2;
    const list = codes.map((code) => ({ code, center: info.get(code).center }));
    list.sort((a, b) => {
      const ba = Math.floor((a.center[1] - top) / band), bb = Math.floor((b.center[1] - top) / band);
      return ba - bb || a.center[0] - b.center[0];
    });
    return list.map((x, i) => ({ ...x, n: i + 1 }));
  })();
  let crowded = 0; // how many numbers ended up far from their country on the last map drawn
  const byName = () => numbered.slice().sort((a, b) => I18N.compare(countryName(a.code), countryName(b.code)));

  // ---------------------------------------------------------------- layout

  function renderSheets() {
    const v = $('orientation').value;
    if (v !== 'auto' || !codes.length) return layout(v === 'auto' ? 'landscape' : v);
    // Auto: lay out both ways and keep whichever shows the map at the larger scale.
    const landscape = layout('landscape');
    if (layout('portrait') <= landscape) layout('landscape');
  }

  function render() {
    renderSheets();
    // Screen-only nudge when the map has more numbers than it can show clearly.
    $('crowded').hidden = !(crowded > Math.max(3, codes.length * 0.08));
  }

  /** Builds the sheets for one orientation; returns the map scale (px per map unit). */
  function layout(orient) {
    const sheets = $('sheets');
    sheets.replaceChildren();
    if (!codes.length) {
      sheets.append(
        el('div', { class: 'print-empty' }, `${t('printEmpty')} `, el('a', { href: $('back').href }, t('printEmptyLink')), ` ${t('printEmptyAfter')}`),
      );
      $('print').disabled = true;
      return;
    }

    const [w, h] = SHEET[orient];
    $('page-size').textContent = `@page { size: ${orient}; margin: 0.4in; }`;
    const newSheet = () => {
      const s = el('section', { class: 'sheet' });
      s.style.width = `${w}in`;
      s.style.height = `${h}in`;
      sheets.append(s);
      return s;
    };
    const title = quiz.title || t('findTheCountries');

    // Worksheet: header, map, word bank.
    const sheet = newSheet();
    sheet.append(
      el(
        'header',
        { class: 'sheet-head' },
        el('h1', {}, title),
        el('div', { class: 'name-line' }, t('nameLine'), el('span')),
      ),
    );
    const mapBox = el('div', { class: 'sheet-map' });
    sheet.append(mapBox);
    const bank = wordBank();
    sheet.append(bank);

    // A long word bank would squeeze the map; move it onto its own page(s) instead.
    if (bank.offsetHeight > sheet.clientHeight * 0.42) {
      bank.remove();
      flowList(newSheet, t('wordBankHeading', { title }), () => wordBank([]), bankItems());
    }
    const scale = drawMap(mapBox);

    if ($('answer-key').checked) {
      const keyItems = numbered.map(({ code, n }) => el('li', {}, el('b', {}, String(n)), countryName(code)));
      flowList(newSheet, t('answerKeyHeading', { title }), () => el('ol', { class: 'key-list' }), keyItems);
    }
    return scale;
  }

  const bankItems = () => byName().map(({ code }) => el('li', {}, el('span', { class: 'blank' }), countryName(code)));

  function wordBank(items = bankItems()) {
    return el(
      'div',
      { class: 'word-bank' },
      el('h2', {}, t('wordBankInstructions')),
      el('ul', {}, items),
    );
  }

  /**
   * Fills sheets with list items, starting a new sheet whenever one is full, so long
   * lists continue onto further pages instead of being cut off.
   */
  function flowList(newSheet, heading, makeList, items) {
    let page = 0;
    let i = 0;
    while (i < items.length) {
      const sheet = newSheet();
      const list = makeList();
      const ul = list.matches('ul, ol') ? list : list.querySelector('ul, ol');
      sheet.append(el('header', { class: 'sheet-head' }, el('h1', {}, page ? t('continued', { heading }) : heading)), list);
      const start = i;
      for (; i < items.length; i++) {
        ul.append(items[i]);
        if (sheet.scrollHeight > sheet.clientHeight + 1 && i > start) {
          items[i].remove();
          break;
        }
      }
      page++;
    }
  }

  // ---------------------------------------------------------------- map

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  function drawMap(box) {
    const W = box.clientWidth, H = box.clientHeight;
    // Grow the selection bounds to the box's shape so the map fills it (showing more surroundings).
    let bw = bounds.w, bh = bounds.h;
    if (bw / bh > W / H) bh = (bw * H) / W;
    else bw = (bh * W) / H;
    const s = W / bw; // px per map unit
    const x0 = bounds.cx - bw / 2, y0 = bounds.cy - bh / 2;
    const px = (v) => v / s; // screen px -> map units

    const svg = svgEl('svg', { viewBox: `${x0} ${y0} ${bw} ${bh}`, width: W, height: H, class: 'print-map' });
    svg.append(svgEl('path', { d: sphere, class: 'pm-ocean' }));
    const land = svgEl('g', { 'stroke-width': px(0.6), 'stroke-linejoin': 'round' });
    const selected = new Set(codes);
    for (const { code, d } of shapes) {
      land.append(svgEl('path', { d, class: selected.has(code) ? 'pm-sel' : 'pm-land' }));
    }
    svg.append(land);
    // Redraw selected outlines on top so shared borders with grey neighbours stay crisp.
    const outlines = svgEl('g', { 'stroke-width': px(0.9), 'stroke-linejoin': 'round', class: 'pm-outline' });
    for (const code of codes) outlines.append(svgEl('path', { d: shapeByCode.get(code).d }));
    svg.append(outlines);

    const labels = svgEl('g', { class: 'pm-labels' });
    const nodes = placeLabels(px, s, [x0, y0, bw, bh]);
    // Labels pushed far from their country mean the map is too dense to read well.
    crowded = nodes.filter((n) => Math.hypot(n.x - n.ax, n.y - n.ay) > n.r * 4).length;
    for (const n of nodes) {
      if (n.leader) {
        const dx = n.x - n.ax, dy = n.y - n.ay;
        const dist = Math.hypot(dx, dy) || 1;
        labels.append(
          svgEl('line', {
            x1: n.ax, y1: n.ay, x2: n.x - (dx / dist) * n.r, y2: n.y - (dy / dist) * n.r,
            'stroke-width': px(0.8),
          }),
          svgEl('circle', { cx: n.ax, cy: n.ay, r: px(1.8), class: 'pm-anchor' }),
        );
      }
      labels.append(
        svgEl('circle', { cx: n.x, cy: n.y, r: n.r, 'stroke-width': px(1), class: 'pm-badge' }),
      );
      const t = svgEl('text', { x: n.x, y: n.y, 'font-size': px(n.n >= 100 ? 9.5 : 10.5), dy: '0.35em' });
      t.textContent = n.n;
      labels.append(t);
    }
    svg.append(labels);
    box.append(svg);
    return s;
  }

  /** Positions numbered badges near each country's centre, nudging them apart where they'd overlap. */
  function placeLabels(px, s, [vx, vy, vw, vh]) {
    const nodes = numbered.map(({ code, n, center }) => {
      const small = info.get(code).area * s * s < SMALL_AREA;
      const r = px(n >= 100 ? BADGE_R_WIDE : BADGE_R);
      // Small countries start beside their location so the badge doesn't hide them.
      const off = small ? r * 1.8 : 0;
      return { n, r, ax: center[0], ay: center[1], x: center[0] + off, y: center[1] - off, small, cr: r + px(1.5) };
    });
    // Fixed obstacles on small countries keep other badges from covering them.
    const anchors = nodes
      .filter((d) => d.small)
      .map((d) => ({ fx: d.ax, fy: d.ay, x: d.ax, y: d.ay, cr: px(4) }));
    const sim = d3
      .forceSimulation(nodes.concat(anchors))
      .force('x', d3.forceX((d) => d.ax ?? d.fx).strength(0.12))
      .force('y', d3.forceY((d) => d.ay ?? d.fy).strength(0.12))
      .force('collide', d3.forceCollide((d) => d.cr).iterations(4))
      .stop();
    for (let i = 0; i < 300; i++) {
      sim.tick();
      for (const d of nodes) {
        d.x = Math.max(vx + d.r * 1.3, Math.min(vx + vw - d.r * 1.3, d.x));
        d.y = Math.max(vy + d.r * 1.3, Math.min(vy + vh - d.r * 1.3, d.y));
      }
    }
    for (const d of nodes) d.leader = d.small || Math.hypot(d.x - d.ax, d.y - d.ay) > d.r * 0.9;
    return nodes;
  }

  $('orientation').onchange = render;
  $('answer-key').onchange = render;
  document.addEventListener('langchange', render);
  render();
})();
