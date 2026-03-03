/**
 * @fileoverview KanaSensei — Main application controller
 *
 * Orchestrates all game modes, user state, authentication, i18n,
 * audio, and the Live Dashboard.  Written as a single ES module so
 * the browser handles dependency resolution natively — no bundler needed.
 *
 * Architecture overview
 * ─────────────────────
 *   config.js       Firebase app / auth / Firestore
 *   auth.js         Google Sign-In button wiring
 *   db.js           Firestore read / write helpers
 *   engine.js       SRS card-draw & answer-checking logic
 *   data.js         Kana & vocabulary datasets
 *   live-dashboard  Firebase Realtime Database presence + feed
 *   main.js  ← you are here — UI, routing, all game modes
 *
 * @author  Wiktor Waryszak
 * @version 5.0
 */

import { GameEngine }                             from './engine.js';
import { hiragana, hiraganaDakuten, katakana, vocabulary } from './data.js';
import { initAuth }                               from './auth.js';
import { auth }                                   from './config.js';
import { onAuthStateChanged }                     from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  saveUserProgress,
  getTopPlayers,
  getUserProfile,
  getUserKanaProgress,
  saveKanaProgress,
} from './db.js';
import {
  recordActivity,
  markOffline,
  subscribeToLiveStats,
  subscribeToActivityFeed,
  pushFeedEvent,
} from './live-dashboard.js';

// ─── Full kana deck (used for SRS stats & Speed Run) ──────────────────────
const FULL_DECK = [...hiragana, ...hiraganaDakuten, ...katakana];


// ══════════════════════════════════════════════════════════════════════════
// i18n
// ══════════════════════════════════════════════════════════════════════════

/** @type {Record<'en'|'pl', Record<string, string>>} */
const STRINGS = {
  en: {
    // Dashboard
    welcome:      '稽古 — Training',
    welcomeSub:   'Choose a level and sharpen your skills',
    newLabel:     'New',
    reviewLabel:  'Reviews',
    masteredLabel:'Mastered',
    chartLabel:   'Progress',
    // Levels
    level1: 'Hiragana Basics',    level1sub: 'Level 1 · 15 characters',
    level2: 'Kana Meteors',       level2sub: 'Level 2 · Arcade typing',
    level3: 'Hiragana Dakuten',   level3sub: 'Level 3 · 25 characters',
    level4: 'Boss: Yokai Demon',  level4sub: 'Level 4 · Final battle',
    level5: 'Katakana Basics',    level5sub: 'Level 5 · 15 characters',
    level6: 'Katakana Full',      level6sub: 'Level 6 · All 46 characters',
    level7: 'Speed Run',          level7sub: 'Level 7 · 60 seconds',
    level8: 'Kana Pairs',         level8sub: 'Level 8 · Match the kana',
    // Achievements
    achievements: 'Achievements',
    badge1: 'First Blood',   badge1sub: 'Start learning',
    badge2: 'Focus Master',  badge2sub: 'Combo ×5',
    badge3: 'Word Samurai',  badge3sub: 'Unlock Vocabulary',
    // About
    about:     'About This Project',
    aboutText: '<strong>KanaSensei</strong> is an interactive web app for learning Japanese kana, built for the <strong>MEXT Scholarship 2028</strong> by <em>Wiktor Waryszak</em>. Uses SRS and gamification to make daily practice stick.',
    // Difficulty
    diffTitle:    'Select Difficulty',
    diffSub:      'This applies to all training modes',
    diff1: 'Scholar',   diff1desc: 'No time limit · Unlimited retries · Full hints',
    diff2: 'Samurai',   diff2desc: '5s timer per answer · 1 retry · No hints',
    diff3: 'Demon',     diff3desc: '3s timer · No retries · Wrong answer penalises score',
    diff4: 'Oni Lord',  diff4desc: '2s timer · Random decoys · Life drain on error',
    applyDiff:    'Start Training',
    currentDiff:  'Difficulty',
    // Game UI
    interruptBtn: 'Interrupt training',
    backBtn:      'Back',
    sessionXP:    'Session XP:',
    clearCanvas:  'Clear',
    shodoCTA:     '書道 · Shodō',
    arenaTitle:   '稽古 · Training Arena',
    hint:         'Type romaji + Enter',
    // Meteors
    meteorTitle: 'Kana Meteors ☄️',
    meteorPts:   'Points',
    meteorLives: 'Lives',
    meteorSpeed: 'Speed',
    // Pairs
    pairsTitle: 'Kana Pairs',
    pairsSub:   'Match the kana to its romaji',
    // Speed Run
    speedTitle:  'Speed Run ⚡',
    speedSub:    'How many kana can you read in 60 seconds?',
    timeLeft:    'Time left',
    correct:     'Correct',
    // Boss
    bossTitle:    '👹 Demon Dakuten 👹',
    // Leaderboard / Vocab / Theory
    topTitle:       '番付 · Top 10',
    topSub:         'Best players in Firebase',
    vocabTitle:     '語彙 · Vocabulary',
    kanaTableTitle: '五十音 · Kana Tables',
    kanaTableSub:   'Click a character to hear pronunciation',
    // Results & errors
    lockedMsg:    'Complete the previous level first!',
    lockedDiff:   'You need Level 5 (500 XP) to enter!',
    gameOver:     'Game Over!',
    victory:      'Victory!',
    bossDefeated: 'You defeated the Yokai Demon! +200 XP',
    speedResult:  'characters in 60 seconds!',
    // Live Dashboard
    liveTitle:      'Live Global Stats',
    liveActive:     'Active now',
    liveTotal:      'Total learners',
    liveMastered:   'Kana mastered globally',
    liveTop:        'Top score',
    liveBtn:        'Live Stats',
    liveChartLabel: 'Your XP — last 7 days',
    liveFeedLabel:  '⚡ Live Activity Feed',
    // Footer
    footerDesc: 'Educational project · MEXT Scholarship 2028 · Wiktor Waryszak',
  },

  pl: {
    // Dashboard
    welcome:      '稽古 — Trening',
    welcomeSub:   'Wybierz poziom i rozwijaj swoje umiejętności',
    newLabel:     'Nowe',
    reviewLabel:  'Powtórki',
    masteredLabel:'Opanowane',
    chartLabel:   'Wykres',
    // Levels
    level1: 'Podstawy Hiragany',  level1sub: 'Poziom 1 · 15 znaków',
    level2: 'Kana-Meteory',       level2sub: 'Poziom 2 · Arcade typing',
    level3: 'Hiragana Dakuten',   level3sub: 'Poziom 3 · 25 znaków',
    level4: 'Boss: Demon Yokai',  level4sub: 'Poziom 4 · Finałowa walka',
    level5: 'Podstawy Katakany',  level5sub: 'Poziom 5 · 15 znaków',
    level6: 'Katakana Pełna',     level6sub: 'Poziom 6 · Wszystkie 46 znaków',
    level7: 'Speed Run',          level7sub: 'Poziom 7 · 60 sekund',
    level8: 'Pary Kana',          level8sub: 'Poziom 8 · Dopasuj kana',
    // Achievements
    achievements: 'Osiągnięcia',
    badge1: 'Pierwsza Krew',     badge1sub: 'Rozpocznij naukę',
    badge2: 'Mistrz Skupienia',  badge2sub: 'Combo ×5',
    badge3: 'Samuraj Słowa',     badge3sub: 'Odblokuj Słówka',
    // About
    about:     'O Projekcie',
    aboutText: '<strong>KanaSensei</strong> to interaktywna aplikacja do nauki japońskiej kany, stworzona na potrzeby <strong>Stypendium MEXT 2028</strong> przez <em>Wiktora Waryszaka</em>. Używa SRS i grywalizacji, żeby codzienny trening naprawdę dawał efekty.',
    // Difficulty
    diffTitle: 'Wybierz Poziom Trudności',
    diffSub:   'Dotyczy wszystkich trybów treningowych',
    diff1: 'Uczony',   diff1desc: 'Brak limitu czasu · Nieograniczone próby · Podpowiedzi',
    diff2: 'Samuraj',  diff2desc: '5 sek na odpowiedź · 1 próba · Brak podpowiedzi',
    diff3: 'Demon',    diff3desc: '3 sek · Brak prób · Zła odpowiedź odejmuje punkty',
    diff4: 'Oni Lord', diff4desc: '2 sek · Losowe wabiki · Błąd = utrata życia',
    applyDiff:   'Rozpocznij trening',
    currentDiff: 'Trudność',
    // Game UI
    interruptBtn: 'Przerwij trening',
    backBtn:      'Wróć',
    sessionXP:    'XP sesji:',
    clearCanvas:  'Wyczyść',
    shodoCTA:     '書道 · Shodō',
    arenaTitle:   '稽古 · Arena Treningowa',
    hint:         'Wpisz romaji + Enter',
    // Meteors
    meteorTitle: 'Kana-Meteory ☄️',
    meteorPts:   'Punkty',
    meteorLives: 'Życia',
    meteorSpeed: 'Prędkość',
    // Pairs
    pairsTitle: 'Pary Kana',
    pairsSub:   'Dopasuj kana do właściwego romaji',
    // Speed Run
    speedTitle:  'Speed Run ⚡',
    speedSub:    'Ile kana przeczytasz w 60 sekund?',
    timeLeft:    'Czas',
    correct:     'Poprawne',
    // Boss
    bossTitle: '👹 Demon Dakuten 👹',
    // Leaderboard / Vocab / Theory
    topTitle:       '番付 · Top 10',
    topSub:         'Najlepsi gracze w bazie Firebase',
    vocabTitle:     '語彙 · Słówka',
    kanaTableTitle: '五十音 · Tablice Kana',
    kanaTableSub:   'Kliknij znak, aby usłyszeć wymowę',
    // Results & errors
    lockedMsg:    'Ukończ poprzedni poziom!',
    lockedDiff:   'Potrzebujesz Poziomu 5 (500 XP) żeby wejść!',
    gameOver:     'Koniec Gry!',
    victory:      'Zwycięstwo!',
    bossDefeated: 'Pokonałeś Demona Dakuten! +200 XP',
    speedResult:  'znaków w 60 sekund!',
    // Live Dashboard
    liveTitle:      'Statystyki na żywo',
    liveActive:     'Aktywni teraz',
    liveTotal:      'Wszyscy uczący się',
    liveMastered:   'Opanowane kana globalnie',
    liveTop:        'Najwyższy wynik',
    liveBtn:        'Statystyki live',
    liveChartLabel: 'Twój XP — ostatnie 7 dni',
    liveFeedLabel:  '⚡ Aktywność na żywo',
    // Footer
    footerDesc: 'Projekt edukacyjny · Stypendium MEXT 2028 · Wiktor Waryszak',
  },
};

