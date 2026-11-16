// Controllo rapido di dati, testi e regole. Si lancia con:  node check.js
// Se qualcosa è rotto (un piatto senza traduzione, un allergene sbagliato, il QR, un conto...) si ferma con un errore.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const ctx = vm.createContext({ console, TextEncoder });
for (const file of ['data.js', 'i18n.js', 'app.js']) vm.runInContext(read(file), ctx, { filename: file });
const names = 'MENU, ALLERGENS, CATEGORIES, CANTEENS, NUTRIENTS, DINNER, JOBS, LUNCH, I18N, rsRemainder, qrMatrix, qrSvg, qrToken, ' +
  'seatsFree, dinnerPhase, clampMinutes, matchesFilter, orderTotal, seatCode, defaultTime';
const { MENU, ALLERGENS, CATEGORIES, CANTEENS, NUTRIENTS, DINNER, JOBS, LUNCH, I18N, rsRemainder, qrMatrix, qrSvg, qrToken,
  seatsFree, dinnerPhase, clampMinutes, matchesFilter, orderTotal, seatCode, defaultTime } = vm.runInContext(`({ ${names} })`, ctx);

/* --- QR --- */
// Vettore noto ("HELLO WORLD", versione 1-M): i 10 codeword di correzione devono essere questi.
assert.equal(
  rsRemainder([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10).join(),
  '196,35,39,119,235,215,231,226,93,23', 'Reed-Solomon sbagliato');

const token = qrToken('i6123456', 1794844800000);
const m = qrMatrix(token);
assert.equal(m.length, 29); assert.ok(m.every(row => row.length === 29), 'il QR deve essere 29×29');
assert.ok(m[0][0] && !m[1][1] && m[3][3] && !m[7][7], 'mirino in alto a sinistra');
assert.ok(m[0][28] && m[28][0] && m[22][22] && !m[21][22], 'mirini e allineamento');
assert.ok(m[21][8], 'modulo sempre nero');
// Formato M + maschera 0 = 101010000010010 (dal bit 14 al bit 0), letto lungo il bordo del primo mirino.
const fmtCells = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
assert.equal(fmtCells.map(([y, x]) => (m[y][x] ? 1 : 0)).reverse().join(''), '101010000010010', 'bit di formato');
assert.notEqual(JSON.stringify(m), JSON.stringify(qrMatrix(token + 'x')), 'testi diversi, QR diversi');
assert.throws(() => qrMatrix('x'.repeat(43)), 'oltre 42 byte deve dare errore');
assert.ok(qrSvg(token).startsWith('<svg'), 'qrSvg produce un SVG');

/* --- Codice personale: cambia ogni 3 secondi --- */
assert.equal(qrToken('i6123456', 9000), qrToken('i6123456', 11999), 'stesso codice dentro i 3 secondi');
assert.notEqual(qrToken('i6123456', 9000), qrToken('i6123456', 12000), 'codice nuovo dopo 3 secondi');
assert.notEqual(qrToken('i6123456', 9000), qrToken('i6999999', 9000), 'codice diverso per ogni studente');
assert.ok(new TextEncoder().encode(token).length <= 42, 'il codice deve stare nel QR');

/* --- Posto a sedere: massimo 30 minuti, QR del tavolo --- */
assert.equal([15, 20, 30, 45, 999, 'abc', 0, 3].map(clampMinutes).join(), '15,20,30,30,30,30,30,5', 'mai più di 30 minuti');
assert.equal(seatCode({ canteen: 'fasos', table: 128, seat: 4 }), 'MM1.SEAT.fasos.128.4');
assert.equal(defaultTime(new Date(2026, 10, 16, 12, 2)), '12:05', 'orario arrotondato ai 5 minuti');
assert.equal(defaultTime(new Date(2026, 10, 16, 8, 0)), LUNCH.open, 'prima dell\'apertura si propone l\'apertura');
assert.equal(defaultTime(new Date(2026, 10, 16, 20, 0)), '12:00', 'dopo la chiusura si propone mezzogiorno');

/* --- Conto dell'asporto: 2 × 2,25 + 5,95 = 10,45 → sconto 20% = 2,09 → totale 8,36 (in centesimi) --- */
const bill = orderTotal([{ price: 2.25, qty: 2 }, { price: 5.95, qty: 1 }], true);
assert.equal([bill.subtotal, bill.discount, bill.total].join(), '1045,209,836', 'conto con sconto');
assert.equal(orderTotal([{ price: 2.25, qty: 2 }], false).total, 450, 'senza sconto il totale è pieno');

/* --- Cena del mercoledì: gio-sab idee, dom decisione, lun-mer tema annunciato --- */
assert.equal([0, 1, 2, 3, 4, 5, 6].map(dinnerPhase).join(),
  'deciding,announced,announced,announced,ideas,ideas,ideas');
assert.ok(DINNER.theme.en && DINNER.theme.nl && DINNER.ideas.length > 0);

/* --- Canteen --- */
assert.equal(CANTEENS.map(c => c.id + ':' + c.seats).join(), 'fasos:2000,law:3000,sbe:2500');
for (const c of CANTEENS) {
  assert.ok(c.address.includes('Maastricht') && c.full.en && c.full.nl, 'canteen incompleta: ' + c.id);
  const free = seatsFree(c, Date.now());
  assert.ok(free > 0 && free < c.seats, 'posti liberi fuori scala: ' + c.id);
}

/* --- Menu --- */
const both = t => t && typeof t.en === 'string' && t.en && typeof t.nl === 'string' && t.nl;
const all = [...MENU.daily, ...Object.values(MENU.seasonal).flat(), ...MENU.glutenFree];
const ids = new Set();
for (const d of all) {
  assert.ok(!ids.has(d.id), 'id doppio: ' + d.id); ids.add(d.id);
  assert.ok(both(d.name) && both(d.desc), 'manca una traduzione: ' + d.id);
  assert.ok(d.price > 0 && CATEGORIES[d.cat] && ['', 'veg', 'vegan'].includes(d.diet), 'campi sbagliati: ' + d.id);
  assert.ok(d.al.every(a => ALLERGENS[a]), 'allergene sconosciuto: ' + d.id);
  assert.ok(d.n.length === NUTRIENTS.length && d.n.every(v => typeof v === 'number' && v >= 0), 'valori nutrizionali: ' + d.id);
  const [kcal, fat, sat, carbs, sugars, protein] = d.n;
  assert.ok(sat <= fat && sugars <= carbs, 'saturi/zuccheri più alti del totale: ' + d.id);
  // Le calorie devono tornare con grassi, carboidrati e proteine (9-4-4), con un po' di tolleranza.
  const estimate = 9 * fat + 4 * carbs + 4 * protein;
  assert.ok(Math.abs(kcal - estimate) <= Math.max(15, kcal * 0.12), `calorie incoerenti: ${d.id} (${kcal} contro ~${estimate})`);
  if (d.diet === 'vegan') assert.ok(!d.al.some(a => ['milk', 'egg', 'fish', 'crustaceans', 'molluscs'].includes(a)), 'vegano con allergene animale: ' + d.id);
}
assert.ok(MENU.glutenFree.every(d => d.gf && !d.al.includes('gluten')), 'angolo senza glutine: c\'è glutine');
assert.ok(all.filter(d => !MENU.glutenFree.includes(d)).every(d => !d.gf), 'gf solo nell\'angolo senza glutine');
assert.equal(Object.keys(MENU.seasonal).join(), '1,2,3,4,5', 'menu stagionale da lunedì a venerdì');
for (const [day, dishes] of Object.entries(MENU.seasonal)) {
  assert.ok(dishes.some(d => d.diet === 'vegan') && dishes.some(d => d.cat === 'soup') && dishes.some(d => d.cat === 'main'),
    'giorno ' + day + ': servono zuppa, piatto principale e opzione vegana');
}
assert.ok(MENU.daily.some(d => d.diet === 'vegan') && MENU.daily.some(d => d.diet === 'veg'), 'menu fisso: servono piatti vegani e vegetariani');
const shown = filter => all.filter(d => matchesFilter(d, filter)).length;
assert.ok(shown('all') === all.length && shown('veg') > shown('vegan') && shown('vegan') > 0 && shown('gf') === MENU.glutenFree.length, 'filtri del menu');
assert.ok(JOBS.every(j => both(j.name) && both(j.desc)), 'ruoli di lavoro incompleti');
assert.ok(Object.values(ALLERGENS).length === 14 && Object.values(ALLERGENS).every(both), 'allergeni: devono essere 14, in due lingue');
assert.ok(NUTRIENTS.every(both) && Object.values(CATEGORIES).every(both), 'etichette senza traduzione');

/* --- Testi dell'interfaccia: inglese e olandese allineati, niente voci mancanti o inutili --- */
const app = read('app.js');
const keys = Object.keys(I18N.en);
assert.equal(keys.join(), Object.keys(I18N.nl).join(), 'inglese e olandese devono avere le stesse voci, nello stesso ordine');
const slots = text => (text.match(/\{\w+\}/g) || []).sort().join();
for (const key of keys) {
  assert.ok(I18N.en[key] && I18N.nl[key], 'testo vuoto: ' + key);
  assert.equal(slots(I18N.en[key]), slots(I18N.nl[key]), 'parti tra graffe diverse tra le due lingue: ' + key);
  assert.ok(app.includes(`'${key}'`), 'testo mai usato dall\'app: ' + key);
}
for (const [, key] of app.matchAll(/\bt\('(\w+)'/g)) assert.ok(I18N.en[key], 'testo mancante: ' + key);

console.log(`OK — ${all.length} piatti, ${CANTEENS.length} canteen, ${keys.length} testi in 2 lingue, QR e regole verificati.`);
