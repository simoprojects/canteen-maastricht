// Pannello per lo staff della canteen: menu (piatti, prezzi, foto, esauriti), cena del mercoledì, punti e sconti.
// Usa i dati di data.js e le funzioni di app.js.
// ponytail: demo senza server e senza login. Le modifiche restano in questo browser (localStorage) e l'app
// degli studenti le legge all'avvio, ma solo su questo dispositivo. Per farle vedere a tutti servono
// un database e gli account dello staff (per esempio Supabase): è il passo successivo.

const SECTIONS = ['daily', '1', '2', '3', '4', '5', 'glutenFree'];
// Problemi trovati da dishProblems → messaggio da mostrare sotto il modulo.
const PROBLEM_KEYS = { name: 'stErrName', desc: 'stErrDesc', price: 'stErrPrice', vegan: 'stErrVegan', photo: 'stErrPhoto', n: 'stErrNutrition' };
// Regole di punti e sconti modificabili: [campo, etichetta, in percentuale?]
const REWARD_FIELDS = [
  ['dailyDiscount', 'stDailyDiscount', true], ['perEuro', 'stPerEuro', false], ['onTime', 'stOnTime', false],
  ['graceMinutes', 'stGrace', false], ['coffeeEvery', 'stCoffeeEvery', false], ['goldAt', 'stGoldAt', false],
  ['goldDiscount', 'stGoldDiscount', true],
];

let staffTab = 'menu';      // 'menu' | 'dinner' | 'rewards'
let section = 'daily';      // lista del menu aperta
let draft = null;           // copia di lavoro dei dati: si salva tutta insieme

const copy = x => JSON.parse(JSON.stringify(x));
const listOf = sec => (sec === 'daily' ? draft.menu.daily : sec === 'glutenFree' ? draft.menu.glutenFree : draft.menu.seasonal[sec]);
const sectionLabel = sec => (sec === 'daily' ? t('everyDay') : sec === 'glutenFree' ? t('gfCorner') : weekday(Number(sec), 'short'));
const draftDishes = () => [...draft.menu.daily, ...Object.values(draft.menu.seasonal).flat(), ...draft.menu.glutenFree];
const dinnerIdeas = () => [
  ...store.get('ideas', []).filter(text => typeof text === 'string').map(text => ({ text, by: t('stThisDevice') })),
  ...DINNER.ideas,
];

function loadDraft() {
  draft = copy({
    menu: { season: MENU.season, daily: MENU.daily, seasonal: MENU.seasonal, glutenFree: MENU.glutenFree },
    dinner: { theme: DINNER.theme, themeDesc: DINNER.themeDesc },
    rewards: REWARDS,
  });
}

// Salva tutto e lo applica subito. Se qualcosa non torna non salva niente e ricarica i dati buoni.
function saveDraft(messageKey) {
  if (!menuValid(draft.menu) || !rewardsValid(draft.rewards)) {
    toast(t('stErrOther'));
    loadDraft();
  } else {
    store.set('staff', draft);
    applyStaffData(copy(draft));
    toast(t(messageKey));
  }
  renderStaff();
}

// Identificativo per un piatto nuovo, ricavato dal nome e mai ripetuto.
function newId(name) {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'dish';
  const taken = new Set(draftDishes().map(d => d.id));
  let id = base;
  for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
  return id;
}

/* ---------- Menu ---------- */