/** @type {'en'|'pl'} */
let lang = /** @type {'en'|'pl'} */ (localStorage.getItem('ks_lang') ?? 'en');

/** Translate a key to the current language. Falls back to EN. */
const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

/** Apply all data-i18n / data-i18n-title attributes and update the toggle buttons. */
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT') el.placeholder = t(key);
    else                        el.innerHTML   = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('.lang-toggle-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  const footer = document.getElementById('footer-desc');
  if (footer) footer.textContent = t('footerDesc');
}

/** Public — called by onclick in HTML */
window.setLang = (l) => {
  lang = l;
  localStorage.setItem('ks_lang', l);
  applyLang();
};


// ══════════════════════════════════════════════════════════════════════════
// Audio engine  (Web Audio API — no external files needed)
// ══════════════════════════════════════════════════════════════════════════

let audioCtx;

/**
 * Play a synthesised sound effect.
 * @param {'correct'|'wrong'|'explosion'|'tick'} type
 */
window.playSound = (type) => {
  audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const t0 = audioCtx.currentTime;

  const profiles = {
    correct:   () => { osc.type = 'sine';     osc.frequency.setValueAtTime(800, t0); osc.frequency.exponentialRampToValueAtTime(1200, t0 + 0.1); gain.gain.setValueAtTime(0.25, t0); gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.12); osc.start(); osc.stop(t0 + 0.12); },
    wrong:     () => { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, t0); osc.frequency.exponentialRampToValueAtTime(150, t0 + 0.2);  gain.gain.setValueAtTime(0.25, t0); gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.2);  osc.start(); osc.stop(t0 + 0.2);  },
    explosion: () => { osc.type = 'square';   osc.frequency.setValueAtTime(100, t0); osc.frequency.exponentialRampToValueAtTime(20, t0 + 0.3);   gain.gain.setValueAtTime(0.4,  t0); gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);  osc.start(); osc.stop(t0 + 0.3);  },
    tick:      () => { osc.type = 'square';   osc.frequency.setValueAtTime(1200, t0);                                                             gain.gain.setValueAtTime(0.1,  t0); gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.05); osc.start(); osc.stop(t0 + 0.05); },
  };

  profiles[type]?.();
};


// ══════════════════════════════════════════════════════════════════════════
// Modal dialog  (replaces all alert() / confirm() calls)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Show the global modal overlay.
 *
 * @param {string}      icon
 * @param {string}      title
 * @param {string}      message
 * @param {()=>void}    [onClose]
 */
