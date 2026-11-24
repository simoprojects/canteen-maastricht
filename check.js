// Controllo rapido di dati, testi e regole. Si lancia con:  node check.js
// Se qualcosa è rotto (un piatto senza traduzione, un allergene sbagliato, il QR, un conto, i punti...) si ferma con un errore.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const ctx = vm.createContext({ console, TextEncoder });
for (const file of ['data.js', 'i18n.js', 'app.js']) vm.runInContext(read(file), ctx, { filename: file });
const names = 'MENU, ALLERGENS, CATEGORIES, CANTEENS, NUTRIENTS, DINNER, JOBS, LUNCH, REWARDS, PHOTOS, I18N, rsRemainder, qrMatrix, qrSvg, qrToken, ' +
  'seatsFree, dinnerPhase, clampMinutes, matchesFilter, orderTotal, seatCode, defaultTime, monthKey, monthPoints, mealPoints, onTimePoints, ' +
  'rewardStatus, discountRate, resetDate, photoOf, thumbOf, soldOut, dishProblems, menuValid, rewardsValid, applyStaffData';
const app = vm.runInContext(`({ ${names} })`, ctx);
const { MENU, ALLERGENS, CATEGORIES, CANTEENS, NUTRIENTS, DINNER, JOBS, LUNCH, REWARDS, PHOTOS, I18N } = app;

