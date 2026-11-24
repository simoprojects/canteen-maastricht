// Logica dell'app Canteen Maastricht.
// La prima parte non tocca la pagina: sono funzioni "pure" che `node check.js` può verificare.
// La seconda parte (più in basso) disegna le schermate.

/* ---------- QR code ---------- */

// Aritmetica del campo GF(256), usata dalla correzione d'errore (Reed-Solomon) dei QR.
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  GF_EXP[i] = GF_EXP[i + 255] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11D;
}
const gfMul = (a, b) => (a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0);

// Codeword di correzione d'errore: resto della divisione dei dati per il polinomio generatore.
function rsRemainder(data, ecLen) {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gfMul(c, GF_EXP[i]); });
    gen = next;
  }
  const rem = new Array(ecLen).fill(0);
  for (const d of data) {
    const f = d ^ rem.shift();
    rem.push(0);
    for (let j = 0; j < ecLen; j++) rem[j] ^= gfMul(gen[j + 1], f);
  }
  return rem;
}

// QR code versione 3 (29×29 moduli), correzione d'errore M, testo in byte.
// Restituisce una griglia di true/false (true = quadratino nero).
// ponytail: versione e maschera fisse → massimo 42 byte di testo.
// Se un giorno servono testi più lunghi, passare a una libreria QR completa.
function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 42) throw new Error('QR: massimo 42 byte');
  const N = 29;

  // 1. Testo → 44 codeword di dati + 26 di correzione
  const bits = [];
  const put = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, 8);
  bytes.forEach(b => put(b, 8));
  put(0, 4);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xEC; data.length < 44; pad ^= 0xFD) data.push(pad);
  const codewords = data.concat(rsRemainder(data, 26));

  // 2. Disegni fissi: linee di sincronismo, tre mirini, quadratino di allineamento, formato
  const dark = Array.from({ length: N }, () => new Array(N).fill(false));
  const fixed = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (x, y, on) => {
    if (x >= 0 && x < N && y >= 0 && y < N) { dark[y][x] = on; fixed[y][x] = true; }
  };
  for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Informazione di formato: livello M + maschera 0 danno sempre il valore 0x5412.
  const fmt = i => ((0x5412 >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, fmt(i));
  set(8, 7, fmt(6)); set(8, 8, fmt(7)); set(7, 8, fmt(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, fmt(i));
  for (let i = 0; i < 8; i++) set(N - 1 - i, 8, fmt(i));
  for (let i = 8; i < 15; i++) set(8, N - 15 + i, fmt(i));
  set(8, N - 8, true);

  // 3. Dati a zig-zag partendo dall'angolo in basso a destra.
  //    Maschera 0: il quadratino si inverte dove x + y è pari.
  let k = 0;
  for (let right = N - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < N; v++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = ((right + 1) & 2) === 0 ? N - 1 - v : v;
      if (fixed[y][x]) continue;
      const bit = k < codewords.length * 8 && ((codewords[k >> 3] >> (7 - (k & 7))) & 1) === 1;
      dark[y][x] = bit !== ((x + y) % 2 === 0);
      k++;
    }
  }
  return dark;
}

// Il QR come immagine SVG. Sempre nero su bianco, con il bordo bianco di 4 moduli
// che serve ai lettori per riconoscerlo.
function qrSvg(text) {
  let path = '';
  qrMatrix(text).forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z`; }));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 37 37" shape-rendering="crispEdges" role="img" aria-label="QR">' +
    `<rect x="-4" y="-4" width="37" height="37" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/* ---------- Codice personale ---------- */

const QR_PERIOD_MS = 3000;   // il codice personale cambia ogni 3 secondi

// Piccolo hash (FNV-1a) per ottenere numeri "casuali ma stabili".
function hash32(str) {
  let h = 0x811C9DC5;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

// Testo dentro il QR personale: cambia a ogni periodo di 3 secondi.
// ponytail: la "firma" finale è solo dimostrativa. Con un server vero il codice va firmato
// lato server (TOTP/HMAC) e la cassa lo accetta una sola volta: è lì che lo sconto diventa "una volta sola".
function qrToken(studentId, now) {
  const step = Math.floor(now / QR_PERIOD_MS);
  return `MM1.${studentId}.${step}.${hash32(studentId + '.' + step)}`;
}

/* ---------- Regole dell'app ---------- */

// Posti liberi di esempio: finti ma stabili, cambiano ogni 5 minuti (tra il 25% e il 75% dei posti).
function seatsFree(canteen, now) {
  const busy = parseInt(hash32(canteen.id + Math.floor(now / 300000)).slice(0, 4), 16) / 0xFFFF;
  return Math.round(canteen.seats * (0.25 + 0.5 * busy));
}

// Fase della cena del mercoledì in base al giorno (0 = domenica ... 6 = sabato):
// da giovedì a sabato si raccolgono le idee, domenica si decide, da lunedì a mercoledì il tema è annunciato.
function dinnerPhase(day) {
  return day >= 4 ? 'ideas' : day === 0 ? 'deciding' : 'announced';
}

// Durata della prenotazione in minuti: mai più del massimo consentito (30).
function clampMinutes(value) {
  return Math.min(MAX_SEAT_MINUTES, Math.max(5, Math.round(Number(value)) || MAX_SEAT_MINUTES));
}

// Filtro del menu: 'veg' = vegetariano (quindi anche vegano), 'vegan', 'gf' = senza glutine, altrimenti tutto.
function matchesFilter(dish, filter) {
  if (filter === 'veg') return dish.diet !== '';
  if (filter === 'vegan') return dish.diet === 'vegan';
  if (filter === 'gf') return dish.gf === true;
  return true;
}

// Totale di un ordine, in centesimi per evitare errori di arrotondamento.
// lines = [{ price, qty }], rate = sconto da applicare (0 = nessuno sconto).
function orderTotal(lines, rate) {
  const subtotal = lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.qty, 0);
  const discount = Math.round(subtotal * rate);
  return { subtotal, discount, total: subtotal - discount };
}

// Testo scritto nel QR del tavolo: deve coincidere con il posto assegnato.
function seatCode(b) {
  return `MM1.SEAT.${b.canteen}.${b.table}.${b.seat}`;
}

// Orario proposto nei moduli: il prossimo multiplo di 5 minuti, dentro l'orario del pranzo.
function defaultTime(now = new Date()) {
  const next = new Date(Math.ceil(now.getTime() / 300000) * 300000);
  const time = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
  if (time < LUNCH.open) return LUNCH.open;
  return time <= LUNCH.close ? time : '12:00';
}

/* ---------- Punti e premi ---------- */

// Mese come testo 'AAAA-MM' (ora locale): i punti valgono solo nel mese in cui li guadagni.
const monthKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// Punti del mese: se quelli salvati sono di un mese passato (o rovinati) si riparte da zero.
function monthPoints(saved, now = new Date()) {
  const month = monthKey(now);
  if (saved && saved.month === month && Number.isFinite(saved.points) && Number.isFinite(saved.coffeesUsed) && Array.isArray(saved.log)) return saved;
  return { month, points: 0, coffeesUsed: 0, log: [] };
}

// Punti per un pasto: REWARDS.perEuro per ogni euro pagato (cents = centesimi pagati, dopo lo sconto).
const mealPoints = cents => Math.floor((Math.max(0, cents) * REWARDS.perEuro) / 100);

// Punti in più se lasci il posto entro la fine del tempo prenotato (più qualche minuto di tolleranza).
const onTimePoints = (leftAt, endAt) => (leftAt <= endAt + REWARDS.graceMinutes * 60000 ? REWARDS.onTime : 0);

// Situazione dei premi: caffè guadagnati e ancora da usare, sconto del mese raggiunto o no.
function rewardStatus(state) {
  const coffeesEarned = Math.floor(state.points / REWARDS.coffeeEvery);
  return {
    points: state.points,
    coffeesEarned,
    coffeesLeft: Math.max(0, coffeesEarned - state.coffeesUsed),
    toCoffee: REWARDS.coffeeEvery - (state.points % REWARDS.coffeeEvery),
    gold: state.points >= REWARDS.goldAt,
    toGold: Math.max(0, REWARDS.goldAt - state.points),
  };
}

// Sconto su un pasto: se hai raggiunto lo sconto del mese vale su tutti i pasti,
// altrimenti c'è lo sconto studenti una volta al giorno. I due sconti non si sommano.
const discountRate = (gold, dailyAvailable) => (gold ? REWARDS.goldDiscount : dailyAvailable ? REWARDS.dailyDiscount : 0);

// Primo giorno del mese successivo: è lì che i punti si azzerano.
const resetDate = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() + 1, 1);