function showModal(icon, title, message, onClose) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-icon').textContent    = icon;
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-message').textContent = message;
  overlay.classList.remove('hidden');

  const btn = document.getElementById('modal-btn');
  const handler = () => {
    overlay.classList.add('hidden');
    btn.removeEventListener('click', handler);
    onClose?.();
  };
  btn.addEventListener('click', handler);
}


// ══════════════════════════════════════════════════════════════════════════
// Difficulty system
// ══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} DifficultyConfig
 * @property {string}  name
 * @property {number}  timeLimit   - ms; 0 = unlimited
 * @property {number}  retries     - max wrong attempts before auto-advance
 * @property {number}  penalty     - XP deducted on error
 * @property {boolean} decoys      - whether the Oni Lord mode adds fake choices
 * @property {boolean} lifeDrain   - whether wrong answers cost a life
 */

/** @type {Record<number, DifficultyConfig>} */
const DIFFICULTY = {
  1: { name: 'Scholar / Uczony', timeLimit: 0,     retries: 99, penalty: 0,  decoys: false, lifeDrain: false },
  2: { name: 'Samurai',          timeLimit: 5_000,  retries: 1,  penalty: 0,  decoys: false, lifeDrain: false },
  3: { name: 'Demon',            timeLimit: 3_000,  retries: 0,  penalty: 5,  decoys: false, lifeDrain: false },
  4: { name: 'Oni Lord',         timeLimit: 2_000,  retries: 0,  penalty: 10, decoys: true,  lifeDrain: true  },
};

let currentDifficulty = parseInt(localStorage.getItem('ks_diff') ?? '1', 10);
let diffTimer         = null;
let retriesLeft       = 99;

const getDiff = () => DIFFICULTY[currentDifficulty];

/** Public — called by diff-card onclick */
window.setDifficulty = (level) => {
  currentDifficulty = level;
  localStorage.setItem('ks_diff', String(level));
  document.querySelectorAll('.diff-card').forEach((c, i) =>
    c.classList.toggle('selected', i + 1 === level)
  );
  updateDiffBadge();
};

function updateDiffBadge() {
  const badge = document.getElementById('diff-badge');
  if (badge) badge.textContent = `${t('currentDiff')}: ${getDiff().name}`;
}

/**
 * Start the difficulty countdown timer for the current card.
 * Calls onTimeout if the player doesn't answer in time.
 *
 * @param {()=>void} onTimeout
 */
function startDifficultyTimer(onTimeout) {
  clearDifficultyTimer();
  const { timeLimit } = getDiff();
  if (!timeLimit) return;

  const bar = document.getElementById('timer-bar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width      = '100%';
    requestAnimationFrame(() => {
      bar.style.transition = `width ${timeLimit}ms linear`;
      bar.style.width      = '0%';
    });
  }
  diffTimer = setTimeout(onTimeout, timeLimit);
}

function clearDifficultyTimer() {
  clearTimeout(diffTimer);
  diffTimer = null;
  const bar = document.getElementById('timer-bar');
  if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; }
}


// ══════════════════════════════════════════════════════════════════════════
// Application state
// ══════════════════════════════════════════════════════════════════════════

initAuth();
const engine = new GameEngine();

let currentUser      = null;
let combo            = 0;
let currentStreak    = 0;
let userAchievements = [];
let currentUserLevel = 1;
let currentKanaProgress = {};


// ══════════════════════════════════════════════════════════════════════════
// Session logging  (powers the personal XP chart)
// ══════════════════════════════════════════════════════════════════════════

/** Persist session stats to localStorage (and Firestore if logged in). */
function saveUserData() {
  if (currentUser) {
    saveUserProgress(
      currentUser.uid,
      engine.score,
      currentUser.displayName,
      currentStreak,
      userAchievements,
      currentUserLevel
    );
  }
  logSession();
}

function logSession() {
  const todayStr = new Date().toISOString().split('T')[0];
  const sessions = JSON.parse(localStorage.getItem('ks_sessions') ?? '[]');
  const mastered  = FULL_DECK.filter((c) => (currentKanaProgress[c.kan]?.stage ?? 0) >= 8).length;

  const idx = sessions.findIndex((s) => s.date === todayStr);
  if (idx !== -1) {
    sessions[idx] = { date: todayStr, xp: engine.score, mastered };
  } else {
    sessions.push({ date: todayStr, xp: engine.score, mastered });
    if (sessions.length > 30) sessions.shift();
  }
  localStorage.setItem('ks_sessions', JSON.stringify(sessions));
}


// ══════════════════════════════════════════════════════════════════════════
// Achievements
// ══════════════════════════════════════════════════════════════════════════

function showToast(title) {
  const toast = document.getElementById('achievement-toast');
  const text  = document.getElementById('toast-text');
  if (!toast || !text) return;
  text.textContent = title;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4_000);
}

/**
 * @param {'first_blood'|'combo_5'|'lvl_5'} id
 * @param {string} title
 */
function unlockAchievement(id, title) {
  if (userAchievements.includes(id)) return;
  userAchievements.push(id);
  showToast(title);
  renderAchievements();
  saveUserData();
}

function renderAchievements() {
  if (userAchievements.includes('first_blood')) document.getElementById('badge-first')?.classList.remove('locked');
  if (userAchievements.includes('combo_5'))     document.getElementById('badge-combo')?.classList.remove('locked');
  if (userAchievements.includes('lvl_5'))       document.getElementById('badge-vocab')?.classList.remove('locked');
}


// ══════════════════════════════════════════════════════════════════════════
// Level unlock system
// ══════════════════════════════════════════════════════════════════════════

function checkLevelUnlocks(score) {
  const level = Math.floor(score / 100) + 1;
  if (level > currentUserLevel) {
    currentUserLevel = level;
    renderPath(currentUserLevel);
  }
}

/** @param {number} userLevel */
function renderPath(userLevel) {
  document.querySelectorAll('.path-node').forEach((node, i) => {
    const isUnlocked = i + 1 <= userLevel;
    node.classList.toggle('locked',   !isUnlocked);
    node.classList.toggle('unlocked',  isUnlocked);
  });
}


// ══════════════════════════════════════════════════════════════════════════
// SRS stats panel
// ══════════════════════════════════════════════════════════════════════════