function staffMenu() {
  const list = listOf(section), weekdaySection = !['daily', 'glutenFree'].includes(section);
  return `
    <div class="filters">${SECTIONS.map(sec => `<button class="chip round ${sec === section ? 'on' : ''}" aria-pressed="${sec === section}" onclick="setSection('${sec}')"><span class="cap">${sectionLabel(sec)}</span></button>`).join('')}</div>
    <h2>${weekdaySection ? `${t('seasonal')} · <span class="cap">${weekday(Number(section))}</span>` : sectionLabel(section)}</h2>
    ${section === 'glutenFree' ? `<p class="hint">${t('gfNote')}</p>` : ''}
    <div class="card list">${list.length ? list.map((d, i) => `
      <div class="pick staff-row">
        ${thumb(d)}
        <span class="grow"><strong>${esc(L(d.name))}</strong><span class="muted">${price(d)} · ${L(CATEGORIES[d.cat])} · ${d.n[0]} kcal</span><span class="tags">${dishTags(d)}</span></span>
        <span class="row-actions">
          <label class="switch"><input type="checkbox" ${isSoldOut(d) ? 'checked' : ''} onchange="toggleSoldOut(${i}, this.checked)">${t('soldOut')}</label>
          <button class="btn ghost small" onclick="editDish(${i})">${icon('pencil')}${t('stEdit')}</button>
        </span>
      </div>`).join('') : `<p class="muted">${t('stEmpty')}</p>`}</div>
    <button class="btn" onclick="editDish(-1)">${icon('plus')}${t('stAddDish')}</button>
    ${weekdaySection ? `
      <form class="card form" onsubmit="saveSeason(event)">
        <h3>${t('stSeason')}</h3>
        <div class="grid2">
          <label>${t('stSeasonEn')}<input name="en" required maxlength="30" value="${esc(draft.menu.season.en)}"></label>
          <label>${t('stSeasonNl')}<input name="nl" required maxlength="30" value="${esc(draft.menu.season.nl)}"></label>
        </div>
        <button class="btn ghost" type="submit">${t('stSave')}</button>
      </form>` : ''}`;
}

// Modulo per modificare (i >= 0) o aggiungere (i = -1) un piatto della lista aperta.
function editDish(i) {
  const gfCorner = section === 'glutenFree';
  const d = i >= 0 ? listOf(section)[i]
    : { cat: 'main', price: 5, diet: '', al: [], n: [0, 0, 0, 0, 0, 0, 0], name: { en: '', nl: '' }, desc: { en: '', nl: '' } };
  const diets = [['', 'stMeatFish'], ['veg', 'vegetarian'], ['vegan', 'vegan']];
  openSheet(`
    <h2>${i >= 0 ? t('stEditDish') : t('stNewDish')}</h2>
    <form class="form" onsubmit="saveDish(event, ${i})">
      <div class="grid2">
        <label>${t('stNameEn')}<input name="nameEn" required maxlength="80" value="${esc(d.name.en)}"></label>
        <label>${t('stNameNl')}<input name="nameNl" required maxlength="80" value="${esc(d.name.nl)}"></label>
        <label>${t('stDescEn')}<textarea name="descEn" required maxlength="200" rows="2">${esc(d.desc.en)}</textarea></label>
        <label>${t('stDescNl')}<textarea name="descNl" required maxlength="200" rows="2">${esc(d.desc.nl)}</textarea></label>
        <label>${t('stCategory')}<select name="cat">${Object.keys(CATEGORIES).map(c => `<option value="${c}" ${c === d.cat ? 'selected' : ''}>${L(CATEGORIES[c])}</option>`).join('')}</select></label>
        <label>${t('stPrice')}<input name="price" type="number" inputmode="decimal" required min="0.05" max="99" step="0.05" value="${d.price}"></label>
        <label>${t('stDiet')}<select name="diet">${diets.map(([v, key]) => `<option value="${v}" ${v === d.diet ? 'selected' : ''}>${t(key)}</option>`).join('')}</select></label>
        <label>${t('stPhoto')}<input name="photo" type="url" inputmode="url" maxlength="300" placeholder="https://…" value="${esc(d.photo || '')}"></label>
      </div>
      <p class="hint">${t('stPhotoHint')}</p>
      <fieldset>
        <legend>${t('allergens')}</legend>
        <div class="checks">${Object.keys(ALLERGENS).map(a => `<label><input type="checkbox" name="al" value="${a}" ${d.al.includes(a) ? 'checked' : ''} ${gfCorner && a === 'gluten' ? 'disabled' : ''}>${L(ALLERGENS[a])}</label>`).join('')}</div>
      </fieldset>
      <fieldset>
        <legend>${t('nutrition')}</legend>
        <div class="grid4">${NUTRIENTS.map((nu, k) => `<label>${L(nu)} (${nu.unit})<input name="n${k}" type="number" inputmode="decimal" required min="0" max="4999" step="0.1" value="${d.n[k]}"></label>`).join('')}</div>
      </fieldset>
      <p id="dish-err" class="error" role="alert"></p>
      <button class="btn" type="submit">${t('stSave')}</button>
      ${i >= 0 ? `<button class="btn text" type="button" onclick="deleteDish(${i})">${icon('trash')}${t('stDelete')}</button>` : ''}
    </form>`);
}