/* ---------- Foto e piatti esauriti ---------- */

// Foto di un piatto: quella scelta dallo staff, altrimenti quella di Wikimedia Commons (se c'è).
const photoOf = d => (d.photo ? { src: d.photo } : PHOTOS[d.id] || null);
// Versione piccola della stessa foto: Wikimedia prepara le miniature in misure fisse (250 px va bene).
const thumbOf = src => src.replace(/\/500px-/, '/250px-');
// Lo staff segna un piatto come esaurito per un giorno preciso (AAAA-MM-GG).
const soldOut = (d, day) => d.soldOutOn === day;

/* ---------- Dati modificati dallo staff ---------- */

const DIETS = ['', 'veg', 'vegan'];
const ANIMAL = ['milk', 'egg', 'fish', 'crustaceans', 'molluscs'];   // allergeni che un piatto vegano non può avere
const bothLangs = x => !!x && typeof x.en === 'string' && x.en.trim() !== '' && typeof x.nl === 'string' && x.nl.trim() !== '';

// Controlla un piatto: restituisce l'elenco dei problemi (vuoto se va bene).
// glutenFreeCorner = il piatto sta nell'angolo senza glutine.
function dishProblems(d, glutenFreeCorner) {
  if (!d || typeof d !== 'object') return ['dish'];
  const p = [];
  if (typeof d.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(d.id)) p.push('id');
  if (!bothLangs(d.name)) p.push('name');
  if (!bothLangs(d.desc)) p.push('desc');
  if (!Object.hasOwn(CATEGORIES, d.cat)) p.push('cat');
  if (!(Number.isFinite(d.price) && d.price > 0 && d.price < 100)) p.push('price');
  if (!DIETS.includes(d.diet)) p.push('diet');
  if (!Array.isArray(d.al) || !d.al.every(a => Object.hasOwn(ALLERGENS, a))) p.push('al');
  else if (d.diet === 'vegan' && d.al.some(a => ANIMAL.includes(a))) p.push('vegan');
  if (!Array.isArray(d.n) || d.n.length !== NUTRIENTS.length || !d.n.every(v => Number.isFinite(v) && v >= 0 && v < 5000)) p.push('n');
  if (d.photo !== undefined && !/^https:\/\/[^\s"'<>]+$/.test(d.photo)) p.push('photo');
  if (d.soldOutOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.soldOutOn)) p.push('soldOut');
  if (glutenFreeCorner ? !(d.gf === true && Array.isArray(d.al) && !d.al.includes('gluten')) : d.gf !== undefined) p.push('gf');
  return p;
}

// Tutto il menu salvato dallo staff è valido? (stagione in due lingue, piatti corretti, nessun id ripetuto)
function menuValid(menu) {
  if (!menu || !bothLangs(menu.season) || !Array.isArray(menu.daily) || !Array.isArray(menu.glutenFree) || !menu.seasonal) return false;
  const lists = [[menu.daily, false], [menu.glutenFree, true], ...[1, 2, 3, 4, 5].map(day => [menu.seasonal[day], false])];
  if (!lists.every(([list, gf]) => Array.isArray(list) && list.every(d => dishProblems(d, gf).length === 0))) return false;
  const ids = lists.flatMap(([list]) => list.map(d => d.id));
  return new Set(ids).size === ids.length;
}

// Limiti ragionevoli per le regole di punti e sconti (gli sconti sono frazioni: 0.2 = 20%).
const REWARD_LIMITS = {
  dailyDiscount: [0, 0.5], perEuro: [0, 100], onTime: [0, 500], graceMinutes: [0, 15],
  coffeeEvery: [10, 5000], goldAt: [10, 20000], goldDiscount: [0, 0.5],
};
const rewardsValid = r => !!r && Object.entries(REWARD_LIMITS).every(([k, [min, max]]) => Number.isFinite(r[k]) && r[k] >= min && r[k] <= max);

// Applica le modifiche salvate dallo staff, ma solo le parti valide: dati rovinati non rompono l'app.
function applyStaffData(saved) {
  if (!saved || typeof saved !== 'object') return;
  if (menuValid(saved.menu)) {
    MENU.season = saved.menu.season;
    MENU.daily = saved.menu.daily;
    MENU.glutenFree = saved.menu.glutenFree;
    for (const day of [1, 2, 3, 4, 5]) MENU.seasonal[day] = saved.menu.seasonal[day];
  }
  if (rewardsValid(saved.rewards)) for (const k of Object.keys(REWARD_LIMITS)) REWARDS[k] = saved.rewards[k];
  const dinner = saved.dinner;
  if (dinner && bothLangs(dinner.theme) && bothLangs(dinner.themeDesc)) {
    DINNER.theme = { en: dinner.theme.en, nl: dinner.theme.nl };
    DINNER.themeDesc = { en: dinner.themeDesc.en, nl: dinner.themeDesc.nl };
  }
}

/* =====================================================================
   Da qui in giù: le schermate. Questa parte lavora solo nel browser.
   ===================================================================== */

// Salvataggio sul telefono. Se il browser lo blocca, l'app funziona lo stesso ma non ricorda.
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('mensa.' + key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('mensa.' + key, JSON.stringify(value)); } catch { /* si continua senza salvare */ }
  },
};

let lang = 'en';          // lingua corrente: 'en' oppure 'nl'
let booking = null;       // posto prenotato: { canteen, time, minutes, table, seat, checkedInAt }
let order = null;         // ordine da asporto pagato: { canteen, code, time, lines, discount, gold, rate, total, points }
let cart = {};            // carrello dell'asporto: { idPiatto: quantità }
let paying = false;       // asporto: false = scelta dei piatti, true = pagamento
let menuDay = 1;          // giorno mostrato nel menu (1 = lunedì ... 5 = venerdì)
let menuFilter = 'all';
let demoDay = null;       // giorno simulato per provare la cena del mercoledì
let myIdeas = [];         // idee per la cena inviate da questo telefono
let applied = null;       // nome di chi ha appena inviato la candidatura
let lastRoute = '';
let points = monthPoints(null);   // punti del mese: { month, points, coffeesUsed, log }
let seatPhase = '';       // posto occupato: 'on' durante il tempo, 'grace' nei minuti di tolleranza

// Voci dello storico dei punti → testo da mostrare.
const LOG_KEYS = { till: 'logTill', takeaway: 'logTakeaway', ontime: 'logOnTime', demo: 'logDemo' };

const allDishes = () => [...MENU.daily, ...Object.values(MENU.seasonal).flat(), ...MENU.glutenFree];

/* ---------- Piccoli aiuti ---------- */

