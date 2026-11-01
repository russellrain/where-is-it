// Translations. Loaded in <head> (before theme.js) so the page language is known before anything renders.
//
// Static HTML is translated with attributes, applied on DOMContentLoaded and on every language switch:
//   data-i18n="key"             -> textContent
//   data-i18n-title="key"       -> title attribute (also data-i18n-aria-label, data-i18n-placeholder)
// Scripts call I18N.t('key', { vars }) and re-render on the document's 'langchange' event.
//
// Pages with <html data-quiz-lang> (the game and the worksheet) only offer the languages the teacher
// allowed in the quiz link (?l=en,es). Other pages offer every language. Any <select class="lang-select">
// becomes a language picker (hidden when there's only one choice); the pick is remembered in localStorage.
//
// To add a language: add it to LANGUAGES, add a STRINGS and REGIONS table below, and add its country
// names in tools/build-data.mjs (TRANSLATIONS), then run `npm run build-data`.
(function () {
  'use strict';

  const LANGUAGES = { en: 'English', es: 'Español', fr: 'Français' };
  const CODES = Object.keys(LANGUAGES);
  const KEY = 'whereisit-lang';

  // Plural helper: plural(n, 'country', 'countries')
  const plural = (n, one, other) => (n === 1 ? one : other);

  const STRINGS = {
    en: {
      tagline: 'The country-finding game',
      language: 'Language',
      madeBy: 'Made by',
      mapCredit: 'Map:',
      about: 'About',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      resetView: 'Reset view',
      zoomToSelection: 'Zoom to selection',
      switchTheme: 'Switch theme',
      themeToDark: 'Switch to dark mode',
      themeToLight: 'Switch to light mode',
      showOnMap: 'Show on map',
      expand: 'Expand',
      territory: 'territory',
      copied: 'Copied ✓',
      copyFailed: 'Copy failed',
      print: 'Print',

      // game
      gamePageTitle: 'Where Is It · The country-finding game',
      backToStart: 'Back to quiz start',
      statCountry: 'Country',
      statCorrect: 'Correct',
      statTime: 'Time',
      guessesLeftTitle: 'Guesses left',
      showResults: 'Show results',
      confirmLeave: 'Go back to the start? Your progress will be lost.',
      welcome: 'You’ll see one country at a time. Find it and click it on the map. If you miss 3 times, we’ll show you where it is.',
      makeYourOwn: 'Make your own',
      makeYourOwnBlurb: 'Choose regions or individual countries to make your own quiz.',
      createQuiz: 'Create a quiz →',
      quickPlay: 'Quick play',
      presetAfrica: 'Africa',
      presetEurope: 'Europe',
      presetAsia: 'Asia',
      presetSouthAmerica: 'South America',
      presetNorthCentralAmerica: 'N. & Central America',
      presetOceania: 'Oceania',
      presetMiddleEast: 'Middle East',
      presetWorld: 'Random',
      presetAllCountries: 'All countries',
      introFind: ({ n }) => `Find ${n} ${plural(n, 'country', 'countries')} on the map.`,
      introGuesses: ({ n }) =>
        `You get ${n} ${plural(n, 'guess', 'guesses')} before getting a hint. Countries you need a hint for are marked as missed.`,
      introControls: 'Scroll or pinch to zoom, drag to move the map.',
      start: 'Start',
      find: 'Find',
      correct: 'Correct!',
      correctTries: 'Correct! ({n} tries)',
      thatsKeepPracticing: 'That’s {name}. Keep practicing!',
      thatsClickHighlighted: 'That’s {name}. Click the highlighted country.',
      thatsHereIs: 'That’s {name}. Here’s {target}. Click it to continue.',
      thatsGuessesLeft: ({ name, n }) => `That’s ${name}. ${n} ${plural(n, 'guess', 'guesses')} left.`,
      guessesLeft: ({ n }) => `${n} ${plural(n, 'guess', 'guesses')} left`,
      finished: 'Finished',
      scoreLine: 'Score: {correct}/{total} ({pct}%)',
      timeLine: 'Time: {time}',
      missedLine: 'Missed: {list}',
      missedNone: 'Missed: none 🎉',
      completedLine: 'Completed: {date}',
      praisePerfect: 'Perfect score! 🎉',
      praiseGreat: 'Great job!',
      praiseNice: 'Nice work!',
      praiseTry: 'Good practice. Try again!',
      copyScore: 'Copy score',
      playAgain: 'Play again',
      practiceMissed: 'Practice missed',
      practiceTitle: '{title} — practice',
      viewMap: 'View map',
      resultMissed: 'Missed',
      resultFirstTry: 'First try',
      resultOnTry: 'Found on try {n}',
      correctPct: 'Correct ({pct}%)',
      countriesHeading: 'Countries',
      customize: '✎ Customize',
      customizeTitle: 'Open this quiz in the editor to change it and get your own link',
      regionTitle: '{region} countries',
      worldTitle: 'Countries of the world',

      // setup
      setupPageTitle: 'Create a Quiz · Where Is It',
      setupIntro: 'Pick regions or individual countries, or click countries on the map, then share the link.',
      searchCountries: 'Search countries…',
      clear: 'Clear',
      includeTerritories: 'Include territories & dependencies (e.g. Greenland, Puerto Rico)',
      quizOptions: 'Quiz options',
      quizTitle: 'Quiz title',
      quizTitlePlaceholder: 'e.g. Countries of Africa',
      questions: 'Questions',
      all: 'All',
      guessesPerCountry: 'Guesses per country',
      dimOthers: 'Grey out countries that aren’t in the quiz',
      studentLanguages: 'Learner languages',
      studentLanguagesHint: 'Learners can switch between the languages you choose.',
      allLanguages: ({ n }) => `All languages (${n})`,
      changeLanguages: 'Change',
      searchLanguages: 'Search languages…',
      selectAll: 'Select all',
      done: 'Done',
      back: 'Back',
      pickOneLanguage: 'Choose at least one language.',
      nOfTotalSelected: '{n} of {total} selected',
      noLanguagesMatch: 'No languages match “{q}”',
      noneSelected: 'No countries selected',
      nSelected: ({ n }) => `${n} ${plural(n, 'country', 'countries')} selected`,
      askedPerGame: ' · {n} asked per game',
      quizLink: 'Quiz link',
      copyLink: 'Copy link',
      tryIt: 'Try it ↗',
      printTitle: 'Printable map worksheet',
      mapHint: 'Click countries to add or remove them',

      // print
      printPageTitle: 'Printable Worksheet · Where Is It',
      backToSetup: 'Back to quiz setup',
      printableWorksheet: 'Printable worksheet',
      crowded: 'Some numbers are crowded together on the map. Splitting this into smaller worksheets (e.g. one per region) will be easier to read.',
      page: 'Page',
      orientAuto: 'Auto',
      orientLandscape: 'Landscape',
      orientPortrait: 'Portrait',
      answerKeyPage: 'Answer key page',
      findTheCountries: 'Find the Countries',
      nameLine: 'Name',
      wordBankHeading: '{title} · Word bank',
      answerKeyHeading: '{title} · Answer key',
      continued: '{heading} (continued)',
      wordBankInstructions: 'Write the number from the map next to each country.',
      printEmpty: 'No countries selected.',
      printEmptyLink: 'Choose some countries',
      printEmptyAfter: 'first.',
    },

    es: {
      tagline: 'El juego de buscar países',
      language: 'Idioma',
      madeBy: 'Hecho por',
      mapCredit: 'Mapa:',
      about: 'Acerca de',
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      resetView: 'Restablecer vista',
      zoomToSelection: 'Ajustar a la selección',
      switchTheme: 'Cambiar tema',
      themeToDark: 'Cambiar a modo oscuro',
      themeToLight: 'Cambiar a modo claro',
      showOnMap: 'Ver en el mapa',
      expand: 'Expandir',
      territory: 'territorio',
      copied: 'Copiado ✓',
      copyFailed: 'No se pudo copiar',
      print: 'Imprimir',

      gamePageTitle: 'Where Is It · El juego de buscar países',
      backToStart: 'Volver al inicio del cuestionario',
      statCountry: 'País',
      statCorrect: 'Aciertos',
      statTime: 'Tiempo',
      guessesLeftTitle: 'Intentos restantes',
      showResults: 'Ver resultados',
      confirmLeave: '¿Volver al inicio? Se perderá tu progreso.',
      welcome: 'Verás un país a la vez. Búscalo y haz clic en él en el mapa. Si fallas 3 veces, te mostraremos dónde está.',
      makeYourOwn: 'Crea el tuyo',
      makeYourOwnBlurb: 'Elige regiones o países concretos para crear tu propio cuestionario.',
      createQuiz: 'Crear un cuestionario →',
      quickPlay: 'Juego rápido',
      presetAfrica: 'África',
      presetEurope: 'Europa',
      presetAsia: 'Asia',
      presetSouthAmerica: 'Sudamérica',
      presetNorthCentralAmerica: 'Norte y Centroamérica',
      presetOceania: 'Oceanía',
      presetMiddleEast: 'Oriente Medio',
      presetWorld: 'Al azar',
      presetAllCountries: 'Todos los países',
      introFind: ({ n }) => `Encuentra ${n} ${plural(n, 'país', 'países')} en el mapa.`,
      introGuesses: ({ n }) =>
        `Tienes ${n} ${plural(n, 'intento', 'intentos')} antes de recibir una pista. Los países para los que necesites una pista cuentan como fallados.`,
      introControls: 'Usa la rueda o pellizca para acercar, y arrastra para mover el mapa.',
      start: 'Empezar',
      find: 'Busca',
      correct: '¡Correcto!',
      correctTries: '¡Correcto! ({n} intentos)',
      thatsKeepPracticing: 'Eso es {name}. ¡Sigue practicando!',
      thatsClickHighlighted: 'Eso es {name}. Haz clic en el país resaltado.',
      thatsHereIs: 'Eso es {name}. Aquí está {target}. Haz clic para continuar.',
      thatsGuessesLeft: ({ name, n }) => `Eso es ${name}. ${plural(n, 'Te queda', 'Te quedan')} ${n} ${plural(n, 'intento', 'intentos')}.`,
      guessesLeft: ({ n }) => `${plural(n, 'Queda', 'Quedan')} ${n} ${plural(n, 'intento', 'intentos')}`,
      finished: 'Terminado',
      scoreLine: 'Puntuación: {correct}/{total} ({pct} %)',
      timeLine: 'Tiempo: {time}',
      missedLine: 'Fallados: {list}',
      missedNone: 'Fallados: ninguno 🎉',
      completedLine: 'Completado: {date}',
      praisePerfect: '¡Puntuación perfecta! 🎉',
      praiseGreat: '¡Muy bien!',
      praiseNice: '¡Buen trabajo!',
      praiseTry: 'Buena práctica. ¡Inténtalo de nuevo!',
      copyScore: 'Copiar puntuación',
      playAgain: 'Jugar de nuevo',
      practiceMissed: 'Practicar fallados',
      practiceTitle: '{title} — práctica',
      viewMap: 'Ver mapa',
      resultMissed: 'Fallado',
      resultFirstTry: 'A la primera',
      resultOnTry: 'Encontrado en el intento {n}',
      correctPct: 'Aciertos ({pct} %)',
      countriesHeading: 'Países',
      customize: '✎ Personalizar',
      customizeTitle: 'Abre este cuestionario en el editor para cambiarlo y obtener tu propio enlace',
      regionTitle: 'Países de {region}',
      worldTitle: 'Países del mundo',

      setupPageTitle: 'Crear un cuestionario · Where Is It',
      setupIntro: 'Elige regiones o países concretos, o haz clic en los países del mapa, y luego comparte el enlace.',
      searchCountries: 'Buscar países…',
      clear: 'Borrar',
      includeTerritories: 'Incluir territorios y dependencias (p. ej., Groenlandia, Puerto Rico)',
      quizOptions: 'Opciones del cuestionario',
      quizTitle: 'Título del cuestionario',
      quizTitlePlaceholder: 'p. ej., Países de África',
      questions: 'Preguntas',
      all: 'Todas',
      guessesPerCountry: 'Intentos por país',
      dimOthers: 'Atenuar los países que no están en el cuestionario',
      studentLanguages: 'Idiomas para participantes',
      studentLanguagesHint: 'Los participantes pueden cambiar entre los idiomas que elijas.',
      allLanguages: ({ n }) => `Todos los idiomas (${n})`,
      changeLanguages: 'Cambiar',
      searchLanguages: 'Buscar idiomas…',
      selectAll: 'Seleccionar todos',
      done: 'Listo',
      back: 'Volver',
      pickOneLanguage: 'Elige al menos un idioma.',
      nOfTotalSelected: '{n} de {total} seleccionados',
      noLanguagesMatch: 'Ningún idioma coincide con «{q}»',
      noneSelected: 'No hay países seleccionados',
      nSelected: ({ n }) => `${n} ${plural(n, 'país seleccionado', 'países seleccionados')}`,
      askedPerGame: ' · {n} por partida',
      quizLink: 'Enlace del cuestionario',
      copyLink: 'Copiar enlace',
      tryIt: 'Probar ↗',
      printTitle: 'Hoja de trabajo imprimible con mapa',
      mapHint: 'Haz clic en los países para añadirlos o quitarlos',

      printPageTitle: 'Hoja de trabajo imprimible · Where Is It',
      backToSetup: 'Volver a la configuración del cuestionario',
      printableWorksheet: 'Hoja de trabajo imprimible',
      crowded: 'Algunos números quedan amontonados en el mapa. Será más fácil de leer si lo divides en hojas más pequeñas (p. ej., una por región).',
      page: 'Página',
      orientAuto: 'Automática',
      orientLandscape: 'Horizontal',
      orientPortrait: 'Vertical',
      answerKeyPage: 'Página de respuestas',
      findTheCountries: 'Encuentra los países',
      nameLine: 'Nombre',
      wordBankHeading: '{title} · Banco de palabras',
      answerKeyHeading: '{title} · Respuestas',
      continued: '{heading} (continuación)',
      wordBankInstructions: 'Escribe junto a cada país el número que tiene en el mapa.',
      printEmpty: 'No hay países seleccionados.',
      printEmptyLink: 'Elige algunos países',
      printEmptyAfter: 'primero.',
    },

    fr: {
      tagline: 'Le jeu pour trouver les pays',
      language: 'Langue',
      madeBy: 'Créé par',
      mapCredit: 'Carte :',
      about: 'À propos',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arrière',
      resetView: 'Réinitialiser la vue',
      zoomToSelection: 'Ajuster à la sélection',
      switchTheme: 'Changer de thème',
      themeToDark: 'Passer en mode sombre',
      themeToLight: 'Passer en mode clair',
      showOnMap: 'Voir sur la carte',
      expand: 'Développer',
      territory: 'territoire',
      copied: 'Copié ✓',
      copyFailed: 'Échec de la copie',
      print: 'Imprimer',

      gamePageTitle: 'Where Is It · Le jeu pour trouver les pays',
      backToStart: 'Retour au début du quiz',
      statCountry: 'Pays',
      statCorrect: 'Réussis',
      statTime: 'Temps',
      guessesLeftTitle: 'Essais restants',
      showResults: 'Voir les résultats',
      confirmLeave: 'Revenir au début ? Ta progression sera perdue.',
      welcome: 'Tu verras un pays à la fois. Trouve-le et clique dessus sur la carte. Si tu te trompes 3 fois, on te montrera où il se trouve.',
      makeYourOwn: 'Créez le vôtre',
      makeYourOwnBlurb: 'Choisissez des régions ou des pays précis pour créer votre propre quiz.',
      createQuiz: 'Créer un quiz →',
      quickPlay: 'Partie rapide',
      presetAfrica: 'Afrique',
      presetEurope: 'Europe',
      presetAsia: 'Asie',
      presetSouthAmerica: 'Amérique du Sud',
      presetNorthCentralAmerica: 'Amérique du N. et centrale',
      presetOceania: 'Océanie',
      presetMiddleEast: 'Moyen-Orient',
      presetWorld: 'Au hasard',
      presetAllCountries: 'Tous les pays',
      introFind: ({ n }) => `Trouve ${n} pays sur la carte.`,
      introGuesses: ({ n }) =>
        `Tu as ${n} ${plural(n, 'essai', 'essais')} avant de recevoir un indice. Les pays pour lesquels tu as besoin d’un indice comptent comme manqués.`,
      introControls: 'Fais défiler ou pince pour zoomer, et fais glisser pour déplacer la carte.',
      start: 'Commencer',
      find: 'Trouve',
      correct: 'Bravo !',
      correctTries: 'Bravo ! ({n} essais)',
      thatsKeepPracticing: 'Ça, c’est : {name}. Continue à t’entraîner !',
      thatsClickHighlighted: 'Ça, c’est : {name}. Clique sur le pays en surbrillance.',
      thatsHereIs: 'Ça, c’est : {name}. Voici : {target}. Clique dessus pour continuer.',
      thatsGuessesLeft: ({ name, n }) => `Ça, c’est : ${name}. Encore ${n} ${plural(n, 'essai', 'essais')}.`,
      guessesLeft: ({ n }) => `${n} ${plural(n, 'essai restant', 'essais restants')}`,
      finished: 'Terminé',
      scoreLine: 'Score : {correct}/{total} ({pct} %)',
      timeLine: 'Temps : {time}',
      missedLine: 'Manqués : {list}',
      missedNone: 'Manqués : aucun 🎉',
      completedLine: 'Terminé le : {date}',
      praisePerfect: 'Score parfait ! 🎉',
      praiseGreat: 'Excellent travail !',
      praiseNice: 'Bien joué !',
      praiseTry: 'Bon entraînement. Réessaie !',
      copyScore: 'Copier le score',
      playAgain: 'Rejouer',
      practiceMissed: 'Revoir les manqués',
      practiceTitle: '{title} — entraînement',
      viewMap: 'Voir la carte',
      resultMissed: 'Manqué',
      resultFirstTry: 'Du premier coup',
      resultOnTry: 'Trouvé à l’essai {n}',
      correctPct: 'Réussis ({pct} %)',
      countriesHeading: 'Pays',
      customize: '✎ Personnaliser',
      customizeTitle: 'Ouvrir ce quiz dans l’éditeur pour le modifier et obtenir votre propre lien',
      regionTitle: 'Pays : {region}',
      worldTitle: 'Les pays du monde',

      setupPageTitle: 'Créer un quiz · Where Is It',
      setupIntro: 'Choisissez des régions ou des pays précis, ou cliquez sur les pays de la carte, puis partagez le lien.',
      searchCountries: 'Rechercher des pays…',
      clear: 'Effacer',
      includeTerritories: 'Inclure les territoires et dépendances (p. ex. Groenland, Porto Rico)',
      quizOptions: 'Options du quiz',
      quizTitle: 'Titre du quiz',
      quizTitlePlaceholder: 'p. ex. Les pays d’Afrique',
      questions: 'Questions',
      all: 'Toutes',
      guessesPerCountry: 'Essais par pays',
      dimOthers: 'Griser les pays qui ne font pas partie du quiz',
      studentLanguages: 'Langues des participants',
      studentLanguagesHint: 'Les participants peuvent passer d’une langue choisie à l’autre.',
      allLanguages: ({ n }) => `Toutes les langues (${n})`,
      changeLanguages: 'Modifier',
      searchLanguages: 'Rechercher des langues…',
      selectAll: 'Tout sélectionner',
      done: 'Terminé',
      back: 'Retour',
      pickOneLanguage: 'Choisissez au moins une langue.',
      nOfTotalSelected: '{n} sur {total} sélectionnées',
      noLanguagesMatch: 'Aucune langue ne correspond à « {q} »',
      noneSelected: 'Aucun pays sélectionné',
      nSelected: ({ n }) => `${n} pays ${plural(n, 'sélectionné', 'sélectionnés')}`,
      askedPerGame: ' · {n} par partie',
      quizLink: 'Lien du quiz',
      copyLink: 'Copier le lien',
      tryIt: 'Essayer ↗',
      printTitle: 'Fiche d’exercice imprimable avec carte',
      mapHint: 'Cliquez sur les pays pour les ajouter ou les retirer',

      printPageTitle: 'Fiche imprimable · Where Is It',
      backToSetup: 'Retour à la configuration du quiz',
      printableWorksheet: 'Fiche imprimable',
      crowded: 'Certains numéros se chevauchent sur la carte. Diviser en fiches plus petites (p. ex. une par région) sera plus lisible.',
      page: 'Page',
      orientAuto: 'Automatique',
      orientLandscape: 'Paysage',
      orientPortrait: 'Portrait',
      answerKeyPage: 'Page de corrigé',
      findTheCountries: 'Trouve les pays',
      nameLine: 'Nom',
      wordBankHeading: '{title} · Liste de mots',
      answerKeyHeading: '{title} · Corrigé',
      continued: '{heading} (suite)',
      wordBankInstructions: 'Écris à côté de chaque pays le numéro qui lui correspond sur la carte.',
      printEmpty: 'Aucun pays sélectionné.',
      printEmptyLink: 'Choisissez quelques pays',
      printEmptyAfter: 'd’abord.',
    },
  };

  // Region and subregion names (English names are the keys used in the data).
  const REGIONS = {
    es: {
      Africa: 'África',
      Americas: 'América',
      Asia: 'Asia',
      Europe: 'Europa',
      Oceania: 'Oceanía',
      Antarctica: 'Antártida',
      'Australia and New Zealand': 'Australia y Nueva Zelanda',
      Caribbean: 'Caribe',
      'Central America': 'Centroamérica',
      'Central Asia': 'Asia Central',
      'Central Europe': 'Europa Central',
      'Eastern Africa': 'África Oriental',
      'Eastern Asia': 'Asia Oriental',
      'Eastern Europe': 'Europa del Este',
      Melanesia: 'Melanesia',
      Micronesia: 'Micronesia',
      'Middle Africa': 'África Central',
      'North America': 'Norteamérica',
      'Northern Africa': 'África del Norte',
      'Northern Europe': 'Europa del Norte',
      Polynesia: 'Polinesia',
      'South America': 'Sudamérica',
      'South-Eastern Asia': 'Sudeste Asiático',
      'Southeast Europe': 'Europa del Sudeste',
      'Southern Africa': 'África Austral',
      'Southern Asia': 'Asia del Sur',
      'Southern Europe': 'Europa del Sur',
      'Western Africa': 'África Occidental',
      'Western Asia': 'Asia Occidental',
      'Western Europe': 'Europa Occidental',
    },
    fr: {
      Africa: 'Afrique',
      Americas: 'Amériques',
      Asia: 'Asie',
      Europe: 'Europe',
      Oceania: 'Océanie',
      Antarctica: 'Antarctique',
      'Australia and New Zealand': 'Australie et Nouvelle-Zélande',
      Caribbean: 'Caraïbes',
      'Central America': 'Amérique centrale',
      'Central Asia': 'Asie centrale',
      'Central Europe': 'Europe centrale',
      'Eastern Africa': 'Afrique de l’Est',
      'Eastern Asia': 'Asie de l’Est',
      'Eastern Europe': 'Europe de l’Est',
      Melanesia: 'Mélanésie',
      Micronesia: 'Micronésie',
      'Middle Africa': 'Afrique centrale',
      'North America': 'Amérique du Nord',
      'Northern Africa': 'Afrique du Nord',
      'Northern Europe': 'Europe du Nord',
      Polynesia: 'Polynésie',
      'South America': 'Amérique du Sud',
      'South-Eastern Asia': 'Asie du Sud-Est',
      'Southeast Europe': 'Europe du Sud-Est',
      'Southern Africa': 'Afrique australe',
      'Southern Asia': 'Asie du Sud',
      'Southern Europe': 'Europe du Sud',
      'Western Africa': 'Afrique de l’Ouest',
      'Western Asia': 'Asie de l’Ouest',
      'Western Europe': 'Europe de l’Ouest',
    },
  };

  /** "en,es" -> ['en', 'es'] (known codes only, in the given order); null when nothing valid. */
  function parseLangs(value) {
    const out = [];
    for (const s of String(value || '').split(/[\s,]+/)) {
      const code = s.trim().toLowerCase();
      if (LANGUAGES[code] && !out.includes(code)) out.push(code);
    }
    return out.length ? out : null;
  }

  const root = document.documentElement;
  const allowed = (root.hasAttribute('data-quiz-lang') && parseLangs(new URLSearchParams(location.search).get('l'))) || CODES.slice();

  function saved() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null; // storage blocked: fall back to the device language
    }
  }

  function fromDevice() {
    for (const l of navigator.languages || [navigator.language]) {
      const base = String(l || '').toLowerCase().split('-')[0];
      if (allowed.includes(base)) return base;
    }
    return null;
  }

  let lang = (allowed.includes(saved()) && saved()) || fromDevice() || allowed[0];
  root.lang = lang;

  function t(key, vars) {
    const v = STRINGS[lang][key] ?? STRINGS.en[key];
    if (v == null) return key;
    if (typeof v === 'function') return v(vars || {});
    return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : v;
  }

  function region(name) {
    return REGIONS[lang]?.[name] ?? name;
  }

  let collator = null;
  function compare(a, b) {
    if (!collator || collator.lang !== lang) collator = Object.assign(new Intl.Collator(lang), { lang });
    return collator.compare(a, b);
  }

  /** Translates elements marked with data-i18n* attributes. */
  function apply(scope = document) {
    for (const e of scope.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      for (const e of scope.querySelectorAll(`[data-i18n-${attr}]`)) e.setAttribute(attr, t(e.getAttribute(`data-i18n-${attr}`)));
    }
    for (const sel of document.querySelectorAll('select.lang-select')) {
      sel.value = lang;
      sel.title = t('language');
      sel.setAttribute('aria-label', t('language'));
      const code = sel.parentElement.querySelector('.lang-code');
      if (code) code.textContent = lang.toUpperCase();
    }
  }

  function setLang(next) {
    if (!allowed.includes(next) || next === lang) return;
    lang = next;
    root.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {} // still switches for this page
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  // "文A" translate glyph, so people who can't read the current language can still spot the picker.
  const TRANSLATE_SVG =
    '<svg class="i-translate" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7.5 2.5v2.2M2.5 4.7h10M10.6 4.7c-.9 4.2-3.7 7.4-8.1 9.1M4.6 7.6c1.3 2.8 3.4 4.7 6.1 5.7"/>' +
    '<path d="M12.6 21.5l4.2-11 4.2 11M14.2 17.6h5.2"/></svg>' +
    // Our own chevron (the native one can't be positioned and hugs the edge).
    '<svg class="i-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 9.5l6 6 6-6"/></svg>';

  document.addEventListener('DOMContentLoaded', () => {
    for (const sel of document.querySelectorAll('select.lang-select')) {
      sel.replaceChildren(...allowed.map((code) => new Option(LANGUAGES[code], code)));
      sel.hidden = false;
      sel.addEventListener('change', () => setLang(sel.value));
      // Wrap it with the icon; the wrapper is what gets hidden when there's nothing to choose.
      const wrap = document.createElement('span');
      wrap.className = 'lang-picker';
      wrap.hidden = allowed.length < 2;
      sel.replaceWith(wrap);
      wrap.innerHTML = TRANSLATE_SVG + '<span class="lang-code" aria-hidden="true"></span>';
      wrap.append(sel);
    }
    apply();
  });

  window.I18N = {
    LANGUAGES,
    CODES,
    allowed,
    get lang() {
      return lang;
    },
    t,
    region,
    compare,
    parseLangs,
    apply,
    setLang,
  };
})();
