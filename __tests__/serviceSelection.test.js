/**
 * Régression du rejet App Store 2.1(a) du 18/08/2026.
 *
 * Symptôme constaté par le reviewer Apple (iPad Air 11" M3, iPadOS 26.6) :
 * à l'étape 4 « Review », la bannière « Couldn't prepare the payment. Check
 * your connection. » s'affiche, l'écran annonce « Free service / No payment
 * required » et le CTA « Confirm (free) » est mort.
 *
 * Reproduction : à l'étape 2, taper le TITRE de la catégorie (« Serrurerie »,
 * « Plomberie ») puis « Continuer » sans choisir de sous-catégorie.
 *
 * En base, `Category.price` est NULL pour les 10 catégories — seule une
 * sous-catégorie porte un prix (85 sous-catégories, basePrice de 13 à 530,
 * aucune à 0, aucun pricingMode 'free'). Le service « gratuit » n'existe donc
 * pas en production : il n'était atteignable QUE par ce bug.
 */

const {
  resolveServiceSelection,
} = require('../lib/services/serviceSelection');

/** Reflet fidèle de la base de production. */
const SERRURERIE = {
  id: 1,
  price: null, // ← Category.price est NULL pour les 10 catégories
  subcategories: [
    { id: 11, basePrice: 95, pricingMode: 'fixed_forfait' },
    { id: 12, basePrice: 140, pricingMode: 'estimate', calloutFee: 29 },
  ],
};

/** Le serveur, lui, tranche ainsi (backend/routes/requests.js). */
function serverIsFreeService(dbBasePrice, dbPricingMode) {
  const isQuoteFlow =
    dbPricingMode === 'estimate' || dbPricingMode === 'diagnostic';
  return !isQuoteFlow && dbBasePrice !== null && dbBasePrice === 0;
}

describe('catégorie choisie sans sous-catégorie', () => {
  const sel = () => resolveServiceSelection(SERRURERIE, null);

  it("n'est jamais annoncée comme gratuite (le prix est inconnu, pas nul)", () => {
    expect(sel().rawBasePrice).toBeNull();
    expect(sel().isFreeService).toBe(false);
  });

  it('bloque le passage à l’étape 3 tant que rien n’est précisé', () => {
    expect(sel().requiresSubcategory).toBe(true);
    expect(sel().serviceChosen).toBe(false);
  });

  it('reste alignée sur la décision du serveur', () => {
    // Le serveur reçoit dbBasePrice = Category.price = null → service PAYANT.
    // L'app doit dire la même chose, sinon elle part sans pricingToken → 400.
    expect(sel().isFreeService).toBe(serverIsFreeService(null, null));
  });
});

describe('sous-catégorie choisie', () => {
  it('ouvre le flow prix fixe payant', () => {
    const s = resolveServiceSelection(SERRURERIE, SERRURERIE.subcategories[0]);
    expect(s.rawBasePrice).toBe(95);
    expect(s.isFreeService).toBe(false);
    expect(s.isQuoteFlow).toBe(false);
    expect(s.serviceChosen).toBe(true);
  });

  it('ouvre le flow devis sans le confondre avec du gratuit', () => {
    const s = resolveServiceSelection(SERRURERIE, SERRURERIE.subcategories[1]);
    expect(s.isQuoteFlow).toBe(true);
    expect(s.isFreeService).toBe(false);
    expect(s.calloutFee).toBe(29);
    expect(s.serviceChosen).toBe(true);
  });
});

describe('gratuité réelle', () => {
  it('reste reconnue quand la base déclare explicitement un prix à 0', () => {
    const cat = { id: 9, price: null, subcategories: [{ id: 91, basePrice: 0 }] };
    const s = resolveServiceSelection(cat, cat.subcategories[0]);
    expect(s.rawBasePrice).toBe(0);
    expect(s.isFreeService).toBe(true);
    expect(s.isFreeService).toBe(serverIsFreeService(0, 'fixed_forfait'));
  });

  it("reste reconnue via pricingMode 'free'", () => {
    const cat = { id: 9, price: null, subcategories: [{ id: 92, basePrice: 40, pricingMode: 'free' }] };
    expect(resolveServiceSelection(cat, cat.subcategories[0]).isFreeService).toBe(true);
  });
});

describe('catégorie sans sous-catégorie', () => {
  it('est réservable si elle porte un prix', () => {
    const cat = { id: 20, price: 60, subcategories: [] };
    const s = resolveServiceSelection(cat, null);
    expect(s.serviceChosen).toBe(true);
    expect(s.categoryUnavailable).toBe(false);
    expect(s.isFreeService).toBe(false);
  });

  it("est déclarée non réservable si elle n'en porte pas (même piège)", () => {
    const cat = { id: 21, price: null, subcategories: [] };
    const s = resolveServiceSelection(cat, null);
    expect(s.isFreeService).toBe(false);
    expect(s.serviceChosen).toBe(false);
    expect(s.categoryUnavailable).toBe(true);
  });
});