// Rende innocuo un testo prima di metterlo nella pagina (niente codice nascosto nei testi scritti dagli utenti).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Testo dell'interfaccia nella lingua corrente; i valori tra graffe vengono sempre resi innocui.
const t = (key, vars = {}) => (I18N[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => esc(vars[k] ?? ''));
const L = text => text[lang];   // sceglie en/nl da un dato come { en: '...', nl: '...' }
const locale = () => (lang === 'nl' ? 'nl-NL' : 'en-IE');
const money = cents => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(cents / 100);
const price = dish => money(Math.round(dish.price * 100));
const num = n => n.toLocaleString(locale());
const pct = rate => Math.round(rate * 100);
const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="icons.svg#i-${name}"/></svg>`;
const canteenOf = id => CANTEENS.find(c => c.id === id) || CANTEENS[0];
const dishOf = id => allDishes().find(d => d.id === id);
const street = c => c.address.split(',')[0];
const localDate = () => new Date().toLocaleDateString('sv-SE');   // AAAA-MM-GG nell'ora locale
const isSoldOut = d => soldOut(d, localDate());
const dailyAvailable = () => store.get('discountUsedOn', '') !== localDate();
const longDate = date => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(date);
const monthName = () => new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date());
// Nome del giorno (0 = domenica ... 6 = sabato) nella lingua corrente. Il 1° gennaio 2024 era un lunedì.
const weekday = (day, style = 'long') => new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2024, 0, day || 7));
const mmss = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const seatEnd = () => booking.checkedInAt + booking.minutes * 60000;
const seatTimeLeft = () => seatEnd() - Date.now();
const graceMs = () => REWARDS.graceMinutes * 60000;
const currentRoute = () => location.hash.slice(1) || 'home';
// Va a una schermata; se ci siamo già, la ridisegna.
function show(route) {
  if (currentRoute() === route) render(); else location.hash = route;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3500);
}

function openSheet(html) {
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `<div class="sheet-in"><button class="sheet-x" onclick="closeSheet()" aria-label="${t('close')}">${icon('x')}</button>${html}</div>`;
  sheet.showModal();
}
function closeSheet() {
  document.getElementById('sheet').close();
}

function dishTags(d) {
  const diet = d.diet === 'vegan' ? `<span class="tag green">${icon('leaf')}${t('vegan')}</span>`
    : d.diet === 'veg' ? `<span class="tag green">${t('vegetarian')}</span>` : '';
  return diet + (d.gf ? `<span class="tag blue">${t('glutenFree')}</span>` : '')
    + (isSoldOut(d) ? `<span class="tag red">${t('soldOut')}</span>` : '');
}

// Miniatura della foto di un piatto (se la foto non si carica, sparisce senza lasciare buchi).
function thumb(d, cls = 'thumb') {
  const ph = photoOf(d);
  return ph ? `<img class="${cls}" src="${esc(thumbOf(ph.src))}" alt="" loading="lazy" onerror="this.remove()">` : '';
}

/* ---------- Punti: guadagnarli e mostrarli ---------- */

// Punti del mese aggiornati: se nel frattempo è cominciato un mese nuovo, si riparte da zero.
function myPoints() {
  const fresh = monthPoints(points);
  if (fresh !== points) { points = fresh; store.set('points', points); }
  return points;
}

// Aggiunge punti allo storico del mese. Restituisce quanti punti sono stati aggiunti.
function earn(amount, kind, canteen = '') {
  if (amount <= 0) return 0;
  const p = myPoints();
  p.points += amount;
  p.log.unshift({ at: Date.now(), kind, canteen, points: amount });
  p.log = p.log.slice(0, 30);
  store.set('points', p);
  return amount;
}

// Registra un pasto pagato: punti guadagnati e, se usato, lo sconto studenti del giorno.
function payMeal(cents, usedDaily, kind, canteen) {
  if (usedDaily) store.set('discountUsedOn', localDate());
  return earn(mealPoints(cents), kind, canteen);
}

// Riga dello sconto nel conto: quello del mese oppure quello studenti del giorno.
const discountLabel = (gold, rate) => t(gold ? 'goldDiscountLine' : 'studentDiscount', { pct: pct(rate) });

// Barra dei punti con le tappe: un caffè ogni REWARDS.coffeeEvery punti, lo sconto del mese alla fine.
function pointsBar(r) {
  const max = REWARDS.goldAt;
  const marks = [];
  // Le tappe troppo vicine alla fine (meno del 12% della barra) si sovrapporrebbero alla stella: non si disegnano.
  for (let p = REWARDS.coffeeEvery; p <= max * 0.88 && marks.length < 7; p += REWARDS.coffeeEvery) marks.push(p);
  // ponytail: con tante tappe la barra diventa illeggibile; oltre 6 caffè mostriamo solo l'inizio e la fine.
  const showMarks = marks.length <= 6;
  const pos = p => `${(p / max) * 100}%`;
  const mark = (p, ic, cls) => `<span class="mark ${cls} ${r.points >= p ? 'on' : ''}" style="left:${pos(p)}">${icon(ic)}</span>`;
  return `
    <div class="pbar" role="img" aria-label="${t('pointsOf', { n: num(r.points), max: num(max) })}">
      <span class="bar"><i style="width:${Math.min(100, (r.points / max) * 100)}%"></i></span>
      ${showMarks ? marks.map(p => mark(p, 'coffee', '')).join('') : ''}
      ${mark(max, 'star', 'gold')}
    </div>
    <div class="plabels" aria-hidden="true">${(showMarks ? marks : [0]).concat(max).map(p => `<span style="left:${pos(p)}">${num(p)}</span>`).join('')}</div>`;
}

const coffeesText = n => (n === 1 ? t('coffeeReady1') : n ? t('coffeesReady', { n }) : t('noCoffee'));

/* ---------- Schermate ----------
   Ogni schermata restituisce { title, sub, back, tab, body, after } e viene disegnata da render(). */

// Riquadri in cima alla home: posto prenotato e ordine da ritirare.
function statusCards() {
  let html = '';
  if (booking) {
    const c = canteenOf(booking.canteen), left = booking.checkedInAt ? seatTimeLeft() : 0;
    const state = !booking.checkedInAt ? t('scanToCheckIn')
      : left > 0 ? `${t('timeLeft')} <b data-countdown>${mmss(left)}</b>` : `<b>${t('checkOutNow')}</b>`;
    html += `
      <a class="card status" href="#book/${c.id}">
        <span class="status-ic">${icon('armchair')}</span>
        <span class="grow"><strong>${t('yourSeat')}: ${t('tableSeat', booking)}</strong>
          <span class="muted">${c.name} · ${state}</span></span>
        ${icon('chevron-right')}
      </a>`;
  }
  if (order) {
    const c = canteenOf(order.canteen);
    html += `
      <a class="card status" href="#takeaway/${c.id}">
        <span class="status-ic">${icon('package')}</span>
        <span class="grow"><strong>${t('yourOrder')} ${esc(order.code)}</strong>
          <span class="muted">${c.name} · ${t('pickupAt', order)}</span></span>
        ${icon('chevron-right')}
      </a>`;
  }
  return html;
}

function home() {
  const day = new Date().getDay(), isOpen = day >= 1 && day <= 5;
  const r = rewardStatus(myPoints());
  const today = MENU.seasonal[isOpen ? day : 1];
  return {
    title: 'Canteen Maastricht', sub: t('hello', { name: STUDENT.name.split(' ')[0] }), tab: 'home',
    body: `
      ${statusCards()}
      <a class="card status" href="#qr">
        <span class="status-ic navy">${icon('qr')}</span>
        <span class="grow"><strong>${t('myCard')}</strong>
          <span class="muted">${t('pointsLine', { n: num(r.points) })} · ${r.gold ? t('goldShort', { pct: pct(REWARDS.goldDiscount) }) : coffeesText(r.coffeesLeft)}</span>
          <span class="bar mini"><i style="width:${Math.min(100, (r.points / REWARDS.goldAt) * 100)}%"></i></span></span>
        ${icon('chevron-right')}
      </a>

      <h2>${t('chooseCanteen')}</h2>
      ${CANTEENS.map(c => `
        <article class="card canteen">
          <a class="canteen-head" href="#canteen/${c.id}">
            <span class="grow"><strong class="big">${c.name}</strong><span class="muted">${L(c.full)}</span></span>
            <span class="free">${t('seatsFree', { n: num(seatsFree(c, Date.now())) })}</span>
          </a>
          <button class="link" onclick="openMaps('${c.id}')">${icon('map-pin')}${esc(street(c))}</button>
          <div class="row2">
            <a class="btn" href="#book/${c.id}">${t('bookSeat')}</a>
            <a class="btn ghost" href="#takeaway/${c.id}">${t('takeaway')}</a>
          </div>
        </article>`).join('')}

      <h2>${t('weekMenu')}</h2>
      <a class="card teaser" href="#menu">
        <span class="thumbs">${today.slice(0, 3).map(d => thumb(d)).join('')}</span>
        <span class="muted"><span class="cap">${isOpen ? t('today') : weekday(1)}</span> · ${t('sameEverywhere')}</span>
        ${today.map(d => `<span class="special"><strong>${esc(L(d.name))}</strong>${dishTags(d)}</span>`).join('')}
        <span class="more">${t('seeMenu')}${icon('chevron-right')}</span>
      </a>

      <h2>${t('howTitle')}</h2>
      <ol class="card steps"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ol>
      <button class="btn ghost" onclick="openTour()">${icon('info')}${t('tourAgain')}</button>

      <div class="row2">
        <a class="card teaser" href="#dinner">${icon('calendar', 'accent')}<strong>${t('dinnerTitle')}</strong><span class="muted">${t('dinnerTeaser')}</span></a>
        <a class="card teaser" href="#jobs">${icon('briefcase', 'accent')}<strong>${t('jobsTitle')}</strong><span class="muted">${t('jobsTeaser')}</span></a>
      </div>

      <footer class="footer">
        <p class="hint center">${t('unofficial')}</p>
        <a class="link" href="staff.html">${icon('sliders')}${t('staffLink')}</a>
      </footer>`,
  };
}

// Tocco sull'indirizzo: scelta dell'app di mappe.
function openMaps(id) {
  const c = canteenOf(id), q = encodeURIComponent(c.address);
  // Il collegamento "geo:" apre la scelta delle app di mappe solo su Android; altrove usiamo OpenStreetMap.
  const other = /Android/.test(navigator.userAgent) ? `geo:0,0?q=${q}` : `https://www.openstreetmap.org/search?query=${q}`;
  const links = [
    ['Google Maps', `https://www.google.com/maps/search/?api=1&query=${q}`],
    ['Apple Maps', `https://maps.apple.com/?q=${q}`],
    [t('otherMaps'), other],
  ];
  openSheet(`
    <h2>${t('openIn')}</h2>
    <p class="muted">${esc(c.address)}</p>
    ${links.map(([label, url]) => `<a class="btn ghost" href="${url}" target="_blank" rel="noopener" onclick="closeSheet()">${icon('map-pin')}${label}</a>`).join('')}`);
}

