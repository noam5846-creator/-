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

  /* ---------------- storage ---------------- */
  function blankState() {
    return { v: 1, lessons: {}, reviews: {}, final: null, days: [], exercises: {}, previewAll: false };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blankState();
      const s = JSON.parse(raw);
      return Object.assign(blankState(), s);
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

  /* ---------------- dates ---------------- */
  function keyOf(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function today() { return keyOf(new Date()); }
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return keyOf(dt);
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
  function streaks() {
    const set = new Set(state.days);
    let cur = 0;
    let d = today();
    if (!set.has(d)) d = addDays(d, -1);
    while (set.has(d)) { cur++; d = addDays(d, -1); }
    let best = 0, run = 0, prev = null;
    state.days.forEach(k => {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    });
    return { cur, best, activeToday: set.has(today()) };
  }

  /* ---------------- progress rules ---------------- */
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
    const wk = WEEKS[w - 1];
    if (state.previewAll || lessonRec(wk.to)) return 'open';
    return 'locked';
  }
  function finalStatus() {
    if (state.final) return 'done';
    if (state.previewAll || lessonRec(TOTAL)) return 'open';
    return 'locked';
  }
  function weekOf(n) { return n <= 28 ? Math.ceil(n / 7) : 5; }

  function recordResult(kind, id, score, total) {
    const t = today();
    let bucket;
    if (kind === 'lesson') bucket = state.lessons;
    else if (kind === 'review') bucket = state.reviews;
    const prev = kind === 'final' ? state.final : bucket[id];
    const rec = prev
      ? Object.assign({}, prev, { last: score, best: Math.max(prev.best, score), attempts: prev.attempts + 1, total })
      : { done: t, first: score, last: score, best: score, attempts: 1, total };
    if (kind === 'final') state.final = rec; else bucket[id] = rec;
    markActive();
    save();
  }

  /* ---------------- helpers ---------------- */
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
    mark: '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="var(--accent)"/><path d="M7 17.5c2.6-4.4 5.6-6.5 9-6.5s6.4 2.1 9 6.5" fill="none" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="18" r="3.2" fill="var(--on-accent)"/></svg>'
  };

  const view = document.getElementById('view');
  function setTab(name) {
    document.querySelectorAll('.tabbar a').forEach(a => {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function render(html, tab, title) {
    view.innerHTML = html;
    setTab(tab);
    document.title = title ? title + ' · שפת גוף ב-30 יום' : 'שפת גוף ב-30 יום';
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  function backLink(href, label) {
    return '<a class="back" href="' + href + '">' + ICON.back + esc(label) + '</a>';
  }

  /* ---------------- home ---------------- */
  function streakChip() {
    const s = streaks();
    if (!s.cur) return '';
    const label = s.cur === 1 ? 'יום אחד ברצף' : s.cur + ' ימים ברצף';
    return '<span class="chip streak" title="רצף ימי לימוד">' + ICON.flame + '<span class="num">' + label + '</span></span>';
  }

  function scaleBlock() {
    return '<section class="card" aria-labelledby="scale-h">' +
      '<h2 id="scale-h">סבירות, לא ודאות</h2>' +
      '<div class="scale">' +
        '<div class="scale-wrap"><div class="scale-bar" role="img" aria-label="סרגל סבירות: סימנים מזיזים את המחוג לכיוון סביר, אבל לא מגיעים לוודאות"></div><div class="scale-needle"></div></div>' +
        '<div class="scale-labels"><span>ניחוש</span><span>סביר</span><span class="off">ודאות</span></div>' +
      '</div>' +
      '<p>שפת גוף מזיזה את המחוג, אבל אף פעם לא עד הסוף. סימן אחד כמעט לא אומר כלום, ואין סימן אחד לשקר. כשלא בטוחים, שואלים.</p>' +
    '</section>';
  }

  function trackBlock() {
    const next = nextLessonN();
    let cells = '';
    for (let n = 1; n <= TOTAL; n++) {
      const cls = lessonRec(n) ? 'done' : (n === next && lessonStatus(n) === 'open' ? 'now' : '');
      cells += '<span class="' + cls + '" title="שיעור ' + n + '"></span>';
    }
    return '<section class="track" aria-label="מסלול 30 השיעורים">' +
      '<div class="track-head"><h2>המסלול</h2><span class="muted small num">' + doneCount() + ' מתוך ' + TOTAL + ' שיעורים</span></div>' +
      '<div class="cells">' + cells + '</div>' +
    '</section>';
  }

  function pendingReviews() {
    const out = [];
    WEEKS.forEach(wk => { if (reviewStatus(wk.w) === 'open') out.push(wk.w); });
    return out;
  }

  function viewHome() {
    const next = nextLessonN();
    let todayCard;
    if (next === null) {
      todayCard = '<section class="today done">' +
        '<div class="bignum">30<small>מתוך 30</small></div>' +
        '<div class="body"><span class="eyebrow">סיימתם את המסלול</span><h1>כל 30 השיעורים מאחוריכם</h1>' +
        '<p class="muted">מה שנשאר זה תרגול. אפשר לחזור לכל שיעור, ולנסות את המבחן המסכם.</p></div>' +
        '<div class="actions">' +
          (finalStatus() === 'done'
            ? '<a class="btn" href="#final">לנסות שוב את המבחן המסכם</a>'
            : '<a class="btn" href="#final">למבחן המסכם: 12 שאלות</a>') +
          '<a class="btn secondary" href="#progress">לראות את ההתקדמות</a>' +
        '</div></section>';
    } else {
      const L = lesson(next);
      const st = lessonStatus(next);
      if (st === 'open') {
        todayCard = '<section class="today">' +
          '<div class="bignum">' + next + '<small>מתוך 30</small></div>' +
          '<div class="body"><span class="eyebrow">שיעור היום · שבוע ' + weekOf(next) + '</span><h1>' + esc(L.title) + '</h1>' +
          '<p class="muted">' + esc(L.tag) + '</p></div>' +
          '<div class="actions"><a class="btn block" href="#lesson-' + next + '">להתחיל את השיעור</a>' +
          '<span class="muted small" style="text-align:center">כחמש דקות קריאה, ואחריהן מבחן של 3 שאלות</span></div>' +
        '</section>';
      } else {
        const h = hoursToMidnight();
        const when = h <= 1 ? 'בעוד פחות משעה' : 'בעוד ' + h + ' שעות';
        const prev = lesson(next - 1);
        todayCard = '<section class="today done">' +
          '<div class="bignum">' + (next - 1) + '<small>הושלם</small></div>' +
          '<div class="body"><span class="eyebrow">סיימתם להיום</span><h1>מחר: ' + esc(L.title) + '</h1>' +
          '<p class="muted">השיעור הבא ייפתח בחצות, ' + when + '. בינתיים, התרגיל של היום מחכה לכם בחוץ.</p></div>' +
          '<div class="actions"><a class="btn secondary block" href="#lesson-' + prev.n + '">לחזור לתרגיל: ' + esc(prev.title) + '</a></div>' +
        '</section>';
      }
    }

    const reviews = pendingReviews().map(w =>
      '<section class="card review-card">' +
        '<span class="eyebrow">מבחן חזרה · שבוע ' + w + '</span>' +
        '<h2>7 שאלות על שיעורים ' + WEEKS[w - 1].from + '–' + WEEKS[w - 1].to + '</h2>' +
        '<p class="small">שאלה אחת מכל שיעור בשבוע, בסדר מעורבב. זה הזמן לבדוק מה נשאר.</p>' +
        '<a class="btn" href="#review-' + w + '">להתחיל את מבחן החזרה</a>' +
      '</section>').join('');

    const notice = storageOk ? '' : '<p class="card small">הדפדפן לא מאפשר לשמור נתונים, ולכן ההתקדמות לא תישמר אחרי סגירת הדף.</p>';

    render(
      '<div class="topline"><div class="brand">' + ICON.mark + '<span>שפת גוף ב-30 יום</span></div>' + streakChip() + '</div>' +
      todayCard + reviews + trackBlock() + scaleBlock() + notice,
      'home'
    );
  }

  /* ---------------- lessons list ---------------- */
  function lessonRow(n) {
    const L = lesson(n);
    const st = lessonStatus(n);
    const rec = lessonRec(n);
    let end = '';
    if (st === 'done') end = '<span class="chip ok num">' + rec.best + '/3</span>';
    else if (st === 'open') end = '<span class="chip accent">' + (n === nextLessonN() ? 'היום' : 'פתוח') + '</span>';
    else if (st === 'tomorrow') end = '<span class="chip">מחר</span>';
    else end = ICON.lock;
    const cls = 'row is-' + (st === 'tomorrow' ? 'locked' : st);
    const inner = '<span class="n">' + n + '</span><span class="t"><strong>' + esc(L.title) + '</strong><span>' + esc(L.tag) + '</span></span>' + end;
    if (st === 'done' || st === 'open') return '<li><a class="' + cls + '" href="#lesson-' + n + '">' + inner + '</a></li>';
    return '<li><div class="' + cls + '" aria-disabled="true">' + inner + '</div></li>';
  }
  function reviewRow(w) {
    const st = reviewStatus(w);
    const rec = state.reviews[w];
    let end = st === 'done' ? '<span class="chip ok num">' + rec.best + '/' + rec.total + '</span>'
      : st === 'open' ? '<span class="chip streak">מחכה</span>' : ICON.lock;
    const inner = '<span class="n">' + w + '</span><span class="t"><strong>מבחן חזרה שבועי</strong><span>7 שאלות מכל שיעורי השבוע</span></span>' + end;
    if (st === 'locked') return '<li><div class="row is-locked" aria-disabled="true">' + inner + '</div></li>';
    return '<li><a class="row is-review" href="#review-' + w + '">' + inner + '</a></li>';
  }
  function finalRow() {
    const st = finalStatus();
    const rec = state.final;
    let end = st === 'done' ? '<span class="chip ok num">' + rec.best + '/' + rec.total + '</span>'
      : st === 'open' ? '<span class="chip streak">פתוח</span>' : ICON.lock;
    const inner = '<span class="n">★</span><span class="t"><strong>מבחן מסכם</strong><span>12 שאלות מכל המסלול</span></span>' + end;
    if (st === 'locked') return '<li><div class="row is-locked" aria-disabled="true">' + inner + '</div></li>';
    return '<li><a class="row is-review" href="#final">' + inner + '</a></li>';
  }

  function viewLessons() {
    const groups = [
      { title: 'שבוע 1', sub: 'לקרוא נכון', from: 1, to: 7, w: 1 },
      { title: 'שבוע 2', sub: 'להקשיב ולברר', from: 8, to: 14, w: 2 },
      { title: 'שבוע 3', sub: 'לשדר ולספר', from: 15, to: 21, w: 3 },
      { title: 'שבוע 4', sub: 'אנשים ומצבים', from: 22, to: 28, w: 4 },
      { title: 'סיום', sub: 'כריזמה וסיכום', from: 29, to: 30, w: null }
    ];
    let html = '<div class="lesson-head"><h1>כל השיעורים</h1><p class="muted">שיעור חדש נפתח בכל יום, אחרי שמסיימים את המבחן של השיעור הקודם.</p></div>';
    groups.forEach(g => {
      let rows = '';
      for (let n = g.from; n <= g.to; n++) rows += lessonRow(n);
      rows += g.w ? reviewRow(g.w) : finalRow();
      html += '<section class="week"><div class="week-head"><h2>' + g.title + '</h2><span class="muted small">' + g.sub + '</span></div><ul class="list">' + rows + '</ul></section>';
    });
    if (state.previewAll) html += '<p class="reminder">מצב תצוגה מקדימה פעיל: כל השיעורים פתוחים. אפשר לכבות אותו במסך ההתקדמות.</p>';
    render(html, 'lessons', 'שיעורים');
  }

  /* ---------------- lesson ---------------- */
  function viewLocked(msg) {
    render(backLink('#lessons', 'כל השיעורים') +
      '<section class="card empty">' + ICON.lock.replace('class="lock"', 'class="lock" style="width:40px;height:40px;margin:0 auto"') +
      '<h1>עוד לא פתוח</h1><p>' + msg + '</p><a class="btn" href="#home">לדף הבית</a></section>', 'lessons', 'נעול');
  }

  function viewLesson(n) {
    const L = lesson(n);
    if (!L) return viewHome();
    const st = lessonStatus(n);
    if (st === 'locked') return viewLocked('שיעור ' + n + ' ייפתח אחרי שתסיימו את השיעורים שלפניו, אחד בכל יום.');
    if (st === 'tomorrow') return viewLocked('שיעור ' + n + ' ייפתח מחר. שיעור אחד ביום נותן זמן לתרגל את מה שלמדתם.');
    const rec = lessonRec(n);
    const exDone = !!state.exercises[n];

    const list = items => '<ul>' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';

    let html = backLink('#lessons', 'כל השיעורים') +
      '<header class="lesson-head"><span class="eyebrow">יום ' + n + ' מתוך 30 · ' + (n <= 28 ? 'שבוע ' + weekOf(n) : 'סיום') + '</span>' +
      '<h1>' + esc(L.title) + '</h1><p class="tag">' + esc(L.tag) + '</p></header>' +

      '<section class="section"><h2>הרעיון</h2><p>' + esc(L.idea) + '</p></section>' +

      '<section class="section"><h2>על מה להסתכל</h2><ul class="bullets">' + L.look.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></section>' +

      '<section class="section"><h2>מה זה אומר, ומה לא</h2><div class="pair">' +
        '<div class="yes"><h3>מה זה יכול לרמוז</h3>' + list(L.means) + '</div>' +
        '<div class="no"><h3>מה זה לא אומר</h3>' + list(L.not) + '</div>' +
      '</div></section>' +

      (L.science ? '<aside class="science"><span class="eyebrow">מה המחקר אומר</span><p>' + esc(L.science) + '</p></aside>' : '') +

      '<section class="section"><h2>דוגמה מהחיים</h2><blockquote class="example">' + esc(L.example) + '</blockquote></section>' +

      '<section class="exercise" aria-labelledby="ex-h"><h2 id="ex-h">התרגיל להיום</h2><p>' + esc(L.exercise) + '</p>' +
        '<label class="check" for="ex-' + n + '"><input type="checkbox" id="ex-' + n + '" data-ex="' + n + '"' + (exDone ? ' checked' : '') + '> עשיתי את התרגיל</label></section>' +

      (rec
        ? '<div class="card"><p><strong>השלמתם את השיעור.</strong> הציון הכי טוב שלכם במבחן: <span class="num">' + rec.best + '/3</span>.</p><a class="btn secondary" href="#quiz-' + n + '">לנסות שוב את המבחן</a></div>'
        : '<a class="btn block" href="#quiz-' + n + '">למבחן: 3 שאלות</a>') +

      '<p class="reminder">שפת גוף נותנת סבירות, לא ודאות.</p>';

    const prevOk = n > 1;
    const nextOk = n < TOTAL && ['done', 'open'].includes(lessonStatus(n + 1));
    if (prevOk || nextOk) {
      html += '<nav class="pager" aria-label="מעבר בין שיעורים">' +
        (prevOk ? '<a class="btn ghost" href="#lesson-' + (n - 1) + '">→ שיעור ' + (n - 1) + '</a>' : '<span></span>') +
        (nextOk ? '<a class="btn ghost" href="#lesson-' + (n + 1) + '">שיעור ' + (n + 1) + ' ←</a>' : '<span></span>') +
      '</nav>';
    }
    render(html, 'lessons', L.title);

    const cb = view.querySelector('[data-ex]');
    cb.addEventListener('change', () => {
      if (cb.checked) state.exercises[n] = today(); else delete state.exercises[n];
      save();
    });
  }

  /* ---------------- quiz ---------------- */
  let session = null;

  function buildQuestions(kind, id) {
    const toQ = (L, q) => ({
      q: q.q,
      e: q.e,
      from: L,
      opts: shuffle(q.o.map((text, i) => ({ text, correct: i === 0 })))
    });
    if (kind === 'lesson') {
      const L = lesson(id);
      return L.quiz.map(q => toQ(L, q));
    }
    if (kind === 'review') {
      const wk = WEEKS[id - 1];
      const out = [];
      for (let n = wk.from; n <= wk.to; n++) {
        const L = lesson(n);
        out.push(toQ(L, L.quiz[Math.floor(Math.random() * L.quiz.length)]));
      }
      return shuffle(out);
    }
    // final: 12 different lessons, one question each
    return shuffle(LESSONS).slice(0, 12).map(L => toQ(L, L.quiz[Math.floor(Math.random() * L.quiz.length)]));
  }

  function quizMeta(kind, id) {
    if (kind === 'lesson') return { label: 'מבחן · שיעור ' + id, title: lesson(id).title, back: '#lesson-' + id, backLabel: 'חזרה לשיעור' };
    if (kind === 'review') return { label: 'מבחן חזרה · שבוע ' + id, title: 'שיעורים ' + WEEKS[id - 1].from + '–' + WEEKS[id - 1].to, back: '#lessons', backLabel: 'כל השיעורים' };
    return { label: 'מבחן מסכם', title: 'כל המסלול', back: '#lessons', backLabel: 'כל השיעורים' };
  }

  function startQuiz(kind, id) {
    if (kind === 'lesson') {
      const st = lessonStatus(id);
      if (st === 'locked' || st === 'tomorrow') return viewLesson(id);
    } else if (kind === 'review') {
      if (reviewStatus(id) === 'locked') return viewLocked('מבחן החזרה של שבוע ' + id + ' ייפתח אחרי שתסיימו את שיעור ' + WEEKS[id - 1].to + '.');
    } else if (finalStatus() === 'locked') {
      return viewLocked('המבחן המסכם ייפתח אחרי שתסיימו את שיעור 30.');
    }
    if (!session || session.kind !== kind || session.id !== id || session.finished) {
      session = { kind, id, questions: buildQuestions(kind, id), i: 0, answers: [], finished: false };
    }
    drawQuiz();
  }

  function dotsHtml() {
    return '<div class="dots" aria-hidden="true">' + session.questions.map((_, k) => {
      const a = session.answers[k];
      const cls = a === undefined ? (k === session.i ? 'cur' : '') : (a ? 'right' : 'wrong');
      return '<span class="' + cls + '"></span>';
    }).join('') + '</div>';
  }

  function drawQuiz() {
    const s = session;
    const meta = quizMeta(s.kind, s.id);
    if (s.finished) return drawResult();
    const Q = s.questions[s.i];
    const answered = s.answers[s.i] !== undefined;
    const showFrom = s.kind !== 'lesson';

    let html = backLink(meta.back, meta.backLabel) +
      '<div class="qhead"><span class="eyebrow">' + esc(meta.label) + '</span>' + dotsHtml() + '</div>' +
      '<div class="section"><span class="muted small num">שאלה ' + (s.i + 1) + ' מתוך ' + s.questions.length + '</span>' +
      (showFrom ? '<span class="from">משיעור ' + Q.from.n + ': ' + esc(Q.from.title) + '</span>' : '') +
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
        '<strong>' + (ok ? 'נכון' : 'לא בדיוק') + '</strong><p>' + esc(Q.e) + '</p></div>' +
        '<button type="button" class="btn block" id="next">' + (last ? 'לתוצאה' : 'לשאלה הבאה') + '</button>';
    }

    render(html, 'lessons', meta.label);

    if (!answered) {
      view.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
        const k = Number(btn.dataset.k);
        s.picked = k;
        s.answers[s.i] = Q.opts[k].correct;
        drawQuiz();
        const fb = document.getElementById('fb');
        if (fb) { fb.focus({ preventScroll: true }); fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }));
    } else {
      document.getElementById('next').addEventListener('click', () => {
        if (s.i < s.questions.length - 1) { s.i++; s.picked = null; drawQuiz(); }
        else {
          s.finished = true;
          const score = s.answers.filter(Boolean).length;
          recordResult(s.kind, s.id, score, s.questions.length);
          drawResult();
        }
      });
    }
  }

  function drawResult() {
    const s = session;
    const meta = quizMeta(s.kind, s.id);
    const total = s.questions.length;
    const score = s.answers.filter(Boolean).length;
    const ratio = score / total;
    let msg;
    if (ratio === 1) msg = 'כל התשובות נכונות.';
    else if (ratio >= 0.6) msg = 'כמעט. שווה להציץ בהסברים של מה שפספסתם.';
    else msg = 'שווה לקרוא שוב את השיעור. ההסברים למטה יעזרו.';

    const recap = '<ul class="recap">' + s.questions.map((Q, k) => {
      const ok = s.answers[k];
      const right = Q.opts.find(o => o.correct).text;
      return '<li class="' + (ok ? 'r' : 'w') + '">' + (ok ? ICON.check : ICON.cross) +
        '<span><strong>' + esc(Q.q) + '</strong><br><span class="muted">' + esc(right) + '</span></span></li>';
    }).join('') + '</ul>';

    let actions = '';
    if (s.kind === 'lesson') {
      const n = s.id;
      const wkEnd = WEEKS.find(w => w.to === n);
      if (wkEnd && reviewStatus(wkEnd.w) === 'open') {
        actions += '<a class="btn" href="#review-' + wkEnd.w + '">למבחן החזרה של שבוע ' + wkEnd.w + '</a>';
      } else if (n === TOTAL && finalStatus() === 'open') {
        actions += '<a class="btn" href="#final">למבחן המסכם</a>';
      } else if (n < TOTAL && lessonStatus(n + 1) === 'open') {
        actions += '<a class="btn" href="#lesson-' + (n + 1) + '">לשיעור ' + (n + 1) + '</a>';
      } else if (n < TOTAL) {
        actions += '<a class="btn" href="#home">סיימתם להיום</a>';
      }
      actions += '<a class="btn secondary" href="#lesson-' + n + '">חזרה לשיעור</a>';
    } else {
      actions += '<a class="btn" href="#home">לדף הבית</a>';
    }
    actions += '<button type="button" class="btn secondary" id="again">לנסות שוב</button>';

    const nextNote = (s.kind === 'lesson' && s.id < TOTAL && lessonStatus(s.id + 1) === 'tomorrow')
      ? '<p class="muted small">השיעור הבא ייפתח מחר. עד אז, נסו את התרגיל של היום.</p>' : '';

    render(
      '<section class="card result"><span class="eyebrow">' + esc(meta.label) + '</span>' +
        '<div class="score">' + score + '<span>/' + total + '</span></div>' +
        '<p>' + msg + '</p>' + nextNote + '</section>' +
      '<div class="btn-row">' + actions + '</div>' +
      '<section class="section"><h2>סיכום התשובות</h2>' + recap + '</section>',
      'lessons', 'תוצאה'
    );
    document.getElementById('again').addEventListener('click', () => {
      session = { kind: s.kind, id: s.id, questions: buildQuestions(s.kind, s.id), i: 0, answers: [], finished: false };
      drawQuiz();
    });
  }

  /* ---------------- progress ---------------- */
  function pips(score, total) {
    let h = '<span class="pips" aria-label="' + score + ' מתוך ' + total + '">';
    if (total <= 3) for (let i = 0; i < total; i++) h += '<i class="' + (i < score ? 'on' : '') + '"></i>';
    return h + '<b>' + score + '/' + total + '</b></span>';
  }

  function calendarHtml() {
    const set = new Set(state.days);
    const t = today();
    const [y, m, d] = t.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
    const start = addDays(t, -(dow + 28)); // 5 weeks, starting on a Sunday
    let html = '<div class="cal" role="img" aria-label="ימי לימוד בחמשת השבועות האחרונים">';
    ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(l => { html += '<span class="dh">' + l + '</span>'; });
    for (let i = 0; i < 35; i++) {
      const k = addDays(start, i);
      const day = Number(k.slice(8));
      let cls = 'd';
      if (k > t) cls += ' future';
      else if (set.has(k)) cls += ' on';
      if (k === t) cls += ' is-today';
      html += '<span class="' + cls + '">' + (k > t ? '' : day) + '</span>';
    }
    return html + '</div>';
  }

  function viewProgress() {
    const s = streaks();
    const recs = Object.keys(state.lessons).map(Number).sort((a, b) => a - b);
    const avg = recs.length
      ? Math.round(recs.reduce((sum, n) => sum + state.lessons[n].best / 3, 0) / recs.length * 100)
      : null;

    let html = '<div class="lesson-head"><h1>ההתקדמות שלכם</h1></div>' +
      '<div class="stats">' +
        '<div class="stat hot"><span class="v num">' + s.cur + '</span><span class="l">ימים ברצף' + (s.cur && !s.activeToday ? ' (עוד לא היום)' : '') + '</span></div>' +
        '<div class="stat"><span class="v num">' + s.best + '</span><span class="l">הרצף הכי ארוך</span></div>' +
        '<div class="stat"><span class="v num">' + recs.length + '<small>/30</small></span><span class="l">שיעורים שהושלמו</span></div>' +
        '<div class="stat"><span class="v num">' + (avg === null ? '–' : avg + '<small>%</small>') + '</span><span class="l">ציון ממוצע (הכי טוב)</span></div>' +
      '</div>' +
      '<section class="card"><h2>ימי לימוד</h2>' + calendarHtml() +
        '<p class="muted small">יום נספר ברצף כשמסיימים בו מבחן של שיעור או מבחן חזרה.</p></section>';

    // lesson scores
    if (recs.length) {
      html += '<section class="card"><h2>ציונים בשיעורים</h2><ul class="scores">' +
        recs.map(n => {
          const r = state.lessons[n];
          return '<li><span class="n">' + n + '</span><a class="t" href="#lesson-' + n + '">' + esc(lesson(n).title) + '</a>' + pips(r.best, 3) + '</li>';
        }).join('') + '</ul>' +
        '<p class="muted small">מוצג הציון הכי טוב בכל שיעור. אפשר לחזור על כל מבחן כמה פעמים שרוצים.</p></section>';
    } else {
      html += '<section class="card empty"><h2>עוד אין ציונים</h2><p>אחרי המבחן של השיעור הראשון, הציונים יופיעו כאן.</p><a class="btn" href="#home">לשיעור הראשון</a></section>';
    }

    const revs = WEEKS.filter(w => state.reviews[w.w]);
    if (revs.length || state.final) {
      html += '<section class="card"><h2>מבחני חזרה</h2><ul class="scores">' +
        revs.map(w => {
          const r = state.reviews[w.w];
          return '<li><span class="n">' + w.w + '</span><a class="t" href="#review-' + w.w + '">שבוע ' + w.w + ' · שיעורים ' + w.from + '–' + w.to + '</a>' + pips(r.best, r.total) + '</li>';
        }).join('') +
        (state.final ? '<li><span class="n">★</span><a class="t" href="#final">מבחן מסכם</a>' + pips(state.final.best, state.final.total) + '</li>' : '') +
        '</ul></section>';
    }

    const exCount = Object.keys(state.exercises).length;
    if (exCount) html += '<p class="muted small" style="text-align:center">תרגילים שסימנתם כבוצעו: <span class="num">' + exCount + '</span></p>';

    html += '<details class="settings" id="settings"><summary>הגדרות</summary><div class="inner">' +
      '<label class="check" for="preview-all"><input type="checkbox" id="preview-all"' + (state.previewAll ? ' checked' : '') + '> לפתוח את כל השיעורים עכשיו (בלי לחכות יום)</label>' +
      '<p class="muted small">שימושי כדי לעיין בתוכן מראש. ההתקדמות והציונים נשמרים כרגיל.</p>' +
      '<button type="button" class="btn secondary" id="reset">איפוס כל ההתקדמות</button>' +
      '<div class="confirm" id="confirm" hidden><p><strong>למחוק את כל הציונים, הרצף והשיעורים שהושלמו?</strong> אי אפשר לבטל את זה.</p>' +
      '<div class="btn-row"><button type="button" class="btn danger" id="reset-yes">כן, לאפס</button><button type="button" class="btn secondary" id="reset-no">ביטול</button></div></div>' +
      '</div></details>';

    render(html, 'progress', 'התקדמות');

    document.getElementById('preview-all').addEventListener('change', e => {
      state.previewAll = e.target.checked;
      save();
    });
    const confirmBox = document.getElementById('confirm');
    document.getElementById('reset').addEventListener('click', () => { confirmBox.hidden = false; document.getElementById('reset-no').focus(); });
    document.getElementById('reset-no').addEventListener('click', () => { confirmBox.hidden = true; });
    document.getElementById('reset-yes').addEventListener('click', () => {
      state = blankState();
      session = null;
      save();
      location.hash = '#home';
      route();
    });
  }

  /* ---------------- router ---------------- */
  function route() {
    const h = (location.hash || '').replace(/^#/, '');
    let m;
    if (h === '' || h === 'home') return viewHome();
    if (h === 'lessons') return viewLessons();
    if (h === 'progress') return viewProgress();
    if (h === 'final') return startQuiz('final', 0);
    if ((m = h.match(/^lesson-(\d+)$/))) return viewLesson(Number(m[1]));
    if ((m = h.match(/^quiz-(\d+)$/)) && lesson(Number(m[1]))) return startQuiz('lesson', Number(m[1]));
    if ((m = h.match(/^review-([1-4])$/))) return startQuiz('review', Number(m[1]));
    return viewHome();
  }

  window.addEventListener('hashchange', route);
  // Re-check day-based unlocks when the app comes back to the foreground after midnight.
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && today() !== lastDay) {
      lastDay = today();
      if (!session || session.finished) route();
    }
  });
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { state = load(); route(); } });

  route();
})();
