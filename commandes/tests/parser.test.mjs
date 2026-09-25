// Lancer avec : node --test commandes/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder } from '../js/parser.js';

const settings = {
  products: [
    { id: 'fraise', name: 'Fraise', price: 5.5, keywords: '' },
    { id: 'abricot', name: 'Abricot', price: 5.5, keywords: '' },
    { id: 'fr', name: 'Fraise-rhubarbe', price: 6, keywords: 'fraise rhubarbe' },
    { id: 'orange', name: 'Orange amère', price: 6, keywords: 'marmelade' },
    { id: 'coing', name: 'Gelée de coing', price: 6.5, keywords: '' },
    { id: 'miel', name: 'Miel de lavande', price: 9, keywords: 'miel' },
  ],
  markets: [
    { id: 'vannes', name: 'Marché de Vannes', day: 6, keywords: '' },
    { id: 'auray', name: "Marché d'Auray", day: 1, keywords: '' },
    { id: 'ferme', name: 'Vente à la ferme', day: '', keywords: 'ferme' },
  ],
};
// jeudi 25 septembre 2026
const today = new Date(2026, 8, 25);
const parse = (t) => parseOrder(t, settings, today);
const items = (r) => Object.fromEntries(r.items.map((i) => [i.productId || i.name, i.qty]));

test('message complet type', () => {
  const r = parse('Marie Dupont 06 12 34 56 78 2 fraise 1 abricot pour samedi à Vannes, acompte 5€');
  assert.equal(r.client, 'Marie Dupont');
  assert.equal(r.phone, '06 12 34 56 78');
  assert.deepEqual(items(r), { fraise: 2, abricot: 1 });
  assert.equal(r.pickupDate, '2026-09-26');
  assert.equal(r.marketId, 'vannes');
  assert.equal(r.paid, 5);
  assert.equal(r.items[0].unitPrice, 5.5);
  assert.deepEqual(r.warnings, []);
});

test('quantités après le produit, pluriels et accents', () => {
  const r = parse('mme martin : fraises x3, abricots 2, 1 pot de gelée de coing');
  assert.equal(r.client, 'Mme Martin');
  assert.deepEqual(items(r), { fraise: 3, abricot: 2, coing: 1 });
});

test('produit composé prioritaire sur le produit simple', () => {
  const r = parse('Paul 2 fraise rhubarbe et 1 fraise');
  assert.deepEqual(items(r), { fr: 2, fraise: 1 });
});

test('mots-clés et nombres en lettres', () => {
  const r = parse('Jean : deux marmelades et trois pots de miel');
  assert.equal(r.client, 'Jean');
  assert.deepEqual(items(r), { orange: 2, miel: 3 });
});

test('le marché donne la date', () => {
  const r = parse('Sophie 1 abricot marché d’Auray');
  assert.equal(r.marketId, 'auray');
  assert.equal(r.pickupDate, '2026-09-28'); // lundi suivant
});

test('la date donne le marché', () => {
  const r = parse('Luc 4 fraises pour le 3 octobre');
  assert.equal(r.pickupDate, '2026-10-03');
  assert.equal(r.marketId, 'vannes');
  assert.deepEqual(items(r), { fraise: 4 });
});

test('dates numériques, demain, jour + numéro', () => {
  assert.equal(parse('Ana 1 fraise 12/10').pickupDate, '2026-10-12');
  assert.equal(parse('Ana 1 fraise demain').pickupDate, '2026-09-26');
  assert.equal(parse('Ana 1 fraise après-demain').pickupDate, '2026-09-27');
  assert.equal(parse('Ana 1 fraise samedi 3 octobre').pickupDate, '2026-10-03');
  // « jeudi » un jeudi = la semaine suivante
  assert.equal(parse('Ana 1 fraise jeudi').pickupDate, '2026-10-01');
  // « samedi 3 fraises » : 3 est une quantité, pas une date
  const r = parse('Ana samedi 3 fraises');
  assert.equal(r.pickupDate, '2026-09-26');
  assert.deepEqual(items(r), { fraise: 3 });
  // date passée de peu dans le mois -> mois suivant
  assert.equal(parse('Ana 1 fraise pour le 2').pickupDate, '2026-10-02');
});

test('paiement', () => {
  assert.equal(parse('Léa 2 fraise payé').paidFull, true);
  assert.equal(parse('Léa 2 fraise déjà payé').paidFull, true);
  const nonPaye = parse('Léa 2 fraise pas payé');
  assert.equal(nonPaye.paidFull, false);
  assert.equal(nonPaye.paid, 0);
  assert.equal(parse('Léa 2 fraise 10€ d’acompte').paid, 10);
  const r = parse('Léa 2 fraise a payé 7,50 euros');
  assert.equal(r.paid, 7.5);
  assert.deepEqual(items(r), { fraise: 2 });
});

test('produit inconnu signalé', () => {
  const r = parse('Tom 2 fraise 3 pots de pâte à tartiner');
  assert.deepEqual(items(r), { fraise: 2, 'Pâte à tartiner': 3 });
  assert.ok(r.warnings.some((w) => w.includes('inconnu')));
});

test('note, téléphone international', () => {
  const r = parse('Commande pour Claire +33 6 11 22 33 44, 1 miel. Note : sans étiquette');
  assert.equal(r.client, 'Claire');
  assert.equal(r.phone, '06 11 22 33 44');
  assert.equal(r.notes, 'sans étiquette');
  assert.deepEqual(items(r), { miel: 1 });
});

test('message vide ou sans produit', () => {
  const r = parse('');
  assert.equal(r.items.length, 0);
  assert.ok(r.warnings.includes('Aucun produit reconnu'));
});