function canteen(id) {
  const c = canteenOf(id), free = seatsFree(c, Date.now());
  return {
    title: c.name, back: '#home', tab: 'home',
    body: `
      <section class="card canteen">
        <strong class="big">${L(c.full)}</strong>
        <button class="link" onclick="openMaps('${c.id}')">${icon('map-pin')}${esc(c.address)}</button>
        <p class="line">${icon('clock')}${t('lunchHours', LUNCH)}</p>
        <p class="line">${icon('users')}${t('seatsOf', { n: num(free), total: num(c.seats) })}</p>
        <span class="bar"><i style="width:${Math.round(100 * (1 - free / c.seats))}%"></i></span>
      </section>

      <h2>${t('whatToDo')}</h2>
      <section class="card option">
        <span class="status-ic">${icon('armchair')}</span>
        <div class="grow">
          <strong class="big">${t('eatHere')}</strong>
          <p class="muted">${t('eatHereText')}</p>
          <a class="btn" href="#book/${c.id}">${t('bookSeat')}</a>
        </div>
      </section>
      <section class="card option">
        <span class="status-ic">${icon('package')}</span>
        <div class="grow">
          <strong class="big">${t('takeaway')}</strong>
          <p class="muted">${t('takeawayText')}</p>
          <a class="btn ghost" href="#takeaway/${c.id}">${t('orderTakeaway')}</a>
        </div>
      </section>`,
  };
}

/* --- Prenotazione del posto --- */

function book(id) {
  if (booking) return bookingTicket();
  const c = canteenOf(id);
  return {
    title: t('bookSeat'), back: `#canteen/${c.id}`, tab: 'home',
    body: `
      <form class="card form" onsubmit="confirmBooking(event, '${c.id}')">
        <p class="line">${icon('map-pin')}<span><strong>${c.name}</strong> · ${t('seatsFree', { n: num(seatsFree(c, Date.now())) })}</span></p>
        <label for="bk-time">${t('arrival')}</label>
        <input id="bk-time" name="time" type="time" required min="${LUNCH.open}" max="${LUNCH.close}" value="${defaultTime()}">
        <p class="hint">${t('lunchHours', LUNCH)}</p>
        <fieldset>
          <legend>${t('howLong')}</legend>
          <div class="seg">${[15, 20, 30].map(m => `<label><input type="radio" name="minutes" value="${m}" ${m === MAX_SEAT_MINUTES ? 'checked' : ''}><span>${m} min</span></label>`).join('')}</div>
        </fieldset>
        <p class="hint">${t('max30')}</p>
        <p class="notice">${icon('star')}<span>${t('onTimeHint', { n: REWARDS.onTime })}</span></p>
        <button class="btn" type="submit">${t('confirmBooking')}</button>
      </form>
      <ol class="card steps"><li>${t('bookStep1')}</li><li>${t('bookStep2')}</li><li>${t('bookStep3')}</li></ol>`,
  };
}

function confirmBooking(event, id) {
  event.preventDefault();
  const form = new FormData(event.target), c = canteenOf(id);
  booking = {
    canteen: c.id,
    time: String(form.get('time')).slice(0, 5),
    minutes: clampMinutes(form.get('minutes')),
    table: 1 + Math.floor(Math.random() * (c.seats / 4)),   // tavoli da 4 posti
    seat: 1 + Math.floor(Math.random() * 4),
    checkedInAt: null,
  };
  store.set('booking', booking);
  toast(t('seatBooked'));
  render();
}

// Biglietto della prenotazione: prima della scansione i passi da fare, poi il tempo che resta,
// infine i minuti di tolleranza per lasciare il posto e prendere comunque i punti in più.
function bookingTicket() {
  const c = canteenOf(booking.canteen);
  const where = `<p class="seat">${t('tableSeat', booking)}</p><p class="muted">${c.name} · ${esc(booking.time)} · ${booking.minutes} min</p>`;
  if (booking.checkedInAt) {
    const left = seatTimeLeft(), over = left <= 0;
    return {
      title: t('yourSeat'), back: '#home', tab: 'home',
      body: `
        <section class="card center">
          ${over ? `<p class="badge warn">${icon('clock')}${t('timeUpTitle')}</p>` : `<p class="badge green">${icon('check')}${t('checkedIn')}</p>`}
          <p class="muted">${over ? t('graceLeft') : t('timeLeft')}</p>
          <p class="timer" data-countdown>${mmss(over ? left + graceMs() : left)}</p>
          ${over ? '' : `<span class="bar"><i data-countbar style="width:${Math.max(0, Math.round(100 * left / (booking.minutes * 60000)))}%"></i></span>`}
          ${where}
          <p class="hint">${over ? t('graceText', { n: REWARDS.onTime }) : t('onTimeHint', { n: REWARDS.onTime })}</p>
          <button class="btn" onclick="checkOut()">${icon('check')}${t('checkOut')}</button>
        </section>`,
    };
  }
  return {
    title: t('yourSeat'), back: '#home', tab: 'home',
    body: `
      <section class="card center">
        <p class="badge green">${icon('check')}${t('seatBooked')}</p>
        ${where}
        <ol class="steps"><li>${t('ticket1')}</li><li>${t('ticket2', booking)}</li><li>${t('ticket3', { n: REWARDS.onTime })}</li></ol>
        <a class="btn" href="#scan">${icon('camera')}${t('scanTable')}</a>
        <a class="btn ghost" href="#qr">${icon('qr')}${t('showQr')}</a>
        <button class="btn text" onclick="endBooking('bookingCancelled')">${t('cancelBooking')}</button>
      </section>`,
  };
}

// Chiude la prenotazione: annullata, posto lasciato oppure tempo scaduto.
function endBooking(messageKey, vars = {}) {
  booking = null;
  seatPhase = '';
  store.set('booking', null);
  toast(t(messageKey, vars));
  const name = currentRoute().split('/')[0];
  if (name === 'book' || name === 'scan') show('home');
  else if (name === 'home') render();
}

// Lascia il posto: se è entro il tempo (più la tolleranza) arrivano i punti in più.
function checkOut() {
  if (!booking || !booking.checkedInAt) return;
  const got = earn(onTimePoints(Date.now(), seatEnd()), 'ontime', booking.canteen);
  endBooking(got ? 'leftOnTime' : 'seatLeft', { n: got });
}

/* --- Scansione del QR sul tavolo --- */

function scan() {
  if (!booking || booking.checkedInAt) return book(booking ? booking.canteen : CANTEENS[0].id);
  return {
    title: t('scanTable'), back: `#book/${booking.canteen}`, tab: 'home', after: startCamera,
    body: `
      <div class="scanner"><video id="cam" playsinline muted></video><span class="frame"></span></div>
      <p id="scan-msg" class="center" role="status">${t('scanStarting')}</p>
      <p class="hint center">${t('scanHint', booking)}</p>
      <button class="btn" onclick="checkIn()">${t('simulateScan')}</button>`,
  };
}

let camStream = null, camTimer = null;

