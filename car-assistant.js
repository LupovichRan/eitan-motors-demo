(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('car-assistant'), log = $('assistant-log');
  if (!dialog) return;
  const esc = Inventory.esc, engine = CarSearch, fmt = n => n.toLocaleString('he-IL');
  let prefs = {}, started = false, opener = null, stage = 'budget', snapshot = '', lastResultsStart = null;
  const questions = {
    budget: ['מה התקציב שלך? בחרו את האפשרות המתאימה.', ['עד 80 אלף ₪', 'עד 100 אלף ₪', 'עד 130 אלף ₪', 'עד 160 אלף ₪', 'ללא הגבלת תקציב']],
    uses: ['איך הרכב ישמש אותך בעיקר?', ['נסיעות בעיר', 'רכב למשפחה', 'נסיעות ארוכות', 'רכב פנאי גבוה', 'אין העדפה לשימוש']],
    fuel: ['איזה סוג הנעה לחפש?', ['היברידי', 'בנזין', 'חשמלי', 'בלי בנזין', 'בלי חשמלי', 'ללא העדפת הנעה']],
    year: ['מאיזה שנתון לחפש?', ['משנת 2020', 'משנת 2021', 'משנת 2022', 'משנת 2023', 'משנת 2024', 'ללא הגבלת שנתון']],
    maxKm: ['מה הקילומטראז׳ המקסימלי?', ['עד 30 אלף ק״מ', 'עד 50 אלף ק״מ', 'עד 80 אלף ק״מ', 'ללא הגבלת קילומטראז׳']],
    maxHand: ['עד איזו יד לחפש?', ['יד ראשונה', 'עד יד שנייה', 'ללא הגבלת יד']]
  };
  function stock() { return Inventory.load(); }
  function bottom() { const latest=log.lastElementChild; if(latest)scrollTo(latest); }
  function scrollTo(el) {
    dialog.scrollTop += el.getBoundingClientRect().top - dialog.getBoundingClientRect().top - dialog.querySelector('.assistant-header').getBoundingClientRect().height - 16;
  }
  function message(text, user = false) {
    const el = document.createElement('div');
    el.className = 'chat-message' + (user ? ' user' : '');
    const speaker = document.createElement('span');
    speaker.className = 'chat-speaker'; speaker.textContent = user ? 'אתם' : 'מכוניתי';
    const p = document.createElement('p'); p.textContent = text;
    el.append(speaker, p); log.append(el);
    // Bound transcript growth without keeping hidden personal data elsewhere.
    while (log.children.length > 90) log.firstElementChild.remove();
    return el;
  }
  function retireChoices() {
    log.querySelectorAll('.assistant-choices').forEach(el => el.remove());
  }
  function choices(parent, labels, fn = respond) {
    const box = document.createElement('div'); box.className = 'assistant-choices';
    labels.forEach(label => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => fn(label); box.append(b);
    });
    parent.append(box); return box;
  }
  function ask(field) {
    stage = field; retireChoices();
    if (field === 'brands') {
      const brands = [...new Set(stock().filter(c => c.status === 'published').map(c => c.brand))];
      choices(message('איזה יצרן מעניין אותך?'), ['כל היצרנים', ...brands], label => {
        retireChoices(); message(label, true);
        prefs.brands = label === 'כל היצרנים' ? [] : [label]; prefs.excludeBrands = [];
        next(); focusAction();
      });
    } else {
      const [text, options] = questions[field]; choices(message(text), options);
    }
    bottom();
  }
  function next() {
    const missing = ['budget', 'uses', 'fuel', 'year'].find(k => prefs[k] === undefined);
    if (missing) ask(missing); else { stage = 'results'; results(); }
  }
  function finishMissing() { prefs = engine.complete(prefs); stage = 'results'; results(); }
  function summary() {
    const p = engine.complete(prefs), uses = { city: 'נסיעות בעיר', family: 'למשפחה', long: 'נסיעות ארוכות', suv: 'רכב פנאי גבוה' };
    const budget = p.budget.max === null ? (p.budget.min ? 'מ־'+fmt(p.budget.min)+' ₪, ללא תקרה' : 'ללא תקרת תקציב') : p.budget.min ? `${fmt(p.budget.min)}–${fmt(p.budget.max)} ₪` : `עד ${fmt(p.budget.max)} ₪`;
    const fuel = [p.fuel.include.length ? p.fuel.include.join(' או ') : 'כל סוגי ההנעה', ...p.fuel.exclude.map(f => 'בלי ' + f)].join(', ');
    const year = p.year.max ? (p.year.min ? `שנתונים ${p.year.min}–${p.year.max}` : `עד שנת ${p.year.max}`) : p.year.min ? `משנת ${p.year.min}` : 'כל השנתונים';
    const lines = [budget, p.uses.length ? p.uses.map(u => uses[u]).join(' + ') : 'ללא העדפת שימוש', fuel, year];
    if (p.brands.length) lines.push('יצרן: ' + p.brands.join(' או '));
    if (p.excludeBrands.length) lines.push('בלי ' + p.excludeBrands.join(', '));
    if (p.maxKm != null) lines.push('עד ' + fmt(p.maxKm) + ' ק״מ');
    if (p.maxHand != null) lines.push('עד יד ' + p.maxHand);
    return lines.join(' · ');
  }
  function clearResults() {
    log.querySelectorAll('.assistant-result, .assistant-result-summary, .assistant-result-intro').forEach(el => el.remove());
  }
  function refinementOptions() {
    return ['שינוי תקציב', 'שינוי שימוש', 'שינוי הנעה', 'שינוי שנתון', 'בחירת יצרן', 'הגבלת קילומטראז׳', 'הגבלת יד'];
  }
  function results() {
    prefs = engine.complete(prefs);
    retireChoices(); clearResults();
    const all = stock(), found = engine.search(all, prefs);
    snapshot = JSON.stringify(all);
    const start = message('החיפוש המעודכן שלך:\n' + summary());
    start.classList.add('assistant-result-summary'); lastResultsStart = start;
    $('assistant-current-search').textContent = summary();
    $('assistant-current-search').hidden = false;
    if (!found.length) {
      const el = message(all.some(c => c.status === 'published')
        ? 'אין כרגע רכבים שעומדים בכל התנאים האלה. אפשר לשנות תנאי אחד; לא אשנה אותו בלי שתבחרו.'
        : 'כרגע אין רכבים מוצגים במלאי. אחרי הוספה או פרסום של רכבים בממשק המנהל אפשר לחפש שוב.');
      el.classList.add('assistant-result-intro');
      const options = [];
      if (prefs.fuel.include.length || prefs.fuel.exclude.length) options.push('ללא העדפת הנעה');
      if (prefs.year.min || prefs.year.max) options.push('ללא הגבלת שנתון');
      if (prefs.brands.length || prefs.excludeBrands.length) options.push('כל היצרנים');
      if (prefs.maxKm != null) options.push('ללא הגבלת קילומטראז׳');
      if (prefs.maxHand != null) options.push('ללא הגבלת יד');
      options.push(...refinementOptions(), 'התחל מחדש'); choices(el, options);
      scrollTo(start); return;
    }
    const intro = message(`נמצאו ${found.length} רכבים שעומדים בתנאים. הנה ${Math.min(found.length, 3)} הצעות, לפי קטגוריית השימוש ואז המחיר. חלופה בקטגוריה אחרת מסומנת בכרטיס.`);
    intro.classList.add('assistant-result-intro');
    found.slice(0, 3).forEach(c => {
      const el = document.createElement('article'); el.className = 'assistant-result'; el.dataset.carId = c.id;
      const why = [];
      if (prefs.budget.max !== null || prefs.budget.min) why.push('בתקציב שבחרת');
      if (prefs.uses.length) why.push(engine.score(c, prefs) > 0 ? 'קטגוריה בכיוון השימוש שבחרת' : 'חלופה בקטגוריה אחרת מהעדפת השימוש');
      if (prefs.fuel.include.length || prefs.fuel.exclude.length) why.push('עומד בתנאי ההנעה');
      if (prefs.year.min || prefs.year.max) why.push('עומד בתנאי השנתון');
      if (prefs.brands.length || prefs.excludeBrands.length) why.push('עומד בתנאי היצרן');
      if (prefs.maxKm != null) why.push('עומד במגבלת הקילומטראז׳');
      if (prefs.maxHand != null) why.push('עומד במגבלת היד');
      el.innerHTML = `<div class="assistant-result-top"><img src="${esc(Inventory.displayImage(c.images[0]))}" alt="תמונת אווירה להמחשה בלבד"><div><h3>${esc(c.brand)} ${esc(c.name)}</h3><div class="result-price">${fmt(c.price)} ₪</div><div class="result-meta">${c.year} · ${fmt(c.km)} ק״מ · יד ${c.hand} · ${esc(c.fuel)}</div></div></div><div class="result-reason">${esc(why.join(' · ') || 'אפשרות מהמלאי בהתאם להעדפות הכלליות שבחרת')}</div><div class="assistant-result-actions"><button type="button" data-chat-car="${c.id}" aria-label="פרטים על ${esc(c.brand)} ${esc(c.name)}">לפרטי הרכב ←</button></div>`;
      el.querySelector('button').onclick = () => openVehicle(c.id);
      log.append(el);
    });
    const refine = message('רוצים לדייק את ההצעות? בחרו איזה תנאי לשנות.');
    refine.classList.add('assistant-result-intro'); choices(refine, refinementOptions());
    scrollTo(start);
  }
  function openVehicle(id) {
    const current = stock();
    const car = current.find(c => c.id === id);
    if (!car || !engine.match(car, prefs)) {
      message('פרטי המלאי השתנו; ההצעות עודכנו לפי המלאי הנוכחי.'); results(); return;
    }
    dialog.close();
    // Wait for the close event to restore focus before opening the vehicle dialog.
    setTimeout(() => {
      data = current.filter(c => c.status === 'published');
      brandOptions(); render(); openCar(id);
    }, 0);
  }
  const selections = {};
  for (const amount of [80000, 100000, 130000, 160000]) selections['עד '+(amount/1000)+' אלף ₪'] = {budget:{min:0,max:amount}};
  selections['ללא הגבלת תקציב'] = {budget:{min:0,max:null}};
  for (const [label, use] of [['נסיעות בעיר','city'],['רכב למשפחה','family'],['נסיעות ארוכות','long'],['רכב פנאי גבוה','suv']]) selections[label] = {uses:[use]};
  selections['אין העדפה לשימוש'] = {uses:[]};
  for (const fuel of ['היברידי','בנזין','חשמלי']) selections[fuel] = {fuel:{include:[fuel],exclude:[]}};
  for (const fuel of ['בנזין','חשמלי']) selections['בלי '+fuel] = {fuel:{include:[],exclude:[fuel]}};
  selections['ללא העדפת הנעה'] = {fuel:{include:[],exclude:[]}};
  for (const year of [2020,2021,2022,2023,2024]) selections['משנת '+year] = {year:{min:year,max:null}};
  selections['ללא הגבלת שנתון'] = {year:{min:0,max:null}};
  for (const km of [30000,50000,80000]) selections['עד '+km/1000+' אלף ק״מ'] = {maxKm:km};
  selections['ללא הגבלת קילומטראז׳'] = {maxKm:null};
  selections['יד ראשונה'] = {maxHand:1};
  selections['עד יד שנייה'] = {maxHand:2};
  selections['ללא הגבלת יד'] = {maxHand:null};
  selections['כל היצרנים'] = {brands:[],excludeBrands:[]};
  const edit = {'שינוי תקציב':'budget','שינוי שימוש':'uses','שינוי הנעה':'fuel','שינוי שנתון':'year','בחירת יצרן':'brands','הגבלת קילומטראז׳':'maxKm','הגבלת יד':'maxHand'};
  function focusAction() {
    (stage === 'results' ? log.querySelector('.assistant-result button') || log.querySelector('.assistant-choices button') : log.querySelector('.assistant-choices button'))?.focus({preventScroll:true});
  }
  function respond(label) {
    if (label !== 'התחל מחדש' && !Object.hasOwn(edit,label) && !Object.hasOwn(selections,label)) return;
    retireChoices(); message(label,true);
    if (label === 'התחל מחדש') reset();
    else if (Object.hasOwn(edit,label)) ask(edit[label]);
    else { prefs = {...prefs,...selections[label]}; next(); }
    focusAction();
  }
  function reset(initialUse) {
    prefs = initialUse ? {uses:[initialUse]} : {}; stage = 'budget'; log.replaceChildren(); lastResultsStart = null;
    snapshot = JSON.stringify(stock());
    $('assistant-current-search').hidden = true; $('assistant-current-search').textContent = '';
    message('היי, אני מכוניתי 🚘\nנעזור לך לצמצם את החיפוש מתוך המלאי. החיפוש מתבצע בכפתורי בחירה בלבד, בלי צורך להקליד.'); if(initialUse){const labels={city:'בעיקר בעיר',family:'מקום לכל המשפחה',long:'אוהבים את הדרך'};message('הכיוון שבחרתם: '+labels[initialUse],true)} next();
  }
  function fitMobileViewport() {
    const mobile = window.innerWidth <= 560;
    dialog.classList.toggle('assistant-mobile-viewport', mobile);
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    dialog.classList.toggle('assistant-compact', mobile && height < 500);
    if (!mobile) return;
    const gap = 8;
    dialog.style.setProperty('--chat-top', ((viewport?.offsetTop || 0) + gap) + 'px');
    dialog.style.setProperty('--chat-left', ((viewport?.offsetLeft || 0) + gap) + 'px');
    dialog.style.setProperty('--chat-width', Math.max(0, (viewport?.width || window.innerWidth) - gap * 2) + 'px');
    dialog.style.setProperty('--chat-height', Math.max(0, height - gap * 2) + 'px');
  }
  let viewportFrame = 0;
  function scheduleViewportFit() {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => { if (dialog.open) fitMobileViewport(); });
  }
  window.addEventListener('resize', scheduleViewportFit);
  window.visualViewport?.addEventListener('resize', scheduleViewportFit);
  window.visualViewport?.addEventListener('scroll', scheduleViewportFit);
  function open(event) {
    opener = document.activeElement;
    fitMobileViewport();
    dialog.showModal(); $('assistant-launcher').setAttribute('aria-expanded', 'true');
    const initialUse = event?.currentTarget?.dataset.assistantUse;
    if (['city','family','long'].includes(initialUse)) { reset(initialUse); started = true; }
    else if (!started) { reset(); started = true; }
    else if (stage === 'results' && snapshot !== JSON.stringify(stock())) results();
    if (stage === 'results' && lastResultsStart?.isConnected) scrollTo(lastResultsStart); else bottom();
    focusAction();
  }
  $('assistant-launcher').onclick = open;
  document.querySelectorAll('[data-open-assistant]').forEach(b => b.onclick = open);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  $('assistant-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    $('assistant-launcher').setAttribute('aria-expanded', 'false');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  $('assistant-restart').onclick = () => { reset(); log.querySelector('.assistant-choices button')?.focus({ preventScroll: true }); };
  $('assistant-show-results').onclick = () => { retireChoices(); message('הצגת רכבים לפי הבחירות הנוכחיות',true); finishMissing(); focusAction(); };
  window.addEventListener('storage', e => {
    if ((e.key === Inventory.KEY || e.key === null) && started && stage === 'results') results();
  });
})();