/* --- QR --- */
// Vettore noto ("HELLO WORLD", versione 1-M): i 10 codeword di correzione devono essere questi.
assert.equal(
  app.rsRemainder([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10).join(),
  '196,35,39,119,235,215,231,226,93,23', 'Reed-Solomon sbagliato');

const token = app.qrToken('i6123456', 1794844800000);
const m = app.qrMatrix(token);
assert.equal(m.length, 29); assert.ok(m.every(row => row.length === 29), 'il QR deve essere 29×29');
assert.ok(m[0][0] && !m[1][1] && m[3][3] && !m[7][7], 'mirino in alto a sinistra');
assert.ok(m[0][28] && m[28][0] && m[22][22] && !m[21][22], 'mirini e allineamento');
assert.ok(m[21][8], 'modulo sempre nero');
// Formato M + maschera 0 = 101010000010010 (dal bit 14 al bit 0), letto lungo il bordo del primo mirino.
const fmtCells = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
assert.equal(fmtCells.map(([y, x]) => (m[y][x] ? 1 : 0)).reverse().join(''), '101010000010010', 'bit di formato');
assert.notEqual(JSON.stringify(m), JSON.stringify(app.qrMatrix(token + 'x')), 'testi diversi, QR diversi');
assert.throws(() => app.qrMatrix('x'.repeat(43)), 'oltre 42 byte deve dare errore');
assert.ok(app.qrSvg(token).startsWith('<svg'), 'qrSvg produce un SVG');
assert.ok(new TextEncoder().encode('MM1.COFFEE.i6123456.2026-11.99').length <= 42, 'il QR del caffè deve stare nel QR');

/* --- Codice personale: cambia ogni 3 secondi --- */
assert.equal(app.qrToken('i6123456', 9000), app.qrToken('i6123456', 11999), 'stesso codice dentro i 3 secondi');
assert.notEqual(app.qrToken('i6123456', 9000), app.qrToken('i6123456', 12000), 'codice nuovo dopo 3 secondi');
assert.notEqual(app.qrToken('i6123456', 9000), app.qrToken('i6999999', 9000), 'codice diverso per ogni studente');
assert.ok(new TextEncoder().encode(token).length <= 42, 'il codice deve stare nel QR');

/* --- Posto a sedere: massimo 30 minuti, QR del tavolo --- */
assert.equal([15, 20, 30, 45, 999, 'abc', 0, 3].map(app.clampMinutes).join(), '15,20,30,30,30,30,30,5', 'mai più di 30 minuti');
assert.equal(app.seatCode({ canteen: 'fasos', table: 128, seat: 4 }), 'MM1.SEAT.fasos.128.4');
assert.equal(app.defaultTime(new Date(2026, 10, 16, 12, 2)), '12:05', 'orario arrotondato ai 5 minuti');
assert.equal(app.defaultTime(new Date(2026, 10, 16, 8, 0)), LUNCH.open, 'prima dell\'apertura si propone l\'apertura');
assert.equal(app.defaultTime(new Date(2026, 10, 16, 20, 0)), '12:00', 'dopo la chiusura si propone mezzogiorno');

/* --- Conto: 2 × 2,25 + 5,95 = 10,45 → sconto 20% = 2,09 → totale 8,36 (in centesimi) --- */
const bill = app.orderTotal([{ price: 2.25, qty: 2 }, { price: 5.95, qty: 1 }], 0.2);
assert.equal([bill.subtotal, bill.discount, bill.total].join(), '1045,209,836', 'conto con sconto');
assert.equal(app.orderTotal([{ price: 2.25, qty: 2 }], 0).total, 450, 'senza sconto il totale è pieno');

/* --- Punti e premi (con le regole di esempio di data.js) --- */
assert.equal([REWARDS.perEuro, REWARDS.onTime, REWARDS.coffeeEvery, REWARDS.goldAt].join(), '10,25,200,800', 'regole di esempio cambiate: aggiorna anche questo controllo');
assert.equal(app.mealPoints(625), 62, '€6,25 → 62 punti (si arrotonda per difetto)');
assert.equal(app.mealPoints(0), 0); assert.equal(app.mealPoints(-500), 0, 'mai punti negativi');
const end = 1_000_000;
assert.equal(app.onTimePoints(end - 60000, end), 25, 'esci prima della fine: punti in più');
assert.equal(app.onTimePoints(end + REWARDS.graceMinutes * 60000, end), 25, 'esci entro la tolleranza: punti in più');
assert.equal(app.onTimePoints(end + REWARDS.graceMinutes * 60000 + 1, end), 0, 'esci dopo la tolleranza: niente punti in più');
const st = points => app.rewardStatus({ points, coffeesUsed: 0, log: [] });
assert.equal(st(199).coffeesEarned, 0); assert.equal(st(200).coffeesEarned, 1); assert.equal(st(540).coffeesEarned, 2);
assert.equal(st(540).toCoffee, 60, 'a 540 punti mancano 60 punti al prossimo caffè');
assert.equal(app.rewardStatus({ points: 540, coffeesUsed: 2, log: [] }).coffeesLeft, 0, 'caffè già usati');
assert.equal(app.rewardStatus({ points: 540, coffeesUsed: 5, log: [] }).coffeesLeft, 0, 'mai caffè negativi');
assert.ok(!st(799).gold && st(800).gold, 'sconto del mese da 800 punti');
assert.equal(st(540).toGold, 260);
// Sconti: quello del mese vale su ogni pasto e sostituisce quello giornaliero (non si sommano).
assert.equal(app.discountRate(true, true), REWARDS.goldDiscount);
assert.equal(app.discountRate(true, false), REWARDS.goldDiscount, 'lo sconto del mese vale anche dopo aver usato quello giornaliero');
assert.equal(app.discountRate(false, true), REWARDS.dailyDiscount);
assert.equal(app.discountRate(false, false), 0, 'senza sconti, prezzo pieno');
// Azzeramento mensile.
assert.equal(app.monthKey(new Date(2026, 10, 30)), '2026-11'); assert.equal(app.monthKey(new Date(2027, 0, 1)), '2027-01');
const nov = { month: '2026-11', points: 540, coffeesUsed: 1, log: [{ at: 1, kind: 'demo', points: 540 }] };
assert.equal(app.monthPoints(nov, new Date(2026, 10, 30, 23, 59)), nov, 'stesso mese: i punti restano');
const dec = app.monthPoints(nov, new Date(2026, 11, 1, 0, 1));
assert.ok(dec.month === '2026-12' && dec.points === 0 && dec.coffeesUsed === 0 && dec.log.length === 0, 'mese nuovo: punti e caffè ripartono da zero');
assert.equal(app.monthPoints({ month: '2026-11', points: 'tanti' }, new Date(2026, 10, 5)).points, 0, 'dati rovinati: si riparte da zero');
assert.equal(app.resetDate(new Date(2026, 11, 15)).getTime(), new Date(2027, 0, 1).getTime(), 'a dicembre si azzera il 1° gennaio');

/* --- Cena del mercoledì: gio-sab idee, dom decisione, lun-mer tema annunciato --- */
assert.equal([0, 1, 2, 3, 4, 5, 6].map(app.dinnerPhase).join(),
  'deciding,announced,announced,announced,ideas,ideas,ideas');
assert.ok(DINNER.theme.en && DINNER.theme.nl && DINNER.ideas.length > 0);

/* --- Canteen --- */
assert.equal(CANTEENS.map(c => c.id + ':' + c.seats).join(), 'fasos:2000,law:3000,sbe:2500');
for (const c of CANTEENS) {
  assert.ok(c.address.includes('Maastricht') && c.full.en && c.full.nl, 'canteen incompleta: ' + c.id);
  const free = app.seatsFree(c, Date.now());
  assert.ok(free > 0 && free < c.seats, 'posti liberi fuori scala: ' + c.id);
}

/* --- Menu --- */
const all = [...MENU.daily, ...Object.values(MENU.seasonal).flat(), ...MENU.glutenFree];
for (const d of all) {
  assert.deepEqual(app.dishProblems(d, MENU.glutenFree.includes(d)), [], 'piatto con problemi: ' + d.id);
  const [kcal, fat, sat, carbs, sugars, protein] = d.n;
  assert.ok(sat <= fat && sugars <= carbs, 'saturi/zuccheri più alti del totale: ' + d.id);
  // Le calorie devono tornare con grassi, carboidrati e proteine (9-4-4), con un po' di tolleranza.
  const estimate = 9 * fat + 4 * carbs + 4 * protein;
  assert.ok(Math.abs(kcal - estimate) <= Math.max(15, kcal * 0.12), `calorie incoerenti: ${d.id} (${kcal} contro ~${estimate})`);
}
assert.ok(app.menuValid(MENU), 'il menu di partenza deve essere valido (stagione, piatti, nessun id ripetuto)');
assert.equal(Object.keys(MENU.seasonal).join(), '1,2,3,4,5', 'menu stagionale da lunedì a venerdì');
for (const [day, dishes] of Object.entries(MENU.seasonal)) {
  assert.ok(dishes.some(d => d.diet === 'vegan') && dishes.some(d => d.cat === 'soup') && dishes.some(d => d.cat === 'main'),
    'giorno ' + day + ': servono zuppa, piatto principale e opzione vegana');
}
assert.ok(MENU.daily.some(d => d.diet === 'vegan') && MENU.daily.some(d => d.diet === 'veg'), 'menu fisso: servono piatti vegani e vegetariani');
const shown = filter => all.filter(d => app.matchesFilter(d, filter)).length;
assert.ok(shown('all') === all.length && shown('veg') > shown('vegan') && shown('vegan') > 0 && shown('gf') === MENU.glutenFree.length, 'filtri del menu');
assert.ok(JOBS.every(j => j.name.en && j.name.nl && j.desc.en && j.desc.nl), 'ruoli di lavoro incompleti');
assert.ok(Object.values(ALLERGENS).length === 14 && Object.values(ALLERGENS).every(a => a.en && a.nl), 'allergeni: devono essere 14, in due lingue');
assert.ok(NUTRIENTS.every(x => x.en && x.nl) && Object.values(CATEGORIES).every(x => x.en && x.nl), 'etichette senza traduzione');

/* --- Foto: una per ogni piatto, da Wikimedia Commons, con autore e licenza libera --- */
for (const d of all) {
  const ph = app.photoOf(d);
  assert.ok(ph && /^https:\/\/(thumb|upload)\.wikimedia\.org\/.+\/500px-[^/]+$/.test(ph.src), 'foto mancante o strana: ' + d.id);
  assert.ok(ph.by && /^(CC|Public domain|No restrictions)/.test(ph.license) && ph.page.startsWith('https://commons.wikimedia.org/'), 'foto senza autore o licenza: ' + d.id);
  assert.ok(app.thumbOf(ph.src).includes('/250px-'), 'miniatura: ' + d.id);
}
assert.equal(app.photoOf({ id: 'tomatensoep', photo: 'https://example.org/x.jpg' }).src, 'https://example.org/x.jpg', 'la foto scelta dallo staff vince');
assert.ok(app.soldOut({ soldOutOn: '2026-11-24' }, '2026-11-24') && !app.soldOut({ soldOutOn: '2026-11-24' }, '2026-11-25'), 'esaurito vale solo quel giorno');

/* --- Dati salvati dallo staff: si usano solo se sono validi --- */
const soup = JSON.parse(JSON.stringify(MENU.daily[0]));
assert.ok(app.dishProblems({ ...soup, diet: 'vegan', al: ['milk'] }, false).includes('vegan'), 'vegano con latte: va rifiutato');
assert.ok(app.dishProblems({ ...soup, price: 0 }, false).includes('price'), 'prezzo zero: va rifiutato');
assert.ok(app.dishProblems({ ...soup, photo: 'javascript:alert(1)' }, false).includes('photo'), 'link foto non https: va rifiutato');
assert.ok(app.dishProblems({ ...soup, name: { en: 'Soup', nl: ' ' } }, false).includes('name'), 'nome senza olandese: va rifiutato');
assert.ok(app.dishProblems({ ...soup, gf: true, al: ['gluten'] }, true).includes('gf'), 'angolo senza glutine con glutine: va rifiutato');
assert.ok(app.rewardsValid(REWARDS) && !app.rewardsValid({ ...REWARDS, goldDiscount: 0.9 }) && !app.rewardsValid({ ...REWARDS, perEuro: 'dieci' }), 'limiti delle regole');
const staffMenu = JSON.parse(JSON.stringify({ season: MENU.season, daily: MENU.daily, seasonal: MENU.seasonal, glutenFree: MENU.glutenFree }));
staffMenu.daily[0].price = 2.5;
staffMenu.daily.push({ ...staffMenu.daily[1] });   // id ripetuto
assert.ok(!app.menuValid(staffMenu), 'id ripetuti: menu rifiutato');
staffMenu.daily.pop();
app.applyStaffData({ menu: staffMenu, rewards: { ...REWARDS, coffeeEvery: 150 }, dinner: { theme: { en: 'Tapas', nl: 'Tapas' }, themeDesc: { en: 'Small plates', nl: 'Kleine hapjes' } } });
assert.ok(MENU.daily[0].price === 2.5 && REWARDS.coffeeEvery === 150 && DINNER.theme.en === 'Tapas', 'le modifiche valide dello staff si applicano');
app.applyStaffData({ menu: { ...staffMenu, daily: [{ id: 'x' }] }, rewards: { ...REWARDS, goldAt: -1 } });
assert.ok(MENU.daily.length > 1 && REWARDS.goldAt === 800, 'le modifiche rovinate dello staff si ignorano');

/* --- Testi dell'interfaccia: inglese e olandese allineati, niente voci mancanti o inutili --- */
const code = read('app.js') + read('staff.js');
const keys = Object.keys(I18N.en);
assert.equal(keys.join(), Object.keys(I18N.nl).join(), 'inglese e olandese devono avere le stesse voci, nello stesso ordine');
const slots = text => (text.match(/\{\w+\}/g) || []).sort().join();
for (const key of keys) {
  assert.ok(I18N.en[key] && I18N.nl[key], 'testo vuoto: ' + key);
  assert.equal(slots(I18N.en[key]), slots(I18N.nl[key]), 'parti tra graffe diverse tra le due lingue: ' + key);
  assert.ok(code.includes(`'${key}'`), 'testo mai usato dall\'app: ' + key);
}
for (const [, key] of code.matchAll(/\bt\('(\w+)'/g)) assert.ok(I18N.en[key], 'testo mancante: ' + key);

/* --- Icone: ogni icona usata esiste in icons.svg --- */
const svg = read('icons.svg');
for (const [, name] of code.matchAll(/icon\('([a-z-]+)'/g)) assert.ok(svg.includes(`id="i-${name}"`), 'icona mancante: ' + name);

console.log(`OK — ${all.length} piatti con foto, ${CANTEENS.length} canteen, ${keys.length} testi in 2 lingue, QR, punti, sconti e dati staff verificati.`);