async function startCamera() {
  const video = document.getElementById('cam'), msg = document.getElementById('scan-msg');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (!video.isConnected) { stream.getTracks().forEach(track => track.stop()); return; }   // pagina già cambiata
    camStream = stream;
    video.srcObject = stream;
    await video.play();
    msg.textContent = t('scanLooking');
    // ponytail: la lettura vera del QR funziona solo dove il browser offre BarcodeDetector (Chrome su Android e computer).
    // Su iPhone servirà una libreria di lettura (es. jsQR) quando sui tavoli ci saranno i QR veri; per ora c'è il pulsante demo.
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      camTimer = setInterval(async () => {
        const codes = await detector.detect(video).catch(() => []);
        if (!codes.length || !booking) return;
        if (codes[0].rawValue === seatCode(booking)) checkIn(); else msg.textContent = t('wrongCode');
      }, 400);
    }
  } catch {
    msg.textContent = t('noCamera');
  }
}

function stopCamera() {
  clearInterval(camTimer);
  if (camStream) camStream.getTracks().forEach(track => track.stop());
  camStream = null;
}

// Registra la presenza al tavolo: da qui parte il tempo (massimo 30 minuti).
function checkIn() {
  if (!booking || booking.checkedInAt) return;
  booking.checkedInAt = Date.now();
  store.set('booking', booking);
  toast(t('checkedIn'));
  show(`book/${booking.canteen}`);
}

/* --- Asporto: scelta dei piatti, pagamento in app, ritiro --- */

const cartLines = () => Object.entries(cart).map(([id, qty]) => ({ ...dishOf(id), qty })).filter(l => l.id);

function takeaway(id) {
  if (order) return orderTicket();
  const c = canteenOf(id), day = new Date().getDay();
  const lines = cartLines();
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const r = rewardStatus(myPoints()), daily = dailyAvailable();
  const rate = discountRate(r.gold, daily);
  const totals = orderTotal(lines, rate);

  if (paying && count) {
    return {
      title: t('paymentTitle'), back: `#canteen/${c.id}`, tab: 'home',
      body: `
        <form class="card form" onsubmit="payOrder(event, '${c.id}')">
          <h2>${t('orderSummary')} · ${c.name}</h2>
          <table class="bill">
            ${lines.map(l => `<tr><td>${l.qty} × ${esc(L(l.name))}</td><td>${money(Math.round(l.price * 100) * l.qty)}</td></tr>`).join('')}
            <tr class="sep"><td>${t('subtotal')}</td><td>${money(totals.subtotal)}</td></tr>
            ${totals.discount ? `<tr class="good"><td>${discountLabel(r.gold, rate)}</td><td>−${money(totals.discount)}</td></tr>`
              : !daily && !r.gold ? `<tr><td colspan="2" class="muted">${t('discountUsed')}</td></tr>` : ''}
            <tr class="total"><td>${t('total')}</td><td>${money(totals.total)}</td></tr>
            <tr class="good"><td>${t('youEarn')}</td><td>+${mealPoints(totals.total)}</td></tr>
          </table>
          <label for="pk-time">${t('pickupTime')}</label>
          <input id="pk-time" name="time" type="time" required min="${LUNCH.open}" max="${LUNCH.close}" value="${defaultTime()}">
          <p class="hint">${t('pickupHint', { canteen: c.name })} ${t('lunchHours', LUNCH)}.</p>
          <button class="btn" type="submit">${t('pay', { total: money(totals.total) })}</button>
          <p class="hint center">${t('demoPay')}</p>
          <button class="btn text" type="button" onclick="setPaying(false)">${t('editOrder')}</button>
        </form>`,
    };
  }

  const section = (title, dishes, note = '') => `
    <h2>${title}</h2>${note}
    <div class="card list">${dishes.map(d => `
      <div class="pick">
        ${thumb(d)}
        <span class="grow"><strong>${esc(L(d.name))}</strong><span class="muted">${price(d)} · ${d.n[0]} kcal</span><span class="tags">${dishTags(d)}</span></span>
        ${isSoldOut(d) ? '' : `<span class="stepper">
          ${cart[d.id] ? `<button onclick="addToCart('${d.id}', -1)" aria-label="${t('remove')}: ${esc(L(d.name))}">${icon('minus')}</button><b>${cart[d.id]}</b>` : ''}
          <button onclick="addToCart('${d.id}', 1)" aria-label="${t('add')}: ${esc(L(d.name))}">${icon('plus')}</button>
        </span>`}
      </div>`).join('')}</div>`;

  return {
    title: t('takeaway'), sub: `${c.name} · ${t('inBox')}`, back: `#canteen/${c.id}`, tab: 'home',
    body: `
      <p class="notice">${icon('package')}<span>${t('takeawayIntro')}</span></p>
      ${MENU.seasonal[day] && MENU.seasonal[day].length ? section(`${t('seasonal')} · ${t('today')}`, MENU.seasonal[day]) : ''}
      ${section(t('everyDay'), MENU.daily)}
      ${section(t('gfCorner'), MENU.glutenFree, `<p class="hint">${t('gfNote')}</p>`)}
      ${count ? `
        <div class="cartbar">
          <span><strong>${t('cartCount', { n: count })}</strong> · ${money(totals.subtotal)}</span>
          <button class="btn" onclick="setPaying(true)">${t('toPayment')}</button>
        </div>` : ''}`,
  };
}

function addToCart(id, delta) {
  const d = dishOf(id);
  if (!d || (delta > 0 && isSoldOut(d))) return;
  cart[id] = Math.min(9, Math.max(0, (cart[id] || 0) + delta));
  if (!cart[id]) delete cart[id];
  render();
}

function setPaying(on) {
  paying = on;
  render();
  document.getElementById('view').scrollTop = 0;
}

// Pagamento dimostrativo: non raccoglie carte né dati bancari, registra solo l'ordine sul telefono.
function payOrder(event, id) {
  event.preventDefault();
  const lines = cartLines();
  if (!lines.length) return;
  const c = canteenOf(id), r = rewardStatus(myPoints()), rate = discountRate(r.gold, dailyAvailable());
  const totals = orderTotal(lines, rate);
  const got = payMeal(totals.total, !r.gold && rate > 0, 'takeaway', c.id);
  order = {
    canteen: c.id,
    code: 'A-' + (100 + Math.floor(Math.random() * 900)),
    time: String(new FormData(event.target).get('time')).slice(0, 5),
    lines: lines.map(l => ({ id: l.id, qty: l.qty })),
    discount: totals.discount, gold: r.gold, rate, total: totals.total, points: got,
  };
  store.set('order', order);
  cart = {};
  paying = false;
  toast(t('orderPaid'));
  render();
  document.getElementById('view').scrollTop = 0;
}

function orderTicket() {
  const c = canteenOf(order.canteen);
  return {
    title: t('yourOrder'), back: '#home', tab: 'home',
    body: `
      <section class="card center">
        <p class="badge green">${icon('check')}${t('orderPaid')}</p>
        <p class="seat">${esc(order.code)}</p>
        <p>${t('pickupInfo', { time: order.time, canteen: c.name })}</p>
        <div class="qr small">${qrSvg('MM1.ORDER.' + order.code)}</div>
        <p class="hint">${t('showAtCounter')}</p>
        <table class="bill">
          ${order.lines.map(l => {
            const d = dishOf(l.id);
            return d ? `<tr><td>${l.qty} × ${esc(L(d.name))}</td><td>${money(Math.round(d.price * 100) * l.qty)}</td></tr>` : '';
          }).join('')}
          ${order.discount ? `<tr class="good"><td>${discountLabel(order.gold, order.rate)}</td><td>−${money(order.discount)}</td></tr>` : ''}
          <tr class="total"><td>${t('totalPaid')}</td><td>${money(order.total)}</td></tr>
          ${order.points ? `<tr class="good"><td>${t('pointsEarned')}</td><td>+${order.points}</td></tr>` : ''}
        </table>
        <button class="btn ghost" onclick="pickedUp()">${t('pickedUp')}</button>
      </section>`,
  };
}

function pickedUp() {
  order = null;
  store.set('order', null);
  toast(t('enjoy'));
  show('home');
}

/* --- Menu della settimana, con foto, allergeni e valori nutrizionali --- */

