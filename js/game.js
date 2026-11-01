// Student game: find each country on the map.
(function () {
  'use strict';
  const { byCode, el, flagImg, formatTime, wordmark, pinIcon, countryName } = WhereIsIt;
  const { t } = I18N;

  const quiz = WhereIsIt.parseQuiz(location.search);
  const pool = new Set(quiz.codes);
  const title = () => quiz.title || defaultTitle(quiz.codes);

  const $ = (id) => document.getElementById(id);
  const ui = {
    label: $('prompt-label'),
    target: $('target'),
    guesses: $('guesses'),
    progress: $('stat-progress'),
    score: $('stat-score'),
    time: $('stat-time'),
    bar: $('progress-bar'),
    feedback: $('feedback'),
    overlay: $('overlay'),
    card: $('card'),
    showResults: $('show-results'),
  };

  const game = {
    state: 'intro', // intro | playing | done
    queue: [],
    index: -1,
    current: null,
    wrong: 0,
    hint: false,
    results: [], // { code, wrong, found }
    startedAt: 0,
    elapsed: 0,
    timer: null,
    advancing: false,
  };

  const map = new GeoMap($('map'), {
    rotate: WhereIsIt.rotationFor(quiz.codes),
    isActive: (code) => !quiz.dim || pool.has(code) || !pool.size,
    // The cursor label shows the country to find, never the one under the pointer.
    labelFor: () => (game.state === 'playing' ? game.current : null),
    labelCaption: t('find'),
    onClick: onCountryClick,
  });
  map.focus(quiz.codes);

  $('zoom-in').onclick = () => map.zoomBy(1.6);
  $('zoom-out').onclick = () => map.zoomBy(1 / 1.6);
  $('zoom-reset').onclick = () => map.resetView();
  ui.showResults.onclick = () => {
    ui.showResults.hidden = true;
    ui.overlay.hidden = false;
  };

  const homeBtn = $('home');
  homeBtn.onclick = () => {
    if (game.state === 'playing' && game.results.length && !confirm(t('confirmLeave'))) return;
    backToIntro();
  };

  if (!quiz.codes.length) showWelcome();
  else showIntro();

  // Re-render whatever is on screen in the new language. Game progress is kept.
  document.addEventListener('langchange', () => {
    map.opts.labelCaption = t('find');
    if (game.state === 'intro') {
      if (quiz.codes.length) showIntro();
      else showWelcome();
    } else if (game.state === 'playing') {
      const c = game.current;
      ui.label.textContent = t('find');
      ui.target.replaceChildren(flagImg(c), document.createTextNode(countryName(c)));
      renderGuesses();
      if (!game.hint) hideSay(); // a showing hint stays until they click the country
    } else {
      document.title = `${title()} · Where Is It`;
      ui.label.textContent = t('finished');
      ui.target.replaceChildren(document.createTextNode(title()));
      const viewingMap = ui.overlay.hidden;
      showResults();
      if (viewingMap) {
        ui.overlay.hidden = true;
        ui.showResults.hidden = false;
      }
    }
    map.refreshTooltip(true);
  });

  // ---------------------------------------------------------------- screens

  function showCard(...children) {
    ui.card.replaceChildren(...children.filter((c) => c != null)); // replaceChildren would print null as "null"
    ui.overlay.hidden = false;
    ui.showResults.hidden = true;
  }

  function showWelcome() {
    document.title = t('gamePageTitle');
    const presets = [
      ['presetAfrica', (c) => c.region === 'Africa'],
      ['presetEurope', (c) => c.region === 'Europe'],
      ['presetAsia', (c) => c.region === 'Asia'],
      ['presetSouthAmerica', (c) => c.subregion === 'South America'],
      ['presetNorthCentralAmerica', (c) => ['North America', 'Central America', 'Caribbean'].includes(c.subregion)],
      ['presetOceania', (c) => c.region === 'Oceania'],
      ['presetMiddleEast', (c) => c.subregion === 'Western Asia'],
      ['presetWorld', () => true],
      ['presetAllCountries', () => true],
    ];
    const links = presets.map(([key, fn]) => {
      const codes = WhereIsIt.COUNTRIES.filter((c) => c.sovereign && fn(c)).map((c) => c.code);
      const n = key === 'presetWorld' ? 20 : null;
      const name = t(key);
      return el(
        'a',
        { class: 'btn', href: WhereIsIt.quizQuery({ codes, title: name, count: n }) },
        name,
        el('small', { style: 'color:var(--ink-soft);font-weight:500;margin-left:auto' }, n ? t('nRandom', { n }) : `${codes.length}`),
      );
    });
    showCard(
      el('div', { class: 'hero' }, wordmark({ large: true, tagline: true })),
      el('p', {}, t('welcome')),
      el('h2', {}, t('quickPlay')),
      el('div', { class: 'preset-list' }, links),
      el('h2', {}, t('customize')),
      el('p', {}, t('customizeBlurb')),
      el('div', { class: 'actions', style: 'margin-top:10px' }, el('a', { class: 'btn primary', href: 'setup' }, t('createQuiz'))),
    );
  }

  function showIntro() {
    homeBtn.hidden = true;
    document.title = `${title()} · Where Is It`;
    const total = questionCount();
    const playIcon = el('span', { class: 'btn-icon', 'aria-hidden': 'true' });
    playIcon.innerHTML = '<svg viewBox="7.6 4.2 12.9 15.6"><path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
    const startBtn = el('button', { class: 'btn primary big icon-after', type: 'button', onclick: begin }, t('start'), playIcon);
    function begin() {
      start(WhereIsIt.shuffle(quiz.codes).slice(0, total));
    }
    showCard(
      wordmark(),
      el('h1', {}, title()),
      el('p', {}, `${t('introFind', { n: total })} ${t('introGuesses', { n: quiz.guesses })}`),
      el('p', {}, t('introControls')),
      el('div', { class: 'actions' }, startBtn, customizeLink()),
    );
    setTimeout(() => startBtn.focus(), 50);
  }

  // ---------------------------------------------------------------- play

  function backToIntro() {
    if (game.current) map.toggleClass(game.current, 'hint', false);
    Object.assign(game, { state: 'intro', queue: [], index: -1, current: null, results: [], elapsed: 0, advancing: false });
    clearInterval(game.timer);
    clearTimeout(game.nextTimer);
    hideSay();
    map.clearStates();
    map.ring(null);
    map.refreshTooltip();
    map.focus(quiz.codes);
    ui.label.textContent = '';
    ui.target.replaceChildren(wordmark({ home: true }));
    ui.guesses.replaceChildren();
    tick();
    renderStats();
    showIntro();
  }

  function start(queue) {
    homeBtn.hidden = false;
    clearTimeout(game.nextTimer);
    Object.assign(game, { state: 'playing', queue, index: -1, results: [], elapsed: 0, advancing: false });
    ui.overlay.hidden = true;
    ui.showResults.hidden = true;
    map.clearStates();
    map.ring(null);
    map.resetView();
    game.startedAt = performance.now();
    clearInterval(game.timer);
    game.timer = setInterval(tick, 250);
    tick();
    next();
  }

  function next() {
    if (game.state !== 'playing') return;
    if (game.current) map.toggleClass(game.current, 'hint', false);
    map.ring(null);
    game.index++;
    game.advancing = false;
    if (game.index >= game.queue.length) return finish();
    game.current = game.queue[game.index];
    game.wrong = 0;
    game.hint = false;
    renderPrompt();
    renderStats();
  }

  function onCountryClick(code) {
    if (game.state !== 'playing' || game.advancing) return;
    const target = game.current;
    const name = countryName(code);

    if (code === target) {
      game.advancing = true;
      const found = !game.hint;
      game.results.push({ code, wrong: game.wrong, found });
      map.toggleClass(code, 'hint', false);
      map.ring(null);
      const cls = !found ? 's-missed' : game.wrong === 0 ? 's-first' : 's-ok';
      map.setState(code, cls);
      if (found) {
        map.flash(code, 'flash-right', 800);
        say('good', game.wrong === 0 ? t('correct') : t('correctTries', { n: game.wrong + 1 }), code);
      } else {
        say('', t('thatsKeepPracticing', { name }), code);
      }
      renderStats();
      game.nextTimer = setTimeout(next, found ? 650 : 900);
      return;
    }

    map.flash(code, 'flash-wrong');
    if (game.hint) {
      say('hint', t('thatsClickHighlighted', { name }), code);
      return;
    }
    game.wrong++;
    renderGuesses();
    if (game.wrong >= quiz.guesses) {
      game.hint = true;
      map.toggleClass(target, 'hint', true);
      map.ring(target);
      map.ensureVisible(target);
      say('hint', t('thatsHereIs', { name, target: countryName(target) }), code);
    } else {
      say('bad', t('thatsGuessesLeft', { name, n: quiz.guesses - game.wrong }), code);
    }
  }

  function tick() {
    if (game.state === 'playing') game.elapsed = performance.now() - game.startedAt;
    ui.time.textContent = formatTime(game.elapsed);
  }

  function finish() {
    game.state = 'done';
    game.current = null;
    tick();
    clearInterval(game.timer);
    hideSay();
    ui.label.textContent = t('finished');
    ui.target.replaceChildren(document.createTextNode(title()));
    ui.guesses.replaceChildren();
    renderStats();
    map.refreshTooltip();
    map.resetView();
    showResults();
  }

  // ---------------------------------------------------------------- results

  function summary() {
    const total = game.results.length;
    const correct = game.results.filter((r) => r.found).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const missed = game.results.filter((r) => !r.found).map((r) => r.code);
    return { total, correct, pct, missed };
  }

  function scoreText() {
    const s = summary();
    const lines = [
      `📍 Where Is It — ${title()}`,
      t('scoreLine', s),
      t('timeLine', { time: formatTime(game.elapsed) }),
      s.missed.length ? t('missedLine', { list: s.missed.map(countryName).join(', ') }) : t('missedNone'),
      t('completedLine', { date: new Date().toLocaleString(I18N.lang) }),
    ];
    return lines.filter(Boolean).join('\n');
  }

  function showResults() {
    const s = summary();
    const praise =
      t(s.pct === 100 ? 'praisePerfect' : s.pct >= 80 ? 'praiseGreat' : s.pct >= 50 ? 'praiseNice' : 'praiseTry');

    const copyLabel = el('span', { class: 'label' }, t('copyScore'));
    const copyBtn = el('button', { class: 'btn primary', type: 'button' }, icon('copy'), copyLabel);
    copyBtn.onclick = async () => {
      const ok = await WhereIsIt.copyText(scoreText());
      copyLabel.textContent = t(ok ? 'copied' : 'copyFailed');
      setTimeout(() => (copyLabel.textContent = t('copyScore')), 2000);
    };

    const actions = [
      copyBtn,
      el(
        'button',
        { class: 'btn', type: 'button', onclick: () => start(WhereIsIt.shuffle(quiz.codes).slice(0, questionCount())) },
        icon('replay'),
        t('playAgain'),
      ),
    ];
    if (s.missed.length) {
      actions.push(
        el(
          'a',
          { class: 'btn', href: WhereIsIt.quizQuery({ ...quiz, codes: s.missed, count: null, title: t('practiceTitle', { title: title() }) }) },
          icon('target'),
          t('practiceMissed'),
        ),
      );
    }
    actions.push(
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            ui.overlay.hidden = true;
            ui.showResults.hidden = false;
          },
        },
        icon('map'),
        t('viewMap'),
      ),
    );

    const ordered = game.results.slice().sort((a, b) => I18N.compare(countryName(a.code), countryName(b.code)));
    const list = el(
      'ul',
      { class: 'result-list' },
      ordered.map((r) => {
        const cls = !r.found ? 'missed' : r.wrong === 0 ? 'first' : 'ok';
        const mark = !r.found ? '✗' : r.wrong === 0 ? '✓' : `✓${r.wrong + 1}`;
        const tip = !r.found ? t('resultMissed') : r.wrong === 0 ? t('resultFirstTry') : t('resultOnTry', { n: r.wrong + 1 });
        return el('li', { class: cls, title: tip }, flagImg(r.code), countryName(r.code), el('span', { class: 'mark' }, mark));
      }),
    );

    showCard(
      el('div', { class: 'logo' }, pinIcon(), title()),
      el('h1', {}, praise),
      game.name ? el('p', {}, game.name) : null,
      el(
        'div',
        { class: 'score-big' },
        el('div', {}, el('b', {}, `${s.correct}/${s.total}`), el('small', {}, t('correctPct', s))),
        el('div', {}, el('b', {}, formatTime(game.elapsed)), el('small', {}, t('statTime'))),
      ),
      el('div', { class: 'actions' }, actions),
      el('h2', {}, t('countriesHeading')),
      list,
      el('div', { class: 'card-foot' }, customizeLink()),
    );
  }

  // ---------------------------------------------------------------- rendering

  function renderPrompt() {
    const c = game.current;
    ui.label.textContent = t('find');
    ui.target.replaceChildren(flagImg(c), document.createTextNode(countryName(c)));
    renderGuesses();
    hideSay();
    map.refreshTooltip();
  }

  function renderGuesses() {
    const dots = [];
    for (let i = 0; i < quiz.guesses; i++) dots.push(el('span', { class: i < game.wrong ? 'used' : '' }));
    ui.guesses.replaceChildren(...dots);
    ui.guesses.title = t('guessesLeft', { n: Math.max(quiz.guesses - game.wrong, 0) });
  }

  function renderStats() {
    const total = game.queue.length;
    const shown = Math.min(game.index + 1, total);
    ui.progress.textContent = total ? `${shown}/${total}` : '–';
    ui.score.textContent = game.results.filter((r) => r.found).length;
    ui.bar.style.width = total ? `${(game.results.length / total) * 100}%` : '0';
  }

  let sayTimer = null;
  function say(kind, text, code) {
    clearTimeout(sayTimer);
    const f = ui.feedback;
    f.className = `feedback ${kind}`;
    f.replaceChildren(...(code ? [flagImg(code)] : []), document.createTextNode(text));
    f.hidden = false;
    void f.offsetWidth;
    f.classList.add('pop');
    if (kind !== 'hint') sayTimer = setTimeout(hideSay, 2200);
  }
  function hideSay() {
    clearTimeout(sayTimer);
    ui.feedback.hidden = true;
  }

  // ---------------------------------------------------------------- helpers

  // Outline icons for buttons (24x24, drawn with the .ico stroke style).
  const ICONS = {
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5v-.3a1.7 1.7 0 0 0-1.7-1.7H5.2a1.7 1.7 0 0 0-1.7 1.7v8.6a1.7 1.7 0 0 0 1.7 1.7h.3"/>',
    replay: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V8H8"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
    map: '<path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ico');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name];
    return svg;
  }

  /** Opens the setup page pre-filled with this quiz, so anyone can tweak it into their own. */
  function customizeLink() {
    return el(
      'a',
      { class: 'subtle-link', href: 'setup' + WhereIsIt.quizQuery(quiz), title: t('customizeTitle') },
      t('customize'),
    );
  }

  function questionCount() {
    return Math.min(quiz.count || quiz.codes.length, quiz.codes.length);
  }

  function defaultTitle(codes) {
    if (!codes.length) return 'Where Is It';
    const regions = new Set(codes.map((c) => byCode.get(c).region));
    return regions.size === 1 ? t('regionTitle', { region: I18N.region([...regions][0]) }) : t('worldTitle');
  }
})();