function updateSRSStatsUI() {
  const container = document.getElementById('srs-stats-container');
  if (!container) return;
  container.classList.toggle('hidden', !currentUser);
  if (!currentUser) return;

  const now = Date.now();
  let countNew = 0, countReview = 0, countMastered = 0;

  for (const card of FULL_DECK) {
    const p = currentKanaProgress[card.kan];
    if (!p)                       countNew++;
    else if (p.stage >= 8)        countMastered++;
    else if (p.nextReview <= now) countReview++;
  }

  document.getElementById('stat-new').textContent      = countNew;
  document.getElementById('stat-review').textContent   = countReview;
  document.getElementById('stat-mastered').textContent = countMastered;

  const reviewBox = document.querySelector('.box-review');
  if (reviewBox) reviewBox.style.animation = countReview > 0 ? 'pulse-red 2s infinite' : 'none';
}


// ══════════════════════════════════════════════════════════════════════════
// Authentication state
// ══════════════════════════════════════════════════════════════════════════

onAuthStateChanged(auth, async (user) => {
  const ptsEl = document.getElementById('user-points');
  const strEl = document.getElementById('user-streak');

  if (user) {
    currentUser         = user;
    currentKanaProgress = await getUserKanaProgress(user.uid);
    const profile       = await getUserProfile(user.uid);

    if (profile) {
      engine.score     = profile.totalScore  ?? 0;
      userAchievements = profile.achievements ?? [];
      currentUserLevel = profile.userLevel    ?? 1;

      const todayStr     = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

      if      (profile.lastPlayedDate === todayStr)     currentStreak = profile.streak ?? 0;
      else if (profile.lastPlayedDate === yesterdayStr) currentStreak = (profile.streak ?? 0) + 1;
      else                                              currentStreak = 1;
    } else {
      currentStreak = 1;
    }

    const level = Math.floor(engine.score / 100) + 1;
    if (ptsEl) ptsEl.textContent = `Lvl ${level} | ${engine.score} XP`;
    if (strEl) strEl.textContent = `🔥 ${currentStreak}`;

    checkLevelUnlocks(engine.score);
    renderAchievements();
    renderPath(currentUserLevel);
    updateSRSStatsUI();
    saveUserData();

  } else {
    currentUser = null;
    engine.score = 0;
    currentStreak = 0;
    userAchievements = [];
    currentUserLevel = 1;
    if (ptsEl) ptsEl.textContent = '0 XP';
    if (strEl) strEl.textContent = '🔥 0';
  }
});


// ══════════════════════════════════════════════════════════════════════════
// TTS (Web Speech API)
// ══════════════════════════════════════════════════════════════════════════

/** Speak a Japanese string using the browser's TTS engine. */
function speakJapanese(text) {
  if (!window.speechSynthesis || !text) return;
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = 'ja-JP';
  utt.rate   = 0.85;
  speechSynthesis.speak(utt);
}


// ══════════════════════════════════════════════════════════════════════════
// View router
// ══════════════════════════════════════════════════════════════════════════

const allViews = document.querySelectorAll('.view');

/**
 * Switch to a named view, optionally triggering side-effects.
 * @param {string} viewId
 */
window.switchView = function switchView(viewId) {
  allViews.forEach((v) => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const target = document.getElementById(viewId);
  if (!target) return;
  target.classList.remove('hidden');
  target.classList.add('active');

  // Side-effects per view
  if (viewId === 'view-leaderboard') loadLeaderboard();
  if (viewId === 'view-vocabulary')  startVocabGame();
  if (viewId === 'view-live')        initLiveDashboard();
};

// Back buttons
document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dest = btn.getAttribute('data-target') ?? 'view-dashboard';
    window.switchView(dest);
    stopAllGames();
    combo = 0;
    updateComboUI();
    updateSRSStatsUI();
    clearDifficultyTimer();
  });
});

// Module cards (Live Stats etc.)
document.querySelectorAll('.module-card').forEach((card) => {
  card.addEventListener('click', () => {
    if (card.classList.contains('locked')) {
      showModal('🔒', t('lockedDiff'), '');
      return;
    }
    const target = card.getAttribute('data-target');
    if (target) window.switchView(target);
  });
});