function menu() {
  const list = dishes => `<div class="card list">${dishes.map(d => `
    <button class="dish" onclick="openDish('${d.id}')">
      ${thumb(d)}
      <span class="grow"><strong>${esc(L(d.name))}</strong><span class="muted">${esc(L(d.desc))}</span><span class="tags">${dishTags(d)}</span></span>
      <span class="side"><strong>${price(d)}</strong><span class="muted">${d.n[0]} kcal</span></span>
    </button>`).join('')}</div>`;
  const pick = dishes => dishes.filter(d => matchesFilter(d, menuFilter));
  const seasonal = pick(MENU.seasonal[menuDay]), glutenFree = pick(MENU.glutenFree);
  const daily = Object.keys(CATEGORIES).map(cat => [cat, pick(MENU.daily.filter(d => d.cat === cat))]).filter(([, dishes]) => dishes.length);
  const filters = [['all', 'filterAll'], ['veg', 'vegetarian'], ['vegan', 'vegan'], ['gf', 'glutenFree']];
  return {
    title: t('menuTitle'), sub: t('sameEverywhere'), tab: 'menu',
    body: `
      <div class="days">${[1, 2, 3, 4, 5].map(d => `<button class="chip ${d === menuDay ? 'on' : ''}" aria-pressed="${d === menuDay}" onclick="setMenuDay(${d})">${weekday(d, 'short')}</button>`).join('')}</div>
      <div class="filters">${filters.map(([id, key]) => `<button class="chip round ${id === menuFilter ? 'on' : ''}" aria-pressed="${id === menuFilter}" onclick="setMenuFilter('${id}')">${t(key)}</button>`).join('')}</div>
      ${seasonal.length ? `<h2>${t('seasonal')} · <span class="cap">${weekday(menuDay)}</span></h2><p class="hint">${t('seasonNote', { season: L(MENU.season) })}</p>${list(seasonal)}` : ''}
      ${daily.length ? `<h2>${t('everyDay')}</h2><p class="hint">${t('alwaysAvailable')}</p>${daily.map(([cat, dishes]) => `<h3>${L(CATEGORIES[cat])}</h3>${list(dishes)}`).join('')}` : ''}
      ${glutenFree.length ? `<h2>${t('gfCorner')}</h2><p class="hint">${t('gfNote')}</p>${list(glutenFree)}` : ''}
      ${seasonal.length + daily.length + glutenFree.length ? `<p class="hint">${t('traces')}</p>` : `<p class="notice">${icon('info')}<span>${t('noMatch')}</span></p>`}`,
  };
}

function setMenuDay(day) { menuDay = day; render(); }
function setMenuFilter(filter) { menuFilter = filter; render(); }

// Dettaglio di un piatto: foto, allergeni e valori nutrizionali.
function openDish(id) {
  const d = dishOf(id);
  if (!d) return;
  const ph = photoOf(d);
  openSheet(`
    ${ph ? `<img class="photo" src="${esc(ph.src)}" alt="${esc(L(d.name))}" onerror="this.remove()">` : ''}
    <h2>${esc(L(d.name))}</h2>
    <p class="muted">${esc(L(d.desc))}</p>
    <p class="tags">${dishTags(d)}<span class="price">${price(d)}</span></p>
    <h3>${t('allergens')}</h3>
    ${d.al.length ? `<ul class="chips">${d.al.map(a => `<li>${L(ALLERGENS[a])}</li>`).join('')}</ul>` : `<p class="muted">${t('noAllergens')}</p>`}
    <h3>${t('nutrition')}</h3>
    <table class="nutri">${NUTRIENTS.map((nutrient, i) => `<tr class="${nutrient.sub ? 'sub' : ''}"><th scope="row">${L(nutrient)}</th><td>${num(d.n[i])} ${nutrient.unit}</td></tr>`).join('')}</table>
    <p class="hint">${t('traces')}</p>
    ${ph && ph.by ? `<p class="credit">${t('photoCredit', { by: ph.by, license: ph.license })} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>` : ''}`);
}

/* --- La mia tessera: QR personale (cambia ogni 3 secondi), sconti, punti e premi --- */

function qr() {
  const now = Date.now(), p = myPoints(), r = rewardStatus(p), daily = dailyAvailable();
  const lastDay = new Date(resetDate().getTime() - 86400000);
  return {
    title: t('myCard'), tab: 'qr',
    body: `
      <section class="card center">
        <div id="qr-box" class="qr" data-step="${Math.floor(now / QR_PERIOD_MS)}">${qrSvg(qrToken(STUDENT.id, now))}</div>
        <span class="bar thin"><i class="qr-bar" style="animation-delay:-${now % QR_PERIOD_MS}ms"></i></span>
        <p class="muted">${t('qrRefresh')}</p>
        <strong class="big">${esc(STUDENT.name)}</strong>
        <p class="muted">${t('studentNo')} ${esc(STUDENT.id)}</p>
      </section>

      <section class="card canteen">
        ${r.gold
          ? `<p class="line spread"><strong>${t('goldTitle', { pct: pct(REWARDS.goldDiscount) })}</strong><span class="badge green">${t('activeUntil', { date: longDate(lastDay) })}</span></p>`
          : `<p class="line spread"><strong>${t('studentDiscount', { pct: pct(REWARDS.dailyDiscount) })}</strong><span class="badge ${daily ? 'green' : 'grey'}">${daily ? t('availableToday') : t('usedToday')}</span></p>`}
        <p class="muted">${r.gold ? t('goldText') : t('qrExplain')}</p>
      </section>

      <h2>${t('pointsTitle', { month: monthName() })}</h2>
      <section class="card">
        <p class="pts"><b>${num(r.points)}</b> ${t('points')}</p>
        ${pointsBar(r)}
        <p class="hint">${r.gold ? t('goldReached', { pct: pct(REWARDS.goldDiscount) }) : t('toGold', { n: num(r.toGold), pct: pct(REWARDS.goldDiscount) })}</p>
      </section>

      <section class="card status">
        <span class="status-ic">${icon('coffee')}</span>
        <span class="grow"><strong>${coffeesText(r.coffeesLeft)}</strong><span class="muted">${t('nextCoffee', { n: num(r.toCoffee) })}</span></span>
        ${r.coffeesLeft ? `<button class="btn small" onclick="openCoffee()">${t('useCoffee')}</button>` : ''}
      </section>

      <section class="card">
        <strong>${t('howEarn')}</strong>
        <ul class="earn">
          <li>${icon('utensils')}<span>${t('earnMeal', { n: REWARDS.perEuro })}</span></li>
          <li>${icon('clock')}<span>${t('earnOnTime', { n: REWARDS.onTime })}</span></li>
          <li>${icon('coffee')}<span>${t('earnCoffee', { n: num(REWARDS.coffeeEvery) })}</span></li>
          <li>${icon('star')}<span>${t('earnGold', { n: num(REWARDS.goldAt), pct: pct(REWARDS.goldDiscount) })}</span></li>
        </ul>
        <p class="hint">${t('resetOn', { date: longDate(resetDate()) })}</p>
      </section>

      ${p.log.length ? `
        <h2>${t('thisMonth')}</h2>
        <ul class="card list">${p.log.map(e => `
          <li><span class="grow"><span>${t(LOG_KEYS[e.kind], { canteen: e.canteen ? canteenOf(e.canteen).name : '' })}</span>
            <span class="hint">${longDate(new Date(e.at))}</span></span><b class="plus">+${num(e.points)}</b></li>`).join('')}</ul>` : ''}

      <section class="demo">
        <p class="muted">${t('demoCard')}</p>
        <button class="btn ghost" onclick="simulateTill()">${t('simulateTill')}</button>
        <button class="btn ghost" onclick="demoPoints()">${t('demoPlus', { n: 100 })}</button>
        <button class="btn text" onclick="resetCard()">${t('resetDemo')}</button>
      </section>`,
  };
}

// Demo: pranzo pagato alla cassa con il QR personale (prezzo di esempio: il piatto principale di oggi).
function simulateTill() {
  const dish = (MENU.seasonal[new Date().getDay()] || MENU.seasonal[1]).find(d => d.cat === 'main');
  const r = rewardStatus(myPoints()), rate = discountRate(r.gold, dailyAvailable());
  const { total } = orderTotal([{ price: dish ? dish.price : 6, qty: 1 }], rate);
  const got = payMeal(total, !r.gold && rate > 0, 'till', booking ? booking.canteen : '');
  toast(t('paidPoints', { total: money(total), n: got }));
  render();
}

