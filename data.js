// Dati dell'app: studente di esempio, canteen, allergeni, menu della settimana,
// cena del mercoledì e ruoli di lavoro.
// Per cambiare un piatto, un prezzo o un indirizzo basta modificare questo file.
// Ogni testo ha due versioni: en (inglese) e nl (olandese).

// Studente di esempio: non c'è ancora un login vero.
const STUDENT = { name: 'Alex de Vries', id: 'i6123456' };

const DISCOUNT = 0.2;          // sconto studenti (valore di esempio), una volta al giorno
const MAX_SEAT_MINUTES = 30;   // tempo massimo al tavolo
const LUNCH = { open: '11:30', close: '14:30' };   // orario pranzo, lunedì-venerdì

const CANTEENS = [
  { id: 'fasos', name: 'FASoS', seats: 2000,
    full: { en: 'Faculty of Arts and Social Sciences', nl: 'Faculteit der Cultuur- en Maatschappijwetenschappen' },
    address: 'Grote Gracht 90-92, 6211 SZ Maastricht' },
  { id: 'law', name: 'Law', seats: 3000,
    full: { en: 'Faculty of Law', nl: 'Faculteit der Rechtsgeleerdheid' },
    address: 'Bouillonstraat 1-3, 6211 LH Maastricht' },
  { id: 'sbe', name: 'SBE', seats: 2500,
    full: { en: 'School of Business and Economics', nl: 'School of Business and Economics' },
    address: 'Tongersestraat 53, 6211 LM Maastricht' },
];

// I 14 allergeni che la legge europea obbliga a dichiarare.
const ALLERGENS = {
  gluten:      { en: 'Gluten', nl: 'Gluten' },
  crustaceans: { en: 'Crustaceans', nl: 'Schaaldieren' },
  egg:         { en: 'Egg', nl: 'Ei' },
  fish:        { en: 'Fish', nl: 'Vis' },
  peanuts:     { en: 'Peanuts', nl: "Pinda's" },
  soy:         { en: 'Soy', nl: 'Soja' },
  milk:        { en: 'Milk', nl: 'Melk' },
  nuts:        { en: 'Tree nuts', nl: 'Noten' },
  celery:      { en: 'Celery', nl: 'Selderij' },
  mustard:     { en: 'Mustard', nl: 'Mosterd' },
  sesame:      { en: 'Sesame', nl: 'Sesam' },
  sulphites:   { en: 'Sulphites', nl: 'Sulfiet' },
  lupin:       { en: 'Lupin', nl: 'Lupine' },
  molluscs:    { en: 'Molluscs', nl: 'Weekdieren' },
};

// Valori nutrizionali per porzione, nello stesso ordine dei numeri in `n` di ogni piatto.
const NUTRIENTS = [
  { en: 'Energy', nl: 'Energie', unit: 'kcal' },
  { en: 'Fat', nl: 'Vet', unit: 'g' },
  { en: 'of which saturates', nl: 'waarvan verzadigd', unit: 'g', sub: true },
  { en: 'Carbohydrates', nl: 'Koolhydraten', unit: 'g' },
  { en: 'of which sugars', nl: 'waarvan suikers', unit: 'g', sub: true },
  { en: 'Protein', nl: 'Eiwitten', unit: 'g' },
  { en: 'Salt', nl: 'Zout', unit: 'g' },
];

const CATEGORIES = {
  soup:  { en: 'Soups', nl: 'Soepen' },
  main:  { en: 'Main dishes', nl: 'Hoofdgerechten' },
  bread: { en: 'Sandwiches', nl: 'Broodjes' },
  warm:  { en: 'Warm snacks', nl: 'Warme snacks' },
  salad: { en: 'Salads', nl: 'Salades' },
  sweet: { en: 'Sweet', nl: 'Zoet' },
  drink: { en: 'Drinks', nl: 'Dranken' },
};

