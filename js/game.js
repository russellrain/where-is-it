// Student game: find each country (or state) on the map.
(function () {
  'use strict';
  const { el, flagImg, formatTime, wordmark, pinIcon, countryName, capitalName, promptName, fullName, starIcon, defaultTitle } = WhereIsIt;
  const { t } = I18N;
  const text = (s) => document.createTextNode(s);

  const quiz = WhereIsIt.parseQuiz(location.search);
  // Capitals quiz: the prompt is a capital ("Sacramento") and the answer its state or country. A star stands in for
  // the flag or code badge, which would give the answer away. On maps that know where each capital is (U.S. states),
  // answered capitals also get a star on the map; elsewhere missed places are named on the map as usual.
  const capitals = quiz.mode === 'capitals';
  const capitalStars = capitals && quiz.codes.every((c) => WhereIsIt.byCode.get(c).capitalLatlng);
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
    stats: document.querySelector('.topbar .stats'),
    bar: $('progress-bar'),
    feedback: $('feedback'),
    overlay: $('overlay'),
    card: $('card'),
    showResults: $('show-results'),
    status: $('sr-status'),
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
    extended: WhereIsIt.usesExtended(quiz.codes),
    isActive: (code) => !quiz.dim || pool.has(code) || !pool.size,
    // While playing, the cursor label shows the country to find, never the one under the pointer.
    // Once finished, it names whatever is under the pointer so students can explore their results.
    labelFor: (hovered) => (game.state === 'playing' ? game.current : game.state === 'done' ? hovered : null),
    labelCaption: t('find'),
    // Capitals quizzes test the capitals, not where the places are, so the label also names the place under the pointer.
    labelContent: capitals
      ? (code, hovered) =>
          game.state === 'playing'
            ? [starIcon(), text(capitalName(code)), hovered ? el('span', { class: 'map-tooltip-hover' }, countryName(hovered)) : null].filter(Boolean)
            : [flagImg(code), text(fullName(code))]
      : null,
    labelHover: capitals,
    peekInactive: true, // name the greyed-out places outside the quiz on hover (no clue: they're never answers)
    onClick: onCountryClick,
  });
  map.focus(quiz.codes);

  $('zoom-in').onclick = () => map.zoomBy(1.6);
  $('zoom-out').onclick = () => map.zoomBy(1 / 1.6);
  $('zoom-reset').onclick = () => map.resetView();
  ui.showResults.onclick = () => {
    clearTimeout(game.ringTimer);
    map.ring(null);
    hideSay();
    ui.showResults.hidden = true;
    showOverlay();
  };

  // Some classes hide the running clock (less pressure); the time still shows on the results.
  if (!quiz.timer) ui.time.closest('.stat').hidden = true;

  const homeBtn = $('home');
  homeBtn.onclick = () => {
    if (game.state === 'playing' && game.results.length && !confirm(t('confirmLeave'))) return;
    backToIntro();
  };

  // Outline icons for buttons (24x24, drawn with the .ico stroke style). Declared before the first
  // render below: the welcome card uses them, and a const can't be read before its line has run.
  const ICONS = {
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5v-.3a1.7 1.7 0 0 0-1.7-1.7H5.2a1.7 1.7 0 0 0-1.7 1.7v8.6a1.7 1.7 0 0 0 1.7 1.7h.3"/>',
    replay: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V8H8"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
    shuffle: '<path d="M3.5 7h3.2c1.5 0 2.9.8 3.7 2l3.2 6c.8 1.2 2.2 2 3.7 2h3.2"/><path d="M3.5 17h3.2c1.5 0 2.9-.8 3.7-2l.4-.7M13.2 9.7l.4-.7c.8-1.2 2.2-2 3.7-2h3.2"/><path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
    map: '<path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    chevron: '<path d="M9.5 6l6 6-6 6"/>',
    // A folded map with a pencil over its corner: "draw up your own map quiz".
    mapEdit: '<path d="M11.2 18.6L9 17.5l-5.5 2.5V6.5L9 4l6 2.5L20.5 4v6.3"/><path d="M9 4v13.5M15 6.5v4.8"/><path d="M19.2 12.3l2 2-6.4 6.4-2.8.8.8-2.8z"/>',
  };

  if (!quiz.codes.length) showHome();
  else showIntro();

  // Re-render whatever is on screen in the new language. Game progress is kept.
  document.addEventListener('langchange', () => {
    map.opts.labelCaption = game.state === 'playing' ? t('find') : null;
    map.refreshLabels();
    if (game.state === 'intro') {
      if (quiz.codes.length) showIntro();
      else showHome();
    } else if (game.state === 'playing') {
      const c = game.current;
      ui.label.textContent = t('find');
      ui.target.replaceChildren(...promptNodes(c));
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
    ui.card.className = 'card'; // drop any per-card modifier (showWelcome adds 'welcome')
    void ui.card.offsetWidth; // reflow so .enter below restarts its animation even when swapping cards
    ui.card.classList.add('enter');
    ui.card.replaceChildren(...children.filter((c) => c != null)); // replaceChildren would print null as "null"
    showOverlay();
    ui.showResults.hidden = true;
  }

  /** Shows the card overlay, fading the scrim in only if it was hidden (not when swapping cards, or on page load). */
  function showOverlay() {
    if (!ui.overlay.hidden) return;
    ui.overlay.hidden = false;
    replay(ui.overlay, 'fade-in');
  }

  function showWelcome() {
    ui.stats.classList.add('idle');
    document.title = t('gamePageTitle');
    // [map, label, filter, random sample size, button label, mode]. Untitled presets get the automatic title,
    // which follows the language.
    const { world, us } = WhereIsIt.ATLASES;
    // Territories stay out of quick play; they're still available in "Create a quiz". Regions of states are too
    // (also in "Create a quiz"); the third button opens a list of states to pick a counties quiz from.
    const usPresets = us
      ? [
          [us, t('presetUsAll'), () => true, null, null, 'places'],
          [us, t('presetCapitalsAll'), () => true, null, null, 'capitals'],
        ]
      : [];
    const groups = [
      [
        'quickPlayCountries',
        [
          [world, t('presetAfrica'), (c) => c.region === 'Africa'],
          [world, t('presetEurope'), (c) => c.region === 'Europe'],
          [world, t('presetAsia'), (c) => c.region === 'Asia'],
          [world, t('presetSouthAmerica'), (c) => c.subregion === 'South America'],
          [world, t('presetNorthCentralAmerica'), (c) => ['North America', 'Central America', 'Caribbean'].includes(c.subregion)],
          [world, t('presetOceania'), (c) => c.region === 'Oceania'],
          [world, t('presetMiddleEast'), (c) => c.subregion === 'Western Asia'],
          [world, t('presetAllCountries'), () => true],
          [world, t('presetWorld'), () => true, 20],
        ],
      ],
      ['quickPlayStates', usPresets],
    ];
    const presetLinks = (presets) =>
      presets.map(([atlas, title, fn, n, label, mode]) => {
        const core = atlas.places.filter((c) => atlas.core(c));
        const codes = core.filter(fn).map((c) => c.code);
        // "Random" and "All" draw from the whole map rather than one region, so they get a quieter, distinct look.
        const whole = codes.length === core.length;
        return el(
          'a',
          { class: whole ? 'btn whole' : 'btn', href: WhereIsIt.quizQuery({ map: atlas.id, mode, codes, title, count: n }) },
          el('span', { class: 'preset-name' }, n ? icon('shuffle') : null, label || title),
          el('small', {}, t(mode === 'capitals' ? 'nCapitals' : atlas.id === 'us' ? 'nStates' : 'nCountries', { n: n ?? codes.length })),
        );
      });
    // Opens the list of states (a sub-menu in this card). Like a link, so the browser's back button closes it.
    const countiesButton = () =>
      el(
        'a',
        { class: 'btn', href: '#counties' },
        el('span', { class: 'preset-name' }, t('presetCounties'), icon('chevron')),
        el('small', {}, t('presetCountiesSub')),
      );
    const hasCounties = us && window.GEO_US_COUNTY_STATES;
    // In reading order for the one-column layout; wide, short screens move the presets into a
    // second column via grid areas (see .card.welcome in the CSS).
    showCard(
      el('div', { class: 'card-head welcome-head' }, wordmark({ large: true, tagline: true }), aboutLink()),
      el('p', { class: 'welcome-text' }, t('welcome', { n: WhereIsIt.DEFAULTS.guesses })),
      el(
        'div',
        { class: 'welcome-presets' },
        ...groups
          .filter(([, presets]) => presets.length)
          .flatMap(([heading, presets]) => [
            el('h3', { class: 'preset-heading' }, t(heading)),
            el('div', { class: 'preset-list' }, presetLinks(presets), heading === 'quickPlayStates' && hasCounties ? countiesButton() : null),
          ]),
      ),
      // A tinted panel with the card's only primary button, so building a quiz reads as its own path, apart
      // from the grid of ready-made quizzes.
      el(
        'section',
        { class: 'make-own', 'aria-labelledby': 'make-own-title' },
        el(
          'div',
          { class: 'make-own-row' },
          el('div', { class: 'make-own-badge' }, icon('mapEdit')),
          el('div', { class: 'make-own-body' }, el('h2', { id: 'make-own-title' }, t('makeYourOwn')), el('p', {}, t('makeYourOwnBlurb'))),
          el('a', { class: 'btn primary', href: 'setup' }, t('createQuiz')),
        ),
      ),
    );
    ui.card.classList.add('welcome');
  }

  /** The counties sub-menu: pick a state to play its counties. */
  function showCountyStates() {
    ui.stats.classList.add('idle');
    document.title = `${t('countiesPickState')} · Where Is It`;
    const counts = window.GEO_US_COUNTY_STATES;
    const usNames = GEO_US_STATES.names[I18N.lang] || {};
    const states = GEO_US_STATES.places
      .filter((p) => counts[p.code])
      .map((p) => ({ ...p, label: usNames[p.code] || p.name }))
      .sort((a, b) => I18N.compare(a.label, b.label));
    const links = states.map((p) => {
      const a = el(
        'a',
        { class: 'btn', href: WhereIsIt.quizQuery({ map: `counties-${p.code.toLowerCase()}`, codes: ['all'] }) },
        el('span', { class: 'preset-name' }, p.label),
        el('small', {}, t('nCounties', { n: counts[p.code] })),
      );
      a.dataset.name = WhereIsIt.fold(`${p.label}|${p.name}|${p.code}`);
      return a;
    });
    const search = el('input', { type: 'search', class: 'state-search', placeholder: t('searchStates'), 'aria-label': t('searchStates') });
    search.addEventListener('input', () => {
      const q = WhereIsIt.fold(search.value.trim());
      for (const a of links) a.hidden = Boolean(q) && !a.dataset.name.includes(q);
    });
    // Enter opens the only match, so "tex ⏎" starts Texas.
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const shown = links.filter((a) => !a.hidden);
      if (shown.length === 1) location.href = shown[0].href;
    });
    const back = el(
      'button',
      { class: 'icon-btn', type: 'button', title: t('back'), 'aria-label': t('back'), onclick: closeCountyStates },
    );
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    showCard(
      el('div', { class: 'card-head county-head' }, back, el('h1', {}, t('countiesPickState'))),
      el('p', {}, t('countiesPickStateText')),
      search,
      el('div', { class: 'preset-list county-states' }, links),
    );
    ui.card.classList.add('counties');
    // Don't pop the on-screen keyboard on touch devices.
    if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => search.focus(), 50);
  }

  // The counties sub-menu lives at #counties, so the browser's back button returns to the presets.
  let openedCounties = false; // arrived from the presets (so going back is a history step)
  function closeCountyStates() {
    if (openedCounties) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      showWelcome();
    }
  }
  function showHome() {
    if (location.hash === '#counties' && window.GEO_US_COUNTY_STATES && window.GEO_US_STATES) showCountyStates();
    else showWelcome();
  }
  window.addEventListener('hashchange', () => {
    if (quiz.codes.length) return;
    openedCounties = location.hash === '#counties';
    showHome();
  });

  function showIntro() {
    homeBtn.hidden = true;
    ui.stats.classList.add('idle');
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
    clearTimeout(game.ringTimer);
    hideSay();
    map.clearStates();
    map.ring(null);
    map.setLabels([]);
    map.setCapitals([]);
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
    ui.stats.classList.remove('idle');
    clearTimeout(game.nextTimer);
    clearTimeout(game.ringTimer);
    hideSay();
    map.setLabels([]);
    map.setCapitals([]);
    map.opts.labelCaption = t('find');
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
    map.setLabels([]);
    if (capitalStars) map.setCapitals(answered()); // keep the stars, drop the last one's name
    game.index++;
    game.advancing = false;
    if (game.index >= game.queue.length) return finish();
    game.current = game.queue[game.index];
    game.wrong = 0;
    game.hint = false;
    renderPrompt();
    replay(ui.target, 'enter');
    renderStats();
  }

  function onCountryClick(code) {
    // After the game, tapping a country names it (touch screens have no hover label).
    if (game.state === 'done') {
      if (ui.overlay.hidden) say('', fullName(code), code);
      return;
    }
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
      // Star the capital, named until the next one so it sinks in.
      if (capitalStars) map.setCapitals(answered(), [code], code);
      if (found) {
        map.flash(code, 'flash-right', 800);
        say('good', game.wrong === 0 ? t('correct') : t('correctTries', { n: game.wrong + 1 }), code);
      } else {
        // Leave a missed country on screen, named, long enough to take in where it is.
        if (!capitalStars) map.setLabels([code]);
        say('', t('thatsKeepPracticing', { name, capital: capitalName(code) }), code);
      }
      renderStats();
      game.nextTimer = setTimeout(next, found ? 650 : 2400);
      return;
    }

    map.flash(code, 'flash-wrong');
    if (game.hint) {
      say('hint', t('thatsClickHighlighted', { name }), code);
      return;
    }
    game.wrong++;
    renderGuesses(true);
    if (game.wrong >= quiz.guesses) {
      game.hint = true;
      map.toggleClass(target, 'hint', true);
      map.ring(target);
      map.ensureVisible(target);
      say('hint', t('thatsHereIs', { name, target: countryName(target), capital: capitalName(target) }), code);
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
    map.opts.labelCaption = null;
    // Name what was missed: the places, or in a capitals quiz the missed capitals next to every capital's star.
    if (capitalStars) map.setCapitals(answered(), summary().missed);
    else map.setLabels(summary().missed);
    map.refreshTooltip(true);
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
      s.missed.length ? t('missedLine', { list: s.missed.map(missedName).join(', ') }) : t('missedNone'),
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
            ui.showResults.focus();
          },
        },
        icon('map'),
        t('viewMap'),
      ),
    );

    const ordered = game.results.slice().sort((a, b) => I18N.compare(promptName(a.code), promptName(b.code)));
    const list = el(
      'ul',
      { class: 'result-list' },
      ordered.map((r) => {
        const cls = !r.found ? 'missed' : r.wrong === 0 ? 'first' : 'ok';
        const mark = !r.found ? '✗' : r.wrong === 0 ? '✓' : `✓${r.wrong + 1}`;
        const tip = !r.found ? t('resultMissed') : r.wrong === 0 ? t('resultFirstTry') : t('resultOnTry', { n: r.wrong + 1 });
        return el(
          'li',
          { class: cls },
          el(
            'button',
            { type: 'button', title: `${tip} · ${t('showOnMap')}`, onclick: () => locate(r.code) },
            capitals ? starIcon() : flagImg(r.code),
            capitals
              ? el('span', { class: 'names' }, el('span', { class: 'name' }, capitalName(r.code)), el('span', { class: 'sub' }, countryName(r.code)))
              : el('span', { class: 'name' }, countryName(r.code)),
            el('span', { class: 'mark', 'aria-label': tip }, mark),
          ),
        );
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
      el('p', { class: 'list-hint' }, t('resultsHint')),
      list,
      el('div', { class: 'card-foot' }, customizeLink()),
    );
  }

  // ---------------------------------------------------------------- rendering

  function renderPrompt() {
    const c = game.current;
    ui.label.textContent = t('find');
    ui.target.replaceChildren(...promptNodes(c));
    renderGuesses();
    hideSay();
    map.refreshTooltip();
    announce(t('findAnnounce', { name: promptName(c) }));
  }

  /** The top bar's prompt: flag (or code badge) and name, or in a capitals quiz a star and the capital. */
  function promptNodes(code) {
    return [capitals ? starIcon() : flagImg(code), text(promptName(code))];
  }

  /** animate: play the "used up" animation on the pip the latest wrong guess took. */
  function renderGuesses(animate = false) {
    const dots = [];
    for (let i = 0; i < quiz.guesses; i++) {
      const cls = i < game.wrong ? (animate && i === game.wrong - 1 ? 'used just-used' : 'used') : '';
      dots.push(el('span', { class: cls }));
    }
    ui.guesses.replaceChildren(...dots);
    ui.guesses.title = t('guessesLeft', { n: Math.max(quiz.guesses - game.wrong, 0) });
  }

  function renderStats() {
    const total = game.queue.length;
    const shown = Math.min(game.index + 1, total);
    ui.progress.textContent = total ? `${shown}/${total}` : '–';
    const score = game.results.filter((r) => r.found).length;
    if (score > Number(ui.score.textContent)) replay(ui.score, 'bump');
    ui.score.textContent = score;
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
    announce(text);
    if (kind !== 'hint') sayTimer = setTimeout(hideSay, 2200);
  }
  function hideSay() {
    clearTimeout(sayTimer);
    const f = ui.feedback;
    if (f.hidden) return;
    // Fade out, then hide. say() resets the class list, so a new message during the fade cancels it.
    f.classList.add('out');
    sayTimer = setTimeout(() => (f.hidden = true), 150);
  }
  /** Restarts a one-shot CSS animation class on an element. */
  function replay(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }
  /** Reads feedback out to screen readers (the visible pill comes and goes too fast to be announced). */
  function announce(text) {
    ui.status.textContent = text;
  }

  /** From the results list: closes the card and shows that country on the map. */
  function locate(code) {
    ui.overlay.hidden = true;
    ui.showResults.hidden = false;
    ui.showResults.focus();
    map.fitBounds(map.boundsOf([code]), 700);
    map.ring(code);
    clearTimeout(game.ringTimer);
    game.ringTimer = setTimeout(() => map.ring(null), 3000);
    say('', fullName(code), code);
  }

  // ---------------------------------------------------------------- helpers

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

  /** The About page, linked from the welcome card only (quiz and results cards stay focused on the quiz). */
  function aboutLink() {
    return el('a', { class: 'subtle-link', href: 'about', target: '_blank', rel: 'noopener' }, t('about'));
  }

  /** Places answered so far (found or missed), for the capital stars. */
  function answered() {
    return game.results.map((r) => r.code);
  }

  /** How a missed place is listed in the copied score: "Sacramento (California)" in a capitals quiz. */
  function missedName(code) {
    return capitals ? `${capitalName(code)} (${countryName(code)})` : countryName(code);
  }

  function questionCount() {
    return Math.min(quiz.count || quiz.codes.length, quiz.codes.length);
  }
})();