function stopAllGames() {
  window.stopMeteors?.();
  stopSpeedRun();
  ['answer-input', 'vocab-input'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}


// ══════════════════════════════════════════════════════════════════════════
// Combo UI
// ══════════════════════════════════════════════════════════════════════════

function updateComboUI() {
  const el = document.getElementById('combo-display');
  if (!el) return;
  if (combo > 1) {
    el.style.display    = 'inline-block';
    el.textContent      = `🔥 Combo ×${combo}`;
    el.style.transform  = `scale(${Math.min(1 + combo * 0.04, 1.3)})`;
  } else {
    el.style.display   = 'none';
    el.style.transform = 'scale(1)';
  }
}


// ══════════════════════════════════════════════════════════════════════════
// Difficulty menu
// ══════════════════════════════════════════════════════════════════════════

window.openDifficultyMenu = (pendingLevel) => {
  window._pendingLevel = pendingLevel;
  document.querySelectorAll('.diff-card').forEach((c, i) =>
    c.classList.toggle('selected', i + 1 === currentDifficulty)
  );
  window.switchView('view-difficulty');
};

window.confirmDifficulty = () => {
  const level = window._pendingLevel;
  if (level !== undefined) launchLevel(level);
  else                     window.switchView('view-dashboard');
};


// ══════════════════════════════════════════════════════════════════════════
// Level router
// ══════════════════════════════════════════════════════════════════════════

/** Minimum XP required to unlock each level */
const LEVEL_XP_GATES = { 1: 0, 2: 100, 3: 200, 4: 300, 5: 400, 6: 500, 7: 600, 8: 700 };

window.startLevel = (levelNumber) => {
  const gate = LEVEL_XP_GATES[levelNumber] ?? 0;
  if (engine.score < gate && levelNumber > currentUserLevel) {
    showModal('🔒', t('lockedMsg'), `Need ${gate} XP`);
    return;
  }
  window.openDifficultyMenu(levelNumber);
};

/** @param {number} n - Level number 1–8 */
function launchLevel(n) {
  retriesLeft = getDiff().retries;
  const startArena = (deck) => {
    engine.loadDeck(deck, currentKanaProgress);
    window.switchView('view-game');
    combo = 0;
    updateComboUI();
    newRound();
  };

  switch (n) {
    case 1: startArena(hiragana.slice(0, 15));  break;
    case 2: startMeteorsGame();                 break;
    case 3: startArena(hiraganaDakuten);        break;
    case 4: startBossFight();                   break;
    case 5: startArena(katakana.slice(0, 15));  break;
    case 6: startArena(katakana);               break;
    case 7: startSpeedRun();                    break;
    case 8: startPairsGame();                   break;
  }
}


// ══════════════════════════════════════════════════════════════════════════
// Training Arena
// ══════════════════════════════════════════════════════════════════════════

function newRound() {
  clearDifficultyTimer();
  const card  = engine.drawCard();
  if (!card) return;

  const display = document.getElementById('char-display');
  const input   = document.getElementById('answer-input');

  if (display) {
    display.style.opacity = '0';
    setTimeout(() => { display.textContent = card.kan; display.style.opacity = '1'; }, 80);
  }
  speakJapanese(card.kan);

  if (input) {
    input.value = '';
    input.focus();
    input.classList.remove('correct-flash', 'wrong-shake');
  }

  // Clear the shodō canvas for the new character
  window.shodoCtx?.clearRect(0, 0, 200, 200);

  retriesLeft = getDiff().retries;

  if (getDiff().timeLimit) {
    startDifficultyTimer(() => {
      playSound('wrong');
      engine.score = Math.max(0, engine.score - getDiff().penalty);
      updateScoreUI();
      if (input) input.classList.add('wrong-shake');
      combo = 0;
      updateComboUI();
      setTimeout(() => { input?.classList.remove('wrong-shake'); newRound(); }, 400);
    });
  }
}

function updateScoreUI() {
  const scoreEl = document.getElementById('score-val');
  const ptsEl   = document.getElementById('user-points');
  const level   = Math.floor(engine.score / 100) + 1;
  if (scoreEl) scoreEl.textContent = engine.score;
  if (ptsEl)   ptsEl.textContent   = `Lvl ${level} | ${engine.score} XP`;
}

document.getElementById('answer-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const userInput = e.target.value.toLowerCase().trim();
  if (!userInput) return;

  const isCorrect = engine.checkAnswer(userInput);
  currentKanaProgress = engine.userProgress;
  if (currentUser) saveKanaProgress(currentUser.uid, currentKanaProgress);

  if (isCorrect) {
    clearDifficultyTimer();
    combo++;
    if (combo === 5) unlockAchievement('combo_5', t('badge2'));
    e.target.classList.add('correct-flash');
    playSound('correct');
    engine.score += Math.min(combo, 5);
    updateScoreUI();
    updateComboUI();
    checkLevelUnlocks(engine.score);
    saveUserData();
    unlockAchievement('first_blood', t('badge1'));
    // Push to live feed
    if (currentUser) {
      recordActivity(currentUser.uid, currentUser.displayName, engine.score,
        FULL_DECK.filter((c) => (currentKanaProgress[c.kan]?.stage ?? 0) >= 8).length);
      pushFeedEvent('answer', currentUser.displayName, `answered correctly (+${Math.min(combo, 5)} XP)`);
    }
    setTimeout(() => { e.target.classList.remove('correct-flash'); newRound(); }, 280);

  } else {
    retriesLeft--;
    combo = 0;
    updateComboUI();
    playSound('wrong');
    e.target.classList.add('wrong-shake');
    if (getDiff().penalty) engine.score = Math.max(0, engine.score - getDiff().penalty);
    updateScoreUI();
    const moveOn = retriesLeft < 0;
    setTimeout(() => {
      e.target.classList.remove('wrong-shake');
      e.target.value = '';
      if (moveOn) newRound();
    }, 400);
  }
});


// ══════════════════════════════════════════════════════════════════════════
// Shodō canvas  (practice writing)
// ══════════════════════════════════════════════════════════════════════════

const shodoCanvas = document.getElementById('shodo-canvas');
const shodoCtx    = shodoCanvas?.getContext('2d');

if (shodoCtx) {
  window.shodoCtx = shodoCtx;
  shodoCtx.lineWidth   = 10;
  shodoCtx.lineCap     = 'round';
  shodoCtx.lineJoin    = 'round';
  shodoCtx.strokeStyle = '#1a1008';

  let drawing = false;

  const getPos = (e) => {
    const rect = shodoCanvas.getBoundingClientRect();
    const src  = e.touches?.[0] ?? e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  shodoCanvas.addEventListener('mousedown', (e) => { drawing = true; const p = getPos(e); shodoCtx.beginPath(); shodoCtx.moveTo(p.x, p.y); });
  shodoCanvas.addEventListener('mousemove', (e) => { if (!drawing) return; const p = getPos(e); shodoCtx.lineTo(p.x, p.y); shodoCtx.stroke(); });
  shodoCanvas.addEventListener('mouseup',   () => { drawing = false; });
  shodoCanvas.addEventListener('mouseout',  () => { drawing = false; });
  shodoCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); drawing = true; const p = getPos(e); shodoCtx.beginPath(); shodoCtx.moveTo(p.x, p.y); }, { passive: false });
  shodoCanvas.addEventListener('touchmove',  (e) => { e.preventDefault(); if (!drawing) return; const p = getPos(e); shodoCtx.lineTo(p.x, p.y); shodoCtx.stroke(); }, { passive: false });
  shodoCanvas.addEventListener('touchend',   () => { drawing = false; });

  document.getElementById('clear-canvas')?.addEventListener('click', () =>
    shodoCtx.clearRect(0, 0, shodoCanvas.width, shodoCanvas.height)
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Kana Meteors
// ══════════════════════════════════════════════════════════════════════════

let meteorRAF      = null;
let spawnInterval  = null;
let activeMeteors  = [];
let meteorScore    = 0;
let meteorSpeed    = 2;
let meteorLives    = 3;

function startMeteorsGame() {
  clearInterval(spawnInterval);
  cancelAnimationFrame(meteorRAF);

  window.switchView('view-meteors');

  const container = document.getElementById('meteor-game-container');
  container?.querySelectorAll('.meteor').forEach((m) => m.remove());
  activeMeteors = [];
  meteorScore   = 0;
  meteorSpeed   = 2;
  meteorLives   = getDiff().lifeDrain ? 2 : 3;
  updateMeteorHUD();

  const input = document.getElementById('meteor-input');
  if (input) { input.value = ''; input.focus(); input.disabled = false; }

  let lastFrame = 0;
  const loop = (ts) => {
    if (ts - lastFrame >= 50) { tickMeteors(); lastFrame = ts; }
    meteorRAF = requestAnimationFrame(loop);
  };
  meteorRAF    = requestAnimationFrame(loop);
  spawnInterval = setInterval(spawnMeteor, getDiff().timeLimit ? 1_500 : 2_000);
}

window.stopMeteors = () => {
  clearInterval(spawnInterval);
  cancelAnimationFrame(meteorRAF);
};

function updateMeteorHUD() {
  document.getElementById('meteor-score')?.querySelector ? null : null;
  const scoreEl = document.getElementById('meteor-score');
  const livesEl = document.getElementById('meteor-lives-hud')?.querySelector('.meteor-hud-val');
  const speedEl = document.getElementById('meteor-speed-hud')?.querySelector('.meteor-hud-val');
  const maxLives = getDiff().lifeDrain ? 2 : 3;
  if (scoreEl) scoreEl.textContent = meteorScore;
  if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, meteorLives)) + '🖤'.repeat(Math.max(0, maxLives - meteorLives));
  if (speedEl) speedEl.textContent = `×${meteorSpeed.toFixed(1)}`;
}