// Ogni piatto:
//   diet: 'vegan', 'veg' (vegetariano) oppure '' (con carne o pesce)
//   gf:   true solo per i piatti senza glutine preparati a parte
//   al:   allergeni (chiavi di ALLERGENS)
//   n:    [kcal, grassi, di cui saturi, carboidrati, di cui zuccheri, proteine, sale] per porzione
// I valori nutrizionali sono stime indicative: vanno sostituiti con quelli reali della cucina.
const MENU = {
  season: { en: 'Autumn', nl: 'Herfst' },

  // Parte fissa: uguale tutti i giorni, in tutte le canteen.
  daily: [
    { id: 'tomatensoep', cat: 'soup', price: 2.25, diet: 'vegan', al: ['celery'], n: [110, 3.5, 0.5, 15, 9, 3, 1.8],
      name: { en: 'Tomato soup', nl: 'Tomatensoep' },
      desc: { en: 'Classic tomato soup with vegetables and basil.', nl: 'Klassieke tomatensoep met groenten en basilicum.' } },
    { id: 'broodje-kaas', cat: 'bread', price: 2.75, diet: 'veg', al: ['gluten', 'milk'], n: [330, 15, 9, 31, 2, 16, 1.6],
      name: { en: 'Cheese roll', nl: 'Broodje kaas' },
      desc: { en: 'Wholemeal roll with young matured Gouda.', nl: 'Volkorenbol met jong belegen Goudse kaas.' } },
    { id: 'broodje-gezond', cat: 'bread', price: 3.75, diet: '', al: ['gluten', 'milk', 'egg'], n: [410, 17, 7, 38, 4, 24, 2.2],
      name: { en: 'Broodje gezond (ham, cheese and salad roll)', nl: 'Broodje gezond' },
      desc: { en: 'Roll with ham, cheese, boiled egg, lettuce, tomato and cucumber.', nl: 'Bol met ham, kaas, gekookt ei, sla, tomaat en komkommer.' } },
    { id: 'broodje-kroket', cat: 'bread', price: 3.25, diet: '', al: ['gluten', 'milk', 'egg', 'mustard', 'celery'], n: [400, 18, 7, 44, 3, 13, 2.0],
      name: { en: 'Croquette roll', nl: 'Broodje kroket' },
      desc: { en: 'Soft white roll with a crispy beef croquette and mustard.', nl: 'Zacht wit bolletje met een krokante rundvleeskroket en mosterd.' } },
    { id: 'tosti', cat: 'bread', price: 3.00, diet: '', al: ['gluten', 'milk'], n: [380, 17, 9, 34, 3, 21, 2.3],
      name: { en: 'Ham and cheese toastie', nl: 'Tosti ham-kaas' },
      desc: { en: 'Grilled sandwich with ham and melted cheese, served with ketchup.', nl: 'Geroosterde boterham met ham en gesmolten kaas, met ketchup.' } },
    { id: 'broodje-hummus', cat: 'bread', price: 3.50, diet: 'vegan', al: ['gluten', 'sesame'], n: [360, 12, 1.5, 48, 5, 12, 1.5],
      name: { en: 'Hummus and grilled vegetable roll', nl: 'Broodje hummus met gegrilde groenten' },
      desc: { en: 'Multigrain roll with hummus, grilled courgette and pepper.', nl: 'Meergranenbol met hummus, gegrilde courgette en paprika.' } },
    { id: 'uitsmijter', cat: 'warm', price: 4.75, diet: 'veg', al: ['gluten', 'egg', 'milk'], n: [520, 29, 12, 30, 3, 33, 2.4],
      name: { en: 'Uitsmijter with cheese (fried eggs on bread)', nl: 'Uitsmijter kaas' },
      desc: { en: 'Three fried eggs on bread with melted cheese.', nl: 'Drie gebakken eieren op brood met gesmolten kaas.' } },
    { id: 'friet', cat: 'warm', price: 2.75, diet: 'veg', al: ['egg', 'mustard'], n: [480, 27, 3, 52, 1, 5, 0.9],
      name: { en: 'Fries with mayonnaise', nl: 'Friet met mayonaise' },
      desc: { en: 'Freshly fried in vegetable oil. Vegan without mayonnaise.', nl: 'Vers gebakken in plantaardige olie. Vegan zonder mayonaise.' } },
    { id: 'kaassouffle', cat: 'warm', price: 2.25, diet: 'veg', al: ['gluten', 'milk'], n: [270, 16, 7, 22, 1, 9, 1.2],
      name: { en: 'Kaassoufflé (fried cheese pastry)', nl: 'Kaassoufflé' },
      desc: { en: 'Crispy pastry filled with melted cheese.', nl: 'Krokant gebakken deeg gevuld met gesmolten kaas.' } },
    { id: 'salade', cat: 'salad', price: 5.25, diet: 'vegan', al: ['mustard'], n: [390, 19, 2.5, 38, 8, 14, 1.1],
      name: { en: 'Salad bowl', nl: 'Maaltijdsalade' },
      desc: { en: 'Mixed leaves, chickpeas, roasted vegetables, pumpkin seeds and mustard dressing.', nl: 'Gemengde sla, kikkererwten, geroosterde groenten, pompoenpitten en mosterddressing.' } },
    { id: 'vlaai', cat: 'sweet', price: 2.50, diet: 'veg', al: ['gluten', 'milk', 'egg'], n: [250, 6, 3, 44, 22, 4, 0.3],
      name: { en: 'Limburg vlaai (fruit pie)', nl: 'Limburgse vlaai' },
      desc: { en: 'Slice of traditional Limburg pie: cherry or apricot.', nl: 'Punt traditionele Limburgse vlaai: kers of abrikoos.' } },
    { id: 'vla', cat: 'sweet', price: 1.50, diet: 'veg', al: ['milk'], n: [180, 5, 3.2, 28, 22, 6, 0.2],
      name: { en: 'Vanilla vla (custard)', nl: 'Vanillevla' },
      desc: { en: 'Dutch pouring custard, served cold.', nl: 'Hollandse vanillevla, koud geserveerd.' } },
    { id: 'fruit', cat: 'sweet', price: 0.75, diet: 'vegan', al: [], n: [80, 0.2, 0, 17, 15, 0.5, 0],
      name: { en: 'Seasonal fruit', nl: 'Seizoensfruit' },
      desc: { en: 'Dutch apple or pear.', nl: 'Hollandse appel of peer.' } },
    { id: 'melk', cat: 'drink', price: 1.00, diet: 'veg', al: ['milk'], n: [115, 3.8, 2.5, 12, 12, 8.5, 0.25],
      name: { en: 'Milk or buttermilk', nl: 'Melk of karnemelk' },
      desc: { en: 'Glass of semi-skimmed milk or karnemelk (250 ml).', nl: 'Glas halfvolle melk of karnemelk (250 ml).' } },
    { id: 'koffie', cat: 'drink', price: 1.25, diet: 'vegan', al: [], n: [2, 0, 0, 0, 0, 0.2, 0],
      name: { en: 'Coffee or tea', nl: 'Koffie of thee' },
      desc: { en: 'Fairtrade filter coffee or tea.', nl: 'Fairtrade filterkoffie of thee.' } },
  ],

  // Parte stagionale: cambia ogni giorno (1 = lunedì ... 5 = venerdì).
  // Ogni giorno: una zuppa, un piatto con carne o pesce, un piatto vegano.
  seasonal: {
    1: [
      { id: 'pompoensoep', cat: 'soup', price: 2.50, diet: 'vegan', al: ['celery'], n: [150, 8, 5, 16, 8, 3, 1.6],
        name: { en: 'Pumpkin soup', nl: 'Pompoensoep' },
        desc: { en: 'Roasted pumpkin with ginger and coconut milk.', nl: 'Geroosterde pompoen met gember en kokosmelk.' } },
      { id: 'boerenkool', cat: 'main', price: 6.25, diet: '', al: ['milk', 'mustard', 'celery', 'gluten'], n: [690, 38, 15, 55, 5, 28, 3.1],
        name: { en: 'Kale stamppot with smoked sausage', nl: 'Boerenkoolstamppot met rookworst' },
        desc: { en: 'Mashed potato with kale, smoked sausage, gravy and mustard.', nl: 'Aardappelpuree met boerenkool, rookworst, jus en mosterd.' } },
      { id: 'boerenkool-vegan', cat: 'main', price: 5.95, diet: 'vegan', al: ['soy', 'gluten', 'mustard', 'celery'], n: [560, 22, 4, 62, 5, 24, 2.6],
        name: { en: 'Kale stamppot with plant-based sausage', nl: 'Boerenkoolstamppot met vegan rookworst' },
        desc: { en: 'Kale mash made with oat drink, plant-based smoked sausage and mushroom gravy.', nl: 'Boerenkoolstamppot met haverdrank, vegan rookworst en champignonjus.' } },
    ],
    2: [
      { id: 'erwtensoep', cat: 'soup', price: 3.50, diet: '', al: ['celery', 'gluten'], n: [380, 14, 5, 38, 5, 24, 2.6],
        name: { en: 'Split pea soup (snert)', nl: 'Erwtensoep (snert)' },
        desc: { en: 'Thick pea soup with smoked sausage, served with rye bread.', nl: 'Dikke erwtensoep met rookworst, geserveerd met roggebrood.' } },
      { id: 'hutspot', cat: 'main', price: 6.25, diet: '', al: ['milk', 'gluten', 'egg', 'mustard', 'celery'], n: [640, 32, 13, 54, 12, 30, 2.7],
        name: { en: 'Hutspot with meatball', nl: 'Hutspot met gehaktbal' },
        desc: { en: 'Carrot, onion and potato mash with a Dutch meatball and gravy.', nl: 'Stamppot van wortel, ui en aardappel met een gehaktbal en jus.' } },
      { id: 'knolselderij', cat: 'main', price: 5.95, diet: 'vegan', al: ['celery', 'gluten', 'mustard'], n: [520, 20, 2.5, 70, 14, 11, 2.0],
        name: { en: 'Celeriac schnitzel with red cabbage', nl: 'Knolselderijschnitzel met rode kool' },
        desc: { en: 'Breaded celeriac steak, red cabbage with apple and mashed potato.', nl: 'Gepaneerde knolselderij, rode kool met appel en aardappelpuree.' } },
    ],
    3: [
      { id: 'mosterdsoep', cat: 'soup', price: 2.50, diet: 'veg', al: ['mustard', 'milk', 'gluten', 'celery'], n: [210, 14, 8, 14, 4, 5, 1.9],
        name: { en: 'Mustard soup', nl: 'Mosterdsoep' },
        desc: { en: 'Creamy soup with coarse Limburg mustard and leek.', nl: 'Romige soep met grove Limburgse mosterd en prei.' } },
      { id: 'zuurvlees', cat: 'main', price: 6.75, diet: '', al: ['gluten', 'sulphites', 'egg', 'mustard'], n: [720, 30, 8, 78, 22, 34, 2.4],
        name: { en: 'Limburg zuurvlees with fries', nl: 'Limburgs zuurvlees met friet' },
        desc: { en: 'Maastricht classic: sweet-and-sour beef stew with gingerbread and apple syrup, fries and mayonnaise.', nl: 'Maastrichtse klassieker: zoetzuur gestoofd rundvlees met ontbijtkoek en appelstroop, friet en mayonaise.' } },
      { id: 'zuurkool', cat: 'main', price: 5.95, diet: 'vegan', al: ['soy', 'mustard'], n: [480, 16, 2.5, 60, 12, 20, 2.8],
        name: { en: 'Sauerkraut bake with smoked tofu', nl: 'Zuurkoolschotel met gerookte tofu' },
        desc: { en: 'Oven dish of sauerkraut, potato, apple and smoked tofu.', nl: 'Ovenschotel van zuurkool, aardappel, appel en gerookte tofu.' } },
    ],
    4: [
      { id: 'paddenstoelensoep', cat: 'soup', price: 2.50, diet: 'veg', al: ['milk', 'gluten', 'celery'], n: [180, 12, 6, 12, 3, 5, 1.7],
        name: { en: 'Wild mushroom soup', nl: 'Bospaddenstoelensoep' },
        desc: { en: 'Creamy soup of forest mushrooms with thyme.', nl: 'Romige soep van bospaddenstoelen met tijm.' } },
      { id: 'witlof', cat: 'main', price: 6.25, diet: '', al: ['milk', 'gluten'], n: [560, 28, 14, 44, 7, 30, 2.8],
        name: { en: 'Baked chicory with ham and cheese', nl: 'Witlof met ham en kaas uit de oven' },
        desc: { en: 'Chicory rolled in ham, baked in cheese sauce, with mashed potato.', nl: 'Witlof in ham gerold, gegratineerd met kaassaus, met aardappelpuree.' } },
      { id: 'pompoencurry', cat: 'main', price: 5.95, diet: 'vegan', al: ['celery'], n: [540, 16, 9, 80, 10, 16, 1.6],
        name: { en: 'Pumpkin and chickpea curry', nl: 'Pompoen-kikkererwtencurry' },
        desc: { en: 'Mild curry with pumpkin, chickpeas and spinach, served with rice.', nl: 'Milde curry met pompoen, kikkererwten en spinazie, geserveerd met rijst.' } },
    ],
    5: [
      { id: 'preisoep', cat: 'soup', price: 2.50, diet: 'vegan', al: ['celery'], n: [140, 5, 0.8, 20, 4, 3, 1.6],
        name: { en: 'Leek and potato soup', nl: 'Prei-aardappelsoep' },
        desc: { en: 'Smooth soup of leek and potato with chives.', nl: 'Gladde soep van prei en aardappel met bieslook.' } },
      { id: 'kibbeling', cat: 'main', price: 6.95, diet: '', al: ['fish', 'gluten', 'egg', 'mustard'], n: [780, 42, 5, 68, 3, 32, 2.5],
        name: { en: 'Kibbeling with fries', nl: 'Kibbeling met friet' },
        desc: { en: 'Battered fried cod bites with fries and ravigote sauce.', nl: 'Gefrituurde stukjes kabeljauw in beslag met friet en ravigotesaus.' } },
      { id: 'spruitjes', cat: 'main', price: 5.95, diet: 'vegan', al: ['nuts', 'celery', 'gluten'], n: [510, 20, 2.5, 62, 7, 16, 2.0],
        name: { en: 'Brussels sprout stamppot with hazelnuts', nl: 'Spruitjesstamppot met hazelnoten' },
        desc: { en: 'Sprout and potato mash with roasted hazelnuts and mushroom gravy.', nl: 'Stamppot van spruitjes met geroosterde hazelnoten en champignonjus.' } },
    ],
  },

  // Angolo senza glutine: per celiaci, preparato in una zona separata e confezionato a parte.
  glutenFree: [
    { id: 'gf-kaas', cat: 'bread', price: 3.50, diet: 'veg', gf: true, al: ['milk', 'egg'], n: [340, 16, 9, 34, 3, 13, 1.7],
      name: { en: 'Gluten-free cheese roll', nl: 'Glutenvrij broodje kaas' },
      desc: { en: 'Gluten-free roll with Gouda, individually sealed.', nl: 'Glutenvrij bolletje met Goudse kaas, per stuk verpakt.' } },
    { id: 'gf-hummus', cat: 'bread', price: 3.95, diet: 'vegan', gf: true, al: ['sesame'], n: [350, 13, 1.5, 46, 5, 9, 1.5],
      name: { en: 'Gluten-free hummus roll', nl: 'Glutenvrij broodje hummus' },
      desc: { en: 'Gluten-free roll with hummus and grilled vegetables, individually sealed.', nl: 'Glutenvrij bolletje met hummus en gegrilde groenten, per stuk verpakt.' } },
    { id: 'gf-soep', cat: 'soup', price: 2.50, diet: 'vegan', gf: true, al: ['celery'], n: [110, 3.5, 0.5, 15, 9, 3, 1.8],
      name: { en: 'Gluten-free tomato soup', nl: 'Glutenvrije tomatensoep' },
      desc: { en: 'Made with gluten-free stock, served in a sealed cup.', nl: 'Bereid met glutenvrije bouillon, geserveerd in een afgesloten beker.' } },
    { id: 'gf-bowl-kip', cat: 'main', price: 6.25, diet: '', gf: true, al: ['soy', 'sesame'], n: [560, 16, 3, 72, 8, 30, 2.0],
      name: { en: 'Rice bowl with chicken', nl: 'Rijstbowl met kip' },
      desc: { en: 'Rice, roasted seasonal vegetables and chicken with tamari dressing.', nl: 'Rijst, geroosterde seizoensgroenten en kip met tamaridressing.' } },
    { id: 'gf-bowl-tofu', cat: 'main', price: 5.95, diet: 'vegan', gf: true, al: ['soy', 'sesame'], n: [520, 17, 2.5, 70, 8, 22, 2.0],
      name: { en: 'Rice bowl with tofu', nl: 'Rijstbowl met tofu' },
      desc: { en: 'Rice, roasted seasonal vegetables and crispy tofu with tamari dressing.', nl: 'Rijst, geroosterde seizoensgroenten en krokante tofu met tamaridressing.' } },
    { id: 'gf-brownie', cat: 'sweet', price: 2.50, diet: 'veg', gf: true, al: ['nuts', 'egg', 'milk'], n: [290, 19, 8, 24, 20, 6, 0.2],
      name: { en: 'Gluten-free brownie', nl: 'Glutenvrije brownie' },
      desc: { en: 'Brownie made with almond flour.', nl: 'Brownie van amandelmeel.' } },
  ],
};

