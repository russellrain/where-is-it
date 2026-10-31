// Teacher setup: choose countries and options, produce a shareable quiz link.
(function () {
  'use strict';
  const { byCode, el, flagImg, countryName, fold } = WhereIsIt;
  const { t } = I18N;
  const $ = (id) => document.getElementById(id);

  const initial = WhereIsIt.parseQuiz(location.search);
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

  // Student languages: one checkbox per language; all checked = no restriction (param left out).
  const langBoxes = I18N.CODES.map((code) => {
    const box = el('input', { type: 'checkbox', value: code });
    box.checked = !initial.langs || initial.langs.includes(code);
    box.addEventListener('change', () => {
      if (!langBoxes.some((b) => b.checked)) box.checked = true; // keep at least one
      updateLink();
    });
    $('opt-langs').append(el('label', { lang: code }, box, I18N.LANGUAGES[code]));
    return box;
  });
  $('territories').checked = includeTerritories;

  const visible = (c) => includeTerritories || c.sovereign;

  // region -> subregion -> [country]
  const groups = new Map();
  for (const c of WhereIsIt.COUNTRIES) {
    if (!groups.has(c.region)) groups.set(c.region, new Map());
    const subs = groups.get(c.region);
    if (!subs.has(c.subregion)) subs.set(c.subregion, []);
    subs.get(c.subregion).push(c);
  }
  const regionNames = [...groups.keys()].sort(
    (a, b) => WhereIsIt.REGION_ORDER.indexOf(a) - WhereIsIt.REGION_ORDER.indexOf(b),
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
      const rRow = groupRow('region', rKey, I18N.region(r), () => membersOf(r));
      const rBody = el('div', { hidden: !expanded.has(rKey) });
      tree.append(rRow, rBody);

      const subNames = [...groups.get(r).keys()].sort((a, b) => I18N.compare(I18N.region(a), I18N.region(b)));
      const flat = subNames.length === 1; // e.g. Antarctica
      for (const s of subNames) {
        const members = membersOf(r, s);
        if (!members.length) continue;
        let target = rBody;
        if (!flat) {
          const sKey = `${r}|${s}`;
          const sBody = el('div', { hidden: !expanded.has(sKey) });
          rBody.append(groupRow('sub', sKey, I18N.region(s), () => membersOf(r, s)), sBody);
          target = sBody;
        }
        for (const c of members.sort((a, b) => I18N.compare(countryName(a.code), countryName(b.code)))) {
          const box = el('input', { type: 'checkbox', onchange: () => toggle([c.code], box.checked) });
          const zoom = el('button', { class: 'zoom-to', type: 'button', title: t('showOnMap'), onclick: () => zoomTo([c.code]) }, '⌖');
          const name = countryName(c.code);
          const row = el(
            'div',
            { class: 'row country' },
            el('label', {}, box, flagImg(c.code), el('span', { class: 'name' }, name), c.sovereign ? null : el('span', { class: 'terr' }, t('territory'))),
            zoom,
          );
          // Search matches the English name too, so either works whatever language the page is in.
          row.dataset.name = fold(name === c.name ? name : `${name}|${c.name}`);
          target.append(row);
          countryRows.push({ row, box, c });
        }
      }
    }
    sync();
  }

  function groupRow(kind, key, label, members) {
    const caret = el('button', { class: `caret${expanded.has(key) ? ' open' : ''}`, type: 'button', 'aria-label': t('expand') }, '▶');
    const box = el('input', { type: 'checkbox' });
    const count = el('span', { class: 'count' });
    const zoom = el('button', { class: 'zoom-to', type: 'button', title: t('showOnMap'), onclick: () => zoomTo(members().map((c) => c.code)) }, '⌖');
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
    const q = fold(e.target.value.trim());
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

  // The page's own language (header picker) is separate from the quiz's student languages.
  document.addEventListener('langchange', () => {
    buildTree();
    $('search').dispatchEvent(new Event('input'));
    map.refreshTooltip(true);
  });

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
      langs: langBoxes.filter((b) => b.checked).map((b) => b.value),
    };
  }

  function updateLink() {
    const q = currentQuiz();
    const n = q.codes.length;
    opt.count.max = n || '';
    const asked = q.count ? Math.min(q.count, n) : n;
    $('summary').textContent = n
      ? t('nSelected', { n }) + (asked < n ? t('askedPerGame', { n: asked }) : '')
      : t('noneSelected');
    const query = WhereIsIt.quizQuery(q);
    const url = n ? WhereIsIt.pageUrl('index.html', query) : '';
    $('link').value = url;
    $('copy-link').disabled = !n;
    const open = $('open-link');
    const print = $('print-link');
    if (n) {
      open.href = url;
      print.href = WhereIsIt.pageUrl('print.html', query);
    } else {
      open.removeAttribute('href');
      print.removeAttribute('href');
    }
    // Keep this page's URL in sync so a refresh (or bookmark) keeps the selection.
    try {
      history.replaceState(null, '', n ? query : location.pathname);
    } catch {} // some browsers block this on file://
  }

  $('copy-link').onclick = async () => {
    const label = $('copy-link').querySelector('.label');
    const ok = await WhereIsIt.copyText($('link').value);
    label.textContent = t(ok ? 'copied' : 'copyFailed');
    setTimeout(() => (label.textContent = t('copyLink')), 2000);
  };
  $('link').addEventListener('focus', (e) => e.target.select());

  buildTree();
})();