function spawnMeteor() {
  const container = document.getElementById('meteor-game-container');
  if (!container) return;

  const deck     = currentDifficulty >= 3 ? [...hiragana, ...hiraganaDakuten] : hiragana;
  const isGolden = Math.random() < 0.12;
  const char     = deck[Math.floor(Math.random() * deck.length)];
  const el       = document.createElement('div');

  el.className  = 'meteor';
  el.textContent = char.kan;
  el.style.left  = `${8 + Math.random() * 75}%`;
  el.style.top   = '-60px';
  if (isGolden) {
    el.style.background  = 'radial-gradient(circle, #ffe100 0%, #ff9d00 70%)';
    el.style.boxShadow   = '0 0 20px #ffe100';
  }
  container.appendChild(el);
  activeMeteors.push({ element: el, y: -60, data: char, golden: isGolden });
}

function tickMeteors() {
  const container = document.getElementById('meteor-game-container');
  if (!container || !container.offsetHeight) return;

  for (let i = activeMeteors.length - 1; i >= 0; i--) {
    const m = activeMeteors[i];
    m.y += meteorSpeed;
    m.element.style.top = `${m.y}px`;

    if (m.y > container.offsetHeight) {
      m.element.remove();
      activeMeteors.splice(i, 1);
      meteorLives--;
      updateMeteorHUD();
      playSound('wrong');
      container.classList.add('wrong-shake');
      setTimeout(() => container.classList.remove('wrong-shake'), 300);
      if (meteorLives <= 0) {
        window.stopMeteors();
        showModal('☄️', t('gameOver'), `${meteorScore} points / punktów`, () => window.switchView('view-dashboard'));
      }
    }
  }
}

document.getElementById('meteor-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target.value.toLowerCase().trim();
  if (!input) return;

  const hitIdx = activeMeteors.findIndex((m) => m.data.rom === input);
  if (hitIdx !== -1) {
    const m = activeMeteors[hitIdx];
    playSound('explosion');
    m.element.style.transform = 'scale(2)';
    m.element.style.opacity   = '0';
    meteorScore   += m.golden ? 30 : 15;
    meteorSpeed   += m.golden ? -0.5 : 0.05;
    meteorSpeed    = Math.max(1, meteorSpeed);
    setTimeout(() => m.element.remove(), 200);
    activeMeteors.splice(hitIdx, 1);
    updateMeteorHUD();
    engine.score += m.golden ? 10 : 5;
    saveUserData();
  } else {
    playSound('wrong');
    if (getDiff().lifeDrain) { meteorLives--; updateMeteorHUD(); }
    e.target.classList.add('wrong-shake');
    setTimeout(() => e.target.classList.remove('wrong-shake'), 300);
  }
  e.target.value = '';
});


// ══════════════════════════════════════════════════════════════════════════
// Speed Run
// ══════════════════════════════════════════════════════════════════════════

let speedInterval  = null;
let speedTimeLeft  = 60;
let speedCorrect   = 0;
let speedCard      = null;

function startSpeedRun() {
  window.switchView('view-speedrun');
  speedTimeLeft = 60;
  speedCorrect  = 0;
  engine.loadDeck(FULL_DECK, currentKanaProgress);
  updateSpeedUI();

  const input = document.getElementById('speed-input');
  if (input) { input.value = ''; input.focus(); input.disabled = false; }

  nextSpeedCard();
  clearInterval(speedInterval);
  speedInterval = setInterval(() => {
    speedTimeLeft--;
    updateSpeedUI();
    if (speedTimeLeft <= 10) playSound('tick');
    if (speedTimeLeft <= 0)  endSpeedRun();
  }, 1_000);
}

function stopSpeedRun() { clearInterval(speedInterval); speedInterval = null; }

function nextSpeedCard() {
  speedCard = engine.drawCard();
  const display = document.getElementById('speed-char');
  if (display && speedCard) {
    display.style.opacity = '0';
    setTimeout(() => { display.textContent = speedCard.kan; display.style.opacity = '1'; }, 60);
  }
  speakJapanese(speedCard?.kan);
}

function updateSpeedUI() {
  const timeEl    = document.getElementById('speed-time');
  const correctEl = document.getElementById('speed-correct');
  const barEl     = document.getElementById('speed-timer-bar');
  if (timeEl) {
    timeEl.textContent  = speedTimeLeft;
    timeEl.style.color  = speedTimeLeft <= 10 ? 'var(--red)' : 'var(--ink)';
  }
  if (correctEl) correctEl.textContent = speedCorrect;
  if (barEl)     barEl.style.width     = `${(speedTimeLeft / 60) * 100}%`;
}

function endSpeedRun() {
  stopSpeedRun();
  const bonus = speedCorrect * 8;
  engine.score += bonus;
  updateScoreUI();
  saveUserData();
  checkLevelUnlocks(engine.score);
  const input = document.getElementById('speed-input');
  if (input) input.disabled = true;
  showModal('⚡', t('speedTitle'), `${speedCorrect} ${t('speedResult')} (+${bonus} XP)`, () => window.switchView('view-dashboard'));
}

document.getElementById('speed-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !speedCard || speedTimeLeft <= 0) return;
  const input = e.target.value.toLowerCase().trim();
  if (!input) return;

  if (input === speedCard.rom) {
    speedCorrect++;
    playSound('correct');
    e.target.classList.add('correct-flash');
    engine.score += 2;
    setTimeout(() => { e.target.classList.remove('correct-flash'); nextSpeedCard(); }, 150);
  } else {
    playSound('wrong');
    if (getDiff().penalty) engine.score = Math.max(0, engine.score - 2);
    e.target.classList.add('wrong-shake');
    setTimeout(() => e.target.classList.remove('wrong-shake'), 300);
  }
  e.target.value = '';
});


// ══════════════════════════════════════════════════════════════════════════
// Kana Pairs
// ══════════════════════════════════════════════════════════════════════════

let pairsSelected = null;
let pairsMatched  = 0;
let pairsTotal    = 0;

function startPairsGame() {
  window.switchView('view-pairs');
  const deck = [...hiragana.slice(0, 20), ...hiraganaDakuten.slice(0, 10)]
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);

  pairsMatched = 0;
  pairsTotal   = deck.length;
  pairsSelected = null;

  renderPairsBoard(deck);
}

