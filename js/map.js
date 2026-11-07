// Interactive map (D3 + TopoJSON) shared by the setup page and the game. It draws the current
// map's places (WhereIsIt.ATLAS): the world's countries, or U.S. states.
//
//   const map = new GeoMap(container, {
//     rotate: 0,                         // central meridian offset in degrees
//     extended: false,                   // the atlas's extended layout (U.S. territories)
//     isActive: (code) => true,          // can this country be hovered/clicked?
//     labelFor: (hovered) => hovered,    // country to show next to the cursor (or null)
//     labelCaption: null,                // optional small caption before the name, e.g. 'Find'
//     labelContent: null,                // (code, hovered) => [nodes] for the cursor label; default: flag and name
//     labelHover: false,                 // labelContent also depends on the hovered country, so rebuild as it changes
//     peekInactive: false,               // hovering an inactive country writes its name (muted) on the map
//     hoverName: () => false,            // (hovered) => true writes the hovered country's name on the map itself
//     onClick: (code) => {},
//   });
//
// Shapes are projected once into a fixed 1000-unit-wide coordinate space; d3.zoom
// maps that space onto the screen, so pan/zoom/resizing never re-project paths.
(function () {
  'use strict';

  const BASE_W = 1000;
  const TINY_AREA = 12; // base units²; countries smaller than this get a clickable dot
  const DOT_RADIUS = 6; // screen px
  const DOT_HIDE_AREA = 90; // screen px²; hide the dot once the shape itself is this big
  const STATE_CLASSES = ['s-first', 's-ok', 's-missed', 'selected'];
  const HATCH = 7; // screen px between the stripes on missed countries
  const URALS_LON = 60; // east edge of Russia when framing it with other places (see boundsOf)
  const reduceMotion =window.matchMedia('(prefers-reduced-motion: reduce)');

  class GeoMap {
    constructor(container, opts) {
      this.opts = Object.assign(
        { rotate: 0, extended: false, isActive: () => true, labelFor: (hovered) => hovered, labelCaption: null, labelContent: null, labelHover: false, peekInactive: false, hoverName: () => false, onClick: null },
        opts,
      );
      this.container = container;
      this.countries = new Map(); // code -> { el, dot, bounds, center, area }
      this.transform = d3.zoomIdentity;

      const atlas = WhereIsIt.ATLAS;
      const features = WhereIsIt.features(this.opts.extended);
      const { path, outline, borders } = GeoMap.projectAtlas(atlas, this.opts.rotate, features, this.opts.extended);
      this.path = path;
      this.projection = path.projection();
      this.worldBounds = path.bounds(outline); // the whole map (named for the world map, its first use)

      const svg = d3.select(container).append('svg').attr('class', 'geomap');
      this.svg = svg;
      // Missed countries are striped as well as red, so they don't rely on red vs. green alone (colour blindness).
      // The stripes are rescaled on zoom (see _applyTransform) to stay the same size on screen.
      const hatch = svg
        .append('defs')
        .append('pattern')
        .attr('id', 'geomap-hatch')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', HATCH)
        .attr('height', HATCH);
      hatch.append('rect').attr('class', 'hatch-bg').attr('width', HATCH).attr('height', HATCH);
      hatch.append('path').attr('class', 'hatch-line').attr('d', `M0,${HATCH / 2}h${HATCH}`);
      this.hatch = hatch;
      const vp = svg.append('g').attr('class', 'viewport');
      this.viewport = vp;
      if (atlas.sphere) {
        vp.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
        vp.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));
      }
      if (borders) vp.append('path').attr('class', 'inset-borders').attr('d', borders);
      const land = vp.append('g').attr('class', 'land');
      const dots = vp.append('g').attr('class', 'dots');
      this.overlay = vp.append('g').attr('class', 'overlay');
      this.capitalLayer = vp.append('g').attr('class', 'capitals');
      this.labelLayer = vp.append('g').attr('class', 'map-labels');
      this.hoverLabelLayer = vp.append('g').attr('class', 'map-labels');
      this._hoverLabel = null; // { g, x, y } of the hovered country's name, when opts.hoverName wants it
      this._labels = [];
      this._labelCodes = [];
      this._capitals = [];
      this._capitalArgs = [[], []];

      for (const f of features) {
        const d = path(f);
        if (!d) continue;
        const code = String(f.id);
        const node = land.append('path').attr('d', d).attr('class', 'country').node();
        if (code.startsWith('_')) {
          node.classList.add('other');
          continue;
        }
        node.dataset.code = code;
        const info = { el: node, dot: null, ...measure(path, f) };
        if (info.area < TINY_AREA) {
          info.dot = dots
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', info.center[0])
            .attr('cy', info.center[1])
            .attr('r', DOT_RADIUS)
            .attr('data-code', code)
            .node();
        }
        this.countries.set(code, info);
      }

      this.zoom = d3
        .zoom()
        // d3 swallows the click if the mouse moves at all between down and up (default 0px),
        // so a slightly shaky click registers as a pan. Allow a few px of jitter.
        .clickDistance(6)
        .on('zoom', (e) => this._applyTransform(e.transform));
      svg.call(this.zoom).on('dblclick.zoom', null);

      this._setupPointer();
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(container);
      this._focus = null;
      this._onResize();
      this.refreshActive();
    }

    /** Removes the map from the page (e.g. to rebuild it with another layout). */
    destroy() {
      this._resizeObserver.disconnect();
      this.tooltip.remove();
      this.svg.interrupt().remove();
    }

    has(code) {
      return this.countries.has(code);
    }

    // ---- appearance -------------------------------------------------------

    /** Re-evaluates isActive() for every country (call after changing what's active). */
    refreshActive() {
      for (const [code, c] of this.countries) {
        const active = this.opts.isActive(code);
        c.el.classList.toggle('inactive', !active);
        if (c.dot) c.dot.classList.toggle('inactive', !active);
      }
    }

    /** Sets a single "state" class (s-first, s-ok, s-missed, selected) or clears it with null. */
    setState(code, cls) {
      this._each(code, (n) => {
        n.classList.remove(...STATE_CLASSES);
        if (cls) n.classList.add(cls);
      });
    }

    clearStates() {
      for (const code of this.countries.keys()) this.setState(code, null);
    }

    toggleClass(code, cls, on) {
      this._each(code, (n) => n.classList.toggle(cls, on));
    }

    /** Briefly plays a CSS animation class on a country. */
    flash(code, cls = 'flash-wrong', ms = 900) {
      this._each(code, (n) => {
        n.classList.remove(cls);
        void n.getBoundingClientRect(); // restart animation
        n.classList.add(cls);
        clearTimeout(n['_t_' + cls]);
        n['_t_' + cls] = setTimeout(() => n.classList.remove(cls), ms);
      });
    }

    /** Shows (or hides with null) a pulsing ring around a country — used for hints. */
    ring(code) {
      this.overlay.selectAll('*').remove();
      this._ring = null;
      if (!code || !this.countries.has(code)) return;
      const c = this.countries.get(code);
      const b = c.bounds;
      const r = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) / 2;
      const g = this.overlay.append('g').attr('class', 'ring');
      g.append('circle').attr('r', 1);
      this._ring = { g, cx: c.center[0], cy: c.center[1], r };
      this._updateOverlay();
    }

    /** Writes country names on the map (e.g. the ones a student missed). Pass [] to remove them. */
    setLabels(codes) {
      this._labelCodes = (codes || []).slice();
      this.labelLayer.selectAll('*').remove();
      this._labels = [];
      for (const code of this._labelCodes) {
        const c = this.countries.get(code);
        if (!c) continue;
        const g = this.labelLayer.append('g').attr('class', 'map-label');
        // Tiny countries are drawn as a dot, so put their name just above it rather than over it.
        g.append('text').attr('dy', c.dot ? '-1.1em' : '0.35em').text(WhereIsIt.countryName(code));
        this._labels.push({ g, x: c.center[0], y: c.center[1] });
      }
      this._updateOverlay();
    }
    /** Writes the hovered country's name on the map (opts.hoverName, or muted for opts.peekInactive), or clears it. */
    _setHoverLabel(code, peek) {
      this.hoverLabelLayer.selectAll('*').remove();
      this._hoverLabel = null;
      const c = code && this.countries.get(code);
      if (!c) return;
      const g = this.hoverLabelLayer.append('g').attr('class', `map-label map-hover-label${peek ? ' map-peek-label' : ''}`);
      g.append('text').attr('dy', c.dot ? '-1.1em' : '0.35em').text(WhereIsIt.countryName(code));
      this._hoverLabel = { g, x: c.center[0], y: c.center[1] };
      this._updateOverlay();
    }

    /** Rebuilds the labels, e.g. after a language change. */
    refreshLabels() {
      this.setLabels(this._labelCodes);
      this.setCapitals(...this._capitalArgs);
    }

    /**
     * Marks capitals with a star (places with a `capital` and `capitalLatlng`: U.S. states). Those in `named` also get the
     * capital's name. A code in `fresh` pops in. Pass [] to remove them all.
     */
    setCapitals(codes, named = [], fresh = null) {
      this._capitalArgs = [(codes || []).slice(), named.slice()];
      this.capitalLayer.selectAll('*').remove();
      this._capitals = [];
      const withName = new Set(named);
      for (const code of this._capitalArgs[0]) {
        const p = WhereIsIt.byCode.get(code);
        const xy = p?.capitalLatlng && this.projection([p.capitalLatlng[1], p.capitalLatlng[0]]);
        if (!xy) continue;
        const g = this.capitalLayer.append('g').attr('class', 'capital');
        const inner = g.append('g').attr('class', code === fresh ? 'capital-mark pop' : 'capital-mark');
        inner.append('path').attr('d', WhereIsIt.STAR_PATH);
        if (withName.has(code)) inner.append('text').attr('dy', '-0.95em').text(WhereIsIt.capitalName(code));
        this._capitals.push({ g, x: xy[0], y: xy[1] });
      }
      this._updateOverlay();
    }
    // ---- camera -----------------------------------------------------------

    /** Union of the main-landmass bounds of the given countries. */
    boundsOf(codes) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const code of codes) {
        const c = this.countries.get(code);
        if (!c) continue;
        let b = c.bounds;
        // Alongside other places (e.g. the Europe quiz), only count Russia up to the Urals, or Siberia would take
        // most of the view. On its own it's framed whole.
        if (code === 'RU' && codes.length > 1) {
          // East edge at the Urals; top edge at the Arctic coast west of them (Siberia reaches further north).
          const east = this.projection([URALS_LON, 55]);
          const north = this.projection([URALS_LON, 70.5]);
          if (east && north && east[0] > b[0][0] && east[0] < b[1][0]) {
            b = [[b[0][0], Math.max(b[0][1], north[1])], [east[0], b[1][1]]];
          }
        }
        x0 = Math.min(x0, b[0][0]);
        y0 = Math.min(y0, b[0][1]);
        x1 = Math.max(x1, b[1][0]);
        y1 = Math.max(y1, b[1][1]);
      }
      return x0 === Infinity ? this.worldBounds : [[x0, y0], [x1, y1]];
    }

    /** Remembers a focus area (used by "reset view" and on resize) and moves the camera there. */
    focus(codes, duration = 0) {
      this._focus = codes && codes.length ? codes.slice() : null;
      this.resetView(duration);
    }

    resetView(duration = 600) {
      this.fitBounds(this._focus ? this.boundsOf(this._focus) : this.worldBounds, duration);
    }

    fitBounds([[x0, y0], [x1, y1]], duration = 600, minSize = 40) {
      const { w, h } = this._size();
      const pad = Math.min(w, h) * 0.06;
      const bw = Math.max(x1 - x0, minSize);
      const bh = Math.max(y1 - y0, minSize * 0.6);
      const [kMin, kMax] = this.zoom.scaleExtent();
      const k = Math.max(kMin, Math.min(kMax, Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh)));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const t = d3.zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k);
      this._goto(t, duration);
    }

    /** Pans (and zooms out if needed) so the country is comfortably on screen. */
    ensureVisible(code, duration = 700) {
      const c = this.countries.get(code);
      if (!c) return;
      const { w, h } = this._size();
      const t = this.transform;
      const [[x0, y0], [x1, y1]] = c.bounds;
      const sx0 = t.applyX(x0), sx1 = t.applyX(x1), sy0 = t.applyY(y0), sy1 = t.applyY(y1);
      const m = 40;
      const inView = sx0 >= m && sy0 >= m && sx1 <= w - m && sy1 <= h - m;
      const bigEnough = (sx1 - sx0) * (sy1 - sy0) > 30 || c.dot;
      if (inView && bigEnough) return;
      const bw = x1 - x0, bh = y1 - y0;
      let k = t.k;
      if (bw * k > w * 0.7 || bh * k > h * 0.7) k = Math.min((w * 0.7) / bw, (h * 0.7) / bh);
      if (!bigEnough) k = Math.max(k, Math.sqrt(400 / Math.max(bw * bh, 1e-3)));
      const [kMin, kMax] = this.zoom.scaleExtent();
      k = Math.max(kMin, Math.min(kMax, k));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      this._goto(d3.zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k), duration);
    }

    zoomBy(factor) {
      this.svg.transition().duration(reduceMotion.matches ? 0 : 300).call(this.zoom.scaleBy, factor);
    }

    // ---- internals --------------------------------------------------------

    _each(code, fn) {
      const c = this.countries.get(code);
      if (!c) return;
      fn(c.el);
      if (c.dot) fn(c.dot);
    }

    _size() {
      return { w: this.container.clientWidth || 800, h: this.container.clientHeight || 500 };
    }

    _goto(t, duration) {
      if (duration && !reduceMotion.matches) this.svg.transition().duration(duration).call(this.zoom.transform, t);
      else this.svg.call(this.zoom.transform, t);
    }

    _onResize() {
      const { w, h } = this._size();
      const [[x0, y0], [x1, y1]] = this.worldBounds;
      const worldK = Math.min(w / (x1 - x0), h / (y1 - y0));
      this.zoom
        .extent([[0, 0], [w, h]])
        .scaleExtent([worldK * 0.9, worldK * 120])
        .translateExtent([[x0 - 200, y0 - 150], [x1 + 200, y1 + 150]]);
      this.resetView(0);
    }

    _applyTransform(t) {
      this.transform = t;
      this.viewport.attr('transform', t);
      this.hatch.attr('patternTransform', `rotate(45) scale(${1 / t.k})`);
      const k2 = t.k * t.k;
      for (const c of this.countries.values()) {
        if (!c.dot) continue;
        c.dot.setAttribute('r', DOT_RADIUS / t.k);
        c.dot.style.display = c.area * k2 > DOT_HIDE_AREA ? 'none' : '';
      }
      this._updateOverlay();
    }

    _updateOverlay() {
      const k = this.transform.k;
      // Labels stay the same size on screen whatever the zoom.
      const marks = this._labels.concat(this._capitals);
      if (this._hoverLabel) marks.push(this._hoverLabel);
      for (const { g, x, y } of marks) g.attr('transform', `translate(${x},${y}) scale(${1 / k})`);
      if (!this._ring) return;
      const { g, cx, cy, r } = this._ring;
      // Ring radius in screen px: around the country, but never smaller than 22px.
      const screenR = Math.max(r * k + 10, 22);
      g.attr('transform', `translate(${cx},${cy}) scale(${screenR / k})`);
    }

    _setupPointer() {
      const tip = document.createElement('div');
      tip.className = 'map-tooltip';
      tip.hidden = true;
      document.body.appendChild(tip);
      this.tooltip = tip;
      let hovered = null; // country under the pointer
      let hoverName = null; // 'code' or 'peek:code': the name written on the map (opts.hoverName / opts.peekInactive)
      let peek = null; // inactive country under the pointer (only with opts.peekInactive)
      let inside = false; // pointer is over the map
      let shown = null; // country currently rendered in the tooltip
      let last = null; // last pointer position
      let mouse = false; // last pointer was a mouse (no tooltip for touch/pen)
      let hideTimer = null;

      const rawCodeAt = (e) => {
        const t = e.target.closest && e.target.closest('[data-code]');
        return (t && t.dataset.code) || null;
      };
      const codeAt = (e) => {
        const code = rawCodeAt(e);
        return code && this.opts.isActive(code) ? code : null;
      };
      const place = () => {
        if (tip.hidden || !last) return;
        const pad = 16;
        const r = tip.getBoundingClientRect();
        let x = last.x + pad;
        let y = last.y + pad;
        if (x + r.width > window.innerWidth - 4) x = last.x - r.width - pad;
        if (y + r.height > window.innerHeight - 4) y = last.y - r.height - pad;
        tip.style.transform = `translate(${x}px, ${y}px)`;
      };
      // The tooltip shows whichever country opts.labelFor(hovered) returns (or nothing).
      const updateTip = () => {
        const code = inside && mouse ? this.opts.labelFor(hovered) : null;
        const key = code && this.opts.labelHover ? `${code}|${hovered}` : code;
        if (key !== shown) {
          shown = key;
          let parts = [];
          let caption = null;
          if (code) {
            parts = this.opts.labelContent
              ? this.opts.labelContent(code, hovered)
              : [WhereIsIt.flagImg(code), document.createTextNode(WhereIsIt.countryName(code))];
            caption = this.opts.labelCaption;
            if (caption) {
              const c = document.createElement('span');
              c.className = 'map-tooltip-caption';
              c.textContent = caption;
              parts.unshift(c);
            }
          }
          if (code) {
            tip.replaceChildren(...parts);
            tip.classList.toggle('has-caption', !!caption);
          }
        }
        tip.hidden = !code;
        place();
      };
      const setHover = (code) => {
        if (code !== hovered) {
          if (hovered) this.toggleClass(hovered, 'hover', false);
          hovered = code;
          if (code) this.toggleClass(code, 'hover', true);
        }
        // Names written on the map: the hovered place when opts.hoverName wants it, or with opts.peekInactive, a
        // greyed-out place outside the quiz so gaps in the area (e.g. Western Sahara in Africa) aren't a mystery.
        const name = peek ? `peek:${peek}` : code && this.opts.hoverName(code) ? code : null;
        if (name !== hoverName) {
          hoverName = name;
          this._setHoverLabel(peek || (name && code), !!peek);
        }
        updateTip();
      };
      const setPeek = (code) => {
        if (code === peek) return;
        if (peek) this.toggleClass(peek, 'peek', false);
        peek = code;
        if (code) this.toggleClass(code, 'peek', true);
      };
      const track = (e) => {
        last = { x: e.clientX, y: e.clientY };
        mouse = e.pointerType === 'mouse';
        inside = true;
        const raw = rawCodeAt(e);
        setPeek(this.opts.peekInactive && raw && !this.opts.isActive(raw) ? raw : null);
        setHover(codeAt(e));
      };

      const node = this.svg.node();
      node.addEventListener('pointermove', (e) => {
        clearTimeout(hideTimer);
        track(e);
      });
      node.addEventListener('pointerleave', () => {
        inside = false;
        setPeek(null);
        setHover(null);
      });
      node.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') track(e);
      });
      node.addEventListener('pointerup', (e) => {
        // Touch has no hover: briefly highlight where the finger lands, then clear it.
        if (e.pointerType !== 'mouse') {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => {
            inside = false;
            setPeek(null);
            setHover(null);
          }, 1200);
        }
      });
      node.addEventListener('click', (e) => {
        const code = codeAt(e);
        if (code && this.opts.onClick) this.opts.onClick(code, e);
      });
      this.hideTooltip = () => {
        inside = false;
        setPeek(null);
        setHover(null);
      };
      // force: rebuild the label even if it's for the same country (e.g. after a language switch).
      this.refreshTooltip = (force) => {
        if (force) shown = null;
        updateTip();
      };
    }
  }

  /**
   * Bounds/center of a country's main landmass(es), ignoring far-flung islands.
   * Works on the *projected* outline so shapes cut by the map edge (e.g. Russia at
   * 180°) are measured as separate pieces rather than one world-wide shape.
   */
  function measure(path, feature) {
    const total = path.area(feature);
    const pieces = [];
    for (const sub of path(feature).split('M')) {
      const n = sub.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
      if (!n || n.length < 6) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, a = 0, cx = 0, cy = 0;
      const len = n.length - (n.length % 2);
      for (let i = 0; i < len; i += 2) {
        const x = +n[i], y = +n[i + 1];
        const j = (i + 2) % len;
        const xn = +n[j], yn = +n[j + 1];
        const cross = x * yn - xn * y;
        a += cross;
        cx += (x + xn) * cross;
        cy += (y + yn) * cross;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const area = Math.abs(a / 2);
      const center = a ? [cx / (3 * a), cy / (3 * a)] : [(x0 + x1) / 2, (y0 + y1) / 2];
      pieces.push({ area, bounds: [[x0, y0], [x1, y1]], center });
    }
    if (!pieces.length) return { area: total, bounds: path.bounds(feature), center: path.centroid(feature) };
    pieces.sort((p, q) => q.area - p.area);
    const main = pieces.filter((p) => p.area >= pieces[0].area * 0.2);
    const bounds = [
      [Math.min(...main.map((p) => p.bounds[0][0])), Math.min(...main.map((p) => p.bounds[0][1]))],
      [Math.max(...main.map((p) => p.bounds[1][0])), Math.max(...main.map((p) => p.bounds[1][1]))],
    ];
    return { area: total, bounds, center: pieces[0].center };
  }

  /**
   * The atlas's projection, fitted to a BASE_W-wide space: the whole globe for the world map,
   * the places themselves otherwise. Returns { path, outline, borders }: outline is what was fitted,
   * borders an SVG path of the inset boxes (composite projections only).
   */
  function projectAtlas(atlas, rotate, features, extended) {
    const outline = atlas.sphere ? { type: 'Sphere' } : { type: 'FeatureCollection', features };
    const projection = atlas.projection(rotate, extended);
    // Composite projections have no fitWidth; a very tall extent leaves the width as the constraint.
    if (projection.fitWidth) projection.fitWidth(BASE_W, outline);
    else projection.fitExtent([[0, 0], [BASE_W, BASE_W * 10]], outline);
    const borders = projection.getCompositionBorders ? projection.getCompositionBorders() : null;
    return { path: d3.geoPath(projection), outline, borders };
  }

  // Also used by the printable worksheet.
  GeoMap.measure = measure;
  GeoMap.projectAtlas = projectAtlas;
  window.GeoMap = GeoMap;
})();
