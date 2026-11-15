/*
  איורים פשוטים (SVG) וכרטיסי "מה רואים בתמונה?".
  האיורים מסוגננים בכוונה: הם מראים סימן אחד בבירור, ולא מתיימרים להיות פנים אמיתיות.
  הצבעים מגיעים ממשתני CSS, כדי שיעבדו במצב בהיר ובמצב כהה.
*/
window.PICS = (function () {
  const svg = (vb, inner, label) => '<svg viewBox="' + vb + '" role="img" aria-label="' + (label || '') + '">' + inner + '</svg>';
  const L = 'class="pl"';   // ink line
  const SK = 'class="psk"'; // skin
  const CL = 'class="pcl"'; // clothing

  function face(o) {
    o = o || {};
    let s = '';
    if (o.backlit) {
      s += '<rect x="4" y="4" width="112" height="112" rx="10" class="pwin"/>';
      s += '<circle cx="60" cy="66" r="40" class="pshadow"/>';
      s += '<path d="M24 120 Q60 92 96 120" class="pshadow"/>';
      return svg('0 0 120 120', s, o.label);
    }
    if (o.lamp) s += '<path d="M8 20 l14 6 M8 34 h14 M8 48 l14 -6" ' + L + ' stroke-width="2.5"/>';
    s += '<circle cx="60" cy="62" r="40" ' + SK + '/>';
    // brows
    const brows = {
      flat: 'M36 44 h16 M68 44 h16',
      raised: 'M36 40 Q44 33 52 39 M68 39 Q76 33 84 40',
      furrowed: 'M36 41 L52 47 M84 41 L68 47',
      sad: 'M36 47 L52 41 M84 47 L68 41'
    }[o.brows || 'flat'];
    s += '<path d="' + brows + '" ' + L + ' stroke-width="3.5"/>';
    // eyes
    const eyes = o.eyes || 'open';
    if (eyes === 'open') s += '<circle cx="44" cy="56" r="4" class="pink"/><circle cx="76" cy="56" r="4" class="pink"/>';
    if (eyes === 'crinkle') {
      s += '<path d="M37 58 Q44 50 51 58 M69 58 Q76 50 83 58" ' + L + ' stroke-width="3.5"/>';
      s += '<path d="M33 53 l-6 -3 M33 58 h-7 M33 63 l-6 3 M87 53 l6 -3 M87 58 h7 M87 63 l6 3" ' + L + ' stroke-width="2"/>';
    }
    if (eyes === 'wide' || eyes === 'up') {
      const dx = eyes === 'up' ? -3 : 0, dy = eyes === 'up' ? -3 : 0;
      s += '<ellipse cx="44" cy="56" rx="8" ry="' + (eyes === 'wide' ? 7 : 6) + '" class="pwhite"/><ellipse cx="76" cy="56" rx="8" ry="' + (eyes === 'wide' ? 7 : 6) + '" class="pwhite"/>';
      s += '<circle cx="' + (44 + dx) + '" cy="' + (56 + dy) + '" r="3.5" class="pink"/><circle cx="' + (76 + dx) + '" cy="' + (56 + dy) + '" r="3.5" class="pink"/>';
    }
    if (o.cheeks) s += '<path d="M36 70 Q44 65 52 70 M68 70 Q76 65 84 70" ' + L + ' stroke-width="2" opacity=".55"/>';
    // mouth
    const mouth = o.mouth || 'flat';
    if (mouth === 'smile') s += '<path d="M42 76 Q60 96 78 76 Z" class="pwhite" stroke-linejoin="round"/><path d="M42 76 Q60 96 78 76 Z" ' + L + ' stroke-width="3"/>';
    if (mouth === 'polite') s += '<path d="M47 81 Q60 87 73 81" ' + L + ' stroke-width="3"/>';
    if (mouth === 'flat') s += '<path d="M48 83 h24" ' + L + ' stroke-width="3"/>';
    if (mouth === 'pressed') s += '<path d="M51 83 h18" ' + L + ' stroke-width="5"/>';
    if (mouth === 'frown') s += '<path d="M46 88 Q60 77 74 88" ' + L + ' stroke-width="3"/>';
    if (mouth === 'open') s += '<ellipse cx="60" cy="85" rx="6" ry="8" class="pink"/>';
    return svg('0 0 120 120', s, o.label);
  }

  function figure(o) {
    o = o || {};
    const arms = o.arms || 'down';
    let s = '';
    const wide = arms === 'hips';
    s += '<path d="M51 104 L' + (wide ? 38 : 48) + ' 152 M69 104 L' + (wide ? 82 : 72) + ' 152" class="pleg"/>';
    s += '<rect x="40" y="48" width="40" height="58" rx="14" ' + CL + '/>';
    const A = {
      down: ['M43 58 L34 100', 'M77 58 L86 100', [[34, 100], [86, 100]]],
      open: ['M43 58 L24 92', 'M77 58 L96 92', [[24, 92], [96, 92]]],
      crossed: ['M43 60 L54 80 L78 74', 'M77 60 L66 82 L42 77', [[78, 74], [42, 77]]],
      neck: ['M43 58 L34 100', 'M77 58 L90 78 L66 46', [[34, 100], [66, 46]]],
      hips: ['M43 58 L27 77 L42 92', 'M77 58 L93 77 L78 92', [[42, 92], [78, 92]]],
      point: ['M43 58 L34 100', 'M77 58 L108 42', [[34, 100], [108, 42]]],
      palms: ['M43 58 L30 84 L16 74', 'M77 58 L90 84 L104 74', [[16, 74], [104, 74]]]
    }[arms];
    s += '<path d="' + A[0] + '" class="parm"/><path d="' + A[1] + '" class="parm"/>';
    A[2].forEach(p => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" ' + SK + '/>'; });
    if (arms === 'point') s += '<path d="M112 40 l8 -4" ' + L + ' stroke-width="3"/>';
    s += '<circle cx="60" cy="30" r="16" ' + SK + '/>';
    if (o.caption) s += '<text x="60" y="12" class="ptext" text-anchor="middle">' + o.caption + '</text>';
    return svg('0 0 120 160', s, o.label);
  }

  function seated(o) {
    o = o || {};
    const lean = o.lean || 'fwd';
    const sh = lean === 'fwd' ? [80, 58] : [44, 58];
    const hd = lean === 'fwd' ? [90, 42] : [38, 40];
    let s = '<path d="M38 100 L34 46 M38 100 H92 M44 100 V146 M88 100 V146" class="pchair"/>';
    s += '<path d="M60 98 L92 100 L94 142" class="pleg"/>';
    s += '<path d="M60 98 L' + sh[0] + ' ' + sh[1] + '" class="ptorso"/>';
    s += '<path d="M' + sh[0] + ' ' + (sh[1] + 4) + ' L' + (lean === 'fwd' ? 96 : 66) + ' ' + (lean === 'fwd' ? 88 : 90) + '" class="parm"/>';
    s += '<circle cx="' + hd[0] + '" cy="' + hd[1] + '" r="14" ' + SK + '/>';
    s += '<circle cx="132" cy="46" r="12" class="pother"/><path d="M132 60 V108" class="pother-l"/>';
    return svg('0 0 150 150', s, o.label);
  }

  function standingSide(o) {
    o = o || {};
    const slump = o.pose === 'slump';
    let s = '<path d="M60 100 L58 150 M60 100 L66 150" class="pleg"/>';
    if (slump) {
      s += '<path d="M60 100 Q70 76 66 56" class="ptorso" fill="none"/>';
      s += '<path d="M66 60 L72 98" class="parm"/>';
      s += '<circle cx="76" cy="46" r="14" ' + SK + '/>';
    } else {
      s += '<path d="M60 100 L60 52" class="ptorso"/>';
      s += '<path d="M60 58 L62 98" class="parm"/>';
      s += '<circle cx="62" cy="34" r="14" ' + SK + '/>';
    }
    return svg('0 0 120 160', s, o.label);
  }

  // top-down view: people as shoulders + head + nose, feet ahead of them
  function person(x, y, face, feet, me) {
    const r = a => a * Math.PI / 180;
    const fx = x + Math.cos(r(feet)) * 16, fy = y + Math.sin(r(feet)) * 16;
    const nx = x + Math.cos(r(face)) * 11, ny = y + Math.sin(r(face)) * 11;
    let s = '';
    s += '<ellipse cx="' + (fx + Math.cos(r(feet + 90)) * 5).toFixed(1) + '" cy="' + (fy + Math.sin(r(feet + 90)) * 5).toFixed(1) + '" rx="5" ry="3" transform="rotate(' + feet + ' ' + (fx + Math.cos(r(feet + 90)) * 5).toFixed(1) + ' ' + (fy + Math.sin(r(feet + 90)) * 5).toFixed(1) + ')" class="pfoot"/>';
    s += '<ellipse cx="' + (fx - Math.cos(r(feet + 90)) * 5).toFixed(1) + '" cy="' + (fy - Math.sin(r(feet + 90)) * 5).toFixed(1) + '" rx="5" ry="3" transform="rotate(' + feet + ' ' + (fx - Math.cos(r(feet + 90)) * 5).toFixed(1) + ' ' + (fy - Math.sin(r(feet + 90)) * 5).toFixed(1) + ')" class="pfoot"/>';
    s += '<ellipse cx="' + x + '" cy="' + y + '" rx="15" ry="7" transform="rotate(' + (face + 90) + ' ' + x + ' ' + y + ')" class="' + (me ? 'pcl-me' : 'pcl-top') + '"/>';
    s += '<circle cx="' + x + '" cy="' + y + '" r="8" ' + SK + '/>';
    s += '<circle cx="' + nx.toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="2.5" class="pink"/>';
    return s;
  }

  function top(o) {
    o = o || {};
    let s = '<rect x="2" y="2" width="156" height="116" rx="10" class="pfloor"/>';
    if (o.door) s += '<rect x="148" y="40" width="8" height="40" rx="2" class="pdoor"/><text x="140" y="34" class="ptext" text-anchor="end">דלת</text>';
    if (o.table) s += o.table === 'corner'
      ? '<rect x="58" y="38" width="44" height="44" rx="6" class="ptable"/>'
      : '<rect x="58" y="38" width="44" height="44" rx="6" class="ptable"/>';
    (o.people || []).forEach(p => { s += person(p[0], p[1], p[2], p[3] === undefined ? p[2] : p[3], p[4]); });
    if (o.gap) s += '<path d="M' + o.gap[0] + ' ' + o.gap[1] + ' l10 0 m-5 -5 l5 5 l-5 5" class="parrow"/>';
    if (o.ruler) s += '<path d="M' + o.ruler[0] + ' 100 H' + o.ruler[1] + ' M' + o.ruler[0] + ' 95 v10 M' + o.ruler[1] + ' 95 v10" ' + L + ' stroke-width="1.5"/><text x="' + ((o.ruler[0] + o.ruler[1]) / 2) + '" y="114" class="ptext" text-anchor="middle">' + o.rulerText + '</text>';
    return svg('0 0 160 120', s, o.label);
  }

  function kid(o) {
    o = o || {};
    const kneel = o.pose === 'kneel';
    let s = '';
    // adult
    if (kneel) {
      s += '<path d="M44 110 L60 130 L40 148 M52 110 L54 148" class="pleg"/>';
      s += '<rect x="32" y="70" width="34" height="44" rx="12" ' + CL + '/>';
      s += '<path d="M62 78 L84 96" class="parm"/>';
      s += '<circle cx="49" cy="56" r="13" ' + SK + '/>';
    } else {
      s += '<path d="M44 108 L42 152 M56 108 L58 152" class="pleg"/>';
      s += '<rect x="32" y="40" width="34" height="70" rx="12" ' + CL + '/>';
      s += '<path d="M62 50 L76 84" class="parm"/>';
      s += '<circle cx="49" cy="24" r="13" ' + SK + '/>';
    }
    // child
    s += '<path d="M96 126 L95 152 M104 126 L105 152" class="pleg kidleg"/>';
    s += '<rect x="88" y="94" width="24" height="34" rx="9" class="pcl-kid"/>';
    s += '<circle cx="100" cy="82" r="11" ' + SK + '/>';
    s += '<path d="M' + (kneel ? '60 56' : '60 26') + ' L90 80" class="pgaze"/>';
    return svg('0 0 130 160', s, o.label);
  }

  return { face, figure, seated, standingSide, top, kid };
})();

(function () {
  const out = window.FEED = window.FEED || [];
  let i = out.length;
  const id = () => 'f' + String(++i).padStart(3, '0');
  // P(topic, panels, question, options (first is correct), explanation, caption)
  const P = (topic, panels, q, options, explain, caption) => out.push({ id: id(), type: 'pic', topic, panels, q, options, explain, caption });

  P(3, [['face', { eyes: 'crinkle', brows: 'flat', mouth: 'smile', cheeks: true, label: 'חיוך עם עיניים מצטמצמות ולחיים מורמות' }], ['face', { eyes: 'open', mouth: 'polite', label: 'חיוך של הפה בלבד' }]],
    `באיזה ציור החיוך כנראה ספונטני יותר?`,
    [`א: העיניים מצטמצמות והלחיים עולות`, `ב: רק הפה מחייך`, `אי אפשר לראות שום הבדל`],
    `העיניים והלחיים הם הרמז. ובכל זאת, חלק מהאנשים יודעים לייצר גם חיוך כזה במכוון, אז זו סבירות, לא הוכחה. חיוך ב הוא חיוך מנומס, לא שקר.`);
  P(12, [['face', { eyes: 'open', brows: 'furrowed', mouth: 'pressed', label: 'גבות מכווצות ושפתיים לחוצות' }]],
    `מה הכי נכון לומר על ההבעה הזאת?`,
    [`אולי מתח, ריכוז או מחשבה. צריך הקשר`, `הוא משקר`, `הוא שמח`],
    `גבות מכווצות ושפתיים לחוצות מופיעות במתח, אבל גם בריכוז. בלי קו בסיס והקשר, זו רק נקודת התחלה.`);
  P(5, [['figure', { arms: 'crossed', caption: 'חדר ממוזג, 18 מעלות', label: 'אדם עם ידיים שלובות בחדר קר' }]],
    `מה המסקנה הסבירה?`,
    [`כנראה קר לו. אין כאן ראיה להתנגדות`, `הוא מתנגד למה שאומרים`, `הוא מסתיר משהו`],
    `ההקשר כאן מסביר את התנוחה. ידיים שלובות לבד אומרות מעט מאוד.`);
  P(12, [['figure', { arms: 'neck', label: 'אדם נוגע בצוואר' }]],
    `מה התנועה הזאת יכולה לרמוז?`,
    [`מתח או אי-נוחות, בלי לדעת למה`, `שהוא משקר`, `שהוא נמשך אליכם`],
    `מגע בצוואר הוא דרך נפוצה להרגיע את עצמנו. הוא מספר על מתח, לא על הסיבה, ובטח לא על שקר.`);
  P(2, [['top', { people: [[50, 60, 0], [96, 88, 240], [96, 32, 120]], label: 'שלושה אנשים במעגל סגור' }], ['top', { people: [[46, 60, 0], [96, 22, 125], [96, 98, 235]], gap: [122, 60], label: 'שלושה אנשים במעגל עם פתח' }]],
    `לאיזו קבוצה קל יותר להצטרף?`,
    [`ב: יש פתח במעגל`, `א: המעגל סגור`, `אין הבדל`],
    `כשיש רווח במעגל, הקבוצה "משאירה מקום". מעגל סגור מאותת שיחה פרטית יותר. עדיין, אפשר לחכות בקצה ולהקשיב.`);
  P(2, [['top', { door: true, people: [[50, 60, 0], [92, 60, 180, 0]], label: 'שני אנשים מדברים, הרגליים של אחד מהם פונות לדלת' }]],
    `הפנים של האדם הימני פונות לשני, אבל הרגליים פונות לדלת. מה הרמז?`,
    [`אולי הוא רוצה לסיים. כדאי לתת לו יציאה קלה`, `הוא לא אוהב את השני`, `אין שום רמז`],
    `זה רמז, לא כלל. "נמשיך אחר כך?" נותן לו אפשרות לצאת בכבוד, ואם טעיתם הוא פשוט יגיד.`);
  P(11, [['seated', { lean: 'fwd', label: 'אדם יושב ונוטה קדימה' }], ['seated', { lean: 'back', label: 'אדם יושב ונשען אחורה' }]],
    `מי מהשניים נראה מעורב יותר בשיחה?`,
    [`א: נוטה קדימה`, `ב: נשען אחורה`, `שניהם בדיוק אותו דבר`],
    `נטייה קדימה היא רמז סביר לעניין. אבל אולי ב פשוט עייף או נוח לו. השינוי בין התנוחות, ברגע מסוים, אומר יותר.`);
  P(24, [['figure', { arms: 'palms', label: 'כפות ידיים פתוחות' }], ['figure', { arms: 'point', label: 'אצבע מורה מכוונת' }]],
    `איזו תנועה עדיפה בוויכוח?`,
    [`א: כפות ידיים פתוחות`, `ב: אצבע מורה`, `אין הבדל`],
    `אצבע מורה שמכוונת לאדם נתפסת כהאשמה. כפות ידיים פתוחות מרגישות פחות מאיימות.`);
  P(7, [['face', { eyes: 'up', brows: 'flat', mouth: 'flat', label: 'אדם מסתכל למעלה ולצד' }]],
    `שאלתם שאלה, והוא מסתכל למעלה ולצד לפני שהוא עונה. מה הכי סביר?`,
    [`הוא חושב`, `הוא ממציא שקר`, `הוא משועמם`],
    `הטענה שכיוון המבט מסגיר שקר נבדקה ונמצאה לא נכונה. מבט שבורח הוא בדרך כלל חשיבה.`);
  P(27, [['face', { eyes: 'wide', brows: 'raised', mouth: 'open', label: 'גבות מורמות, עיניים פקוחות ופה פתוח' }]],
    `איזה רגש הכי סביר בהבעה הזאת?`,
    [`הפתעה, אבל ההקשר יכריע`, `כעס`, `גועל`],
    `גבות מורמות, עיניים פקוחות ופה פתוח מקושרים להפתעה. ובכל זאת, אותה הבעה יכולה להופיע גם בפחד או בהתלהבות.`);
  P(8, [['face', { eyes: 'open', brows: 'sad', mouth: 'frown', label: 'גבות פנימיות מורמות ופה עצוב' }]],
    `חבר נראה ככה כשהוא מגיע. איך כדאי להגיב?`,
    [`לשאול בעדינות אם הכל בסדר, ולהקשיב`, `להגיד לו לחייך`, `להתעלם, כדי לא להביך`],
    `שאלה עדינה נותנת לו לבחור אם לשתף. "תחייך" מבטל את מה שהוא מרגיש.`);
  P(17, [['standingSide', { pose: 'slump', label: 'יציבה כפופה' }], ['standingSide', { pose: 'upright', label: 'יציבה זקופה' }]],
    `איזו יציבה נתפסת בדרך כלל כבטוחה יותר?`,
    [`ב: זקופה ורגועה`, `א: כפופה`, `אין הבדל`],
    `יציבה זקופה ורגועה נתפסת כבטוחה. אבל כפיפות יכולה להיות גם עייפות או כאב גב, אז לא שופטים אנשים לפיה.`);
  P('seat', [['top', { table: 'across', people: [[38, 60, 0], [122, 60, 180]], label: 'שני אנשים יושבים משני צדי השולחן' }], ['top', { table: 'corner', people: [[46, 50, 0], [80, 96, 270]], label: 'שני אנשים יושבים בפינת השולחן' }]],
    `איזו ישיבה מתאימה יותר לשיחה קשה?`,
    [`ב: בזווית, בפינת השולחן`, `א: זה מול זה, משני הצדדים`, `אין הבדל`],
    `ישיבה בזווית מרגישה פחות כמו עימות. שולחן ביניכם מוסיף מחסום.`);
  P(17, [['figure', { arms: 'hips', label: 'אדם עומד עם ידיים על המותניים ורגליים פשוקות' }]],
    `איך התנוחה הזאת עלולה להיתפס בפגישת עבודה?`,
    [`כשחצנית או מאיימת`, `כחמה ונגישה`, `כביישנית`],
    `תנוחה "דומיננטית" מוגזמת נתפסת לרוב כמאמץ להיראות גדולים. ביטחון אמיתי נראה כמו נוחות.`);
  P('space', [['top', { people: [[64, 60, 0], [92, 60, 180]], ruler: [64, 92], rulerText: 'כ-30 ס"מ', label: 'שני אנשים קרובים מאוד' }], ['top', { people: [[40, 60, 0], [120, 60, 180]], ruler: [40, 120], rulerText: 'כמטר', label: 'שני אנשים במרחק נוח' }]],
    `בשיחה עם מישהו שאתם בקושי מכירים, באיזה מצב הוא כנראה ירצה לזוז אחורה?`,
    [`א: קרוב מאוד, בתוך המרחב האישי`, `ב: במרחק של כמטר`, `באף אחד`],
    `לפי אדוארד הול, מרחק של עד חצי מטר שמור בדרך כלל לאנשים קרובים. המספרים משתנים בין תרבויות ובין אנשים.`);
  P('video', [['face', { backlit: true, label: 'פנים בצל מול חלון מואר' }], ['face', { eyes: 'open', mouth: 'polite', lamp: true, label: 'פנים מוארות מלפנים' }]],
    `בשיחת וידאו, באיזה מצב הצד השני רואה את ההבעות שלכם?`,
    [`ב: האור מגיע מלפנים`, `א: חלון מאחוריכם`, `אין הבדל`],
    `אור מאחור הופך את הפנים לצל. ההבעות שלכם הן חלק גדול מהשיחה, אז שימו את האור מולכם.`);
  P('kids', [['kid', { pose: 'stand', label: 'מבוגר עומד ומדבר עם ילד מלמעלה' }], ['kid', { pose: 'kneel', label: 'מבוגר כורע בגובה העיניים של הילד' }]],
    `איך עדיף לדבר עם ילד על משהו חשוב?`,
    [`ב: בגובה העיניים שלו`, `א: מלמעלה`, `אין הבדל`],
    `מבט מלמעלה מרגיש לילד כמו נזיפה, גם כשלא התכוונתם. בגובה העיניים קל לו יותר להקשיב ולשתף.`);
})();