function renderPairsBoard(deck) {
  const board = document.getElementById('pairs-board');
  if (!board) return;

  const kanaCards   = [...deck].sort(() => Math.random() - 0.5);
  const romajiCards = [...deck].sort(() => Math.random() - 0.5);

  const leftCol  = document.createElement('div');
  const rightCol = document.createElement('div');
  leftCol.className  = 'pairs-col';
  rightCol.className = 'pairs-col';

  const makeCard = (item, type) => {
    const card = document.createElement('div');
    card.className    = `pairs-card ${type}-type`;
    card.dataset.value = type === 'kana' ? item.kan : item.rom;
    card.dataset.match = type === 'kana' ? item.rom : item.kan;
    card.textContent  = card.dataset.value;
    card.addEventListener('click', () => handlePairsClick(card, type));
    return card;
  };

  kanaCards.forEach((item) => leftCol.appendChild(makeCard(item, 'kana')));
  romajiCards.forEach((item) => rightCol.appendChild(makeCard(item, 'romaji')));

  board.innerHTML = '';
  board.append(leftCol, rightCol);

  const prog = document.getElementById('pairs-progress');
  if (prog) prog.textContent = `0 / ${pairsTotal}`;
}

function handlePairsClick(card, type) {
  if (card.classList.contains('matched') || card.classList.contains('selected')) return;

  if (!pairsSelected) {
    pairsSelected = { card, type };
    card.classList.add('selected');
    speakJapanese(type === 'kana' ? card.dataset.value : card.dataset.match);
    return;
  }

  const first = pairsSelected;

  // Same column — swap selection
  if (first.type === type) {
    first.card.classList.remove('selected');
    card.classList.add('selected');
    pairsSelected = { card, type };
    return;
  }

  const kanaCard   = type === 'kana'   ? card : first.card;
  const romajiCard = type === 'romaji' ? card : first.card;
  const isMatch    = kanaCard.dataset.match === romajiCard.dataset.value;

  if (isMatch) {
    playSound('correct');
    kanaCard.classList.replace('selected', 'matched');
    romajiCard.classList.replace('selected', 'matched');
    pairsMatched++;
    engine.score += 15;
    updateScoreUI();
    const prog = document.getElementById('pairs-progress');
    if (prog) prog.textContent = `${pairsMatched} / ${pairsTotal}`;

    if (pairsMatched === pairsTotal) {
      saveUserData();
      setTimeout(() =>
        showModal('🀄', t('victory'), `+${pairsTotal * 15} XP`, () => window.switchView('view-dashboard')),
        400
      );
    }
  } else {
    playSound('wrong');
    [kanaCard, romajiCard].forEach((c) => c.classList.add('wrong-shake'));
    if (getDiff().penalty) engine.score = Math.max(0, engine.score - getDiff().penalty);
    setTimeout(() => {
      [kanaCard, romajiCard].forEach((c) => c.classList.remove('selected', 'wrong-shake'));
    }, 500);
  }
  pairsSelected = null;
}


// ══════════════════════════════════════════════════════════════════════════
// Boss Fight
// ══════════════════════════════════════════════════════════════════════════

let bossHp       = 100;
const BOSS_MAX_HP = 100;
let bossCard     = null;
let bossTimerRef = null;

function startBossFight() {
  window.switchView('view-boss');
  bossHp = BOSS_MAX_HP;

  // Lazy-render the boss DOM (view-boss starts empty to keep HTML clean)
  const view = document.getElementById('view-boss');
  if (view && !document.getElementById('boss-container')) {
    view.innerHTML = `
      <button class="back-btn" data-target="view-dashboard">${t('backBtn')}</button>
      <div id="boss-container">
        <div class="boss-title">${t('bossTitle')}</div>
        <div class="boss-hp-track"><div id="boss-hp-fill" style="width:100%"></div></div>
        <div class="boss-timer-track"><div id="boss-timer-bar" style="width:100%"></div></div>
        <div id="boss-char">が</div>
        <input id="boss-input" type="text" placeholder="${lang === 'pl' ? 'Wpisz romaji...' : 'Type romaji...'}"
               autocomplete="off" spellcheck="false" style="max-width:400px;display:block;margin:0 auto;">
      </div>`;

    document.getElementById('boss-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleBossAnswer(e.target.value.toLowerCase().trim());
    });
    view.querySelector('.back-btn').addEventListener('click', () => window.switchView('view-dashboard'));
  }

  updateBossHP();
  nextBossChar();
  const input = document.getElementById('boss-input');
  if (input) { input.value = ''; input.focus(); }
  if (getDiff().timeLimit) startBossTimer();
}