// Cena speciale del mercoledì sera.
// Le idee si inviano da giovedì a sabato; domenica si sceglie il tema.
const DINNER = {
  time: '18:30',
  canteen: 'fasos',
  // Tema di esempio, scelto domenica scorsa.
  theme: { en: 'Indonesian rijsttafel night', nl: 'Indonesische rijsttafelavond' },
  themeDesc: {
    en: 'Many small dishes to share: nasi, satay, gado-gado and more. Vegan and gluten-free options included.',
    nl: 'Veel kleine gerechten om te delen: nasi, saté, gado-gado en meer. Ook vegan en glutenvrij.',
  },
  // Idee di esempio inviate da altri studenti.
  ideas: [
    { text: 'Italian trattoria night with fresh pasta', by: 'Giulia · SBE' },
    { text: 'Surinaamse avond: roti, bara en pom', by: 'Jayden · Law' },
    { text: 'Korean street food: bibimbap and tteokbokki', by: 'Min-ji · FASoS' },
    { text: 'Limburgse avond met zoervleis en vlaai', by: 'Sanne · FASoS' },
  ],
};

// Ruoli per la sezione "Work with us!".
const JOBS = [
  { id: 'kitchen', name: { en: 'Kitchen assistant', nl: 'Keukenhulp' },
    desc: { en: 'Help the cooks prepare the daily menu.', nl: 'Help de koks met het dagmenu.' } },
  { id: 'counter', name: { en: 'Counter and till', nl: 'Counter en kassa' },
    desc: { en: 'Serve students and scan their QR codes.', nl: 'Bedien studenten en scan hun QR-codes.' } },
  { id: 'takeaway', name: { en: 'Takeaway packing', nl: 'Afhaalbalie' },
    desc: { en: 'Pack app orders into canteen boxes.', nl: 'Pak app-bestellingen in kantineboxen.' } },
  { id: 'dishes', name: { en: 'Dishwashing', nl: 'Spoelkeuken' },
    desc: { en: 'Keep trays, plates and boxes clean.', nl: 'Houd dienbladen, borden en boxen schoon.' } },
];