function saveDish(event, i) {
  event.preventDefault();
  const f = new FormData(event.target), list = listOf(section), gfCorner = section === 'glutenFree';
  const old = i >= 0 ? list[i] : null;
  const text = key => String(f.get(key) || '').trim();
  const dish = {
    id: old ? old.id : newId(text('nameEn') || text('nameNl')),
    cat: text('cat'),
    price: Math.round(Number(f.get('price')) * 100) / 100,
    diet: text('diet'),
    ...(gfCorner ? { gf: true } : {}),
    al: f.getAll('al').map(String),
    n: NUTRIENTS.map((_, k) => Number(f.get('n' + k))),
    name: { en: text('nameEn'), nl: text('nameNl') },
    desc: { en: text('descEn'), nl: text('descNl') },
  };
  if (text('photo')) dish.photo = text('photo');
  if (old && old.soldOutOn) dish.soldOutOn = old.soldOutOn;
  const problems = dishProblems(dish, gfCorner);
  if (problems.length) {
    document.getElementById('dish-err').textContent = [...new Set(problems.map(p => t(PROBLEM_KEYS[p] || 'stErrOther')))].join(' ');
    return;
  }
  if (old) list[i] = dish; else list.push(dish);
  closeSheet();
  saveDraft('stSaved');
}

function deleteDish(i) {
  if (!confirm(t('stConfirmDelete'))) return;
  listOf(section).splice(i, 1);
  closeSheet();
  saveDraft('stDeleted');
}

// Esaurito vale solo per oggi: domani il piatto torna disponibile da solo.
function toggleSoldOut(i, on) {
  const d = listOf(section)[i];
  if (on) d.soldOutOn = localDate(); else delete d.soldOutOn;
  saveDraft(on ? 'stSoldOutOn' : 'stSoldOutOff');
}

function saveSeason(event) {
  event.preventDefault();
  const f = new FormData(event.target);
  draft.menu.season = { en: String(f.get('en')).trim(), nl: String(f.get('nl')).trim() };
  saveDraft('stSaved');
}

/* ---------- Cena del mercoledì ---------- */

function staffDinner() {
  const dn = draft.dinner;
  return `
    <form class="card form" onsubmit="saveDinner(event)">
      <h2>${t('themeLabel')}</h2>
      <div class="grid2">
        <label>${t('stThemeEn')}<input id="th-en" name="themeEn" required maxlength="80" value="${esc(dn.theme.en)}"></label>
        <label>${t('stThemeNl')}<input id="th-nl" name="themeNl" required maxlength="80" value="${esc(dn.theme.nl)}"></label>
        <label>${t('stDescEn')}<textarea name="descEn" required maxlength="300" rows="3">${esc(dn.themeDesc.en)}</textarea></label>
        <label>${t('stDescNl')}<textarea name="descNl" required maxlength="300" rows="3">${esc(dn.themeDesc.nl)}</textarea></label>
      </div>
      <p id="dn-err" class="error" role="alert"></p>
      <button class="btn" type="submit">${t('stSaveTheme')}</button>
    </form>
    <h2>${t('ideasSoFar')}</h2>
    <p class="hint">${t('stIdeasHint')}</p>
    <div class="card list">${dinnerIdeas().map((idea, k) => `
      <div class="pick staff-row">
        <span class="grow"><span>${esc(idea.text)}</span><span class="muted">${esc(idea.by)}</span></span>
        <button class="btn ghost small" onclick="useIdea(${k})">${t('stUseIdea')}</button>
      </div>`).join('')}</div>`;
}

// Copia l'idea nel tema: lo staff la traduce e poi pubblica.
function useIdea(k) {
  const idea = dinnerIdeas()[k];
  if (!idea) return;
  for (const id of ['th-en', 'th-nl']) document.getElementById(id).value = idea.text;
  const first = document.getElementById('th-en');
  first.scrollIntoView({ block: 'center' });
  first.focus();
  toast(t('stIdeaCopied'));
}

