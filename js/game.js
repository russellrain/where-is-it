// Student game: find each country on the map.
(function () {
  'use strict';
  const { byCode, el, flagImg, formatTime } = GeoFind;

  const quiz = GeoFind.parseQuiz(location.search);
  const pool = new Set(quiz.codes);
  const title = quiz.title || defaultTitle(quiz.codes);

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
    name: '',
  };

  const map = new GeoMap($('map'), {
    rotate: GeoFind.rotationFor(quiz.codes),
    isActive: (code) => !quiz.dim || pool.has(code) || !pool.size,
    // The cursor label shows the country to find, never the one under the pointer.
    labelFor: () => (game.state === 'playing' ? game.current : null),
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

  if (!quiz.codes.length) showWelcome();
  else showIntro();

  // ---------------------------------------------------------------- screens

  function showCard(...children) {
    ui.card.replaceChildren(...children);
    ui.overlay.hidden = false;
    ui.showResults.hidden = true;
  }

  function showWelcome() {
    document.title = 'GeoFindIt';
    const presets = [
      ['Africa', (c) => c.region === 'Africa'],
      ['Europe', (c) => c.region === 'Europe'],
      ['Asia', (c) => c.region === 'Asia'],
      ['South America', (c) => c.subregion === 'South America'],
      ['North & Central America', (c) => ['North America', 'Central America', 'Caribbean'].includes(c.subregion)],
      ['Oceania', (c) => c.region === 'Oceania'],
      ['Middle East', (c) => c.subregion === 'Western Asia'],
      ['Whole world', () => true],
    ];
    const links = presets.map(([name, fn]) => {
      const codes = GeoFind.COUNTRIES.filter((c) => c.sovereign && fn(c)).map((c) => c.code);
      const n = name === 'Whole world' ? 20 : null;
      return el(
        'a',
        { class: 'btn', href: GeoFind.quizQuery({ codes, title: name, count: n }) },
        `${name}`,
        el('small', { style: 'color:var(--ink-soft);font-weight:500;margin-left:auto' }, n ? `${n} random` : `${codes.length}`),
      );
    });
    showCard(
      el('div', { class: 'logo' }, el('span', { class: 'globe' }, '🌍'), 'GeoFindIt'),
      el('h1', {}, 'Find the country!'),
      el('p', {}, 'You’ll be shown one country at a time — click it on the map. You get 3 guesses before the answer flashes.'),
      el('h2', {}, 'Teachers'),
      el('p', {}, 'Choose regions or individual countries and get a link to share with your class.'),
      el('div', { class: 'actions', style: 'margin-top:10px' }, el('a', { class: 'btn primary', href: 'setup.html' }, 'Create a quiz →')),
      el('h2', {}, 'Quick play'),
      el('div', { class: 'preset-list' }, links),
    );
  }

  function showIntro() {
    document.title = `${title} · GeoFindIt`;
    const total = questionCount();
    const nameInput = el('input', {
      type: 'text',
      autocomplete: 'name',
      maxlength: '40',
      placeholder: 'Your name',
      value: loadName(),
    });
    const startBtn = el('button', { class: 'btn primary big', type: 'button', onclick: begin }, 'Start');
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && begin());
    function begin() {
      game.name = nameInput.value.trim();
      saveName(game.name);
      start(GeoFind.shuffle(quiz.codes).slice(0, total));
    }
    showCard(
      el('div', { class: 'logo' }, el('span', { class: 'globe' }, '🌍'), 'GeoFindIt'),
      el('h1', {}, title),
      el(
        'p',
        {},
        `Find ${total} ${total === 1 ? 'country' : 'countries'} on the map. `,
        `You get ${quiz.guesses} ${quiz.guesses === 1 ? 'guess' : 'guesses'} for each one — after that, the answer will flash and you’ll click it to move on.`,
      ),
      el('p', {}, 'Scroll or pinch to zoom, drag to move the map.'),
      el('label', { class: 'field' }, 'Name (shown on your score)', nameInput),
      el('div', { class: 'actions' }, startBtn),
    );
    setTimeout(() => (nameInput.value ? startBtn : nameInput).focus(), 50);
  }

  // ---------------------------------------------------------------- play

  function start(queue) {
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
    const clicked = byCode.get(code);

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
        say('good', game.wrong === 0 ? 'Correct!' : `Correct! (${game.wrong + 1} tries)`, code);
      } else {
        say('', `That’s ${clicked.name}. Keep practicing!`, code);
      }
      renderStats();
      setTimeout(next, found ? 650 : 900);
      return;
    }

    map.flash(code, 'flash-wrong');
    if (game.hint) {
      say('hint', `That’s ${clicked.name}. Click the flashing country.`, code);
      return;
    }
    game.wrong++;
    renderGuesses();
    if (game.wrong >= quiz.guesses) {
      game.hint = true;
      map.toggleClass(target, 'hint', true);
      map.ring(target);
      map.ensureVisible(target);
      say('hint', `That’s ${clicked.name}. ${byCode.get(target).name} is flashing — click it to continue.`, code);
    } else {
      const left = quiz.guesses - game.wrong;
      say('bad', `That’s ${clicked.name}. ${left} ${left === 1 ? 'guess' : 'guesses'} left.`, code);
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
    ui.label.textContent = 'Finished';
    ui.target.replaceChildren(document.createTextNode(title));
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
    const first = game.results.filter((r) => r.found && r.wrong === 0).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const missed = game.results.filter((r) => !r.found).map((r) => r.code);
    return { total, correct, first, pct, missed };
  }

  function scoreText() {
    const s = summary();
    const lines = [
      `🌍 GeoFindIt — ${title}`,
      game.name ? `Name: ${game.name}` : null,
      `Score: ${s.correct}/${s.total} (${s.pct}%)`,
      `First try: ${s.first}/${s.total}`,
      `Time: ${formatTime(game.elapsed)}`,
      s.missed.length ? `Missed: ${s.missed.map((c) => byCode.get(c).name).join(', ')}` : 'Missed: none 🎉',
      `Completed: ${new Date().toLocaleString()}`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  function showResults() {
    const s = summary();
    const praise =
      s.pct === 100 ? 'Perfect score! 🎉' : s.pct >= 80 ? 'Great job!' : s.pct >= 50 ? 'Nice work — keep going!' : 'Good practice — try again!';

    const copyBtn = el('button', { class: 'btn primary', type: 'button' }, 'Copy score');
    copyBtn.onclick = async () => {
      const ok = await GeoFind.copyText(scoreText());
      copyBtn.textContent = ok ? 'Copied ✓' : 'Copy failed';
      setTimeout(() => (copyBtn.textContent = 'Copy score'), 2000);
    };

    const actions = [
      copyBtn,
      el('button', { class: 'btn', type: 'button', onclick: () => start(GeoFind.shuffle(quiz.codes).slice(0, questionCount())) }, 'Play again'),
    ];
    if (s.missed.length) {
      actions.push(
        el('a', { class: 'btn', href: GeoFind.quizQuery({ ...quiz, codes: s.missed, count: null, title: `${title} — practice` }) }, 'Practice missed'),
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
        'View map',
      ),
    );

    const ordered = game.results.slice().sort((a, b) => byCode.get(a.code).name.localeCompare(byCode.get(b.code).name));
    const list = el(
      'ul',
      { class: 'result-list' },
      ordered.map((r) => {
        const cls = !r.found ? 'missed' : r.wrong === 0 ? 'first' : 'ok';
        const mark = !r.found ? '✗' : r.wrong === 0 ? '✓' : `✓${r.wrong + 1}`;
        const title = !r.found ? 'Missed' : r.wrong === 0 ? 'First try' : `Found on try ${r.wrong + 1}`;
        return el('li', { class: cls, title }, flagImg(r.code), byCode.get(r.code).name, el('span', { class: 'mark' }, mark));
      }),
    );

    showCard(
      el('div', { class: 'logo' }, el('span', { class: 'globe' }, '🌍'), title),
      el('h1', {}, praise),
      game.name ? el('p', {}, game.name) : null,
      el(
        'div',
        { class: 'score-big' },
        el('div', {}, el('b', {}, `${s.correct}/${s.total}`), el('small', {}, `Correct (${s.pct}%)`)),
        el('div', {}, el('b', {}, `${s.first}`), el('small', {}, 'First try')),
        el('div', {}, el('b', {}, formatTime(game.elapsed)), el('small', {}, 'Time')),
      ),
      el('div', { class: 'actions' }, actions),
      el('h2', {}, 'Countries'),
      list,
    );
  }

  // ---------------------------------------------------------------- rendering

  function renderPrompt() {
    const c = byCode.get(game.current);
    ui.label.textContent = 'Find';
    ui.target.replaceChildren(flagImg(c.code), document.createTextNode(c.name));
    renderGuesses();
    hideSay();
    map.refreshTooltip();
  }

  function renderGuesses() {
    const dots = [];
    for (let i = 0; i < quiz.guesses; i++) dots.push(el('span', { class: i < game.wrong ? 'used' : '' }));
    ui.guesses.replaceChildren(...dots);
    ui.guesses.title = `${Math.max(quiz.guesses - game.wrong, 0)} guesses left`;
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

  function questionCount() {
    return Math.min(quiz.count || quiz.codes.length, quiz.codes.length);
  }

  function defaultTitle(codes) {
    if (!codes.length) return 'GeoFindIt';
    const regions = new Set(codes.map((c) => byCode.get(c).region));
    return regions.size === 1 ? `${[...regions][0]} countries` : 'Countries of the world';
  }

  function loadName() {
    try {
      return localStorage.getItem('geofindit.name') || '';
    } catch {
      return '';
    }
  }
  function saveName(name) {
    try {
      localStorage.setItem('geofindit.name', name);
    } catch {}
  }
})();
