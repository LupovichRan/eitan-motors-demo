/* Shared, deterministic search rules. No network calls or persistent chat data. */
(function (root) {
  'use strict';
  const NONE = { min: 0, max: null };
  const defaults = () => ({ budget: { ...NONE }, uses: [], fuel: { include: [], exclude: [] }, year: { ...NONE }, brands: [], excludeBrands: [] });
  const normalize = text => String(text).normalize('NFKC').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[״“”]/g, '"').replace(/[׳’]/g, "'").replace(/[–—־]/g, '-').replace(/(\d)[,.](?=\d{3}(?:\D|$))/g, '$1').replace(/\s+/g, ' ').trim();
  const numberPattern = '(\\d+(?:\\.\\d+)?)\\s*(אלף|אלפים|k|₪|שקלים|שקל|ש"ח|שח)?';
  const toAmount = (digits, unit, inheritUnit) => {
    const n = Number(digits), u = unit || inheritUnit || '';
    return Math.round(n * (/אל|k/i.test(u) ? 1000 : u ? 1 : n >= 10 && n < 1000 ? 1000 : 1));
  };
  function parse(text, current = {}, stage = 'budget', inventory = []) {
    const t = normalize(text);
    const patch = {};
    const fail = error => ({ patch: {}, error, changed: false });
    if (/(?:לא|בלי|ללא)\s*(?:רוצה\s*)?(?:רכב\s*)?(?:משפחתי|לעיר|פנאי|שטח)/.test(t)) return fail('כדי שלא אהפוך שלילה להעדפה, בחרו את השימוש הרצוי: עיר, משפחה, נסיעות ארוכות או פנאי. ההעדפות לא שונו.');
    if (!t) return fail('כתבו העדפה או בחרו באחת האפשרויות.');
    if (/(?:\d+|שבעה|שבע|חמישה|חמש)\s*(?:מקומות|מושבים)|מושבי|ידני|תאונ|אחריות|טסט|דירוג בטיחות|מימון|ליסינג/.test(t)) {
      return fail('אין בדמו נתונים מאומתים על מושבים, גיר ידני, תאונות, אחריות, טסט או מימון. לא אוכל להבטיח התאמה לדרישות האלה. אפשר להמשיך בחיפוש לפי תקציב, יצרן, שימוש, הנעה, שנתון, קילומטראז׳ ויד.');
    }
    let moneyText = t;
    const maxYear = new Date().getFullYear() + 1;
    const yearRange = t.match(/(?:שנתו(?:ן|נים)|שנים|משנת|שנה|מודל)\s*(?:בין\s*)?(\d{4})\s*(?:-\s*|עד\s*|ל-?\s*)(\d{4})/);
    const yearMax = t.match(/(?:עד\s*שנת(?:ון)?|עד\s*שנה|לא אחרי\s*)\s*(\d{4})/);
    const yearMin = t.match(/(?:משנת|שנתון|שנה|מודל|שנת ייצור|מינימום שנה)\s*(?:מ-?\s*)?(\d{4})/);
    if (/ללא הגבלת שנתון|כל השנים|כל השנתונים|שנתון לא משנה/.test(t)) patch.year = { ...NONE };
    else if (yearRange) {
      const min = +yearRange[1], max = +yearRange[2];
      if (min < 1950 || max > maxYear || min > max) return fail('טווח השנתונים אינו תקין. ציינו שנים מ־1950 ועד '+maxYear+', מהשנה המוקדמת למאוחרת.');
      patch.year = { min, max };
      moneyText = moneyText.replace(yearRange[0], ' ');
    } else if (yearMax) {
      const max = +yearMax[1];
      if (max < 1950 || max > maxYear) return fail('השנתון המקסימלי אינו תקין.');
      patch.year = {min: 0, max};
      moneyText = moneyText.replace(yearMax[0], ' ');
    } else if (yearMin || (stage === 'year' && /^\d{4}$/.test(t))) {
      const min = +(yearMin ? yearMin[1] : t);
      if (min < 1950 || min > maxYear) return fail('השנתון אינו תקין. ציינו שנה מ־1950 ועד '+maxYear+'.');
      patch.year = { min, max: null };
      moneyText = moneyText.replace(yearMin ? yearMin[0] : t, ' ');
    }
    // Mileage is extracted before prices, so "50 אלף קמ" never becomes a budget.
    const mileage = t.match(new RegExp('(?:עד|מקסימום|פחות מ-?)?\\s*'+numberPattern+'\\s*ק["\']?מ','i'));
    if (/ללא הגבלת קילומטראז|ללא הגבלת קילומטר|כל קילומטראז/.test(t)) patch.maxKm = null;
    else if (mileage) {
      if (/(?:מעל|יותר מ|לפחות)\s*\d+.*ק["']?מ/.test(t) && !/לא יותר מ/.test(t)) return fail('בחיפוש לפי קילומטראז׳ אפשר לציין כרגע מגבלה עליונה בלבד, למשל ״עד 50 אלף קמ״. ההעדפות לא שונו.');
      const n = mileage[2] ? toAmount(mileage[1], mileage[2]) : Math.round(+mileage[1]);
      if (n < 0 || n > 2000000) return fail('מגבלת הקילומטראז׳ אינה תקינה.');
      patch.maxKm = n;
      moneyText = moneyText.replace(mileage[0], ' ');
    }
    if (/ללא הגבלת יד|כל הבעלויות/.test(t)) patch.maxHand = null;
    else {
      const hand = t.match(/(?:עד\s*)?יד\s*(ראשונה|שנייה|שניה|שלישית|\d+)/);
      if (hand) {
        const n = ({ ראשונה: 1, שנייה: 2, שניה: 2, שלישית: 3 })[hand[1]] || +hand[1];
        if (n < 1 || n > 20) return fail('מספר היד אינו תקין.');
        patch.maxHand = n;
        moneyText = moneyText.replace(hand[0], ' ');
      }
    }
    // Remove bare years from money candidates, including when a year appears first.
    moneyText = moneyText.replace(/\b(?:19|20)\d{2}\b/g, ' ');
    if (/ללא הגבלת תקציב|אין מגבלת תקציב|תקציב לא מוגבל|אין הגבלת תקציב/.test(t)) patch.budget = { ...NONE };
    else {
      if (/(?:תקציב|עד|בין)\s*-\s*\d/.test(moneyText) || /^-\s*\d/.test(moneyText.trim())) return fail('התקציב צריך להיות סכום חיובי.');
      const range = moneyText.match(new RegExp('(?:בין\\s*|מ-?\\s*)?'+numberPattern+'\\s*(?:-\\s*|עד\\s*|ל-?\\s*)'+numberPattern,'i'));
      const explicit = moneyText.match(new RegExp('(?:תקציב(?:\\s+של)?|מחיר|עד|בסביבות|בערך|מקסימום|לא יותר מ-?)\\s*'+numberPattern,'i'));
      const currency = moneyText.match(new RegExp(numberPattern.replace(/\?$/, ''),'i'));
      const minimum = moneyText.match(new RegExp('(?:מעל|יותר מ-?|לפחות|לא פחות מ-?)\\s*'+numberPattern,'i'));
      const bare = /^(?:אני רוצה\s*)?(\d+(?:\.\d+)?)$/.exec(moneyText.trim());
      if (range) {
        const min = toAmount(range[1], range[2], range[4]);
        const max = toAmount(range[3], range[4], range[2]);
        if (min < 0 || max < 1 || max > 10000000 || min > max) return fail('טווח התקציב אינו תקין. למשל: ״בין 80 ל־100 אלף״ או ״80-100 אלף״.');
        patch.budget = { min, max };
      } else if (minimum && (!explicit || minimum.index <= explicit.index)) {
        const min = toAmount(minimum[1], minimum[2]) + (/^(?:מעל|יותר מ)/.test(minimum[0]) ? 1 : 0);
        if (min < 1 || min > 10000000) return fail('תקציב המינימום אינו תקין.');
        patch.budget = {min, max:null};
      } else {
        const amount = explicit || currency || ((stage === 'budget' || stage === 'results') ? bare : null);
        if (amount) {
          const max = toAmount(amount[1], amount[2]);
          if (max < 1 || max > 10000000) return fail('התקציב אינו תקין. ציינו סכום בין 1 ל־10,000,000 ₪.');
          patch.budget = { min: 0, max };
        }
      }
    }
    const fuelPatterns = [['היברידי', /היברידי(?:ת)?|היבריד/g], ['חשמלי', /חשמלי(?:ת)?|חשמל/g], ['בנזין', /בנזין/g], ['דיזל', /דיזל/g]];
    if (/ללא העדפת הנעה|אין העדפת הנעה|כל סוגי ההנעה|הנעה לא משנה/.test(t)) patch.fuel = { include: [], exclude: [] };
    else {
      const include = [], exclude = [];
      for (const [name, pattern] of fuelPatterns) {
        for (const m of t.matchAll(pattern)) {
          const before = t.slice(Math.max(0, m.index - 25), m.index);
          const negative = /(?:בלי|ללא|לא(?: רוצה| מעוניין| מעוניינת)?|שאינו|שאינה)\s*(?:רכב\s*)?$/.test(before) || /(?:בלי|ללא|לא(?: רוצה)?)\s*(?:בנזין|דיזל|חשמלי(?:ת)?|היברידי(?:ת)?)\s*(?:ו|או)\s*$/.test(before);
          (negative ? exclude : include).push(name);
        }
      }
      if (include.length || exclude.length) {
        const excluded = [...new Set(exclude)], included = [...new Set(include)];
        if (included.some(x => excluded.includes(x))) return fail('ציינתם גם העדפה וגם שלילה לאותו סוג הנעה. איזה סוג לחפש?');
        patch.fuel = { include: included, exclude: excluded };
      }
    }
    if (/אין העדפה לשימוש|כל שימוש|ללא העדפת שימוש/.test(t)) patch.uses = [];
    else {
      const uses = [];
      if (/משפח|ילדים|ילד|עגלה/.test(t)) uses.push('family');
      if (/פנאי|גבוה|שטח|ג'יפ|גיפ|suv/i.test(t)) uses.push('suv');
      if (/ארוכ|בין[- ]?עירונ|כביש מהיר/.test(t)) uses.push('long');
      if (/עיר|חניה/.test(t.replace(/בין[- ]?עירונ\S*/g, ''))) uses.push('city');
      if (uses.length) patch.uses = uses;
    }
    if (/ללא העדפת יצרן|כל היצרנים|יצרן לא משנה/.test(t)) { patch.brands = []; patch.excludeBrands = []; }
    else {
      const known = [...new Set([...inventory.map(c => c.brand), 'טויוטה', 'קיה', 'יונדאי', 'מאזדה', 'סקודה', 'סיאט', 'טסלה', 'ניסאן', 'סוזוקי', 'הונדה', 'מיצובישי', 'פיגו', 'רנו', 'סובארו', 'וולוו', 'אאודי', 'מרצדס', 'פולקסווגן', 'במוו', 'ב.מ.וו'])].filter(Boolean);
      const include = [], exclude = [];
      for (const name of known) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const hit = new RegExp('(?:^|[\\s,;])(?:של |ל|ב|מ)?(' + escaped + ')(?=$|[\\s,.;?!])', 'i').exec(t);
        if (!hit) continue;
        const i = t.indexOf(hit[1], hit.index);
        const negative = /(?:בלי|ללא|לא(?: רוצה)?|שאינו)\s*(?:רכב\s*)?$/.test(t.slice(Math.max(0, i - 20), i));
        (negative ? exclude : include).push(name);
      }
      if (include.length || exclude.length) { patch.brands = include; patch.excludeBrands = exclude; }
    }
    return { patch, changed: Object.keys(patch).length > 0, error: null };
  }
  function complete(prefs) { return { ...defaults(), ...prefs }; }
  function score(car, prefs) {
    const uses = prefs.uses || [];
    const kinds = { city: ['סופר מיני'], family: ['משפחתית', 'פנאי ושטח'], suv: ['פנאי ושטח'], long: ['משפחתית'] };
    return uses.reduce((total, use) => total + (kinds[use]?.includes(car.kind) ? 4 : 0), 0);
  }
  function match(car, prefs) {
    const p = complete(prefs);
    return car.status === 'published'
      && car.price >= p.budget.min && (p.budget.max === null || car.price <= p.budget.max)
      && car.year >= p.year.min && (p.year.max === null || car.year <= p.year.max)
      && (!p.fuel.include.length || p.fuel.include.includes(car.fuel)) && !p.fuel.exclude.includes(car.fuel)
      && (!p.brands.length || p.brands.includes(car.brand)) && !p.excludeBrands.includes(car.brand)
      && (p.maxKm == null || car.km <= p.maxKm) && (p.maxHand == null || car.hand <= p.maxHand);
  }
  function search(stock, prefs) { return stock.filter(c => match(c, prefs)).sort((a, b) => score(b, prefs) - score(a, prefs) || a.price - b.price || a.id - b.id); }
  const api = { normalize, parse, defaults, complete, match, score, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