function startBossTimer() {
  clearTimeout(bossTimerRef);
  const bar = document.getElementById('boss-timer-bar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width      = '100%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${getDiff().timeLimit}ms linear`;
    bar.style.width      = '0%';
    bossTimerRef = setTimeout(() => {
      // Too slow — boss heals
      bossHp = Math.min(BOSS_MAX_HP, bossHp + 10);
      updateBossHP();
      nextBossChar();
      startBossTimer();
    }, getDiff().timeLimit);
  });
}

function nextBossChar() {
  bossCard = hiraganaDakuten[Math.floor(Math.random() * hiraganaDakuten.length)];
  const el = document.getElementById('boss-char');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = bossCard.kan; el.style.opacity = '1'; }, 80);
  }
  speakJapanese(bossCard.kan);
}

function updateBossHP() {
  const fill = document.getElementById('boss-hp-fill');
  if (fill) fill.style.width = `${(bossHp / BOSS_MAX_HP) * 100}%`;
}

function handleBossAnswer(input) {
  const inputEl = document.getElementById('boss-input');
  if (inputEl) inputEl.value = '';

  if (input === bossCard.rom) {
    playSound('explosion');
    bossHp -= getDiff().name === 'Oni Lord' ? 8 : 10;
    updateBossHP();
    const charEl = document.getElementById('boss-char');
    charEl?.classList.add('wrong-shake');
    setTimeout(() => charEl?.classList.remove('wrong-shake'), 300);

    if (bossHp <= 0) {
      clearTimeout(bossTimerRef);
      playSound('correct');
      engine.score += 200;
      updateScoreUI();
      checkLevelUnlocks(engine.score);
      saveUserData();
      showModal('🔥', t('victory'), t('bossDefeated'), () => window.switchView('view-dashboard'));
    } else {
      nextBossChar();
      if (getDiff().timeLimit) startBossTimer();
    }
  } else {
    playSound('wrong');
    bossHp = Math.min(BOSS_MAX_HP, bossHp + (getDiff().penalty || 5));
    updateBossHP();
    inputEl?.classList.add('wrong-shake');
    setTimeout(() => inputEl?.classList.remove('wrong-shake'), 300);
  }
}


// ══════════════════════════════════════════════════════════════════════════
// Vocabulary
// ══════════════════════════════════════════════════════════════════════════

let currentVocab = null;

function startVocabGame() { nextVocabRound(); }

function nextVocabRound() {
  if (!vocabulary.length) return;
  currentVocab = vocabulary[Math.floor(Math.random() * vocabulary.length)];
  const display = document.getElementById('vocab-display');
  const prompt  = document.getElementById('vocab-pl');
  const input   = document.getElementById('vocab-input');
  if (display) { display.style.opacity = '0'; setTimeout(() => { display.textContent = currentVocab.kan; display.style.opacity = '1'; }, 80); }
  if (prompt)  prompt.textContent = currentVocab.pl;
  speakJapanese(currentVocab.kan);
  if (input)  { input.value = ''; input.focus(); }
}

document.getElementById('vocab-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target.value.toLowerCase().trim();
  if (!input) return;

  if (input === currentVocab.rom) {
    e.target.classList.add('correct-flash');
    engine.score += 20;
    updateScoreUI();
    checkLevelUnlocks(engine.score);
    saveUserData();
    setTimeout(() => { e.target.classList.remove('correct-flash'); nextVocabRound(); }, 300);
  } else {
    e.target.classList.add('wrong-shake');
    setTimeout(() => { e.target.classList.remove('wrong-shake'); e.target.value = ''; }, 400);
  }
});


// ══════════════════════════════════════════════════════════════════════════
// Kana Theory Table
// ══════════════════════════════════════════════════════════════════════════

const kanaTableContainer = document.getElementById('kana-table-container');

function renderKanaTable(deck) {
  if (!kanaTableContainer) return;
  kanaTableContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  deck.forEach((item) => {
    const box = document.createElement('div');
    box.className = 'kana-box';
    box.innerHTML = `<div class="kan">${item.kan}</div><div class="rom">${item.rom}</div>`;
    box.addEventListener('click', () => speakJapanese(item.kan));
    fragment.appendChild(box);
  });
  kanaTableContainer.appendChild(fragment);
}

document.getElementById('tab-hiragana')?.addEventListener('click', (e) => {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  e.target.classList.add('active');
  renderKanaTable(hiragana);
});

document.getElementById('tab-katakana')?.addEventListener('click', (e) => {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  e.target.classList.add('active');
  renderKanaTable(katakana);
});

if (kanaTableContainer) renderKanaTable(hiragana);


// ══════════════════════════════════════════════════════════════════════════
// Leaderboard
// ══════════════════════════════════════════════════════════════════════════

async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  list.innerHTML = '<li>Loading…</li>';
  const players = await getTopPlayers();
  list.innerHTML = '';
  if (!players.length) { list.innerHTML = '<li>No data yet.</li>'; return; }
  players.forEach((p, i) => {
    const li  = document.createElement('li');
    const lv  = Math.floor((p.totalScore ?? 0) / 100) + 1;
    li.innerHTML = `<span>${i + 1}. ${p.displayName ?? 'Anon'}</span><span>Lvl ${lv} (${p.totalScore ?? 0} XP)</span>`;
    list.appendChild(li);
  });
}


// ══════════════════════════════════════════════════════════════════════════
// Live Dashboard
// ══════════════════════════════════════════════════════════════════════════

let liveChart      = null;
let unsubStats     = null;
let unsubFeed      = null;

const FEED_ICONS = {
  answer:       '✅',
  levelup:      '🎉',
  boss_victory: '👹',
  streak:       '🔥',
  speedrun:     '⚡',
};

function initLiveDashboard() {
  // Chart — initialise once
  const canvas = document.getElementById('liveChart');
  if (canvas && !liveChart) {
    liveChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels:   ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
        datasets: [{
          label:           'XP',
          data:            [0, 0, 0, 0, 0, 0, 0],
          backgroundColor: 'rgba(188,0,45,0.12)',
          borderColor:     'rgba(188,0,45,0.75)',
          borderWidth:     2,
          borderRadius:    6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(250,246,239,.98)', titleColor: '#1a1008', bodyColor: '#888', borderColor: '#d4c9b0', borderWidth: 1, padding: 10, cornerRadius: 8 },
        },
        scales: {
          x: { grid: { color: 'rgba(26,16,8,.05)' }, ticks: { color: '#c8bfaa' } },
          y: { grid: { color: 'rgba(26,16,8,.05)' }, ticks: { color: '#c8bfaa' }, beginAtZero: true },
        },
      },
    });
  }

  // Populate chart from local session log
  if (liveChart) {
    const sessions = JSON.parse(localStorage.getItem('ks_sessions') ?? '[]');
    const days     = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const today    = new Date();
    const labels   = [];
    const data     = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(days[d.getDay()]);
      const s = sessions.find((x) => x.date === d.toISOString().split('T')[0]);
      data.push(s?.xp ?? 0);
    }
    liveChart.data.labels                = labels;
    liveChart.data.datasets[0].data     = data;
    liveChart.update();
  }

  // Subscribe to Firebase Realtime Database
  unsubStats?.();
  unsubStats = subscribeToLiveStats(({ activeUsers, totalUsers, totalMastered, topScore }) => {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('live-active',   activeUsers);
    setVal('live-total',    totalUsers);
    setVal('live-mastered', totalMastered.toLocaleString());
    setVal('live-top',      topScore.toLocaleString() + ' XP');
  });

  unsubFeed?.();
  unsubFeed = subscribeToActivityFeed((events) => {
    const list = document.getElementById('live-feed-list');
    if (!list || !events.length) return;
    const fragment = document.createDocumentFragment();
    events.forEach((ev) => {
      const li  = document.createElement('li');
      li.className = 'live-feed-item';
      const ago    = ev.timestamp ? Math.floor((Date.now() - ev.timestamp) / 60_000) : 0;
      const timeStr = ago < 1 ? 'now' : `${ago}m ago`;
      li.innerHTML  = `
        <span class="feed-icon">${FEED_ICONS[ev.type] ?? '📝'}</span>
        <span><span class="feed-name">${ev.displayName}</span> ${ev.detail}</span>
        <span class="feed-time">${timeStr}</span>`;
      fragment.appendChild(li);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
  });
}

// Mark offline on page unload
window.addEventListener('beforeunload', () => {
  if (currentUser) markOffline(currentUser.uid);
});


// ══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ══════════════════════════════════════════════════════════════════════════

applyLang();
updateDiffBadge();