function saveDinner(event) {
  event.preventDefault();
  const f = new FormData(event.target), text = key => String(f.get(key) || '').trim();
  const next = { theme: { en: text('themeEn'), nl: text('themeNl') }, themeDesc: { en: text('descEn'), nl: text('descNl') } };
  if (!bothLangs(next.theme) || !bothLangs(next.themeDesc)) {
    document.getElementById('dn-err').textContent = t('stErrDinner');
    return;
  }
  draft.dinner = next;
  saveDraft('stSaved');
}

/* ---------- Punti e sconti ---------- */

function staffRewards() {
  const r = draft.rewards;
  return `
    <form class="card form" onsubmit="saveRewards(event)">
      <h2>${t('stRewards')}</h2>
      <div class="grid2">${REWARD_FIELDS.map(([k, key, isPct]) => {
        const [min, max] = REWARD_LIMITS[k], scale = isPct ? 100 : 1;
        return `<label>${t(key)}<input name="${k}" type="number" inputmode="numeric" required min="${min * scale}" max="${max * scale}" step="1" value="${Math.round(r[k] * scale)}"></label>`;
      }).join('')}</div>
      <p class="hint">${t('stRewardsHint')}</p>
      <p id="rw-err" class="error" role="alert"></p>
      <button class="btn" type="submit">${t('stSave')}</button>
    </form>
    <section class="card form">
      <h2>${t('stReset')}</h2>
      <p class="muted">${t('stResetText')}</p>
      <button class="btn ghost" onclick="resetAll()">${t('stResetBtn')}</button>
    </section>`;
}

function saveRewards(event) {
  event.preventDefault();
  const f = new FormData(event.target), next = {};
  for (const [k, , isPct] of REWARD_FIELDS) next[k] = Number(f.get(k)) / (isPct ? 100 : 1);
  if (!rewardsValid(next)) {
    document.getElementById('rw-err').textContent = t('stErrRewards');
    return;
  }
  draft.rewards = next;
  saveDraft('stSaved');
}

function resetAll() {
  if (!confirm(t('stConfirmReset'))) return;
  store.set('staff', null);
  location.reload();   // si ricaricano i dati originali di data.js
}

/* ---------- Disegno della pagina ---------- */

function setStaffTab(id) { staffTab = id; renderStaff(); scrollTo(0, 0); }
function setSection(sec) { section = sec; renderStaff(); }
function setStaffLang(code) { lang = code; store.set('lang', lang); renderStaff(); }

function renderStaff() {
  document.documentElement.lang = lang;
  const tabs = [['menu', 'stMenu'], ['dinner', 'dinnerTitle'], ['rewards', 'stRewards']];
  document.getElementById('top').innerHTML = `
    <div class="top-row">
      <h1>${t('stTitle')}</h1>
      <a class="top-link" href="index.html">${t('stOpenApp')}</a>
      <div class="lang" role="group" aria-label="Language / Taal">
        ${['en', 'nl'].map(code => `<button class="${code === lang ? 'on' : ''}" aria-pressed="${code === lang}" onclick="setStaffLang('${code}')">${code.toUpperCase()}</button>`).join('')}
      </div>
    </div>
    <nav class="staff-tabs">${tabs.map(([id, key]) => `<button class="${id === staffTab ? 'on' : ''}" aria-pressed="${id === staffTab}" onclick="setStaffTab('${id}')">${t(key)}</button>`).join('')}</nav>`;
  const body = staffTab === 'menu' ? staffMenu() : staffTab === 'dinner' ? staffDinner() : staffRewards();
  document.getElementById('panel').innerHTML = `<p class="notice">${icon('info')}<span>${t('stDemo')}</span></p>${body}`;
}

function bootStaff() {
  applyStaffData(store.get('staff', null));
  const savedLang = store.get('lang', 'en');
  lang = Object.hasOwn(I18N, savedLang) ? savedLang : 'en';
  loadDraft();
  const sheet = document.getElementById('sheet');
  sheet.addEventListener('click', event => { if (event.target === sheet) sheet.close(); });
  renderStaff();
}

bootStaff();
