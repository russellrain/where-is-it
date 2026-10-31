// Teacher setup: choose countries and options, produce a shareable quiz link.
(function () {
  'use strict';
  const { byCode, el, flagImg } = GeoFind;
  const $ = (id) => document.getElementById(id);

  const initial = GeoFind.parseQuiz(location.search);
  const selected = new Set(initial.codes);
  let includeTerritories = initial.codes.some((c) => !byCode.get(c).sovereign);
  const expanded = new Set();

  const opt = {
    title: $('opt-title'),
    count: $('opt-count'),
    guesses: $('opt-guesses'),
    dim: $('opt-dim'),
  };
  opt.title.value = initial.title;
  opt.count.value = initial.count || '';
  opt.guesses.value = String(initial.guesses);
  opt.dim.checked = initial.dim;
  $('territories').checked = includeTerritories;

  const visible = (c) => includeTerritories || c.sovereign;

  // region -> subregion -> [country]
  const groups = new Map();
  for (const c of GeoFind.COUNTRIES) {
    if (!groups.has(c.region)) groups.set(c.region, new Map());
    const subs = groups.get(c.region);
    if (!subs.has(c.subregion)) subs.set(c.subregion, []);
    subs.get(c.subregion).push(c);
  }
  const regionNames = [...groups.keys()].sort(
    (a, b) => GeoFind.REGION_ORDER.indexOf(a) - GeoFind.REGION_ORDER.indexOf(b),
  );

  const map = new GeoMap($('map'), {
    rotate: 0,
    isActive: (code) => visible(byCode.get(code)),
    onClick: (code) => {
      toggle([code], !selected.has(code));
    },
  });
  if (selected.size) map.focus([...selected]);
  $('zoom-in').onclick = () => map.zoomBy(1.6);
  $('zoom-out').onclick = () => map.zoomBy(1 / 1.6);
  $('zoom-reset').onclick = () => map.focus([...selected], 600);

  // ---------------------------------------------------------------- tree

  const tree = $('tree');
  let groupBoxes = []; // { box, count, codes() }
  let countryRows = []; // { row, box, c }

  function membersOf(regionName, subName) {
    const subs = groups.get(regionName);
    const list = subName ? subs.get(subName) : [...subs.values()].flat();
    return list.filter(visible);
  }

  function buildTree() {
    tree.replaceChildren();
    groupBoxes = [];
    countryRows = [];
    for (const r of regionNames) {
      if (!membersOf(r).length) continue;
      const rKey = r;
      const rRow = groupRow('region', rKey, r, () => membersOf(r));
      const rBody = el('div', { hidden: !expanded.has(rKey) });
      tree.append(rRow, rBody);

      const subNames = [...groups.get(r).keys()].sort();
      const flat = subNames.length === 1; // e.g. Antarctica
      for (const s of subNames) {
        const members = membersOf(r, s);
        if (!members.length) continue;
        let target = rBody;
        if (!flat) {
          const sKey = `${r}|${s}`;
          const sBody = el('div', { hidden: !expanded.has(sKey) });
          rBody.append(groupRow('sub', sKey, s, () => membersOf(r, s)), sBody);
          target = sBody;
        }
        for (const c of members.sort((a, b) => a.name.localeCompare(b.name))) {
          const box = el('input', { type: 'checkbox', onchange: () => toggle([c.code], box.checked) });
          const zoom = el('button', { class: 'zoom-to', type: 'button', title: 'Show on map', onclick: () => zoomTo([c.code]) }, '⌖');
          const row = el(
            'div',
            { class: 'row country' },
            el('label', {}, box, flagImg(c.code), el('span', { class: 'name' }, c.name), c.sovereign ? null : el('span', { class: 'terr' }, 'territory')),
            zoom,
          );
          row.dataset.name = c.name.toLowerCase();
          target.append(row);
          countryRows.push({ row, box, c });
        }
      }
    }
    sync();
  }

  function groupRow(kind, key, label, members) {
    const caret = el('button', { class: `caret${expanded.has(key) ? ' open' : ''}`, type: 'button', 'aria-label': 'Expand' }, '▶');
    const box = el('input', { type: 'checkbox' });
    const count = el('span', { class: 'count' });
    const zoom = el('button', { class: 'zoom-to', type: 'button', title: 'Show on map', onclick: () => zoomTo(members().map((c) => c.code)) }, '⌖');
    const row = el('div', { class: `row ${kind}` }, caret, el('label', {}, box, el('span', { class: 'name' }, label)), zoom, count);
    caret.onclick = () => {
      const body = row.nextElementSibling;
      const open = body.hidden;
      body.hidden = !open;
      caret.classList.toggle('open', open);
      if (open) expanded.add(key);
      else expanded.delete(key);
    };
    box.onchange = () => toggle(members().map((c) => c.code), box.checked);
    groupBoxes.push({ box, count, members });
    return row;
  }

  function sync() {
    for (const { box, c } of countryRows) box.checked = selected.has(c.code);
    for (const g of groupBoxes) {
      const codes = g.members().map((c) => c.code);
      const n = codes.filter((c) => selected.has(c)).length;
      g.box.checked = n > 0 && n === codes.length;
      g.box.indeterminate = n > 0 && n < codes.length;
      g.count.textContent = n ? `${n}/${codes.length}` : `${codes.length}`;
    }
    for (const code of map.countries.keys()) map.setState(code, selected.has(code) ? 'selected' : null);
    updateLink();
  }

  function toggle(codes, on) {
    for (const c of codes) on ? selected.add(c) : selected.delete(c);
    sync();
  }

  function zoomTo(codes) {
    map.fitBounds(map.boundsOf(codes), 600);
  }

  // ---------------------------------------------------------------- search & filters

  $('search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const { row } of countryRows) row.hidden = q && !row.dataset.name.includes(q);
    // Show/expand groups that contain matches while searching.
    for (const body of tree.querySelectorAll('div:not(.row)')) {
      const head = body.previousElementSibling;
      const any = !q || body.querySelector('.row.country:not([hidden])');
      head.hidden = !any;
      body.hidden = q ? !any : !head.querySelector('.caret').classList.contains('open');
    }
  });

  $('clear').onclick = () => {
    selected.clear();
    sync();
  };

  $('territories').onchange = (e) => {
    includeTerritories = e.target.checked;
    if (!includeTerritories) for (const c of [...selected]) if (!byCode.get(c).sovereign) selected.delete(c);
    $('search').value = '';
    map.refreshActive();
    buildTree();
  };

  for (const input of Object.values(opt)) input.addEventListener('input', updateLink);

  // ---------------------------------------------------------------- link

  function currentQuiz() {
    const codes = [...selected].sort();
    const count = parseInt(opt.count.value, 10);
    return {
      codes,
      title: opt.title.value.trim(),
      count: Number.isFinite(count) && count > 0 ? count : null,
      guesses: parseInt(opt.guesses.value, 10),
      dim: opt.dim.checked,
    };
  }

  function updateLink() {
    const q = currentQuiz();
    const n = q.codes.length;
    opt.count.max = n || '';
    const asked = q.count ? Math.min(q.count, n) : n;
    $('summary').textContent = n
      ? `${n} ${n === 1 ? 'country' : 'countries'} selected${asked < n ? ` · ${asked} asked per game` : ''}`
      : 'No countries selected';
    const query = GeoFind.quizQuery(q);
    const url = n ? GeoFind.pageUrl('index.html', query) : '';
    $('link').value = url;
    $('copy-link').disabled = !n;
    const open = $('open-link');
    if (n) open.href = url;
    else open.removeAttribute('href');
    // Keep this page's URL in sync so a refresh (or bookmark) keeps the selection.
    try {
      history.replaceState(null, '', n ? query : location.pathname);
    } catch {} // some browsers block this on file://
  }

  $('copy-link').onclick = async () => {
    const btn = $('copy-link');
    const ok = await GeoFind.copyText($('link').value);
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => (btn.textContent = 'Copy link'), 2000);
  };
  $('link').addEventListener('focus', (e) => e.target.select());

  buildTree();
})();