function demoPoints() {
  earn(100, 'demo');
  toast(t('demoAdded', { n: 100 }));
  render();
}

function resetCard() {
  points = monthPoints(null);
  store.set('points', points);
  store.set('discountUsedOn', '');
  render();
}

// Caffè gratis: si mostra un QR alla cassa. Il caffè si "consuma" quando la cassa lo scansiona.
function openCoffee() {
  const p = myPoints();
  if (!rewardStatus(p).coffeesLeft) return;
  openSheet(`
    <h2>${t('freeCoffee')}</h2>
    <p class="muted">${t('coffeeText')}</p>
    <div class="qr small mid">${qrSvg(`MM1.COFFEE.${STUDENT.id}.${p.month}.${p.coffeesUsed + 1}`)}</div>
    <button class="btn" onclick="useCoffee()">${t('simulateCoffee')}</button>`);
}

function useCoffee() {
  const p = myPoints();
  if (!rewardStatus(p).coffeesLeft) return;
  p.coffeesUsed += 1;
  store.set('points', p);
  closeSheet();
  toast(t('coffeeEnjoy'));
  render();
}

/* --- Cena del mercoledì: idee da giovedì a sabato, tema scelto la domenica --- */

function dinner() {
  const day = demoDay ?? new Date().getDay(), phase = dinnerPhase(day);
  const ideas = [...myIdeas.map(text => ({ text, by: t('you') })), ...DINNER.ideas];
  const ideaList = `
    <h2>${t('ideasSoFar')}</h2>
    <ul class="card list ideas">${ideas.map(idea => `<li><span>${esc(idea.text)}</span><span class="muted">${esc(idea.by)}</span></li>`).join('')}</ul>`;
  const phases = [
    ['ideas', `${weekday(4, 'short')}–${weekday(6, 'short')}`, t('phaseIdeas')],
    ['deciding', weekday(0, 'short'), t('phaseDeciding')],
    ['announced', weekday(3, 'short'), t('phaseDinner')],
  ];
  let main;
  if (phase === 'ideas') {
    main = `
      <form class="card form" onsubmit="submitIdea(event)" novalidate>
        <label for="idea">${t('ideaLabel')}</label>
        <textarea id="idea" name="idea" rows="3" maxlength="140" placeholder="${t('ideaPlaceholder')}" oninput="document.getElementById('idea-err').textContent = ''"></textarea>
        <p id="idea-err" class="error" role="alert"></p>
        <button class="btn" type="submit">${t('sendIdea')}</button>
        <p class="hint">${t('ideaHint')}</p>
      </form>${ideaList}`;
  } else if (phase === 'deciding') {
    main = `<p class="notice">${icon('info')}<span>${t('decidingText')}</span></p>${ideaList}`;
  } else {
    main = `
      <section class="card center">
        <p class="muted">${t('themeLabel')}</p>
        <p class="seat">${esc(L(DINNER.theme))}</p>
        <p>${esc(L(DINNER.themeDesc))}</p>
        <p class="line center">${icon('clock')}<span><span class="cap">${weekday(3)}</span> ${DINNER.time} · ${canteenOf(DINNER.canteen).name}</span></p>
      </section>
      <p class="notice">${icon('info')}<span>${t('announcedText')}</span></p>`;
  }
  return {
    title: t('dinnerTitle'), tab: 'dinner',
    body: `
      <p class="lead">${t('dinnerIntro', DINNER)}</p>
      <ol class="phases">${phases.map(([key, when, label]) => `<li class="${key === phase ? 'on' : ''}" ${key === phase ? 'aria-current="step"' : ''}><b>${when}</b><span>${label}</span></li>`).join('')}</ol>
      ${main}
      <section class="demo">
        <p class="muted">${t('demoDay')}</p>
        <div class="seg small">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="${d === day ? 'on' : ''}" aria-pressed="${d === day}" onclick="setDemoDay(${d})">${weekday(d, 'short')}</button>`).join('')}</div>
      </section>`,
  };
}

function setDemoDay(day) { demoDay = day; render(); }

function submitIdea(event) {
  event.preventDefault();
  if (dinnerPhase(demoDay ?? new Date().getDay()) !== 'ideas') return;   // le idee si accettano solo da giovedì a sabato
  const text = String(new FormData(event.target).get('idea')).trim().slice(0, 140);
  if (text.length < 3) {
    document.getElementById('idea-err').textContent = t('ideaError');
    return;
  }
  myIdeas.unshift(text);
  store.set('ideas', myIdeas);
  toast(t('ideaSent'));
  render();
}

/* --- Lavora con noi --- */

function jobs() {
  const form = applied ? `
    <section class="card center" id="applied">
      <p class="badge green">${icon('check')}${t('applySent')}</p>
      <p>${t('applyThanks', { name: applied })}</p>
      <p class="hint">${t('applyDemo')}</p>
    </section>` : `
    <form class="card form" onsubmit="submitApplication(event)">
      <h2>${t('applyTitle')}</h2>
      <label for="jb-name">${t('fName')}</label>
      <input id="jb-name" name="name" required pattern=".*\\S.*" maxlength="80" autocomplete="name">
      <label for="jb-mail">${t('fEmail')}</label>
      <input id="jb-mail" name="email" type="email" required maxlength="120" autocomplete="email" placeholder="name@student.maastrichtuniversity.nl">
      <label for="jb-canteen">${t('fCanteen')}</label>
      <select id="jb-canteen" name="canteen"><option value="">${t('noPreference')}</option>${CANTEENS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
      <label for="jb-role">${t('fRole')}</label>
      <select id="jb-role" name="role">${JOBS.map(job => `<option value="${job.id}">${L(job.name)}</option>`).join('')}</select>
      <fieldset>
        <legend>${t('fDays')}</legend>
        <div class="seg small">${[1, 2, 3, 4, 5].map(d => `<label><input type="checkbox" name="days" value="${d}"><span>${weekday(d, 'short')}</span></label>`).join('')}</div>
      </fieldset>
      <label for="jb-why">${t('fWhy')}</label>
      <textarea id="jb-why" name="why" rows="3" maxlength="500"></textarea>
      <button class="btn" type="submit">${t('sendApplication')}</button>
    </form>`;
  return {
    title: t('jobsTitle'), tab: 'jobs',
    body: `
      <p class="lead">${t('jobsIntro')}</p>
      <ul class="card list perks"><li>${icon('clock')}${t('perk1')}</li><li>${icon('utensils')}${t('perk2')}</li><li>${icon('users')}${t('perk3')}</li></ul>
      <h2>${t('rolesTitle')}</h2>
      <ul class="card list roles">${JOBS.map(job => `<li><strong>${L(job.name)}</strong><span class="muted">${L(job.desc)}</span></li>`).join('')}</ul>
      ${form}`,
  };
}

// Candidatura dimostrativa: i dati non vengono inviati né salvati, si mostra solo la conferma.
function submitApplication(event) {
  event.preventDefault();
  applied = String(new FormData(event.target).get('name')).trim();
  render();
  document.getElementById('applied').scrollIntoView({ block: 'center' });
}

/* ---------- Tutorial a schede: si apre al primo avvio, poi dalla home ---------- */

const TOUR = [
  ['home', 'tour1T', 'tour1'], ['map-pin', 'tour2T', 'tour2'], ['armchair', 'tour3T', 'tour3'],
  ['package', 'tour4T', 'tour4'], ['utensils', 'tour5T', 'tour5'], ['qr', 'tour6T', 'tour6'],
  ['star', 'tour7T', 'tour7'], ['calendar', 'tour8T', 'tour8'], ['globe', 'tour9T', 'tour9'],
];

function openTour(start = 0) {
  const tour = document.getElementById('tour');
  const vars = {
    max: MAX_SEAT_MINUTES, daily: pct(REWARDS.dailyDiscount), perEuro: REWARDS.perEuro, onTime: REWARDS.onTime,
    coffee: num(REWARDS.coffeeEvery), gold: num(REWARDS.goldAt), goldPct: pct(REWARDS.goldDiscount),
  };
  tour.innerHTML = `
    <div class="tour-top">
      <div class="lang" role="group" aria-label="Language / Taal">
        ${['en', 'nl'].map(code => `<button class="${code === lang ? 'on' : ''}" aria-pressed="${code === lang}" onclick="setTourLang('${code}')">${code.toUpperCase()}</button>`).join('')}
      </div>
    </div>
    <div class="tour-track" id="tour-track">
      ${TOUR.map(([ic, title, text], i) => `
        <section class="tour-slide" aria-label="${i + 1} / ${TOUR.length}">
          <span class="tour-ic">${icon(ic)}</span>
          <h2>${t(title)}</h2>
          <p>${t(text, vars)}</p>
        </section>`).join('')}
    </div>
    <div class="tour-nav">
      <button class="btn text" onclick="closeTour()">${t('skip')}</button>
      <span class="dots" aria-hidden="true">${TOUR.map(() => '<i></i>').join('')}</span>
      <button class="btn small" id="tour-next" onclick="tourNext()"></button>
    </div>`;
  if (!tour.open) tour.showModal();
  const track = document.getElementById('tour-track');
  tourTarget = null;
  track.scrollLeft = start * track.clientWidth;
  track.addEventListener('scroll', updateTour, { passive: true });
  track.addEventListener('pointerdown', () => { tourTarget = null; });   // il dito ha la precedenza su "Next"
  updateTour();
}

// Scheda verso cui "Next" sta scorrendo: così due tocchi rapidi avanzano di due schede, non di una.
let tourTarget = null;

const tourIndex = () => {
  if (tourTarget !== null) return tourTarget;
  const track = document.getElementById('tour-track');
  return Math.round(track.scrollLeft / track.clientWidth) || 0;
};

function updateTour() {
  const track = document.getElementById('tour-track');
  if (tourTarget !== null && Math.abs(track.scrollLeft - tourTarget * track.clientWidth) < 2) tourTarget = null;
  const i = tourIndex();
  document.querySelectorAll('#tour .dots i').forEach((dot, k) => dot.classList.toggle('on', k === i));
  document.getElementById('tour-next').textContent = t(i === TOUR.length - 1 ? 'start' : 'next');
}

function tourNext() {
  const track = document.getElementById('tour-track'), i = tourIndex();
  if (i >= TOUR.length - 1) return closeTour();
  tourTarget = i + 1;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  track.scrollTo({ left: tourTarget * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  updateTour();
}

function setTourLang(code) {
  const i = tourIndex();
  setLang(code);
  openTour(i);
}

function closeTour() {
  document.getElementById('tour').close();   // l'evento "close" segna il tutorial come visto
}

/* ---------- Disegno della pagina ---------- */

const VIEWS = { home, canteen, book, scan, takeaway, menu, qr, dinner, jobs };
const TABS = [['home', 'home', 'tabHome'], ['menu', 'utensils', 'tabMenu'], ['qr', 'qr', 'tabQr'], ['dinner', 'calendar', 'tabDinner'], ['jobs', 'briefcase', 'tabJobs']];

function setLang(next) {
  lang = next;
  store.set('lang', lang);
  render();
}

function render() {
  const route = currentRoute();
  const [name, arg] = route.split('/');
  stopCamera();
  const sheet = document.getElementById('sheet');
  if (sheet.open) sheet.close();
  if (name !== 'takeaway') paying = false;
  seatPhase = booking && booking.checkedInAt ? (seatTimeLeft() > 0 ? 'on' : 'grace') : '';

  const view = (Object.hasOwn(VIEWS, name) ? VIEWS[name] : home)(arg);
  document.documentElement.lang = lang;
  document.getElementById('top').innerHTML = `
    <div class="top-row">
      ${view.back ? `<a class="back" href="${view.back}" aria-label="${t('back')}">${icon('arrow-left')}</a>` : ''}
      <h1>${view.title}</h1>
      <div class="lang" role="group" aria-label="Language / Taal">
        ${['en', 'nl'].map(code => `<button class="${code === lang ? 'on' : ''}" aria-pressed="${code === lang}" onclick="setLang('${code}')">${code.toUpperCase()}</button>`).join('')}
      </div>
    </div>
    ${view.sub ? `<p class="top-sub">${view.sub}</p>` : ''}`;
  const main = document.getElementById('view');
  main.innerHTML = view.body;
  document.getElementById('tabs').innerHTML = TABS.map(([id, ic, key]) =>
    `<a href="#${id}" class="${view.tab === id ? 'on' : ''}" ${view.tab === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t(key)}</span></a>`).join('');
  if (route !== lastRoute) { main.scrollTop = 0; lastRoute = route; }
  if (view.after) view.after();
}

// Aggiornamenti continui: QR personale ogni 3 secondi e conto alla rovescia del posto.
function tick() {
  const now = Date.now();
  const box = document.getElementById('qr-box');
  if (box) {
    const step = String(Math.floor(now / QR_PERIOD_MS));
    if (box.dataset.step !== step) {
      box.dataset.step = step;
      box.innerHTML = qrSvg(qrToken(STUDENT.id, now));
    }
  }
  if (booking && booking.checkedInAt) {
    const left = seatTimeLeft();
    if (left + graceMs() <= 0) { endBooking('timeUpNoPoints', { n: REWARDS.onTime }); return; }
    const phase = left > 0 ? 'on' : 'grace';
    if (phase !== seatPhase) {
      seatPhase = phase;
      if (['home', 'book'].includes(currentRoute().split('/')[0])) render();
      return;
    }
    for (const el of document.querySelectorAll('[data-countdown]')) el.textContent = mmss(phase === 'on' ? left : left + graceMs());
    for (const el of document.querySelectorAll('[data-countbar]')) el.style.width = `${Math.round(100 * left / (booking.minutes * 60000))}%`;
  }
}

function boot() {
  applyStaffData(store.get('staff', null));
  const savedLang = store.get('lang', (navigator.language || '').toLowerCase().startsWith('nl') ? 'nl' : 'en');
  lang = Object.hasOwn(I18N, savedLang) ? savedLang : 'en';

  // I dati salvati potrebbero essere vecchi o rovinati: si tengono solo se hanno la forma giusta.
  const b = store.get('booking', null);
  if (b && CANTEENS.some(c => c.id === b.canteen)) {
    booking = {
      canteen: b.canteen, time: String(b.time).slice(0, 5), minutes: clampMinutes(b.minutes),
      table: Math.trunc(b.table) || 1, seat: Math.trunc(b.seat) || 1, checkedInAt: Number(b.checkedInAt) || null,
    };
  }
  const o = store.get('order', null);
  if (o && CANTEENS.some(c => c.id === o.canteen) && Array.isArray(o.lines)) {
    order = {
      canteen: o.canteen, code: String(o.code).slice(0, 8), time: String(o.time).slice(0, 5),
      lines: o.lines.filter(l => l && dishOf(l.id) && l.qty > 0).map(l => ({ id: l.id, qty: Math.trunc(l.qty) })),
      discount: Math.trunc(o.discount) || 0, gold: o.gold === true, rate: Number(o.rate) || 0,
      total: Math.trunc(o.total) || 0, points: Math.trunc(o.points) || 0,
    };
  }
  const p = store.get('points', null);
  points = monthPoints(p && typeof p === 'object' ? {
    month: String(p.month), points: Math.max(0, Math.trunc(p.points)), coffeesUsed: Math.max(0, Math.trunc(p.coffeesUsed)),
    log: Array.isArray(p.log) ? p.log.filter(e => e && Object.hasOwn(LOG_KEYS, e.kind) && Number.isFinite(e.points) && Number.isFinite(e.at)).slice(0, 30) : [],
  } : null);
  const ideas = store.get('ideas', []);
  myIdeas = Array.isArray(ideas) ? ideas.filter(text => typeof text === 'string').map(text => text.slice(0, 140)) : [];

  const day = new Date().getDay();
  menuDay = day >= 1 && day <= 5 ? day : 1;

  // Un tocco fuori dal pannello lo chiude.
  const sheet = document.getElementById('sheet');
  sheet.addEventListener('click', event => { if (event.target === sheet) sheet.close(); });
  document.getElementById('tour').addEventListener('close', () => store.set('tourDone', true));
  window.addEventListener('hashchange', render);
  setInterval(tick, 250);
  render();
  if (!store.get('tourDone', false)) openTour();
}

// Si avvia solo nella pagina dell'app (il pannello staff usa le stesse funzioni ma ha la sua pagina).
if (typeof document !== 'undefined' && document.getElementById('view')) boot();
