(function () {
  'use strict';

  const LESSONS = (window.LESSONS || []).slice().sort((a, b) => a.n - b.n);
  const TOTAL = LESSONS.length; // 30
  const WEEKS = [
    { w: 1, from: 1, to: 7 },
    { w: 2, from: 8, to: 14 },
    { w: 3, from: 15, to: 21 },
    { w: 4, from: 22, to: 28 }
  ];
  const STORE_KEY = 'bodylang.v1';
  const LETTERS = ['א', 'ב', 'ג', 'ד'];

  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';

  /* ================= storage ================= */
  function blankState() {
    return {
      v: 1, lessons: {}, reviews: {}, final: null, days: [], exercises: {}, read: {},
      seenBadges: [], sound: true, previewAll: false, installHidden: false,
      feed: {}, seen: [], saved: [], blitz: { best: 0, days: [] },
      srs: {}, srsCleared: 0, practiceDays: {}, stories: {}, journal: [], onboarded: false, name: '', remindAt: '20:00'
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blankState();
      return Object.assign(blankState(), JSON.parse(raw));
    } catch (e) {
      return blankState();
    }
  }
  let state = load();
  let storageOk = true;
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  /* ================= dates ================= */
  function keyOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() { return keyOf(new Date()); }
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return keyOf(new Date(y, m - 1, d + n));
  }
  function hoursToMidnight() {
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.max(1, Math.ceil((mid - now) / 3600000));
  }
  function markActive() {
    const t = today();
    if (!state.days.includes(t)) state.days.push(t);
    state.days.sort();
  }
  function streaks(s) {
    s = s || state;
    const set = new Set(s.days);
    let cur = 0;
    let d = today();
    if (!set.has(d)) d = addDays(d, -1);
    while (set.has(d)) { cur++; d = addDays(d, -1); }
    let best = 0, run = 0, prev = null;
    s.days.forEach(k => {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    });
    return { cur, best, activeToday: set.has(today()) };
  }

  /* ================= progress rules ================= */
  function lessonRec(n) { return state.lessons[n] || null; }
  // A lesson opens the calendar day after the previous one was completed.
  function lessonStatus(n) {
    if (lessonRec(n)) return 'done';
    if (n === 1 || state.previewAll) return 'open';
    const prev = lessonRec(n - 1);
    if (!prev) return 'locked';
    return prev.done < today() ? 'open' : 'tomorrow';
  }
  function nextLessonN() {
    for (let n = 1; n <= TOTAL; n++) if (!lessonRec(n)) return n;
    return null;
  }
  function doneCount() { return Object.keys(state.lessons).length; }
  function reviewStatus(w) {
    if (state.reviews[w]) return 'done';
    if (state.previewAll || lessonRec(WEEKS[w - 1].to)) return 'open';
    return 'locked';
  }
  function finalStatus() {
    if (state.final) return 'done';
    if (state.previewAll || lessonRec(TOTAL)) return 'open';
    return 'locked';
  }
  function weekOf(n) { return n <= 28 ? Math.ceil(n / 7) : 5; }

  /* ================= game: XP, levels, badges ================= */
  const XP = { lesson: 20, perQ: 10, perfect: 15, review: 30, reviewPerfect: 30, final: 50, finalPerfect: 50, exercise: 15, streakDay: 5, blitzBest: 5, blitzDay: 10, story: 20, storyStep: 10, practice: 2, srsCleared: 5, journalDay: 5, tool: 10 };
  const FEED_XP = { right: 5, wrong: 1, read: 2, done: 10 };
  const LEVELS = [
    { xp: 0, name: 'מתבונן מתחיל' },
    { xp: 100, name: 'שם לב' },
    { xp: 250, name: 'מכיר קו בסיס' },
    { xp: 450, name: 'צייד צבירים' },
    { xp: 700, name: 'מקשיב פעיל' },
    { xp: 1000, name: 'שואל שאלות טובות' },
    { xp: 1400, name: 'מספר סיפורים' },
    { xp: 1900, name: 'נוכחות מלאה' },
    { xp: 2400, name: 'עין חדה' },
    { xp: 3000, name: 'קורא אנשים' },
    { xp: 3600, name: 'מנטור תקשורת' },
    { xp: 4300, name: 'אמן הסבירות' }
  ];

  function computeXP(s) {
    let xp = 0;
    Object.values(s.lessons).forEach(r => { xp += XP.lesson + r.best * XP.perQ + (r.best === 3 ? XP.perfect : 0); });
    Object.values(s.reviews).forEach(r => { xp += XP.review + r.best * XP.perQ + (r.best === r.total ? XP.reviewPerfect : 0); });
    if (s.final) xp += XP.final + s.final.best * XP.perQ + (s.final.best === s.final.total ? XP.finalPerfect : 0);
    xp += Object.keys(s.exercises).length * XP.exercise;
    xp += streaks(s).best * XP.streakDay;
    Object.values(s.feed || {}).forEach(r => { xp += FEED_XP[r.r] || 0; });
    if (s.blitz) xp += (s.blitz.best || 0) * XP.blitzBest + (s.blitz.days || []).length * XP.blitzDay;
    Object.values(s.stories || {}).forEach(b => { xp += XP.story + b * XP.storyStep; });
    Object.values(s.practiceDays || {}).forEach(c => { xp += Math.min(c, 20) * XP.practice; });
    xp += (s.srsCleared || 0) * XP.srsCleared;
    xp += new Set((s.journal || []).map(j => j.d)).size * XP.journalDay;
    xp += Object.keys(s.toolsTried || {}).length * XP.tool;
    Object.values(s.sims || {}).forEach(b => { xp += XP.story + b * XP.storyStep; });
    return xp;
  }
  function levelInfo(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
    const cur = LEVELS[i], nxt = LEVELS[i + 1];
    return {
      n: i + 1, name: cur.name, xp, floor: cur.xp,
      next: nxt ? nxt.xp : null,
      pct: nxt ? (xp - cur.xp) / (nxt.xp - cur.xp) : 1
    };
  }

  const BADGES = [
    { id: 'first', icon: 'eye', name: 'צעד ראשון', desc: 'סיימתם את השיעור הראשון', test: c => c.done >= 1 },
    { id: 'perfect', icon: 'star', name: 'בול', desc: 'מבחן שיעור בלי אף טעות', test: c => c.perfects >= 1 },
    { id: 'perfect5', icon: 'star', name: 'חד עין', desc: '5 מבחני שיעור מושלמים', test: c => c.perfects >= 5 },
    { id: 'streak3', icon: 'flame', name: 'שלושה ברצף', desc: 'רצף של 3 ימי לימוד', test: c => c.bestStreak >= 3 },
    { id: 'streak7', icon: 'flame', name: 'שבוע שלם', desc: 'רצף של 7 ימי לימוד', test: c => c.bestStreak >= 7 },
    { id: 'streak14', icon: 'flame', name: 'בלי הפסקה', desc: 'רצף של 14 ימי לימוד', test: c => c.bestStreak >= 14 },
    { id: 'doer', icon: 'check', name: 'עושים, לא רק קוראים', desc: '5 תרגילים בחיים האמיתיים', test: c => c.ex >= 5 },
    { id: 'doer15', icon: 'check', name: 'מתרגלים ברצינות', desc: '15 תרגילים בחיים האמיתיים', test: c => c.ex >= 15 },
    { id: 'myth', icon: 'shield', name: 'שוברי מיתוסים', desc: '3 מתוך 3 בשיעור על מיתוסי השקר', test: c => c.s.lessons[13] && c.s.lessons[13].best === 3 },
    { id: 'truth', icon: 'shield', name: 'בודקי עובדות', desc: '3 מתוך 3 בשיעור "איך לברר אמת"', test: c => c.s.lessons[14] && c.s.lessons[14].best === 3 },
    { id: 'comeback', icon: 'up', name: 'לא מוותרים', desc: 'שיפרתם ציון בניסיון חוזר', test: c => c.comeback },
    { id: 'review1', icon: 'trophy', name: 'חזרה ראשונה', desc: 'סיימתם מבחן חזרה שבועי', test: c => c.reviews >= 1 },
    { id: 'reviews', icon: 'trophy', name: 'ארבעה שבועות', desc: 'סיימתם את כל ארבעת מבחני החזרה', test: c => c.reviews >= 4 },
    { id: 'half', icon: 'flag', name: 'חצי דרך', desc: '15 שיעורים מאחוריכם', test: c => c.done >= 15 },
    { id: 'grad', icon: 'crown', name: 'בוגרי המסלול', desc: 'כל 30 השיעורים', test: c => c.done >= 30 },
    { id: 'feed25', icon: 'bolt', name: 'גוללים ולומדים', desc: '25 כרטיסים בפיד', test: c => c.feed >= 25 },
    { id: 'feed100', icon: 'bolt', name: 'בולעי ידע', desc: '100 כרטיסים בפיד', test: c => c.feed >= 100 },
    { id: 'feedall', icon: 'bolt', name: 'ראיתם הכל', desc: 'כל הכרטיסים בפיד', test: c => c.feed >= c.feedTotal },
    { id: 'myths10', icon: 'shield', name: 'ציידי מיתוסים', desc: '10 תשובות נכונות ב"מיתוס או עובדה"', test: c => c.tfRight >= 10 },
    { id: 'field5', icon: 'check', name: 'אנשי שטח', desc: '5 משימות שטח מהפיד', test: c => c.missions >= 5 },
    { id: 'saver', icon: 'bookmark', name: 'אספנים', desc: '10 כרטיסים שמורים', test: c => c.saved >= 10 },
    { id: 'blitz10', icon: 'bolt', name: 'מהירי מחשבה', desc: '10 ומעלה בסבב בזק', test: c => c.blitzBest >= 10 },
    { id: 'blitz20', icon: 'bolt', name: 'ברק', desc: '20 ומעלה בסבב בזק', test: c => c.blitzBest >= 20 },
    { id: 'story1', icon: 'book', name: 'מספרי סיפורים', desc: 'סיימתם סיפור אינטראקטיבי', test: c => c.stories >= 1 },
    { id: 'storyall', icon: 'book', name: 'כל הבחירות הנכונות', desc: 'כל הבחירות טובות בכל הסיפורים', test: c => c.storiesPerfect },
    { id: 'srs10', icon: 'target', name: 'לומדים מטעויות', desc: '10 שאלות שעברו את כל החזרות', test: c => c.srsCleared >= 10 },
    { id: 'journal5', icon: 'pen', name: 'כותבי יומן', desc: '5 ימים עם רשומה ביומן', test: c => c.journalDays >= 5 },
    { id: 'tools5', icon: 'check', name: 'מהתיאוריה לחיים', desc: '5 כלים מארגז הכלים שניסיתם', test: c => c.tools >= 5 },
    { id: 'sim1', icon: 'chat', name: 'מדברים', desc: 'סיימתם הדמיית שיחה', test: c => c.sims >= 1 },
    { id: 'simall', icon: 'chat', name: 'שיחה זורמת', desc: 'כל התשובות טובות בכל ההדמיות', test: c => c.simsPerfect },
    { id: 'master', icon: 'crown', name: 'אמני הסבירות', desc: '10 ומעלה במבחן המסכם', test: c => c.s.final && c.s.final.best >= 10 }
  ];
  function earnedBadges(s) {
    s = s || state;
    const recs = Object.values(s.lessons);
    const c = {
      s,
      done: recs.length,
      perfects: recs.filter(r => r.best === 3).length,
      bestStreak: streaks(s).best,
      ex: Object.keys(s.exercises).length,
      reviews: Object.keys(s.reviews).length,
      feed: Object.keys(s.feed || {}).length,
      feedTotal: (window.FEED || []).length || Infinity,
      tfRight: Object.keys(s.feed || {}).filter(k => s.feed[k].r === 'right' && (cardById(k) || {}).type === 'tf').length,
      missions: Object.values(s.feed || {}).filter(r => r.r === 'done').length,
      saved: (s.saved || []).length,
      blitzBest: (s.blitz && s.blitz.best) || 0,
      stories: Object.keys(s.stories || {}).length,
      storiesPerfect: (window.STORIES || []).length > 0 && (window.STORIES || []).every(st => (s.stories || {})[st.id] === st.steps.length),
      srsCleared: s.srsCleared || 0,
      tools: Object.keys(s.toolsTried || {}).length,
      sims: Object.keys(s.sims || {}).length,
      simsPerfect: (window.SIMS || []).length > 0 && (window.SIMS || []).every(x => (s.sims || {})[x.id] === x.turns.length),
      journalDays: new Set((s.journal || []).map(j => j.d)).size,
      comeback: recs.concat(Object.values(s.reviews), s.final ? [s.final] : []).some(r => r.best > r.first)
    };
    return BADGES.filter(b => b.test(c)).map(b => b.id);
  }

  // Run a state change and report what the player gained.
  function award(change) {
    const xpBefore = computeXP(state);
    const lvlBefore = levelInfo(xpBefore);
    change();
    save();
    const xpAfter = computeXP(state);
    const lvlAfter = levelInfo(xpAfter);
    const earned = earnedBadges();
    const fresh = earned.filter(id => !state.seenBadges.includes(id));
    if (fresh.length) { state.seenBadges = state.seenBadges.concat(fresh); save(); }
    return {
      gained: xpAfter - xpBefore, xpBefore, xpAfter, lvlBefore, lvlAfter,
      levelUp: lvlAfter.n > lvlBefore.n,
      badges: fresh.map(id => BADGES.find(b => b.id === id))
    };
  }

  function recordResult(kind, id, score, total) {
    return award(() => {
      const t = today();
      const bucket = kind === 'lesson' ? state.lessons : kind === 'review' ? state.reviews : null;
      const prev = kind === 'final' ? state.final : bucket[id];
      const rec = prev
        ? Object.assign({}, prev, { last: score, best: Math.max(prev.best, score), attempts: prev.attempts + 1, total })
        : { done: t, first: score, last: score, best: score, attempts: 1, total };
      if (kind === 'final') state.final = rec; else bucket[id] = rec;
      markActive();
    });
  }

  /* ================= sound, haptics, confetti, toasts ================= */
  let actx = null;
  function tone(freq, t0, dur, type, vol) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function sfx(name) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + 0.01;
      if (name === 'right') { tone(660, t, 0.12); tone(990, t + 0.09, 0.2); }
      else if (name === 'wrong') { tone(240, t, 0.18, 'triangle', 0.07); tone(190, t + 0.12, 0.25, 'triangle', 0.06); }
      else if (name === 'done') [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.22));
      else if (name === 'level') [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.28, 'triangle', 0.07));
      else if (name === 'tick') tone(880, t, 0.06, 'sine', 0.04);
    } catch (e) { /* sound is optional */ }
  }
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* optional */ }
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function confetti() {
    if (reduceMotion()) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement);
    const colors = ['--accent', '--gold', '--good', '--amber'].map(v => cs.getPropertyValue(v).trim() || '#0B6E63');
    const parts = Array.from({ length: 120 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.3,
      vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 12 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const start = performance.now();
    function frame(now) {
      const el = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - el / 2000);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
        ctx.restore();
      });
      if (el < 2000) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  function toast(html) {
    let wrap = document.getElementById('toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toasts';
      wrap.className = 'toasts';
      wrap.setAttribute('role', 'status');
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000);
  }
  function celebrate(res, quiet) {
    if (res.levelUp) {
      sfx('level'); buzz([30, 40, 30, 40, 60]); confetti();
      toast(medal(res.lvlAfter.n, 'sm') + '<span><strong>עליתם לרמה ' + res.lvlAfter.n + '</strong><br>' + esc(res.lvlAfter.name) + '</span>');
    }
    res.badges.forEach(b => {
      if (!quiet) toast(badgeIcon(b, false, 'sm') + '<span><strong>הישג חדש: ' + esc(b.name) + '</strong><br>' + esc(b.desc) + '</span>');
    });
  }

  /* ================= install (PWA) ================= */
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e;
    const h = location.hash;
    if (h === '' || h === '#home' || h === '#progress') route();
  });
  window.addEventListener('appinstalled', () => { installEvent = null; });
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* not available here */ });
  }

  /* ================= helpers & icons ================= */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function lesson(n) { return LESSONS.find(l => l.n === n); }

  const ICON = {
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.5c.6 3-1.4 4.7-2.9 6.4C7.6 10.6 6.5 12.3 6.5 14.6 6.5 18 9 21 12 21s5.5-2.6 5.5-6.2c0-2.3-1-4-2.3-5.2.1 1.6-.5 2.9-1.6 3.4.4-3.6-.6-7.1-1.6-9.5Z"/></svg>',
    lock: '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>',
    cross: '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    mark: '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="var(--accent)"/><path d="M7 17.5c2.6-4.4 5.6-6.5 9-6.5s6.4 2.1 9 6.5" fill="none" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="18" r="3.2" fill="var(--on-accent)"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>'
  };
  const GLYPH = {
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    flame: '<path d="M12 3c.5 2.6-1.2 4.1-2.5 5.6C8.2 10 7.3 11.5 7.3 13.5 7.3 16.5 9.4 19 12 19s4.7-2.3 4.7-5.4c0-2-.9-3.5-2-4.5.1 1.4-.4 2.5-1.4 2.9.3-3.1-.5-6.1-1.3-8z"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
    flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
    crown: '<path d="M4 8l4 4 4-7 4 7 4-4-2 10H6z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
    book: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    pen: '<path d="M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'
  };
  function badgeIcon(b, locked, size) {
    return '<span class="badge-ic' + (locked ? ' locked' : '') + (size ? ' ' + size : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH[b.icon] + '</svg></span>';
  }
  function medal(n, size) {
    return '<span class="medal' + (size ? ' ' + size : '') + '" aria-hidden="true"><span class="num">' + n + '</span></span>';
  }
  function stars(k, cls) {
    let h = '<span class="stars ' + (cls || '') + '" aria-label="' + k + ' כוכבים מתוך 3">';
    for (let i = 0; i < 3; i++) h += '<i class="' + (i < k ? 'on' : '') + '">' + ICON.star + '</i>';
    return h + '</span>';
  }
  function starsFor(score, total) {
    if (score === total) return 3;
    if (score / total >= 0.6) return 2;
    return score > 0 ? 1 : 0;
  }

  const view = document.getElementById('view');
  const LEARN_ROUTE = /^#(learn|sims|sim-|stories|story-|tools|practice|mistakes|blitz|journal)/;
  function setTab(name) {
    if (LEARN_ROUTE.test(location.hash)) name = 'learn';
    document.querySelectorAll('.tabbar a').forEach(a => {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function render(html, tab, title, mode) {
    if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }
    if (blitz && blitz.raf) { cancelAnimationFrame(blitz.raf); blitz.raf = null; }
    document.body.classList.toggle('feed-mode', mode === 'feed');
    view.innerHTML = html;
    setTab(tab);
    document.title = title ? title + ' · שפת גוף ב-30 יום' : 'שפת גוף ב-30 יום';
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  function backLink(href, label) {
    return '<a class="back" href="' + href + '">' + ICON.back + esc(label) + '</a>';
  }

  /* ================= home ================= */
  function streakChip() {
    const s = streaks();
    if (!s.cur) return '';
    const label = s.cur === 1 ? 'יום 1' : s.cur + ' ימים';
    return '<span class="chip streak' + (s.activeToday ? '' : ' cold') + '" title="רצף ימי לימוד">' + ICON.flame + '<span class="num">' + label + '</span></span>';
  }

  function playerCard(link) {
    const L = levelInfo(computeXP(state));
    const badges = earnedBadges().length;
    const toNext = L.next === null ? 'הגעתם לרמה הגבוהה ביותר' : 'עוד <bdi dir="ltr">' + (L.next - L.xp) + ' XP</bdi> לרמה ' + (L.n + 1);
    return '<' + (link ? 'a href="#progress"' : 'section') + ' class="player" aria-label="רמה ' + L.n + ', ' + L.xp + ' נקודות ניסיון">' +
      medal(L.n) +
      '<span class="pinfo"><span class="pname">' + esc(L.name) + '</span>' +
        '<span class="xpbar"><span class="fill" style="width:' + Math.round(L.pct * 100) + '%"></span></span>' +
        '<span class="pmeta"><bdi dir="ltr" class="num">' + L.xp + ' XP</bdi><span>' + toNext + '</span></span></span>' +
      '<span class="pbadges" title="הישגים"><svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH.trophy + '</svg><span class="num">' + badges + '</span></span>' +
    '</' + (link ? 'a' : 'section') + '>';
  }

  function scaleBlock() {
    return '<section class="card" aria-labelledby="scale-h">' +
      '<h2 id="scale-h">כלל המשחק: סבירות, לא ודאות</h2>' +
      '<div class="scale">' +
        '<div class="scale-wrap"><div class="scale-bar" role="img" aria-label="סרגל סבירות: סימנים מזיזים את המחוג לכיוון סביר, אבל לא מגיעים לוודאות"></div><div class="scale-needle"></div></div>' +
        '<div class="scale-labels"><span>ניחוש</span><span>סביר</span><span class="off">ודאות</span></div>' +
      '</div>' +
      '<p>שפת גוף מזיזה את המחוג, אבל אף פעם לא עד הסוף. סימן אחד כמעט לא אומר כלום, ואין סימן אחד לשקר. כשלא בטוחים, שואלים.</p>' +
    '</section>';
  }

  function questLesson() {
    const t = today();
    const doneToday = Object.keys(state.lessons).map(Number).filter(n => state.lessons[n].done === t);
    if (doneToday.length) return Math.max.apply(null, doneToday);
    const next = nextLessonN();
    return next && lessonStatus(next) === 'open' ? next : null;
  }
  function questsBlock() {
    const n = questLesson();
    if (!n) return '';
    const L = lesson(n);
    const q = [
      { done: !!state.read[n], label: 'לקרוא את השיעור', xp: null, href: '#lesson-' + n },
      { done: !!lessonRec(n), label: 'לעבור את המבחן', xp: '+' + (XP.lesson + 3 * XP.perQ + XP.perfect), href: '#quiz-' + n },
      { done: !!state.exercises[n], label: 'לעשות את התרגיל בחיים', xp: '+' + XP.exercise, href: '#lesson-' + n + '-ex' },
      { done: feedToday() >= 10, label: 'לגלול 10 כרטיסים בפיד (' + Math.min(10, feedToday()) + '/10)', xp: null, href: '#feed' }
    ];
    const count = q.filter(x => x.done).length;
    return '<section class="card quests" aria-labelledby="quests-h">' +
      '<div class="quests-head"><h2 id="quests-h">המשימות של היום</h2><span class="chip' + (count === q.length ? ' ok' : '') + ' num">' + count + '/' + q.length + '</span></div>' +
      '<p class="muted small">שיעור ' + n + ': ' + esc(L.title) + '</p>' +
      '<ul class="qlist">' + q.map(x =>
        '<li class="' + (x.done ? 'done' : '') + '"><a href="' + x.href + '"><span class="qbox">' + (x.done ? ICON.check : '') + '</span>' +
        '<span class="qlabel">' + x.label + '</span>' + (x.xp ? '<span class="qxp num">' + (x.done ? '' : 'עד ') + '<bdi dir="ltr">' + x.xp + ' XP</bdi></span>' : '') + '</a></li>'
      ).join('') + '</ul>' +
      (count === q.length ? '<p class="small"><strong>כל המשימות הושלמו.</strong> נתראה מחר עם שלב חדש.</p>' : '') +
    '</section>';
  }

  function pendingReviews() {
    return WEEKS.filter(wk => reviewStatus(wk.w) === 'open').map(wk => wk.w);
  }

  function installBanner() {
    if (isStandalone() || state.installHidden) return '';
    if (!installEvent && !isIOS()) return '';
    return '<section class="card install-card">' +
      '<h2>להתקין כאפליקציה</h2>' +
      '<p class="small">אייקון במסך הבית, מסך מלא, ועובד גם בלי אינטרנט.</p>' +
      (installEvent
        ? '<div class="btn-row"><button type="button" class="btn" id="install-btn">להתקין</button><button type="button" class="btn secondary" id="install-hide">אחר כך</button></div>'
        : '<p class="small">בספארי: לחצו על כפתור השיתוף <b>(ריבוע עם חץ למעלה)</b>, ואז <b>"הוספה למסך הבית"</b>.</p><button type="button" class="btn secondary" id="install-hide">הבנתי</button>') +
    '</section>';
  }
  function bindInstall() {
    const b = document.getElementById('install-btn');
    if (b) b.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch (e) { /* ignore */ }
      installEvent = null;
      route();
    });
    const h = document.getElementById('install-hide');
    if (h) h.addEventListener('click', () => { state.installHidden = true; save(); route(); });
  }

  function viewHome() {
    const next = nextLessonN();
    let todayCard;
    if (next === null) {
      todayCard = '<section class="today done">' +
        '<div class="bignum">30<small>מתוך 30</small></div>' +
        '<div class="body"><span class="eyebrow">סיימתם את המסלול</span><h1>כל 30 השלבים מאחוריכם</h1>' +
        '<p class="muted">מה שנשאר זה תרגול. אפשר לחזור לכל שיעור ולשפר כוכבים, ולנסות את המבחן המסכם.</p></div>' +
        '<div class="actions">' +
          '<a class="btn block" href="#final">' + (finalStatus() === 'done' ? 'לנסות שוב את המבחן המסכם' : 'למבחן המסכם: 12 שאלות') + '</a>' +
        '</div></section>';
    } else {
      const L = lesson(next);
      const st = lessonStatus(next);
      if (st === 'open') {
        todayCard = '<section class="today">' +
          '<div class="bignum">' + next + '<small>מתוך 30</small></div>' +
          '<div class="body"><span class="eyebrow">השלב של היום · שבוע ' + weekOf(next) + '</span><h1>' + esc(L.title) + '</h1>' +
          '<p class="muted">' + esc(L.tag) + '</p></div>' +
          '<div class="actions"><a class="btn block big" href="#lesson-' + next + '">לשחק את השלב</a>' +
          '<span class="muted small center">חמש דקות קריאה ו-3 שאלות · עד <bdi dir="ltr">' + (XP.lesson + 3 * XP.perQ + XP.perfect) + ' XP</bdi></span></div>' +
        '</section>';
      } else {
        const h = hoursToMidnight();
        const when = h <= 1 ? 'בעוד פחות משעה' : 'בעוד ' + h + ' שעות';
        todayCard = '<section class="today done">' +
          '<div class="bignum">' + (next - 1) + '<small>הושלם</small></div>' +
          '<div class="body"><span class="eyebrow">סיימתם את השלב של היום</span><h1>מחר: ' + esc(L.title) + '</h1>' +
          '<p class="muted">השלב הבא ייפתח בחצות, ' + when + '. אל תשברו את הרצף.</p></div>' +
        '</section>';
      }
    }

    const reviews = pendingReviews().slice(0, 1).map(w =>
      '<section class="card review-card">' +
        '<span class="eyebrow">שלב בונוס · מבחן חזרה שבוע ' + w + '</span>' +
        '<h2>7 שאלות על שיעורים ' + WEEKS[w - 1].from + '–' + WEEKS[w - 1].to + '</h2>' +
        '<p class="small">שאלה אחת מכל שיעור בשבוע, בסדר מעורבב. עד <bdi dir="ltr">' + (XP.review + 7 * XP.perQ + XP.reviewPerfect) + ' XP</bdi>.</p>' +
        '<a class="btn gold" href="#review-' + w + '">להתחיל את מבחן החזרה</a>' +
      '</section>').join('');

    const notice = storageOk ? '' : '<p class="card small">הדפדפן לא מאפשר לשמור נתונים, ולכן ההתקדמות לא תישמר אחרי סגירת הדף.</p>';

    render(
      '<div class="topline"><div class="brand">' + ICON.mark + '<span>שפת גוף ב-30 יום</span></div>' + streakChip() + '</div>' +
      playerCard(true) + todayCard + questsBlock() + reviews + moreBlock() + installBanner() + scaleBlock() + notice,
      'home'
    );
    bindInstall();
  }

  /* ================= map ================= */
  const MAP_GROUPS = [
    { title: 'שבוע 1', sub: 'לקרוא נכון', from: 1, to: 7, w: 1 },
    { title: 'שבוע 2', sub: 'להקשיב ולברר', from: 8, to: 14, w: 2 },
    { title: 'שבוע 3', sub: 'לשדר ולספר', from: 15, to: 21, w: 3 },
    { title: 'שבוע 4', sub: 'אנשים ומצבים', from: 22, to: 28, w: 4 },
    { title: 'הסיום', sub: 'כריזמה וסיכום', from: 29, to: 30, w: null }
  ];
  const ROW = 128;

  function nodeHtml(it, x, y) {
    let href = null, cls = 'node', disc = '', extra = '', label = '', aria = '';
    if (it.type === 'lesson') {
      const n = it.n, L = lesson(n), st = lessonStatus(n), rec = lessonRec(n);
      label = L.title;
      disc = '<span class="num">' + n + '</span>';
      if (st === 'done') { cls += ' is-done'; href = '#lesson-' + n; extra = stars(starsFor(rec.best, 3), 'tiny'); aria = 'שלב ' + n + ': ' + L.title + ', הושלם, ' + rec.best + ' מתוך 3'; }
      else if (st === 'open') { cls += ' is-open'; href = '#lesson-' + n; extra = '<span class="bubble">' + (n === nextLessonN() ? 'היום' : 'פתוח') + '</span>'; aria = 'שלב ' + n + ': ' + L.title + ', פתוח'; }
      else { cls += ' is-locked'; disc = ICON.lock; aria = 'שלב ' + n + ': ' + L.title + ', ' + (st === 'tomorrow' ? 'נפתח מחר' : 'נעול'); if (st === 'tomorrow') extra = '<span class="bubble muted-b">מחר</span>'; }
    } else {
      const isFinal = it.type === 'final';
      const st = isFinal ? finalStatus() : reviewStatus(it.w);
      const rec = isFinal ? state.final : state.reviews[it.w];
      cls += ' is-chest';
      label = isFinal ? 'מבחן מסכם' : 'חזרה: שבוע ' + it.w;
      disc = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (isFinal ? GLYPH.crown : GLYPH.trophy) + '</svg>';
      if (st === 'locked') { cls += ' is-locked'; aria = label + ', נעול'; }
      else {
        href = isFinal ? '#final' : '#review-' + it.w;
        if (st === 'done') { cls += ' is-done'; extra = stars(starsFor(rec.best, rec.total), 'tiny'); aria = label + ', ' + rec.best + ' מתוך ' + rec.total; }
        else { cls += ' is-open'; extra = '<span class="bubble gold-b">בונוס</span>'; aria = label + ', פתוח'; }
      }
    }
    const style = 'left:' + x.toFixed(1) + '%;top:' + y + 'px';
    const inner = '<span class="disc">' + disc + '</span>' + extra + '<span class="lbl">' + esc(label) + '</span>';
    return href
      ? '<a class="' + cls + '" href="' + href + '" style="' + style + '" aria-label="' + esc(aria) + '">' + inner + '</a>'
      : '<div class="' + cls + '" style="' + style + '" role="img" aria-label="' + esc(aria) + '">' + inner + '</div>';
  }

  function mapSection(g, phase) {
    const items = [];
    for (let n = g.from; n <= g.to; n++) items.push({ type: 'lesson', n });
    items.push(g.w ? { type: 'review', w: g.w } : { type: 'final' });
    const pts = items.map((it, i) => ({ x: 50 + 24 * Math.sin((i + phase) * 1.1), y: 48 + i * ROW }));
    const h = 48 + (items.length - 1) * ROW + 110;
    const reached = it => it.type === 'lesson'
      ? ['done', 'open'].includes(lessonStatus(it.n))
      : (it.type === 'final' ? finalStatus() : reviewStatus(it.w)) !== 'locked';
    let paths = '';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = 'M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + (a.y + ROW / 2) + ' ' + b.x + ' ' + (b.y - ROW / 2) + ' ' + b.x + ' ' + b.y;
      paths += '<path d="' + d + '" class="' + (reached(items[i]) ? 'on' : '') + '" vector-effect="non-scaling-stroke"/>';
    }
    const doneN = items.filter(it => it.type === 'lesson' && lessonRec(it.n)).length;
    const totalN = items.filter(it => it.type === 'lesson').length;
    return '<section class="map-sec">' +
      '<div class="map-banner"><div><h2>' + g.title + '</h2><span>' + g.sub + '</span></div><span class="chip num">' + doneN + '/' + totalN + '</span></div>' +
      '<div class="map" style="height:' + h + 'px">' +
        '<svg class="map-path" viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + paths + '</svg>' +
        items.map((it, i) => nodeHtml(it, pts[i].x, pts[i].y)).join('') +
      '</div></section>';
  }

  function viewLessons() {
    let html = '<div class="lesson-head"><h1>המפה</h1><p class="muted">30 שלבים. שלב חדש נפתח בכל יום, אחרי שעוברים את המבחן של השלב הקודם. כוכבים: 3 מתוך 3 נכונות.</p></div>';
    let phase = 0;
    MAP_GROUPS.forEach(g => { html += mapSection(g, phase); phase += (g.to - g.from + 2); });
    if (state.previewAll) html += '<p class="reminder">מצב תצוגה מקדימה פעיל: כל השלבים פתוחים. אפשר לכבות אותו בהגדרות.</p>';
    render(html, 'lessons', 'המפה');
    const target = view.querySelector('.node.is-open') || Array.from(view.querySelectorAll('.node.is-done')).pop();
    if (target) target.scrollIntoView({ block: 'center' });
  }

  /* ================= lesson ================= */
  function viewLocked(msg) {
    render(backLink('#lessons', 'למפה') +
      '<section class="card empty">' + ICON.lock.replace('class="lock"', 'class="lock big-lock"') +
      '<h1>עוד לא פתוח</h1><p>' + msg + '</p><a class="btn" href="#home">לדף הבית</a></section>', 'lessons', 'נעול');
  }

  function viewLesson(n, focusEx) {
    const L = lesson(n);
    if (!L) return viewHome();
    const st = lessonStatus(n);
    if (st === 'locked') return viewLocked('שלב ' + n + ' ייפתח אחרי שתסיימו את השלבים שלפניו, אחד בכל יום.');
    if (st === 'tomorrow') return viewLocked('שלב ' + n + ' ייפתח מחר. שלב אחד ביום נותן זמן לתרגל את מה שלמדתם.');
    if (!state.read[n]) { state.read[n] = today(); save(); }
    const rec = lessonRec(n);
    const exDone = !!state.exercises[n];
    const list = items => '<ul>' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';

    let html = backLink('#lessons', 'למפה') +
      '<header class="lesson-head"><span class="eyebrow">שלב ' + n + ' מתוך 30 · ' + (n <= 28 ? 'שבוע ' + weekOf(n) : 'הסיום') + '</span>' +
      '<h1>' + esc(L.title) + '</h1><p class="tag">' + esc(L.tag) + '</p>' +
      (rec ? '<div class="lesson-stars">' + stars(starsFor(rec.best, 3)) + '</div>' : '') + '</header>' +

      '<section class="section"><h2>הרעיון</h2><p>' + esc(L.idea) + '</p></section>' +
      '<section class="section"><h2>על מה להסתכל</h2><ul class="bullets">' + L.look.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></section>' +
      '<section class="section"><h2>מה זה אומר, ומה לא</h2><div class="pair">' +
        '<div class="yes"><h3>מה זה יכול לרמוז</h3>' + list(L.means) + '</div>' +
        '<div class="no"><h3>מה זה לא אומר</h3>' + list(L.not) + '</div>' +
      '</div></section>' +
      (L.science ? '<aside class="science"><span class="eyebrow">מה המחקר אומר</span><p>' + esc(L.science) + '</p></aside>' : '') +
      '<section class="section"><h2>דוגמה מהחיים</h2><blockquote class="example">' + esc(L.example) + '</blockquote></section>' +
      (FEED.some(c => c.type === 'pic' && c.topic === n) ? '<section class="section"><h2>תרגול בתמונה</h2><div class="saved-list">' + FEED.filter(c => c.type === 'pic' && c.topic === n).map(c => feedCardHtml(c.id)).join('') + '</div></section>' : '') +

      '<section class="exercise" id="exercise" aria-labelledby="ex-h"><div class="ex-head"><h2 id="ex-h">המשימה בחיים האמיתיים</h2><bdi dir="ltr" class="chip accent num">+' + XP.exercise + ' XP</bdi></div><p>' + esc(L.exercise) + '</p>' +
        '<label class="check" for="ex-' + n + '"><input type="checkbox" id="ex-' + n + '" data-ex="' + n + '"' + (exDone ? ' checked' : '') + '> עשיתי את המשימה</label>' +
        '<details class="jr-box"><summary>לכתוב ביומן מה קרה</summary><textarea id="jr-' + n + '" class="jr" rows="3" placeholder="מה ראיתם? מה הפתיע אתכם?"></textarea><button type="button" class="btn secondary" id="jr-save-' + n + '">שמירה ביומן</button></details></section>' +

      (rec
        ? '<div class="card"><p><strong>השלב הושלם.</strong> הציון הכי טוב שלכם: <span class="num">' + rec.best + '/3</span>.' + (rec.best < 3 ? ' שפרו ל-3 כוכבים כדי לקבל עוד XP.' : '') + '</p><a class="btn secondary" href="#quiz-' + n + '">לנסות שוב את המבחן</a></div>'
        : '<a class="btn block big" href="#quiz-' + n + '">למבחן: 3 שאלות</a>') +
      '<p class="reminder">שפת גוף נותנת סבירות, לא ודאות.</p>';

    const prevOk = n > 1;
    const nextOk = n < TOTAL && ['done', 'open'].includes(lessonStatus(n + 1));
    if (prevOk || nextOk) {
      html += '<nav class="pager" aria-label="מעבר בין שלבים">' +
        (prevOk ? '<a class="btn ghost" href="#lesson-' + (n - 1) + '">→ שלב ' + (n - 1) + '</a>' : '<span></span>') +
        (nextOk ? '<a class="btn ghost" href="#lesson-' + (n + 1) + '">שלב ' + (n + 1) + ' ←</a>' : '<span></span>') +
      '</nav>';
    }
    render(html, 'lessons', L.title);
    if (focusEx) document.getElementById('exercise').scrollIntoView({ block: 'center' });

    document.getElementById('jr-save-' + n).addEventListener('click', () => {
      const ta = document.getElementById('jr-' + n);
      const res = addJournal(ta.value, 'L' + n);
      if (res) { ta.value = ''; toast('<span>נשמר ביומן.</span>'); celebrate(res); }
    });
    const cb = view.querySelector('[data-ex]');
    cb.addEventListener('change', () => {
      const res = award(() => {
        if (cb.checked) state.exercises[n] = today(); else delete state.exercises[n];
      });
      if (cb.checked) {
        sfx('right'); buzz(25);
        toast('<bdi dir="ltr" class="toast-xp num">+' + res.gained + ' XP</bdi><span>כל הכבוד על התרגול בחיים האמיתיים</span>');
        celebrate(res);
      }
    });
  }

  /* ================= quiz ================= */
  let session = null;

  function lessonPool(n) { return lesson(n).quiz.concat((window.LESSON_EXTRA || {})[n] || []); }
  function poolQ(n, k) {
    const L = lesson(n), q = lessonPool(n)[k];
    return { q: q.q, e: q.e, qid: 'L' + n + '-' + k, fromLabel: 'משלב ' + n + ': ' + L.title, opts: shuffle(q.o.map((text, i) => ({ text, correct: i === 0 }))) };
  }
  function randomPoolQ(n) { return poolQ(n, Math.floor(Math.random() * lessonPool(n).length)); }
  function hardPool(n) { return (window.LESSON_HARD || {})[n] || []; }
  function hardQ(n, k) {
    const L = lesson(n), q = hardPool(n)[k];
    return { q: q.q, e: q.e, qid: 'H' + n + '-' + k, hard: true, fromLabel: 'משלב ' + n + ': ' + L.title, opts: shuffle(q.o.map((text, i) => ({ text, correct: i === 0 }))) };
  }
  function randomHardQ(n) { const h = hardPool(n); return h.length ? hardQ(n, Math.floor(Math.random() * h.length)) : randomPoolQ(n); }
  function cardToQ(c) {
    if (c.type === 'tf') return { q: c.text, e: (c.truth ? 'זו עובדה. ' : 'זה מיתוס. ') + c.explain, qid: c.id, fromLabel: topicName(c.topic), opts: [{ text: 'עובדה', correct: c.truth }, { text: 'מיתוס', correct: !c.truth }] };
    if (c.type === 'sc' || c.type === 'pic') return { q: c.type === 'pic' ? c.q : c.text, e: c.explain, qid: c.id, fromLabel: topicName(c.topic), art: c.type === 'pic' ? picArt(c) : '', opts: shuffle(c.options.map((text, i) => ({ text, correct: i === 0 }))) };
    return null;
  }
  function qidToQ(qid) {
    const mh = /^H(\d+)-(\d+)$/.exec(qid);
    if (mh) { const n = Number(mh[1]), k = Number(mh[2]); return lesson(n) && hardPool(n)[k] ? hardQ(n, k) : null; }
    const m = /^L(\d+)-(\d+)$/.exec(qid);
    if (m) { const n = Number(m[1]), k = Number(m[2]); return lesson(n) && lessonPool(n)[k] ? poolQ(n, k) : null; }
    const c = cardById(qid);
    return c ? cardToQ(c) : null;
  }
  function buildQuestions(kind, id) {
    if (kind === 'lesson') {
      const hard = shuffle(hardPool(id).map((_, k) => k)).slice(0, 2).map(k => hardQ(id, k));
      const easy = shuffle(lessonPool(id).map((_, k) => k)).slice(0, 3 - hard.length).map(k => poolQ(id, k));
      return shuffle(hard.concat(easy));
    }
    if (kind === 'review') {
      const wk = WEEKS[id - 1];
      const out = [];
      for (let n = wk.from; n <= wk.to; n++) out.push(randomHardQ(n));
      return shuffle(out);
    }
    if (kind === 'mistakes') return dueMistakes().slice(0, 10).map(qidToQ).filter(Boolean);
    if (kind === 'practice') return practiceQuestions(id);
    return shuffle(LESSONS).slice(0, 12).map(L => randomHardQ(L.n));
  }

  function quizMeta(kind, id) {
    if (kind === 'lesson') return { label: 'שלב ' + id + ' · מבחן', back: '#lesson-' + id, backLabel: 'חזרה לשיעור' };
    if (kind === 'review') return { label: 'בונוס · חזרה על שבוע ' + id, back: '#lessons', backLabel: 'למפה' };
    if (kind === 'mistakes') return { label: 'חזרה על טעויות', back: '#home', backLabel: 'לדף הבית' };
    if (kind === 'practice') return { label: 'אימון · ' + practiceLabel(id), back: '#practice', backLabel: 'לאימון' };
    return { label: 'מבחן מסכם', back: '#lessons', backLabel: 'למפה' };
  }
  function hasRecord(kind, id) {
    if (kind === 'mistakes' || kind === 'practice') return true;
    return kind === 'lesson' ? !!state.lessons[id] : kind === 'review' ? !!state.reviews[id] : !!state.final;
  }

  function newSession(kind, id) {
    return { kind, id, questions: buildQuestions(kind, id), i: 0, answers: [], combo: 0, bestCombo: 0, finished: false, firstRun: !hasRecord(kind, id), result: null };
  }

  function startQuiz(kind, id) {
    if (kind === 'lesson') {
      const st = lessonStatus(id);
      if (st === 'locked' || st === 'tomorrow') return viewLesson(id);
    } else if (kind === 'review') {
      if (reviewStatus(id) === 'locked') return viewLocked('מבחן החזרה של שבוע ' + id + ' ייפתח אחרי שתסיימו את שלב ' + WEEKS[id - 1].to + '.');
    } else if (kind === 'final' && finalStatus() === 'locked') {
      return viewLocked('המבחן המסכם ייפתח אחרי שתסיימו את שלב 30.');
    }
    if (!session || session.kind !== kind || session.id !== id || session.finished) session = newSession(kind, id);
    if (!session.questions.length) {
      session = null;
      if (kind === 'mistakes') return render(backLink('#home', 'לדף הבית') + '<section class="card empty"><h1>אין טעויות לחזרה היום</h1><p>כשתטעו בשאלה, היא תחזור אליכם כאן אחרי יום, אחרי שלושה ימים ואחרי שבוע, עד שתדעו אותה.</p><a class="btn" href="#feed">לפיד</a></section>', 'home', 'חזרה על טעויות');
      return render(backLink('#practice', 'לאימון') + '<section class="card empty"><h1>אין עדיין שאלות בנושא הזה</h1><p>הנושא ייפתח כשתגיעו לשלב שלו במפה.</p></section>', 'feed', 'אימון');
    }
    drawQuiz();
  }

  function progressBar() {
    const s = session;
    const done = s.answers.length;
    return '<div class="qprog" role="progressbar" aria-valuemin="0" aria-valuemax="' + s.questions.length + '" aria-valuenow="' + done + '"><span style="width:' + Math.round(done / s.questions.length * 100) + '%"></span></div>';
  }

  function drawQuiz() {
    const s = session;
    if (s.finished) return drawResult();
    const meta = quizMeta(s.kind, s.id);
    const Q = s.questions[s.i];
    const answered = s.answers[s.i] !== undefined;

    let html = '<div class="qtop">' + backLink(meta.back, meta.backLabel) +
      (s.combo >= 2 ? '<span class="chip streak combo">' + ICON.flame + '<span>רצף ' + s.combo + '</span></span>' : '') + '</div>' +
      progressBar() +
      '<div class="section"><span class="eyebrow">' + esc(meta.label) + ' · <span class="num">' + (s.i + 1) + '/' + s.questions.length + '</span></span>' +
      (Q.hard ? '<span class="chip hard-chip">שאלת יישום</span>' : '') +
      (s.kind !== 'lesson' && Q.fromLabel ? '<span class="from">' + esc(Q.fromLabel) + '</span>' : '') +
      (Q.art || '') +
      '<h1 class="question" id="q-text">' + esc(Q.q) + '</h1></div>' +
      '<div class="options" role="group" aria-labelledby="q-text">';

    Q.opts.forEach((o, k) => {
      let cls = 'opt', mark = '';
      if (answered) {
        if (o.correct) { cls += ' right'; mark = ICON.check; }
        else if (k === s.picked) { cls += ' wrong'; mark = ICON.cross; }
        else cls += ' dim';
      }
      html += '<button type="button" class="' + cls + '" data-k="' + k + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="letter">' + LETTERS[k] + '</span><span>' + esc(o.text) + '</span>' + (mark || '<span></span>') + '</button>';
    });
    html += '</div>';

    if (answered) {
      const ok = s.answers[s.i];
      const last = s.i === s.questions.length - 1;
      html += '<div class="feedback ' + (ok ? 'right' : 'wrong') + '" id="fb" tabindex="-1" role="status">' +
        '<strong>' + (ok ? (s.combo >= 3 ? 'נכון, ' + s.combo + ' ברצף!' : 'נכון!') : 'לא בדיוק') + '</strong><p>' + esc(Q.e) + '</p></div>' +
        '<button type="button" class="btn block big" id="next">' + (last ? 'לתוצאה' : 'המשך') + '</button>';
    }

    render(html, 'lessons', meta.label);

    if (!answered) {
      view.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
        const k = Number(btn.dataset.k);
        const ok = Q.opts[k].correct;
        s.picked = k;
        s.answers[s.i] = ok;
        s.combo = ok ? s.combo + 1 : 0;
        if (!ok) srsWrong(Q.qid); else if (s.kind === 'mistakes') srsRight(Q.qid);
        recordTopic(Q.qid, ok);
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        if (ok) { sfx('right'); buzz(20); } else { sfx('wrong'); buzz([40, 50, 40]); }
        drawQuiz();
        if (ok && s.firstRun) {
          const opt = view.querySelector('.opt.right');
          if (opt) {
            const f = document.createElement('span');
            f.className = 'xpfloat num';
            f.textContent = '+' + XP.perQ + ' XP';
            opt.appendChild(f);
          }
        }
        if (!ok) { const w = view.querySelector('.opt.wrong'); if (w && !reduceMotion()) w.classList.add('shake'); }
        const fb = document.getElementById('fb');
        if (fb) { fb.focus({ preventScroll: true }); fb.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
      }));
    } else {
      document.getElementById('next').addEventListener('click', () => {
        if (s.i < s.questions.length - 1) { s.i++; s.picked = null; drawQuiz(); }
        else {
          s.finished = true;
          s.result = ['lesson', 'review', 'final'].includes(s.kind)
            ? recordResult(s.kind, s.id, s.answers.filter(Boolean).length, s.questions.length)
            : recordPractice(s);
          drawResult(true);
        }
      });
    }
  }

  function countUp(el, from, to, ms) {
    if (!el) return;
    if (reduceMotion() || from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function drawResult(fresh) {
    const s = session;
    const res = s.result;
    const meta = quizMeta(s.kind, s.id);
    const total = s.questions.length;
    const score = s.answers.filter(Boolean).length;
    const k = starsFor(score, total);
    const msg = k === 3 ? 'מושלם. כל התשובות נכונות.' : k === 2 ? 'יפה מאוד. שווה להציץ בהסברים של מה שפספסתם.' : 'שווה לקרוא שוב את השיעור ולנסות שוב. ההסברים למטה יעזרו.';

    const recap = '<ul class="recap">' + s.questions.map((Q, i) => {
      const ok = s.answers[i];
      return '<li class="' + (ok ? 'r' : 'w') + '">' + (ok ? ICON.check : ICON.cross) +
        '<span><strong>' + esc(Q.q) + '</strong><br><span class="muted">' + esc(Q.opts.find(o => o.correct).text) + '</span></span></li>';
    }).join('') + '</ul>';

    let actions = '';
    if (s.kind === 'lesson') {
      const n = s.id;
      const wkEnd = WEEKS.find(w => w.to === n);
      if (wkEnd && reviewStatus(wkEnd.w) === 'open') actions += '<a class="btn gold" href="#review-' + wkEnd.w + '">לשלב הבונוס: חזרה על שבוע ' + wkEnd.w + '</a>';
      else if (n === TOTAL && finalStatus() === 'open') actions += '<a class="btn gold" href="#final">למבחן המסכם</a>';
      else if (n < TOTAL && lessonStatus(n + 1) === 'open') actions += '<a class="btn" href="#lesson-' + (n + 1) + '">לשלב ' + (n + 1) + '</a>';
      else if (!state.exercises[n]) actions += '<a class="btn" href="#lesson-' + n + '-ex">למשימה בחיים האמיתיים</a>';
      else actions += '<a class="btn" href="#home">לדף הבית</a>';
    } else if (s.kind === 'practice') {
      actions += '<a class="btn" href="#practice">לבחור נושא אחר</a>';
    } else if (s.kind === 'mistakes') {
      actions += '<a class="btn" href="#home">לדף הבית</a>';
    } else {
      actions += '<a class="btn" href="#home">לדף הבית</a>';
    }
    actions += '<button type="button" class="btn secondary" id="again">' + (s.kind === 'practice' ? 'עוד 10 שאלות' : 'לנסות שוב') + '</button>';

    const L1 = res.lvlBefore, L2 = res.lvlAfter;
    const xpNote = res.gained > 0 ? '' : (s.kind === 'practice' ? '<p class="muted small">באימון מקבלים XP על עד 20 תשובות נכונות ביום.</p>'
      : s.kind === 'mistakes' ? '<p class="muted small">XP מתקבל על כל שאלה שעברה את כל החזרות: אחרי יום, שלושה ימים ושבוע.</p>'
      : '<p class="muted small">XP ניתן על שיפור הציון הכי טוב. הפעם לא היה שיפור, אבל התרגול עדיין שווה.</p>');
    const levelBlock = '<div class="lvl-row">' + medal(L2.n, 'sm') +
      '<span class="pinfo"><span class="pname">' + esc(L2.name) + '</span>' +
      '<span class="xpbar"><span class="fill" id="lvlfill" style="width:' + Math.round((res.levelUp ? 0 : L1.pct) * 100) + '%"></span></span></span></div>';

    const levelUp = res.levelUp ? '<div class="levelup">' + medal(L2.n) + '<div><span class="eyebrow">רמה חדשה</span><h2>רמה ' + L2.n + ': ' + esc(L2.name) + '</h2></div></div>' : '';
    const newBadges = res.badges.length
      ? '<section class="card"><h2>הישגים חדשים</h2><div class="badge-grid">' + res.badges.map(b =>
          '<div class="badge new">' + badgeIcon(b) + '<strong>' + esc(b.name) + '</strong><span>' + esc(b.desc) + '</span></div>').join('') + '</div></section>'
      : '';
    const nextNote = (s.kind === 'lesson' && s.id < TOTAL && lessonStatus(s.id + 1) === 'tomorrow')
      ? '<p class="muted small">השלב הבא ייפתח מחר.' + (state.exercises[s.id] ? '' : ' עד אז, יש משימה בחיים האמיתיים.') + '</p>' : '';

    render(
      '<section class="card result"><span class="eyebrow">' + esc(meta.label) + '</span>' +
        stars(k, 'big' + (fresh ? ' pop' : '')) +
        '<div class="score num">' + score + '<span>/' + total + '</span></div>' +
        '<p>' + msg + '</p>' +
        (s.bestCombo >= 3 ? '<span class="chip streak">' + ICON.flame + '<span>הרצף הכי ארוך: ' + s.bestCombo + '</span></span>' : '') +
        '<div class="xpgain"><bdi dir="ltr" class="num">+<span id="xpnum">0</span> XP</bdi></div>' + xpNote + levelBlock + nextNote +
      '</section>' + levelUp + newBadges +
      '<div class="btn-row">' + actions + '</div>' +
      '<section class="section"><h2>סיכום התשובות</h2>' + recap + '</section>',
      'lessons', 'תוצאה'
    );

    if (fresh) {
      countUp(document.getElementById('xpnum'), 0, res.gained, 900);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const f = document.getElementById('lvlfill');
        if (f) f.style.width = Math.round(L2.pct * 100) + '%';
      }));
      if (res.levelUp) celebrate(res, true);
      else {
        sfx('done'); buzz(30);
        if (k === 3) confetti();
      }
    } else {
      document.getElementById('xpnum').textContent = res.gained;
      const f = document.getElementById('lvlfill');
      if (f) f.style.width = Math.round(L2.pct * 100) + '%';
    }
    document.getElementById('again').addEventListener('click', () => {
      session = newSession(s.kind, s.id);
      drawQuiz();
    });
  }

  /* ================= progress ================= */
  function pips(score, total) {
    let h = '<span class="pips" aria-label="' + score + ' מתוך ' + total + '">';
    if (total <= 3) for (let i = 0; i < total; i++) h += '<i class="' + (i < score ? 'on' : '') + '"></i>';
    return h + '<b>' + score + '/' + total + '</b></span>';
  }

  function calendarHtml() {
    const set = new Set(state.days);
    const t = today();
    const [y, m, d] = t.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const start = addDays(t, -(dow + 28));
    let html = '<div class="cal" role="img" aria-label="ימי לימוד בחמשת השבועות האחרונים">';
    ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(l => { html += '<span class="dh">' + l + '</span>'; });
    for (let i = 0; i < 35; i++) {
      const k = addDays(start, i);
      let cls = 'd';
      if (k > t) cls += ' future';
      else if (set.has(k)) cls += ' on';
      if (k === t) cls += ' is-today';
      html += '<span class="' + cls + '">' + (k > t ? '' : Number(k.slice(8))) + '</span>';
    }
    return html + '</div>';
  }

  function installSection() {
    let body;
    if (isStandalone()) body = '<p class="small">האפליקציה מותקנת ופועלת מהמסך הבית.</p>';
    else if (installEvent) body = '<p class="small">אייקון במסך הבית, מסך מלא, ועובד גם בלי אינטרנט.</p><button type="button" class="btn" id="install-btn">להתקין</button>';
    else if (isIOS()) body = '<ol class="steps"><li>פתחו את הדף בספארי.</li><li>לחצו על כפתור השיתוף (ריבוע עם חץ למעלה).</li><li>בחרו "הוספה למסך הבית" ואשרו.</li></ol>';
    else body = '<ol class="steps"><li>פתחו את הדף בכרום.</li><li>לחצו על תפריט שלוש הנקודות.</li><li>בחרו "התקנת אפליקציה" או "הוספה למסך הבית".</li></ol>';
    return '<section class="card"><h2>להתקין בטלפון</h2>' + body + '</section>';
  }

  function viewProgress() {
    const s = streaks();
    const xp = computeXP(state);
    const L = levelInfo(xp);
    const recs = Object.keys(state.lessons).map(Number).sort((a, b) => a - b);
    const avg = recs.length ? Math.round(recs.reduce((sum, n) => sum + state.lessons[n].best / 3, 0) / recs.length * 100) : null;
    const earned = earnedBadges();
    const starsTotal = recs.reduce((sum, n) => sum + starsFor(state.lessons[n].best, 3), 0);

    let html = '<div class="lesson-head"><h1>הפרופיל שלכם</h1></div>' +
      playerCard(false) +
      '<div class="stats">' +
        '<div class="stat hot"><span class="v num">' + s.cur + '</span><span class="l">ימים ברצף' + (s.cur && !s.activeToday ? ' (עוד לא היום)' : '') + '</span></div>' +
        '<div class="stat"><span class="v num">' + s.best + '</span><span class="l">הרצף הכי ארוך</span></div>' +
        '<div class="stat"><span class="v num">' + recs.length + '<small> מתוך 30</small></span><span class="l">שלבים שהושלמו</span></div>' +
        '<div class="stat gold"><span class="v num">' + starsTotal + '<small> מתוך 90</small></span><span class="l">כוכבים</span></div>' +
        '<div class="stat"><span class="v num">' + Object.keys(state.feed).length + '<small> מתוך ' + FEED.length + '</small></span><span class="l">כרטיסים בפיד</span></div>' +
        '<div class="stat"><span class="v num">' + (state.blitz.best || 0) + '</span><span class="l">שיא בסבב בזק</span></div>' +
      '</div>' +
      '<a class="card linkcard" href="#saved">' + ICON.bookmark + '<span><strong>הכרטיסים השמורים</strong><br><span class="muted small">' + state.saved.length + ' כרטיסים</span></span></a>' +

      weakBlock(5) +
      '<section class="card"><div class="quests-head"><h2>הישגים</h2><span class="chip num">' + earned.length + '/' + BADGES.length + '</span></div><div class="badge-grid">' +
        BADGES.map(b => {
          const has = earned.includes(b.id);
          return '<div class="badge' + (has ? '' : ' is-locked') + '">' + badgeIcon(b, !has) + '<strong>' + esc(b.name) + '</strong><span>' + esc(b.desc) + '</span></div>';
        }).join('') + '</div></section>' +

      '<section class="card"><h2>ימי לימוד</h2>' + calendarHtml() +
        '<p class="muted small">יום נספר ברצף כשמסיימים בו מבחן, משחקים סבב בזק או עונים על כרטיס בפיד.</p></section>';

    if (recs.length) {
      html += '<section class="card"><div class="quests-head"><h2>ציונים</h2><span class="muted small">ממוצע ' + avg + '%</span></div><ul class="scores">' +
        recs.map(n => '<li><span class="n">' + n + '</span><a class="t" href="#lesson-' + n + '">' + esc(lesson(n).title) + '</a>' + stars(starsFor(state.lessons[n].best, 3), 'tiny') + '</li>').join('') +
        WEEKS.filter(w => state.reviews[w.w]).map(w => { const r = state.reviews[w.w]; return '<li><span class="n">★</span><a class="t" href="#review-' + w.w + '">חזרה: שבוע ' + w.w + '</a>' + pips(r.best, r.total) + '</li>'; }).join('') +
        (state.final ? '<li><span class="n">★</span><a class="t" href="#final">מבחן מסכם</a>' + pips(state.final.best, state.final.total) + '</li>' : '') +
        '</ul><p class="muted small">מוצג הציון הכי טוב. אפשר לחזור על כל מבחן כדי לשפר כוכבים.</p></section>';
    }

    html += '<section class="card"><h2>איך צוברים XP</h2><ul class="xp-rules">' +
      '<li><span>מבחן של שלב</span><b class="num">' + XP.lesson + ' + ' + XP.perQ + ' לכל תשובה נכונה</b></li>' +
      '<li><span>3 מתוך 3</span><b class=\"num\"><bdi dir=\"ltr\">+' + XP.perfect + '</bdi></b></li>' +
      '<li><span>משימה בחיים האמיתיים</span><b class=\"num\"><bdi dir=\"ltr\">+' + XP.exercise + '</bdi></b></li>' +
      '<li><span>מבחן חזרה שבועי</span><b class="num">' + XP.review + ' + ' + XP.perQ + ' לכל תשובה נכונה</b></li>' +
      '<li><span>כרטיס בפיד: תשובה נכונה / טיפ / משימת שטח</span><b class="num"><bdi dir="ltr">+' + FEED_XP.right + ' / +' + FEED_XP.read + ' / +' + FEED_XP.done + '</bdi></b></li>' +
      '<li><span>סבב בזק: כל נקודה בשיא, וכל יום ששיחקתם</span><b class="num"><bdi dir="ltr">+' + XP.blitzBest + ' / +' + XP.blitzDay + '</bdi></b></li>' +
      '<li><span>סיפור: סיום, וכל בחירה טובה (בתוצאה הכי טובה)</span><b class="num"><bdi dir="ltr">+' + XP.story + ' / +' + XP.storyStep + '</bdi></b></li>' +
      '<li><span>אימון: כל תשובה נכונה (עד 20 ביום)</span><b class="num"><bdi dir="ltr">+' + XP.practice + '</bdi></b></li>' +
      '<li><span>שאלה שעברה את כל החזרות על טעויות</span><b class="num"><bdi dir="ltr">+' + XP.srsCleared + '</bdi></b></li>' +
      '<li><span>הדמיית שיחה: סיום, וכל תשובה טובה (בתוצאה הכי טובה)</span><b class="num"><bdi dir="ltr">+' + XP.story + ' / +' + XP.storyStep + '</bdi></b></li>' +
      '<li><span>כלי מארגז הכלים שניסיתם בחיים</span><b class="num"><bdi dir="ltr">+' + XP.tool + '</bdi></b></li>' +
      '<li><span>יום עם רשומה ביומן</span><b class="num"><bdi dir="ltr">+' + XP.journalDay + '</bdi></b></li>' +
      '<li><span>כל יום ברצף הכי ארוך</span><b class=\"num\"><bdi dir=\"ltr\">+' + XP.streakDay + '</bdi></b></li>' +
      '</ul><p class="muted small">רמה ' + L.n + ' מתוך ' + LEVELS.length + '. ניסיון חוזר נותן XP רק אם הוא משפר את הציון הכי טוב.</p></section>';

    html += '<div class="link-grid">' +
      '<a class="card linkcard" href="#journal"><svg viewBox="0 0 24 24" class="lc-ic" aria-hidden="true">' + GLYPH.pen + '</svg><span><strong>היומן שלי</strong><br><span class="muted small">' + (state.journal || []).length + ' רשומות</span></span></a>' +
      '<a class="card linkcard" href="#practice"><svg viewBox="0 0 24 24" class="lc-ic" aria-hidden="true">' + GLYPH.target + '</svg><span><strong>אימון ומסלולים</strong><br><span class="muted small">' + Object.keys(state.srs || {}).length + ' שאלות בחזרה</span></span></a>' +
      (doneCount() >= TOTAL || state.previewAll ? '<a class="card linkcard" href="#certificate"><svg viewBox="0 0 24 24" class="lc-ic" aria-hidden="true">' + GLYPH.crown + '</svg><span><strong>תעודת סיום</strong><br><span class="muted small">לצלם ולשתף</span></span></a>' : '') +
      '</div>';
    html += backupSection() + reminderSection();
    html += installSection();

    html += '<details class="settings" id="settings"><summary>הגדרות</summary><div class="inner">' +
      '<label class="check" for="sound"><input type="checkbox" id="sound"' + (state.sound ? ' checked' : '') + '> צלילים ורטט</label>' +
      '<label class="check" for="preview-all"><input type="checkbox" id="preview-all"' + (state.previewAll ? ' checked' : '') + '> לפתוח את כל השלבים עכשיו (בלי לחכות יום)</label>' +
      '<p class="muted small">שימושי כדי לעיין בתוכן מראש. ההתקדמות והציונים נשמרים כרגיל.</p>' +
      '<button type="button" class="btn secondary" id="reset">איפוס כל ההתקדמות</button>' +
      '<div class="confirm" id="confirm" hidden><p><strong>למחוק את כל ה-XP, ההישגים, הרצף והשלבים שהושלמו?</strong> אי אפשר לבטל את זה.</p>' +
      '<div class="btn-row"><button type="button" class="btn danger" id="reset-yes">כן, לאפס</button><button type="button" class="btn secondary" id="reset-no">ביטול</button></div></div>' +
      '</div></details>';

    render(html, 'progress', 'פרופיל');
    bindInstall();
    bindBackup();
    bindReminder();

    document.getElementById('sound').addEventListener('change', e => { state.sound = e.target.checked; save(); if (state.sound) sfx('tick'); });
    document.getElementById('preview-all').addEventListener('change', e => { state.previewAll = e.target.checked; save(); });
    const confirmBox = document.getElementById('confirm');
    document.getElementById('reset').addEventListener('click', () => { confirmBox.hidden = false; document.getElementById('reset-no').focus(); });
    document.getElementById('reset-no').addEventListener('click', () => { confirmBox.hidden = true; });
    document.getElementById('reset-yes').addEventListener('click', () => {
      const sound = state.sound;
      state = blankState();
      state.sound = sound;
      session = null;
      save();
      location.hash = '#home';
      route();
    });
  }

  /* ================= feed (short cards, one per screen) ================= */
  const FEED = window.FEED || [];
  const FEED_TOPICS = window.FEED_TOPICS || {};
  const TYPE_LABEL = { tip: 'טיפ', tf: 'מיתוס או עובדה?', sc: 'מה הייתם עושים?', mission: 'משימת שטח', pic: 'מה רואים בתמונה?', voice: 'הקשיבו להבדל', spot: 'מה השתבש פה?', order: 'סדרו נכון' };
  let feedObserver = null;
  let deck = null;
  let deckShown = 0;
  const optOrders = {};

  function cardById(id) { return FEED.find(c => c.id === id) || null; }
  function topicName(t) {
    if (typeof t === 'number') { const L = lesson(t); return L ? 'שלב ' + t + ' · ' + L.title : ''; }
    return FEED_TOPICS[t] || '';
  }
  function feedToday() {
    const t = today();
    return Object.values(state.feed).filter(r => r.d === t).length;
  }
  function optOrder(id) {
    if (!optOrders[id]) optOrders[id] = shuffle([0, 1, 2]);
    return optOrders[id];
  }
  function buildDeck() {
    const seen = new Set(state.seen);
    const isNew = c => !seen.has(c.id) && !state.feed[c.id];
    const ids = shuffle(FEED.filter(isNew)).concat(shuffle(FEED.filter(c => !isNew(c)))).map(c => c.id);
    const out = [];
    ids.forEach((id, k) => { out.push(id); if ((k + 1) % 12 === 0) out.push('#blitz'); });
    return out;
  }

  function feedFeedback(ok, text) {
    return '<div class="feedback ' + (ok ? 'right' : 'wrong') + '" role="status"><strong>' + (ok ? 'נכון!' : 'לא בדיוק') + '</strong><p>' + esc(text) + '</p></div>';
  }
  function finnerHtml(c) {
    const done = state.feed[c.id];
    let body = '';
    if (c.type === 'tip') {
      body = '<h2 class="ftitle">' + esc(c.title) + '</h2><p class="ftext">' + esc(c.text) + '</p>' +
        (done ? '<p class="fdone">' + ICON.check + ' נלמד</p>'
          : '<button type="button" class="btn big" data-act="read">הבנתי <bdi dir="ltr">+' + FEED_XP.read + ' XP</bdi></button>');
    } else if (c.type === 'tf') {
      body = '<p class="fstatement">' + esc(c.text) + '</p>';
      if (!done) body += '<div class="tf-btns"><button type="button" class="btn big" data-act="tf" data-v="1">עובדה</button><button type="button" class="btn big alt" data-act="tf" data-v="0">מיתוס</button></div>';
      else body += feedFeedback(done.r === 'right', (c.truth ? 'זו עובדה. ' : 'זה מיתוס. ') + c.explain);
    } else if (c.type === 'spot') {
      body = spotHtml(c, done);
    } else if (c.type === 'order') {
      body = orderHtml(c, done);
    } else if (c.type === 'voice') {
      const canSpeak = !!window.speechSynthesis;
      body = '<p class="fstatement sm">' + esc(c.question) + '</p>' + (canSpeak ? '' : '<p class="muted small">הדפדפן הזה לא יודע להקריא. קראו את שתי הגרסאות.</p>') + '<div class="voice-list">';
      const vo = optOrder(c.id).filter(k => k < 2);
      vo.forEach((k, pos) => {
        const v = k === 0 ? c.a : c.b;
        let cls = 'voice-row';
        if (done) cls += k === 0 ? ' right' : (k === done.p ? ' wrong' : ' dim');
        body += '<div class="' + cls + '">' + (canSpeak ? '<button type="button" class="vplay" data-act="play" data-k="' + k + '" aria-label="השמעת גרסה ' + (pos + 1) + '">' + ICON.play + '</button>' : '') +
          '<span class="vtext"><b>גרסה ' + (pos + 1) + '</b>' + esc(v.text) + '</span>' +
          (done ? '' : '<button type="button" class="btn small-btn" data-act="voice" data-k="' + k + '">זו</button>') + '</div>';
      });
      body += '</div>';
      if (done) body += feedFeedback(done.r === 'right', c.explain);
    } else if (c.type === 'sc' || c.type === 'pic') {
      body = (c.type === 'pic' ? picArt(c) + '<p class="fstatement sm">' + esc(c.q) + '</p>' : '<p class="fstatement sm">' + esc(c.text) + '</p>') + '<div class="options">';
      optOrder(c.id).forEach((k, pos) => {
        let cls = 'opt', mark = '<span></span>';
        if (done) {
          if (k === 0) { cls += ' right'; mark = ICON.check; }
          else if (k === done.p) { cls += ' wrong'; mark = ICON.cross; }
          else cls += ' dim';
        }
        body += '<button type="button" class="' + cls + '" data-act="sc" data-k="' + k + '"' + (done ? ' disabled' : '') + '><span class="letter">' + LETTERS[pos] + '</span><span>' + esc(c.options[k]) + '</span>' + mark + '</button>';
      });
      body += '</div>';
      if (done) body += feedFeedback(done.r === 'right', c.explain);
    } else {
      body = '<p class="fstatement sm">' + esc(c.text) + '</p>' +
        (done ? '<p class="fdone">' + ICON.check + ' בוצע. כל הכבוד.</p><a class="btn secondary" href="#journal">לכתוב ביומן מה קרה</a>'
          : '<button type="button" class="btn big" data-act="mission">עשיתי את זה <bdi dir="ltr">+' + FEED_XP.done + ' XP</bdi></button><p class="muted small">לא עכשיו? שמרו את הכרטיס וחזרו אליו אחרי שעשיתם.</p>');
    }
    return '<div class="finner"><div class="fmeta"><span class="chip ftype">' + TYPE_LABEL[c.type] + '</span><span class="ftopic">' + esc(topicName(c.topic)) + '</span></div>' + body + '</div>';
  }
  function feedCardHtml(id, first) {
    if (id === '#blitz') {
      return '<article class="fcard t-promo" data-id="#blitz"><div class="finner center-in">' +
        '<span class="promo-ic">' + ICON.bolt + '</span><h2 class="ftitle">סבב בזק</h2>' +
        '<p class="ftext">60 שניות של מיתוס או עובדה. כמה תספיקו?</p>' +
        '<p class="muted">השיא שלכם: <span class="num">' + (state.blitz.best || 0) + '</span></p>' +
        '<a class="btn gold big" href="#blitz">לשחק</a></div></article>';
    }
    const c = cardById(id);
    if (!c) return '';
    const saved = state.saved.includes(id);
    return '<article class="fcard t-' + c.type + '" data-id="' + id + '">' + finnerHtml(c) +
      '<button type="button" class="fsave' + (saved ? ' on' : '') + '" data-act="save" aria-pressed="' + saved + '" aria-label="שמירת הכרטיס">' + ICON.bookmark + '</button>' +
      (first ? '<p class="fhint" aria-hidden="true">גללו למעלה לכרטיס הבא</p>' : '') + '</article>';
  }

  function feedTopHtml() {
    return '<div class="feed-top"><span class="feed-title">פיד הלמידה</span>' +
      '<span class="chip num" id="feed-count">היום: ' + feedToday() + '</span>' +
      '<a class="feed-ic" href="#blitz" aria-label="סבב בזק">' + ICON.bolt + '</a>' +
      '<a class="feed-ic" href="#saved" aria-label="כרטיסים שמורים">' + ICON.bookmark + '</a></div>';
  }

  function appendFeed(n) {
    const wrap = document.getElementById('feed-list');
    if (!wrap) return;
    let html = '';
    for (let k = 0; k < n; k++) {
      if (deckShown >= deck.length) { deck = deck.concat(buildDeck()); }
      html += feedCardHtml(deck[deckShown], deckShown === 0);
      deckShown++;
    }
    wrap.insertAdjacentHTML('beforeend', html);
    wrap.querySelectorAll('.fcard:not([data-obs])').forEach(el => { el.dataset.obs = '1'; if (feedObserver) feedObserver.observe(el); });
  }

  let seenDirty = false;
  function viewFeed() {
    deck = buildDeck();
    deckShown = 0;
    render(feedTopHtml() + '<div id="feed-list" class="feed-list"></div>', 'feed', 'פיד', 'feed');
    feedObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = en.target.dataset.id;
        if (id && id[0] !== '#' && !state.seen.includes(id)) { state.seen.push(id); seenDirty = true; }
        const all = view.querySelectorAll('.fcard');
        if (en.target === all[all.length - 3] || en.target === all[all.length - 1]) appendFeed(8);
      });
      if (seenDirty) { seenDirty = false; save(); }
    }, { root: view, threshold: 0.6 });
    appendFeed(10);
  }

  function viewSaved() {
    const list = state.saved.map(id => cardById(id)).filter(Boolean);
    render(backLink('#feed', 'לפיד') +
      '<div class="lesson-head"><h1>כרטיסים שמורים</h1><p class="muted">' + (list.length ? list.length + ' כרטיסים. לחצו על הסימנייה כדי להסיר.' : '') + '</p></div>' +
      (list.length
        ? '<div class="saved-list">' + list.map(c => feedCardHtml(c.id)).join('') + '</div>'
        : '<section class="card empty"><h2>עוד לא שמרתם כרטיסים</h2><p>בפיד, לחצו על הסימנייה בפינת הכרטיס כדי לשמור אותו כאן.</p><a class="btn" href="#feed">לפיד</a></section>'),
      'feed', 'שמורים');
  }

  function onCardAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const art = btn.closest('.fcard');
    if (!art) return;
    const id = art.dataset.id;
    const c = cardById(id);
    if (!c) return;
    const act = btn.dataset.act;
    if (act === 'save') {
      const on = !state.saved.includes(id);
      const res = award(() => { if (on) state.saved.push(id); else state.saved = state.saved.filter(x => x !== id); });
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      sfx('tick'); buzz(10);
      if (on) toast(ICON.bookmark.replace('<svg', '<svg class="toast-ic"') + '<span>נשמר. תמצאו אותו ב"כרטיסים שמורים".</span>');
      celebrate(res);
      return;
    }
    if (state.feed[id]) return;
    let r, p;
    if (act === 'read') r = 'read';
    else if (act === 'mission') r = 'done';
    else if (act === 'tf') r = ((btn.dataset.v === '1') === c.truth) ? 'right' : 'wrong';
    else if (act === 'sc' || act === 'voice') { p = Number(btn.dataset.k); r = p === 0 ? 'right' : 'wrong'; }
    else if (act === 'play') { const k = Number(btn.dataset.k); speak(k === 0 ? c.a : c.b); return; }
    else if (act === 'spot') { p = Number(btn.dataset.k); r = p === c.bad ? 'right' : 'wrong'; }
    else if (act === 'oreset') { const fin0 = art.querySelector('.finner'); fin0.outerHTML = finnerHtml(c); return; }
    else if (act === 'ostep') {
      const list = art.querySelector('.order-picked');
      const picked = list.dataset.picked ? list.dataset.picked.split(',').map(Number) : [];
      picked.push(Number(btn.dataset.k));
      list.dataset.picked = picked.join(',');
      list.insertAdjacentHTML('beforeend', '<li>' + esc(c.steps[Number(btn.dataset.k)]) + '</li>');
      btn.remove();
      sfx('tick');
      if (picked.length < c.steps.length) return;
      p = picked; r = picked.every((v, k) => v === k) ? 'right' : 'wrong';
    }
    else return;
    const res = award(() => { state.feed[id] = p === undefined ? { d: today(), r } : { d: today(), r, p }; markActive(); });
    if (r === 'wrong' && ['tf', 'sc', 'pic'].includes(c.type)) srsWrong(id);
    if (r === 'right' || r === 'wrong') recordTopic(id, r === 'right');
    if (r === 'wrong') { sfx('wrong'); buzz([40, 50, 40]); } else { sfx('right'); buzz(20); }
    const fin = art.querySelector('.finner');
    fin.outerHTML = finnerHtml(c);
    if (r === 'wrong') { const w = art.querySelector('.opt.wrong'); if (w && !reduceMotion()) w.classList.add('shake'); }
    if (res.gained > 0) {
      const f = document.createElement('span');
      f.className = 'xpfloat big num';
      f.textContent = '+' + res.gained + ' XP';
      art.querySelector('.finner').appendChild(f);
    }
    const cnt = document.getElementById('feed-count');
    if (cnt) cnt.textContent = 'היום: ' + feedToday();
    if (feedToday() === 10) toast('<span class="toast-xp">' + ICON.check.replace('class="mark"', 'class="toast-ic"') + '</span><span><strong>משימת הפיד של היום הושלמה</strong><br>10 כרטיסים. אפשר להמשיך לגלול.</span>');
    celebrate(res);
  }
  view.addEventListener('click', onCardAction);

  function feedPromo() {
    const fresh = FEED.filter(c => !state.feed[c.id] && !state.seen.includes(c.id)).length;
    return '<section class="card feed-promo">' +
      '<div class="quests-head"><h2>פיד הלמידה</h2><span class="chip accent num">' + fresh + ' חדשים</span></div>' +
      '<p class="small">כרטיסים קצרים, אחד בכל מסך: טיפים, מיתוס או עובדה, מה הייתם עושים, ומשימות שטח. גוללים ולומדים.</p>' +
      '<div class="btn-row"><a class="btn" href="#feed">לגלול בפיד</a><a class="btn gold" href="#blitz">' + ICON.bolt.replace('<svg', '<svg class="btn-ic"') + 'סבב בזק</a></div>' +
    '</section>';
  }

  /* ================= blitz: 60 seconds of myth or fact ================= */
  const BLITZ_MS = 60000;
  let blitz = null;

  function viewBlitz() {
    blitz = null;
    render(backLink('#feed', 'לפיד') +
      '<section class="card result blitz-intro"><span class="promo-ic">' + ICON.bolt + '</span>' +
      '<h1>סבב בזק</h1><p>60 שניות. בכל מסך משפט אחד: עובדה או מיתוס? כל תשובה נכונה היא נקודה. טעות עולה 3 שניות.</p>' +
      '<p class="muted">השיא שלכם: <span class="num">' + (state.blitz.best || 0) + '</span></p>' +
      '<button type="button" class="btn gold big block" id="blitz-go">יאללה, מתחילים</button></section>',
      'feed', 'סבב בזק');
    document.getElementById('blitz-go').addEventListener('click', startBlitz);
  }

  function startBlitz() {
    const pool = shuffle(FEED.filter(c => c.type === 'tf'));
    blitz = { pool, i: 0, score: 0, wrong: 0, end: performance.now() + BLITZ_MS, raf: null, lock: false, missed: [] };
    sfx('tick');
    drawBlitz();
  }

  function drawBlitz(flash) {
    const b = blitz;
    const c = b.pool[b.i % b.pool.length];
    render('<div class="blitz">' +
      '<div class="blitz-top"><span class="chip streak num" id="bz-score">' + ICON.bolt + '<span>' + b.score + '</span></span><span class="num bz-sec" id="bz-sec">60</span></div>' +
      '<div class="qprog bz-bar"><span id="bz-bar" style="width:100%"></span></div>' +
      '<p class="fstatement bz-st' + (flash ? ' ' + flash : '') + '">' + esc(c.text) + '</p>' +
      '<div class="tf-btns"><button type="button" class="btn big" data-bz="1">עובדה</button><button type="button" class="btn big alt" data-bz="0">מיתוס</button></div>' +
      '</div>', 'feed', 'סבב בזק');
    view.querySelectorAll('[data-bz]').forEach(btn => btn.addEventListener('click', () => answerBlitz(btn.dataset.bz === '1')));
    tickBlitz();
  }

  function tickBlitz() {
    const b = blitz;
    if (!b) return;
    const left = Math.max(0, b.end - performance.now());
    const sec = document.getElementById('bz-sec');
    const bar = document.getElementById('bz-bar');
    if (sec) sec.textContent = Math.ceil(left / 1000);
    if (bar) bar.style.width = (left / BLITZ_MS * 100) + '%';
    if (left <= 0) return finishBlitz();
    if (location.hash !== '#blitz') { blitz = null; return; }
    b.raf = requestAnimationFrame(tickBlitz);
  }

  function answerBlitz(v) {
    const b = blitz;
    if (!b || b.lock) return;
    const c = b.pool[b.i % b.pool.length];
    const ok = v === c.truth;
    if (ok) { b.score++; sfx('right'); buzz(15); }
    else { b.wrong++; b.end -= 3000; b.missed.push(c); sfx('wrong'); buzz([40, 40]); }
    b.i++;
    b.lock = true;
    const st = view.querySelector('.bz-st');
    if (st) { st.classList.add(ok ? 'ok' : 'bad'); st.textContent = ok ? 'נכון!' : (c.truth ? 'זו עובדה' : 'זה מיתוס'); }
    if (b.raf) cancelAnimationFrame(b.raf);
    setTimeout(() => { if (blitz !== b) return; b.lock = false; if (b.end - performance.now() <= 0) finishBlitz(); else drawBlitz(); }, ok ? 280 : 750);
  }

  function finishBlitz() {
    const b = blitz;
    if (!b || b.done) return;
    b.done = true;
    if (b.raf) cancelAnimationFrame(b.raf);
    const prevBest = state.blitz.best || 0;
    const res = award(() => {
      state.blitz = { best: Math.max(prevBest, b.score), days: (state.blitz.days || []).slice() };
      if (!state.blitz.days.includes(today())) state.blitz.days.push(today());
      markActive();
    });
    const record = b.score > prevBest;
    const missed = b.missed.slice(-5).map(c => '<li class="w">' + ICON.cross + '<span><strong>' + esc(c.text) + '</strong><br><span class="muted">' + (c.truth ? 'עובדה. ' : 'מיתוס. ') + esc(c.explain) + '</span></span></li>').join('');
    render('<section class="card result"><span class="eyebrow">סבב בזק</span>' +
      '<div class="score num">' + b.score + '</div>' +
      '<p>' + (record ? 'שיא חדש!' : 'השיא שלכם: <span class="num">' + prevBest + '</span>') + '</p>' +
      '<div class="xpgain"><bdi dir="ltr" class="num">+' + res.gained + ' XP</bdi></div>' +
      (res.gained ? '' : '<p class="muted small">XP בסבב בזק ניתן על שיא חדש ועל היום הראשון ששיחקתם בו.</p>') +
      '</section>' +
      '<div class="btn-row"><button type="button" class="btn gold" id="bz-again">עוד סבב</button><button type="button" class="btn" id="bz-share">אתגרו חבר</button><a class="btn secondary" href="#feed">חזרה לפיד</a></div>' +
      (missed ? '<section class="section"><h2>מה פספסתם</h2><ul class="recap">' + missed + '</ul></section>' : ''),
      'feed', 'תוצאה');
    document.getElementById('bz-again').addEventListener('click', startBlitz);
    document.getElementById('bz-share').addEventListener('click', () => shareChallenge(b.score));
    if (res.levelUp) celebrate(res, false);
    else { sfx('done'); celebrate(res); if (record && b.score > 0) confetti(); }
  }

  /* ================= picture cards ================= */
  function picArt(c) {
    const P = window.PICS;
    if (!P) return '';
    const two = c.panels.length > 1;
    return '<div class="pic-row' + (two ? ' two' : '') + '">' + c.panels.map((p, k) =>
      '<figure class="pic">' + P[p[0]](p[1]) + (two ? '<figcaption>' + ['א', 'ב'][k] + '</figcaption>' : '') + '</figure>').join('') + '</div>' +
      (c.caption ? '<p class="muted small center">' + esc(c.caption) + '</p>' : '');
  }

  /* ================= voice cards (speech synthesis) ================= */
  function hebrewVoice() {
    try {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      return vs.find(v => /^he|^iw/i.test(v.lang)) || null;
    } catch (e) { return null; }
  }
  if (window.speechSynthesis) { try { speechSynthesis.onvoiceschanged = () => {}; speechSynthesis.getVoices(); } catch (e) { /* optional */ } }
  function speak(v) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(v.text.replace(/\.\.\./g, '. . .'));
      const voice = hebrewVoice();
      if (voice) u.voice = voice;
      u.lang = 'he-IL';
      u.rate = v.rate || 1;
      u.pitch = v.pitch || 1;
      speechSynthesis.speak(u);
    } catch (e) { toast('<span>לא הצלחנו להשמיע כאן. קראו את שתי הגרסאות.</span>'); }
  }

  /* ================= mistakes (spaced repetition) ================= */
  const SRS_GAPS = [1, 3, 7];
  function srsWrong(qid) {
    if (!qid) return;
    state.srs = state.srs || {};
    state.srs[qid] = { box: 0, due: addDays(today(), 1) };
    save();
  }
  function srsRight(qid) {
    const it = state.srs && state.srs[qid];
    if (!it) return;
    const box = it.box + 1;
    if (box >= SRS_GAPS.length) { delete state.srs[qid]; state.srsCleared = (state.srsCleared || 0) + 1; }
    else state.srs[qid] = { box, due: addDays(today(), SRS_GAPS[box]) };
    save();
  }
  function dueMistakes() {
    const t = today();
    return Object.keys(state.srs || {}).filter(q => state.srs[q].due <= t);
  }

  /* ================= practice by topic and tracks ================= */
  const TRACKS = [
    { id: 'read', name: 'קריאה וזיהוי', topics: [1, 2, 3, 4, 5, 11, 12, 27] },
    { id: 'truth', name: 'אמת ושקר', topics: [13, 14, 7, 12] },
    { id: 'talk', name: 'שיחה והקשבה', topics: [8, 9, 10, 18, 19, 21, 'small'] },
    { id: 'work', name: 'עבודה', topics: ['interview', 'nego', 'feedback', 'seat', 22, 23, 16] },
    { id: 'rel', name: 'זוגיות ויחסים', topics: ['couple', 'date', 25, 26, 'apology', 'no', 'touch', 20] },
    { id: 'daily', name: 'חיי יום יום', topics: ['daily', 'service', 'friends', 'family', 'small'] },
    { id: 'kids', name: 'הורות', topics: ['kids', 'emotion', 8, 21, 6] },
    { id: 'screens', name: 'מסכים, טלפון וכתב', topics: ['video', 'phone', 28, 15] },
    { id: 'presence', name: 'נוכחות וביטחון', topics: [17, 24, 29, 'nerves', 'space', 'culture'] }
  ];
  function topicOpen(t) { return typeof t !== 'number' || ['done', 'open'].includes(lessonStatus(t)); }
  function shortTopic(t) { return typeof t === 'number' ? lesson(t).title : (FEED_TOPICS[t] || t); }
  function practiceLabel(id) {
    if (String(id).startsWith('t-')) { const tr = TRACKS.find(x => 't-' + x.id === id); return tr ? tr.name : ''; }
    return shortTopic(/^\d+$/.test(id) ? Number(id) : id);
  }
  function topicQuestions(t) {
    const qs = [];
    if (typeof t === 'number') { lessonPool(t).forEach((_, k) => qs.push(poolQ(t, k))); hardPool(t).forEach((_, k) => qs.push(hardQ(t, k))); }
    FEED.filter(c => c.topic === t && ['tf', 'sc', 'pic'].includes(c.type)).forEach(c => qs.push(cardToQ(c)));
    return qs;
  }
  function practiceQuestions(id) {
    let topics;
    if (String(id).startsWith('t-')) { const tr = TRACKS.find(x => 't-' + x.id === id); topics = tr ? tr.topics.filter(topicOpen) : []; }
    else { const t = /^\d+$/.test(id) ? Number(id) : id; topics = topicOpen(t) ? [t] : []; }
    return shuffle([].concat.apply([], topics.map(topicQuestions))).slice(0, 10);
  }
  function recordPractice(s) {
    const right = s.answers.filter(Boolean).length;
    return award(() => {
      if (s.kind === 'practice') {
        state.practiceDays = state.practiceDays || {};
        state.practiceDays[today()] = (state.practiceDays[today()] || 0) + right;
      }
      markActive();
    });
  }
  function viewPractice() {
    const due = dueMistakes().length;
    let html = '<div class="lesson-head"><h1>אימון</h1><p class="muted">עד 10 שאלות בנושא שתבחרו, מתוך השיעורים והפיד. נושאי שיעורים נפתחים כשמגיעים אליהם במפה.</p></div>';
    if (due) html += '<a class="card linkcard mistakes-card" href="#mistakes">' + ICON.bolt + '<span><strong>חזרה על טעויות</strong><br><span class="muted small">' + due + ' שאלות מחכות לכם היום</span></span></a>';
    TRACKS.forEach(tr => {
      const open = tr.topics.filter(topicOpen);
      html += '<section class="card track-card"><div class="quests-head"><h2>' + tr.name + '</h2>' +
        (open.length ? '<a class="btn secondary small-btn" href="#practice-t-' + tr.id + '">אימון מעורב</a>' : '') + '</div><div class="topic-chips">' +
        tr.topics.map(t => topicOpen(t)
          ? '<a class="tchip" href="#practice-' + t + '">' + esc(shortTopic(t)) + '</a>'
          : '<span class="tchip locked">' + ICON.lock + esc(shortTopic(t)) + '</span>').join('') +
        '</div></section>';
    });
    render(html, 'feed', 'אימון');
  }

  /* ================= interactive stories ================= */
  let story = null;
  function viewStories() {
    const list = window.STORIES || [];
    render(backLink('#home', 'לדף הבית') + '<div class="lesson-head"><h1>סיפורים</h1><p class="muted">מצבים מהחיים שמתקדמים לפי הבחירות שלכם. בכל שלב רואים מה קרה בעקבות הבחירה.</p></div>' +
      list.map(st => {
        const best = (state.stories || {})[st.id];
        return '<a class="card linkcard story-card" href="#story-' + st.id + '"><span class="story-ic">' + ICON.book + '</span><span><strong>' + esc(st.title) + '</strong><br><span class="muted small">' + esc(st.sub) + '</span></span>' +
          (best === undefined ? '<span class="chip accent">חדש</span>' : '<span class="chip ok num">' + best + '/' + st.steps.length + '</span>') + '</a>';
      }).join(''), 'home', 'סיפורים');
  }
  function startStory(id) {
    const st = (window.STORIES || []).find(x => x.id === id);
    if (!st) return viewStories();
    if (!story || story.id !== id || story.done) story = { id, st, step: 0, picks: [], order: st.steps.map(s => shuffle(s.choices.map((_, k) => k))), done: false };
    drawStory();
  }
  function drawStory() {
    const S = story, st = S.st, step = st.steps[S.step], picked = S.picks[S.step];
    let html = backLink('#stories', 'לכל הסיפורים') +
      '<div class="qprog"><span style="width:' + Math.round(S.picks.length / st.steps.length * 100) + '%"></span></div>' +
      '<span class="eyebrow">' + esc(st.title) + ' · שלב <span class="num">' + (S.step + 1) + '/' + st.steps.length + '</span></span>' +
      '<p class="story-text">' + esc(step.text) + '</p><div class="options">';
    S.order[S.step].forEach((k, pos) => {
      const c = step.choices[k];
      let cls = 'opt';
      if (picked !== undefined) cls += k === picked ? (c.good ? ' right' : ' wrong') : (c.good ? ' right dim-r' : ' dim');
      html += '<button type="button" class="' + cls + '" data-sk="' + k + '"' + (picked !== undefined ? ' disabled' : '') + '><span class="letter">' + LETTERS[pos] + '</span><span>' + esc(c.t) + '</span><span></span></button>';
    });
    html += '</div>';
    if (picked !== undefined) {
      const c = step.choices[picked];
      html += '<div class="feedback ' + (c.good ? 'right' : 'wrong') + '" id="fb" tabindex="-1" role="status"><strong>' + (c.good ? 'בחירה טובה' : 'מה קרה') + '</strong><p>' + esc(c.r) + '</p>' +
        (c.good ? '' : '<p class="small"><strong>הבחירה הטובה:</strong> ' + esc(step.choices.find(x => x.good).t) + '</p>') + '</div>' +
        '<button type="button" class="btn block big" id="snext">' + (S.step === st.steps.length - 1 ? 'לסוף הסיפור' : 'המשך') + '</button>';
    }
    render(html, 'home', st.title);
    if (picked === undefined) {
      view.querySelectorAll('[data-sk]').forEach(b => b.addEventListener('click', () => {
        const k = Number(b.dataset.sk);
        S.picks[S.step] = k;
        if (step.choices[k].good) { sfx('right'); buzz(20); } else { sfx('wrong'); buzz([40, 50, 40]); }
        drawStory();
        const fb = document.getElementById('fb');
        if (fb) { fb.focus({ preventScroll: true }); fb.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
      }));
    } else {
      document.getElementById('snext').addEventListener('click', () => {
        if (S.step < st.steps.length - 1) { S.step++; drawStory(); }
        else finishStory();
      });
    }
  }
  function finishStory() {
    const S = story, st = S.st;
    S.done = true;
    const good = S.picks.filter((k, i) => st.steps[i].choices[k].good).length;
    const res = award(() => {
      state.stories = state.stories || {};
      state.stories[st.id] = Math.max(state.stories[st.id] || 0, good);
      markActive();
    });
    const k = starsFor(good, st.steps.length);
    render('<section class="card result"><span class="eyebrow">' + esc(st.title) + '</span>' + stars(k, 'big pop') +
      '<div class="score num">' + good + '<span>/' + st.steps.length + '</span></div><p>בחירות טובות</p>' +
      '<div class="xpgain"><bdi dir="ltr" class="num">+' + res.gained + ' XP</bdi></div>' +
      (res.gained ? '' : '<p class="muted small">XP בסיפור ניתן על שיפור התוצאה הכי טובה.</p>') + '</section>' +
      '<section class="card"><h2>מה היה בסיפור</h2><p class="small">הנושאים שתרגלתם: ' + st.topics.map(t => esc(shortTopic(t))).join(', ') + '.</p></section>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="sagain">לשחק שוב</button><a class="btn" href="#stories">לסיפור אחר</a></div>', 'home', 'סוף הסיפור');
    document.getElementById('sagain').addEventListener('click', () => { story = null; startStory(st.id); });
    sfx('done'); celebrate(res); if (k === 3) confetti();
  }

  /* ================= journal ================= */
  function addJournal(text, ref) {
    text = (text || '').trim();
    if (!text) return null;
    return award(() => {
      state.journal = state.journal || [];
      state.journal.unshift({ d: today(), ref: ref || '', text: text.slice(0, 2000) });
    });
  }
  function refLabel(ref) {
    if (!ref) return '';
    if (/^L\d+$/.test(ref)) { const L = lesson(Number(ref.slice(1))); return L ? 'משימת שלב ' + L.n + ': ' + L.title : ''; }
    const c = cardById(ref);
    return c ? 'משימת שטח: ' + topicName(c.topic) : '';
  }
  function viewJournal() {
    const list = state.journal || [];
    const fmt = d => d.split('-').reverse().join('.');
    render(backLink('#progress', 'לפרופיל') +
      '<div class="lesson-head"><h1>היומן שלי</h1><p class="muted">מה קרה כשניסיתם את המשימות בחיים. כמה מילים מספיקות. נשמר רק בטלפון הזה.</p></div>' +
      '<section class="card"><label for="jr-new"><strong>רשומה חדשה</strong></label><textarea id="jr-new" class="jr" rows="4" placeholder="למשל: שאלתי את דנה שאלת המשך על הטיול, והיא דיברה עשר דקות."></textarea>' +
      '<button type="button" class="btn" id="jr-save">שמירה ביומן</button></section>' +
      (list.length ? '<ul class="journal">' + list.map((j, i) => '<li class="card"><span class="muted small">' + fmt(j.d) + (j.ref ? ' · ' + esc(refLabel(j.ref)) : '') + '</span><p>' + esc(j.text) + '</p><button type="button" class="btn ghost small-btn" data-jdel="' + i + '">מחיקה</button></li>').join('') + '</ul>'
        : '<p class="muted center">עוד אין רשומות.</p>'),
      'progress', 'יומן');
    document.getElementById('jr-save').addEventListener('click', () => {
      const res = addJournal(document.getElementById('jr-new').value);
      if (res) { toast('<span>נשמר ביומן.</span>'); celebrate(res); viewJournal(); }
    });
    view.querySelectorAll('[data-jdel]').forEach(b => b.addEventListener('click', () => {
      state.journal.splice(Number(b.dataset.jdel), 1); save(); viewJournal();
    }));
  }

  /* ================= backup ================= */
  function exportCode() {
    const json = JSON.stringify(state);
    return 'BL1.' + btoa(unescape(encodeURIComponent(json)));
  }
  function importCode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    if (!code.startsWith('BL1.')) throw new Error('format');
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.slice(4)))));
    if (!obj || typeof obj !== 'object' || !obj.lessons || !Array.isArray(obj.days)) throw new Error('content');
    return Object.assign(blankState(), obj);
  }
  function copyText(text, el) {
    const done = () => toast('<span>הועתק.</span>');
    const fallback = () => { if (el) { el.focus(); el.select(); } toast('<span>סמנו והעתיקו ידנית.</span>'); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  function backupSection() {
    return '<section class="card" id="backup"><h2>גיבוי והעברה לטלפון אחר</h2>' +
      '<p class="small">ההתקדמות נשמרת רק בדפדפן הזה. העתיקו את קוד הגיבוי ושמרו אותו (למשל בהודעה לעצמכם). בטלפון אחר, הדביקו אותו כאן ולחצו "שחזור".</p>' +
      '<div class="btn-row"><button type="button" class="btn" id="bk-copy">העתקת קוד גיבוי</button></div>' +
      '<textarea id="bk-out" class="jr mono" rows="3" readonly hidden></textarea>' +
      '<label for="bk-in" class="small"><strong>שחזור מקוד</strong></label><textarea id="bk-in" class="jr mono" rows="3" placeholder="הדביקו כאן קוד שמתחיל ב-BL1."></textarea>' +
      '<button type="button" class="btn secondary" id="bk-load">שחזור</button>' +
      '<div class="confirm" id="bk-confirm" hidden><p><strong>להחליף את כל ההתקדמות בטלפון הזה בהתקדמות מהקוד?</strong> מה שיש עכשיו יימחק.</p><div class="btn-row"><button type="button" class="btn danger" id="bk-yes">כן, לשחזר</button><button type="button" class="btn secondary" id="bk-no">ביטול</button></div></div>' +
      '<p class="small" id="bk-msg" role="status"></p></section>';
  }
  function bindBackup() {
    let pending = null;
    const out = document.getElementById('bk-out');
    document.getElementById('bk-copy').addEventListener('click', () => {
      const code = exportCode();
      out.value = code; out.hidden = false;
      copyText(code, out);
    });
    document.getElementById('bk-load').addEventListener('click', () => {
      const msg = document.getElementById('bk-msg');
      try { pending = importCode(document.getElementById('bk-in').value); msg.textContent = ''; document.getElementById('bk-confirm').hidden = false; }
      catch (e) { msg.textContent = 'הקוד לא תקין. ודאו שהעתקתם את כולו, מ-BL1. ועד הסוף.'; }
    });
    document.getElementById('bk-no').addEventListener('click', () => { pending = null; document.getElementById('bk-confirm').hidden = true; });
    document.getElementById('bk-yes').addEventListener('click', () => {
      if (!pending) return;
      state = pending; state.onboarded = true; session = null; save();
      toast('<span>ההתקדמות שוחזרה.</span>');
      location.hash = '#home'; route();
    });
  }

  /* ================= reminder ================= */
  function reminderSection() {
    const t = state.remindAt || '20:00';
    return '<section class="card"><h2>תזכורת יומית</h2>' +
      '<p class="small">בחרו שעה, והוסיפו תזכורת חוזרת ליומן שלכם. כך גם לא תשברו את הרצף.</p>' +
      '<label class="time-row" for="rm-time"><span>שעה</span><input type="time" id="rm-time" value="' + t + '"></label>' +
      '<div class="btn-row"><a class="btn" id="rm-google" href="#" target="_blank" rel="noopener">הוספה ליומן גוגל</a><a class="btn secondary" id="rm-ics" href="#" download="tizkoret-safat-guf.ics">קובץ ליומן (אייפון ואחרים)</a></div>' +
      '<p class="muted small">אם הקובץ לא יורד, השתמשו בכפתור של יומן גוגל.</p></section>';
  }
  function bindReminder() {
    const inp = document.getElementById('rm-time');
    const g = document.getElementById('rm-google');
    const ics = document.getElementById('rm-ics');
    function update() {
      const [hh, mm] = (inp.value || '20:00').split(':');
      state.remindAt = hh + ':' + mm; save();
      const d = new Date(); d.setDate(d.getDate() + 1);
      const ymd = keyOf(d).replace(/-/g, '');
      const start = ymd + 'T' + hh + mm + '00';
      const endD = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(hh), Number(mm) + 10);
      const end = keyOf(endD).replace(/-/g, '') + 'T' + String(endD.getHours()).padStart(2, '0') + String(endD.getMinutes()).padStart(2, '0') + '00';
      const title = 'שפת גוף: השלב של היום';
      const details = 'חמש דקות: שלב, פיד או סבב בזק.' + (/^https:/.test(location.href) && !/claude/.test(location.host) ? ' ' + location.origin + location.pathname : '');
      g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&details=' + encodeURIComponent(details) + '&dates=' + start + '/' + end + '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY');
      const icsText = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//safat-guf//he', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@safat-guf', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART:' + start, 'DTEND:' + end, 'RRULE:FREQ=DAILY', 'SUMMARY:' + title, 'DESCRIPTION:' + details,
        'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      ics.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText);
    }
    inp.addEventListener('change', update);
    update();
  }

  /* ================= certificate ================= */
  function viewCertificate() {
    if (doneCount() < TOTAL && !state.previewAll) return viewLocked('התעודה מחכה לכם בסוף שלב 30.');
    const xp = computeXP(state), L = levelInfo(xp);
    const recs = Object.values(state.lessons);
    const starsTotal = recs.reduce((s, r) => s + starsFor(r.best, 3), 0);
    const lastDone = recs.map(r => r.done).sort().pop() || today();
    render(backLink('#progress', 'לפרופיל') +
      '<label for="cert-name" class="small"><strong>השם שיופיע בתעודה</strong></label><input id="cert-name" class="text-in" value="' + esc(state.name || '') + '" placeholder="השם שלכם">' +
      '<section class="cert" aria-label="תעודת סיום">' +
        '<div class="cert-mark">' + ICON.mark.replace('brand-mark', 'cert-logo') + '</div>' +
        '<span class="eyebrow">תעודת סיום</span>' +
        '<h1 id="cert-n">' + esc(state.name || 'השם שלכם') + '</h1>' +
        '<p>השלימו את המסלול <strong>שפת גוף ב-30 יום</strong>: 30 שלבים בקריאת אנשים, הקשבה ותקשורת.</p>' +
        '<div class="cert-stats"><span><b class="num">' + starsTotal + '</b>כוכבים</span><span><b class="num">' + L.n + '</b>רמה</span><span><b class="num">' + xp + '</b>XP</span></div>' +
        '<p class="cert-motto">סבירות, לא ודאות. וכשלא בטוחים, שואלים.</p>' +
        '<p class="muted small num">' + lastDone.split('-').reverse().join('.') + '</p>' +
      '</section>' +
      '<p class="muted small center">צלמו את המסך כדי לשמור או לשתף.</p>', 'progress', 'תעודה');
    const inp = document.getElementById('cert-name');
    inp.addEventListener('input', () => { state.name = inp.value.slice(0, 40); save(); document.getElementById('cert-n').textContent = state.name || 'השם שלכם'; });
  }

  /* ================= challenge a friend ================= */
  function shareChallenge(score) {
    const link = /^https:/.test(location.href) && !/claude/.test(location.host) ? ' ' + location.origin + location.pathname + '#blitz' : '';
    const text = 'השגתי ' + score + ' נקודות בסבב הבזק של "שפת גוף ב-30 יום". נסו לשבור את השיא שלי!' + link;
    if (navigator.share) {
      navigator.share({ text }).catch(() => copyText(text));
    } else copyText(text);
  }

  /* ================= onboarding ================= */
  const WELCOME = [
    { h: 'שפת גוף ב-30 יום', p: 'משחק קצר בכל יום: לקרוא אנשים טוב יותר, להקשיב טוב יותר, ולתקשר טוב יותר. שלב חדש נפתח כל יום.', ic: 'eye' },
    { h: 'שלב, מבחן, משימה', p: 'כל שלב הוא חמש דקות קריאה, מבחן קצר, ומשימה קטנה לעשות בחיים האמיתיים. על הכל מקבלים XP, כוכבים והישגים.', ic: 'star' },
    { h: 'פיד, בזק וסיפורים', p: 'רוצים עוד? גוללים בפיד כרטיסים קצרים, משחקים סבב בזק של 60 שניות, או עוברים סיפור שמתקדם לפי הבחירות שלכם.', ic: 'bolt' },
    { h: 'כלל אחד חשוב', p: 'שפת גוף נותנת סבירות, לא ודאות. אין סימן אחד לשקר. כשלא בטוחים, שואלים.', ic: 'shield' }
  ];
  let welcomeStep = 0;
  function viewWelcome() {
    const w = WELCOME[welcomeStep], last = welcomeStep === WELCOME.length - 1;
    render('<section class="welcome">' +
      '<span class="welcome-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH[w.ic] + '</svg></span>' +
      '<h1>' + w.h + '</h1><p>' + w.p + '</p>' +
      '<div class="dots" aria-hidden="true">' + WELCOME.map((_, k) => '<span class="' + (k === welcomeStep ? 'cur' : (k < welcomeStep ? 'right' : '')) + '"></span>').join('') + '</div>' +
      (last ? '<label class="check" for="wl-sound"><input type="checkbox" id="wl-sound"' + (state.sound ? ' checked' : '') + '> צלילים ורטט</label>' : '') +
      '<button type="button" class="btn big block" id="wl-next">' + (last ? 'יאללה, מתחילים' : 'הבא') + '</button>' +
      (last ? '' : '<button type="button" class="btn ghost" id="wl-skip">דלגו</button>') +
      '</section>', 'home', 'ברוכים הבאים');
    const finish = () => { state.onboarded = true; save(); welcomeStep = 0; location.hash = '#home'; route(); };
    document.getElementById('wl-next').addEventListener('click', () => {
      if (last) { const c = document.getElementById('wl-sound'); state.sound = c.checked; finish(); }
      else { welcomeStep++; viewWelcome(); }
    });
    const sk = document.getElementById('wl-skip');
    if (sk) sk.addEventListener('click', finish);
  }

  /* ================= home extras ================= */
  function moreBlock() {
    const due = dueMistakes().length;
    return (due ? '<a class="card linkcard mistakes-card" href="#mistakes">' + ICON.bolt + '<span><strong>חזרה על טעויות</strong><br><span class="muted small">' + due + ' שאלות שטעיתם בהן מחכות לכם היום</span></span></a>' : '') +
      '<a class="card linkcard learn-cta" href="#learn"><span class="story-ic sim-ic">' + ICON.chat + '</span><span><strong>תרגול</strong><br><span class="muted small">הדמיות שיחה, ארגז כלים, סיפורים, סבב בזק ואימון</span></span></a>';
  }

  /* ================= toolbox ================= */
  let toolCat = 'all';
  function viewTools() {
    const tools = window.TOOLS || [];
    const cats = window.TOOL_CATS || {};
    const tried = state.toolsTried || {};
    const list = tools.filter(t => toolCat === 'all' || t.cat === toolCat);
    const ul = (arr, cls) => '<ul class="' + cls + '">' + arr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    render(backLink('#home', 'לדף הבית') +
      '<div class="lesson-head"><h1>ארגז כלים</h1><p class="muted">' + tools.length + ' מצבים מהחיים: מה עושים עם הגוף ומה אומרים, במשפטים שאפשר להשתמש בהם כבר היום. ניסיתם כלי? סמנו אותו וקבלו XP.</p></div>' +
      '<div class="topic-chips" role="group" aria-label="סינון לפי נושא">' +
        '<button type="button" class="tchip' + (toolCat === 'all' ? ' on' : '') + '" data-cat="all">הכל</button>' +
        Object.keys(cats).map(k => '<button type="button" class="tchip' + (toolCat === k ? ' on' : '') + '" data-cat="' + k + '">' + esc(cats[k]) + '</button>').join('') +
      '</div>' +
      '<div class="tool-list">' + list.map(t => '<details class="tool" id="tool-' + t.id + '">' +
        '<summary><span class="tool-title">' + esc(t.title) + '</span>' + (tried[t.id] ? '<span class="chip ok">ניסיתי</span>' : '<span class="chip">' + esc(cats[t.cat] || '') + '</span>') + '</summary>' +
        '<div class="tool-body">' +
          '<h3>מה אומרים</h3><div class="say-list">' + t.say.map((x, k) => '<div class="say"><span>' + esc(x) + '</span><button type="button" class="say-copy" data-copy="' + t.id + ':' + k + '" aria-label="העתקה">' + ICON.copy + '</button></div>').join('') + '</div>' +
          '<h3>מה עושים עם הגוף</h3>' + ul(t.body, 'tool-ul') +
          '<h3>ממה להימנע</h3>' + ul(t.avoid, 'tool-ul avoid') +
          '<p class="tool-why"><strong>למה זה עובד: </strong>' + esc(t.why) + '</p>' +
          (tried[t.id] ? '<p class="fdone">' + ICON.check + ' ניסיתם את זה</p>'
            : '<button type="button" class="btn" data-tried="' + t.id + '">ניסיתי את זה בחיים <bdi dir="ltr">+' + XP.tool + ' XP</bdi></button>') +
        '</div></details>').join('') + '</div>',
      'home', 'ארגז כלים');
    view.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { toolCat = b.dataset.cat; viewTools(); }));
    view.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      const [id, k] = b.dataset.copy.split(':');
      const t = tools.find(x => x.id === id);
      copyText(t.say[Number(k)].replace(/^"|"$/g, '').replace(/"\s*\(.*\)$/, ''));
    }));
    view.querySelectorAll('[data-tried]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.tried;
      const res = award(() => { state.toolsTried = state.toolsTried || {}; state.toolsTried[id] = today(); markActive(); });
      sfx('right'); buzz(20);
      toast('<bdi dir="ltr" class="toast-xp num">+' + res.gained + ' XP</bdi><span>כל הכבוד. רוצים לכתוב ביומן מה קרה?</span>');
      celebrate(res);
      viewTools();
      const el = document.getElementById('tool-' + id);
      if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); }
    }));
  }

  /* ================= conversation simulator ================= */
  let sim = null;
  const MOOD_STEP = { good: 15, ok: 0, bad: -15 };
  function viewSims() {
    const list = window.SIMS || [];
    const best = state.sims || {};
    render(backLink('#home', 'לדף הבית') +
      '<div class="lesson-head"><h1>הדמיית שיחה</h1><p class="muted">שיחה אמיתית, תור אחרי תור. בוחרים מה לענות, רואים איך הצד השני מגיב, ואם טעיתם מקבלים תיקון: מה עדיף להגיד ולמה. אפשר לנסות שוב כל תור.</p></div>' +
      list.map(s => '<a class="card linkcard story-card" href="#sim-' + s.id + '"><span class="story-ic sim-ic">' + ICON.chat + '</span><span><strong>' + esc(s.title) + '</strong><br><span class="muted small">' + esc(s.topic) + ' · ' + esc(s.who) + ', ' + esc(s.role) + '</span></span>' +
        (best[s.id] === undefined ? '<span class="chip accent">חדש</span>' : '<span class="chip ok num">' + best[s.id] + '/' + s.turns.length + '</span>') + '</a>').join(''),
      'home', 'הדמיית שיחה');
  }
  function startSim(id) {
    const s = (window.SIMS || []).find(x => x.id === id);
    if (!s) return viewSims();
    if (!sim || sim.id !== id || sim.done) sim = { id, s, turn: 0, picks: [], first: [], fixes: 0, mood: 50, order: s.turns.map(t => shuffle(t.choices.map((_, k) => k))) };
    drawSim();
  }
  function moodLabel(m) { return m >= 70 ? 'השיחה זורמת' : m >= 40 ? 'השיחה ניטרלית' : 'השיחה מתוחה'; }
  function drawSim() {
    const S = sim, s = S.s;
    let html = backLink('#sims', 'לכל ההדמיות') +
      '<div class="sim-head"><div><strong>' + esc(s.who) + '</strong><span class="muted small"> · ' + esc(s.role) + '</span></div>' +
      '<div class="mood" aria-label="' + moodLabel(S.mood) + '"><span class="mood-bar"><span style="width:' + S.mood + '%"></span></span><span class="small">' + moodLabel(S.mood) + '</span></div></div>' +
      '<p class="sim-intro">' + esc(s.intro) + '</p><div class="chat">';
    for (let k = 0; k <= Math.min(S.turn, s.turns.length - 1); k++) {
      const t = s.turns[k];
      html += '<div class="bub them">' + esc(t.them) + '</div>' + (t.cue ? '<div class="cue">' + ICON.eye + esc(t.cue) + '</div>' : '');
      const p = S.picks[k];
      if (p !== undefined) {
        const c = t.choices[p];
        html += '<div class="bub me">' + esc(c.t) + '</div><div class="bub them reply">' + esc(c.reply) + '</div>';
        if (k === S.turn) {
          const good = t.choices.find(x => x.q === 'good');
          html += '<div class="feedback ' + (c.q === 'good' ? 'right' : 'wrong') + '" id="fb" tabindex="-1" role="status">' +
            '<strong>' + (c.q === 'good' ? 'תשובה טובה' : c.q === 'ok' ? 'לא רע, אבל אפשר טוב יותר' : 'זה החמיר את השיחה') + '</strong><p>' + esc(c.why) + '</p>' +
            (c.q === 'good' ? '' : '<div class="fix"><span class="fix-l">תיקון: מה עדיף להגיד</span><div class="bub me good">' + esc(good.t) + '</div><p class="small">' + esc(good.why) + '</p></div>') + '</div>' +
            '<div class="btn-row">' + (c.q === 'good' ? '' : '<button type="button" class="btn secondary" id="sim-retry">לנסות שוב את התור</button>') +
            '<button type="button" class="btn" id="sim-next">' + (S.turn === s.turns.length - 1 ? 'לסיכום' : 'המשך') + '</button></div>';
        }
      }
    }
    html += '</div>';
    if (S.picks[S.turn] === undefined) {
      html += '<p class="eyebrow">מה עונים?</p><div class="options">';
      S.order[S.turn].forEach((k, pos) => {
        html += '<button type="button" class="opt" data-sim="' + k + '"><span class="letter">' + LETTERS[pos] + '</span><span>' + esc(s.turns[S.turn].choices[k].t) + '</span><span></span></button>';
      });
      html += '</div>';
    }
    render(html, 'home', s.title);
    const fb = document.getElementById('fb');
    if (fb) fb.scrollIntoView({ block: 'start' });
    else { const last = view.querySelector('.chat > :last-child'); if (last && S.turn > 0) last.scrollIntoView({ block: 'center' }); }
    view.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => {
      const k = Number(b.dataset.sim);
      const q = s.turns[S.turn].choices[k].q;
      S.picks[S.turn] = k;
      if (S.first[S.turn] === undefined) S.first[S.turn] = k;
      S.mood = Math.max(0, Math.min(100, S.mood + MOOD_STEP[q]));
      if (q === 'good') { sfx('right'); buzz(20); } else if (q === 'bad') { sfx('wrong'); buzz([40, 50, 40]); } else sfx('tick');
      drawSim();
    }));
    const rt = document.getElementById('sim-retry');
    if (rt) rt.addEventListener('click', () => {
      const q = s.turns[S.turn].choices[S.picks[S.turn]].q;
      S.mood = Math.max(0, Math.min(100, S.mood - MOOD_STEP[q]));
      S.picks[S.turn] = undefined;
      S.fixes++;
      S.order[S.turn] = shuffle(S.order[S.turn]);
      drawSim();
    });
    const nx = document.getElementById('sim-next');
    if (nx) nx.addEventListener('click', () => { if (S.turn < s.turns.length - 1) { S.turn++; drawSim(); } else finishSim(); });
  }
  function finishSim() {
    const S = sim, s = S.s;
    S.done = true;
    const good = S.first.filter((p, k) => s.turns[k].choices[p].q === 'good').length;
    const res = award(() => { state.sims = state.sims || {}; state.sims[s.id] = Math.max(state.sims[s.id] || 0, good); markActive(); });
    const k = starsFor(good, s.turns.length);
    const lessons = s.turns.map((t, i) => {
      const c = t.choices[S.first[i]], g = t.choices.find(x => x.q === 'good');
      return '<li class="' + (c.q === 'good' ? 'r' : 'w') + '">' + (c.q === 'good' ? ICON.check : ICON.cross) + '<span><strong>' + esc(t.them) + '</strong><br><span class="muted">הכי טוב: ' + esc(g.t) + '</span></span></li>';
    }).join('');
    render('<section class="card result"><span class="eyebrow">' + esc(s.title) + '</span>' + stars(k, 'big pop') +
      '<div class="score num">' + good + '<span>/' + s.turns.length + '</span></div><p>תשובות טובות בניסיון הראשון. ' + moodLabel(S.mood) + ' בסוף.' + (S.fixes ? ' תיקנתם ' + S.fixes + ' תורות, וזה בדיוק מה שהתיקון נועד לו, אבל הציון וה-XP נספרים לפי הניסיון הראשון.' : '') + '</p>' +
      '<div class="xpgain"><bdi dir="ltr" class="num">+' + res.gained + ' XP</bdi></div>' +
      (res.gained ? '' : '<p class="muted small">XP בהדמיה ניתן על שיפור התוצאה הכי טובה.</p>') + '</section>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="sim-again">לשחק שוב מההתחלה</button><a class="btn" href="#sims">להדמיה אחרת</a></div>' +
      '<section class="section"><h2>מה כדאי לזכור</h2><ul class="recap">' + lessons + '</ul></section>', 'home', 'סוף ההדמיה');
    document.getElementById('sim-again').addEventListener('click', () => { sim = null; startSim(s.id); });
    sfx('done'); celebrate(res); if (k === 3 && !S.fixes) confetti();
  }

  /* ================= feed formats: spot the moment, put in order ================= */
  const stepOrders = {};
  function stepOrder(c) { if (!stepOrders[c.id]) stepOrders[c.id] = shuffle(c.steps.map((_, k) => k)); return stepOrders[c.id]; }
  function spotHtml(c, done) {
    let h = '<p class="fstatement sm">באיזו שורה השיחה השתבשה?</p><div class="chat spot">';
    c.lines.forEach((ln, k) => {
      const me = ln[0] === 'אתם';
      let cls = 'bub ' + (me ? 'me' : 'them');
      if (done) { if (k === c.bad) cls += ' badline'; else if (k === done.p) cls += ' picked'; }
      h += '<button type="button" class="' + cls + '" data-act="spot" data-k="' + k + '"' + (done ? ' disabled' : '') + '><span class="who">' + esc(ln[0]) + '</span>' + esc(ln[1]) + '</button>';
    });
    h += '</div>';
    if (done) h += feedFeedback(done.r === 'right', c.explain) + '<div class="fix"><span class="fix-l">תיקון: מה עדיף להגיד</span><div class="bub me good">' + esc(c.better) + '</div></div>';
    return h;
  }
  function orderHtml(c, done) {
    let h = '<p class="fstatement sm">' + esc(c.title) + ': סדרו את השלבים</p>';
    if (done) {
      h += '<ol class="order-done">' + c.steps.map((st, k) => '<li class="' + ((done.p || [])[k] === k ? 'ok' : 'no') + '">' + esc(st) + '</li>').join('') + '</ol>';
      h += feedFeedback(done.r === 'right', (done.r === 'right' ? '' : 'זה הסדר הנכון. ') + c.explain);
    } else {
      h += '<ol class="order-picked" data-picked=""></ol><div class="order-pool">' +
        stepOrder(c).map(k => '<button type="button" class="ochip" data-act="ostep" data-k="' + k + '">' + esc(c.steps[k]) + '</button>').join('') + '</div>' +
        '<button type="button" class="btn ghost small-btn" data-act="oreset">להתחיל מחדש</button>';
    }
    return h;
  }

  /* ================= topic stats (weak spots) ================= */
  function topicOfQid(qid) {
    const m = /^[LH](\d+)-/.exec(qid || '');
    if (m) return Number(m[1]);
    const c = cardById(qid);
    return c ? c.topic : null;
  }
  function recordTopic(qid, ok) {
    const t = topicOfQid(qid);
    if (t === null || t === undefined) return;
    state.topicStats = state.topicStats || {};
    const r = state.topicStats[t] || [0, 0];
    state.topicStats[t] = [r[0] + (ok ? 1 : 0), r[1] + 1];
    save();
  }
  function weakTopics(limit) {
    const st = state.topicStats || {};
    return Object.keys(st).map(k => ({ t: /^\d+$/.test(k) ? Number(k) : k, right: st[k][0], total: st[k][1] }))
      .filter(x => x.total >= 3 && x.right / x.total < 0.8)
      .sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total)
      .slice(0, limit || 5);
  }
  function weakBlock(limit) {
    const list = weakTopics(limit);
    const st = state.topicStats || {};
    const answered = Object.values(st).reduce((s, r) => s + r[1], 0);
    let body;
    if (!list.length) {
      body = answered < 15
        ? '<p class="muted small">אחרי שתענו על עוד כמה שאלות (בשלבים, בפיד ובאימון), כאן יופיעו הנושאים שהכי קשים לכם.</p>'
        : '<p class="small">אין כרגע נושא שבו אתם מתחת ל-80%. יפה מאוד.</p>';
    } else {
      body = '<ul class="weak">' + list.map(x => {
        const pct = Math.round(x.right / x.total * 100);
        const open = topicOpen(x.t);
        return '<li><span class="weak-name">' + esc(shortTopic(x.t)) + '<span class="muted small num"> · ' + x.right + '/' + x.total + '</span></span>' +
          '<span class="weak-bar"><span style="width:' + pct + '%"></span></span><b class="num">' + pct + '%</b>' +
          (open ? '<a class="btn secondary small-btn" href="#practice-' + x.t + '">אימון</a>' : '<span></span>') + '</li>';
      }).join('') + '</ul>';
    }
    return '<section class="card"><h2>הנושאים שהכי קשים לי</h2>' + body + '</section>';
  }

  /* ================= practice hub ================= */
  function viewLearn() {
    const due = dueMistakes().length;
    const sims = window.SIMS || [], sts = window.STORIES || [], tools = window.TOOLS || [];
    const simDone = Object.keys(state.sims || {}).length, stDone = Object.keys(state.stories || {}).length, toolsTried = Object.keys(state.toolsTried || {}).length;
    const item = (href, ic, title, sub, cls) => '<a class="card linkcard hub-item' + (cls ? ' ' + cls : '') + '" href="' + href + '"><span class="story-ic">' + ic + '</span><span><strong>' + title + '</strong><br><span class="muted small">' + sub + '</span></span></a>';
    render('<div class="lesson-head"><h1>תרגול</h1><p class="muted">כל דרכי התרגול במקום אחד.</p></div>' +
      (due ? item('#mistakes', ICON.bolt, 'חזרה על טעויות', due + ' שאלות מחכות לכם היום', 'mistakes-card') : '') +
      item('#sims', ICON.chat, 'הדמיית שיחה', sims.length + ' שיחות עם תיקון על כל טעות · עשיתם ' + simDone, 'sim-card') +
      item('#tools', ICON.book, 'ארגז כלים', tools.length + ' מצבים: מה להגיד ומה לעשות · ניסיתם ' + toolsTried, 'tools-card') +
      item('#stories', ICON.book, 'סיפורים', sts.length + ' סיפורים שמתקדמים לפי הבחירות · עשיתם ' + stDone) +
      item('#blitz', ICON.bolt, 'סבב בזק', '60 שניות של מיתוס או עובדה · שיא: ' + (state.blitz.best || 0)) +
      item('#practice', '<svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH.target + '</svg>', 'אימון לפי נושא', 'עד 10 שאלות בנושא שתבחרו, ו-9 מסלולים') +
      item('#journal', '<svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH.pen + '</svg>', 'היומן שלי', (state.journal || []).length + ' רשומות') +
      weakBlock(3),
      'learn', 'תרגול');
  }

  /* ================= router ================= */
  function route() {
    const h = (location.hash || '').replace(/^#/, '');
    let m;
    if (!state.onboarded) {
      if (doneCount() || Object.keys(state.feed || {}).length) { state.onboarded = true; save(); }
      else return viewWelcome();
    }
    if (h === '' || h === 'home') return viewHome();
    if (h === 'lessons') return viewLessons();
    if (h === 'progress') return viewProgress();
    if (h === 'feed') return viewFeed();
    if (h === 'saved') return viewSaved();
    if (h === 'blitz') return viewBlitz();
    if (h === 'practice') return viewPractice();
    if (h === 'tools') return viewTools();
    if (h === 'learn') return viewLearn();
    if (h === 'sims') return viewSims();
    if ((m = h.match(/^sim-([a-z]+)$/))) return startSim(m[1]);
    if (h === 'mistakes') return startQuiz('mistakes', 0);
    if (h === 'stories') return viewStories();
    if (h === 'journal') return viewJournal();
    if (h === 'certificate') return viewCertificate();
    if ((m = h.match(/^practice-([a-z0-9-]+)$/))) return startQuiz('practice', m[1]);
    if ((m = h.match(/^story-([a-z]+)$/))) return startStory(m[1]);
    if (h === 'final') return startQuiz('final', 0);
    if ((m = h.match(/^lesson-(\d+)(-ex)?$/))) return viewLesson(Number(m[1]), !!m[2]);
    if ((m = h.match(/^quiz-(\d+)$/)) && lesson(Number(m[1]))) return startQuiz('lesson', Number(m[1]));
    if ((m = h.match(/^review-([1-4])$/))) return startQuiz('review', Number(m[1]));
    return viewHome();
  }

  window.addEventListener('hashchange', route);
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && today() !== lastDay) {
      lastDay = today();
      if (!session || session.finished) route();
    }
  });
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { state = load(); route(); } });

  // Players who already finished things before the game layer existed shouldn't get a flood of toasts.
  if (!state.seenBadges.length) { state.seenBadges = earnedBadges(); if (state.seenBadges.length) save(); }

  route();
})();
