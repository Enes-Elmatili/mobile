// Le prix indicatif côté client (lib/services/priceService.js) : ce que le
// client voit avant de payer. Une erreur ici, c'est un montant faux affiché au
// checkout — surcharges soir/nuit/week-end/férié lues à l'heure de Bruxelles,
// urgence, déplacement, commission, TVA, arrondis au centime.
const { computePrice, isHoliday, PRICING } = require('@/lib/services/priceService');
const legacy = require('@/lib/services/priceService').default;

// Instants UTC choisis pour tomber à une heure précise à Bruxelles
// (CEST = UTC+2 en septembre, CET = UTC+1 en décembre).
const MER_10H = '2026-09-16T08:00:00Z';   // mercredi 10:00 Bruxelles
const MER_18H = '2026-09-16T16:00:00Z';   // mercredi 18:00
const MER_17H59 = '2026-09-16T15:59:00Z'; // mercredi 17:59
const MER_23H30 = '2026-09-16T21:30:00Z'; // mercredi 23:30 (21:30 en UTC !)
const JEU_00H = '2026-09-16T22:00:00Z';   // jeudi 00:00
const JEU_6H59 = '2026-09-17T04:59:00Z';  // jeudi 06:59
const JEU_7H = '2026-09-17T05:00:00Z';    // jeudi 07:00
const SAM_10H = '2026-09-19T08:00:00Z';   // samedi 10:00
const SAM_20H = '2026-09-19T18:00:00Z';   // samedi 20:00
const DIM_23H30 = '2026-09-20T21:30:00Z'; // dimanche 23:30

const base = (over = {}) => computePrice({ baseRate: 50, hours: 2, requestDate: new Date(MER_10H), ...over });

describe('computePrice — le cas nominal, centime par centime', () => {
  it('50 €/h × 2 h en semaine, journée : 100 € HTVA, 20 % plateforme, 21 % TVA sur le service seul', () => {
    const p = base();
    expect(p.multiplier).toBe(1);
    expect(p.cents).toEqual({
      baseHTVA: 10000,
      adjustedBase: 10000,
      urgentFee: 0,
      travelFee: 0,
      platformFee: 2000,
      totalHTVA: 12000,
      vat: 2100,
      totalTVAC: 14100,
      stripeFee: 237, // round(14100 × 1,5 %) = 212 (211,5 arrondi) + 25 fixes
      finalTotal: 14100,
    });
    expect(p.baseHTVA).toBe('100.00');
    expect(p.vat).toBe('21.00');
    expect(p.platformFee).toBe('20.00');
    expect(p.totalTVAC).toBe('141.00');
    expect(p.finalTotal).toBe('141.00');
    expect(p.stripeFee).toBe('2.37');
    expect(p.vatRate).toBe(0.21);
  });

  it('les frais Stripe ne sont jamais facturés au client', () => {
    const p = base({ isUrgent: true, distanceKm: 25 });
    expect(p.cents.finalTotal).toBe(p.cents.totalTVAC);
    expect(p.cents.finalTotal).not.toBe(p.cents.totalTVAC + p.cents.stripeFee);
  });

  it('la TVA porte sur le prix du service, pas sur la commission plateforme', () => {
    const p = base({ isUrgent: true, distanceKm: 14 });
    const subtotal = p.cents.adjustedBase + p.cents.urgentFee + p.cents.travelFee;
    expect(p.cents.vat).toBe(Math.round(subtotal * 0.21));
    expect(p.cents.platformFee).toBe(Math.round(subtotal * 0.2));
    expect(p.cents.totalHTVA).toBe(subtotal + p.cents.platformFee);
    expect(p.cents.totalTVAC).toBe(subtotal + p.cents.vat + p.cents.platformFee);
  });

  it('taux TVA du service : 6 % (rénovation) remplace 21 %, 0 est respecté', () => {
    const six = base({ vatRate: 0.06 });
    expect(six.cents.vat).toBe(600);
    expect(six.cents.totalTVAC).toBe(10000 + 600 + 2000);
    expect(six.vatRate).toBe(0.06);
    const zero = base({ vatRate: 0 });
    expect(zero.cents.vat).toBe(0);
    expect(zero.vatRate).toBe(0);
    // Une valeur non numérique retombe sur le taux standard
    expect(base({ vatRate: '0.06' }).vatRate).toBe(PRICING.VAT);
  });

  it('arrondis : 45 €/h le soir → 58,50 € ajustés, TVA 12,285 → 12,29 €', () => {
    const p = computePrice({ baseRate: 45, hours: 1, requestDate: new Date(MER_18H) });
    expect(p.cents.adjustedBase).toBe(5850);
    expect(p.cents.vat).toBe(1229);
    expect(p.cents.platformFee).toBe(1170);
    expect(p.cents.totalTVAC).toBe(8249);
    expect(p.cents.stripeFee).toBe(124 + 25);
    expect(p.totalTVAC).toBe('82.49');
  });
});

describe('computePrice — surcharges horaires (heure de Bruxelles, additives)', () => {
  it.each([
    ['17:59 → aucune', MER_17H59, 1],
    ['18:00 → soir ×1,3', MER_18H, 1.3],
    ['23:30 → nuit ×2 (alors qu’il est 21:30 UTC)', MER_23H30, 2],
    ['minuit → nuit ×2', JEU_00H, 2],
    ['06:59 → nuit ×2', JEU_6H59, 2],
    ['07:00 → aucune', JEU_7H, 1],
    ['samedi 10:00 → ×1,3', SAM_10H, 1.3],
    ['samedi 20:00 → soir + samedi = ×1,6', SAM_20H, 1.6],
    ['dimanche 23:30 → nuit + dimanche = ×2,5', DIM_23H30, 2.5],
  ])('%s', (_label, iso, mult) => {
    const p = base({ requestDate: new Date(iso) });
    expect(p.multiplier).toBeCloseTo(mult, 10);
    expect(p.cents.adjustedBase).toBe(Math.round(10000 * mult));
  });

  it('accepte une date en chaîne ISO', () => {
    expect(base({ requestDate: MER_23H30 }).multiplier).toBe(2);
  });

  it('date absente ou invalide : aucune surcharge, pas de NaN dans les montants', () => {
    for (const requestDate of [undefined, 'pas une date', new Date('invalid')]) {
      const p = base({ requestDate });
      expect(p.multiplier).toBe(1);
      expect(p.cents.finalTotal).toBe(14100);
      expect(p.finalTotal).toBe('141.00');
    }
  });

  it('férié : 21 juillet (mardi) en journée → ×1,5', () => {
    expect(base({ requestDate: new Date('2026-07-21T08:00:00Z') }).multiplier).toBe(1.5);
  });

  it('Noël 00:30 à Bruxelles (24 déc. 23:30 UTC) : nuit + férié = ×2,5', () => {
    expect(base({ requestDate: new Date('2026-12-24T23:30:00Z') }).multiplier).toBe(2.5);
  });

  it('un dimanche férié ne cumule pas deux fois la surcharge du jour', () => {
    // Pâques 2026 = dimanche 5 avril
    expect(base({ requestDate: new Date('2026-04-05T08:00:00Z') }).multiplier).toBe(1.5);
  });
});

describe('computePrice — urgence, déplacement, forfait', () => {
  it('urgence = 50 % de la base ajustée (après surcharge)', () => {
    const jour = base({ isUrgent: true });
    expect(jour.cents.urgentFee).toBe(5000);
    const nuit = base({ isUrgent: true, requestDate: new Date(MER_23H30) });
    expect(nuit.cents.adjustedBase).toBe(20000);
    expect(nuit.cents.urgentFee).toBe(10000);
    expect(nuit.urgentFee).toBe('100.00');
  });

  it('déplacement : 10 km inclus, puis 0,60 €/km arrondi au centime', () => {
    expect(base({ distanceKm: 0 }).cents.travelFee).toBe(0);
    expect(base({ distanceKm: 9.5 }).cents.travelFee).toBe(0);
    expect(base({ distanceKm: 10 }).cents.travelFee).toBe(0);
    expect(base({ distanceKm: 10.4 }).cents.travelFee).toBe(24);
    expect(base({ distanceKm: 15 }).cents.travelFee).toBe(300);
    expect(base({ distanceKm: -5 }).cents.travelFee).toBe(0);
    expect(base({ distanceKm: null }).cents.travelFee).toBe(0);
  });

  it('forfait déplacement fixe : 25 € quelle que soit la distance', () => {
    expect(base({ useFlatTravel: true, distanceKm: 0 }).cents.travelFee).toBe(2500);
    expect(base({ useFlatTravel: true, distanceKm: 80 }).cents.travelFee).toBe(2500);
  });

  it('le déplacement entre dans le sous-total, donc dans la commission et la TVA', () => {
    const p = base({ distanceKm: 15 }); // 100 € + 3 €
    expect(p.cents.platformFee).toBe(2060);
    expect(p.cents.vat).toBe(2163);
    expect(p.cents.totalTVAC).toBe(10300 + 2163 + 2060);
  });

  it('prix forfaitaire : le montant fixe remplace taux × heures', () => {
    const p = base({ isFlat: true, flatAmount: 89, baseRate: 999, hours: 9 });
    expect(p.cents.baseHTVA).toBe(8900);
    expect(p.cents.adjustedBase).toBe(8900);
    expect(base({ isFlat: true, flatAmount: undefined }).cents.baseHTVA).toBe(0);
  });

  it('entrées manquantes : 0 € plutôt que NaN, frais Stripe fixes seuls', () => {
    const p = computePrice({ baseRate: undefined, hours: undefined, requestDate: new Date(MER_10H) });
    expect(p.cents.baseHTVA).toBe(0);
    expect(p.cents.finalTotal).toBe(0);
    expect(p.cents.stripeFee).toBe(PRICING.STRIPE_FIXED_CENTS);
    expect(p.finalTotal).toBe('0.00');
  });

  it('heures fractionnaires : 1,5 h à 40 € = 60 €', () => {
    expect(base({ baseRate: 40, hours: 1.5 }).cents.baseHTVA).toBe(6000);
  });
});

describe('isHoliday — jours fériés belges', () => {
  it.each([
    ['Jour de l’An', '2026-01-01T10:00:00Z'],
    ['Fête du Travail', '2026-05-01T10:00:00Z'],
    ['Fête nationale', '2026-07-21T10:00:00Z'],
    ['Assomption', '2026-08-15T10:00:00Z'],
    ['Toussaint', '2026-11-01T10:00:00Z'],
    ['Armistice', '2026-11-11T10:00:00Z'],
    ['Noël', '2026-12-25T10:00:00Z'],
    ['Pâques 2026 (5 avril)', '2026-04-05T10:00:00Z'],
    ['Lundi de Pâques 2026', '2026-04-06T10:00:00Z'],
    ['Ascension 2026 (14 mai)', '2026-05-14T10:00:00Z'],
    ['Pentecôte 2026 (24 mai)', '2026-05-24T10:00:00Z'],
    ['Lundi de Pentecôte 2026', '2026-05-25T10:00:00Z'],
    ['Lundi de Pâques 2027 (29 mars)', '2027-03-29T10:00:00Z'],
  ])('%s est férié', (_l, iso) => {
    expect(isHoliday(new Date(iso))).toBe(true);
  });

  it.each([
    ['un mercredi ordinaire', '2026-09-16T10:00:00Z'],
    ['la veille de Noël', '2026-12-24T10:00:00Z'],
    ['le lendemain du lundi de Pâques', '2026-04-07T10:00:00Z'],
  ])('%s ne l’est pas', (_l, iso) => {
    expect(isHoliday(new Date(iso))).toBe(false);
  });

  it('lit le jour à Bruxelles : 31 déc. 23:30 UTC = 1er janvier à Bruxelles', () => {
    expect(isHoliday(new Date('2026-12-31T23:30:00Z'))).toBe(true);
    expect(isHoliday(new Date('2026-12-31T22:30:00Z'))).toBe(false);
  });

  it('date invalide ou absente : jamais férié', () => {
    expect(isHoliday(new Date('nope'))).toBe(false);
    expect(isHoliday(undefined)).toBe(false);
    expect(isHoliday('2026-12-25')).toBe(false);
  });
});

describe('export par défaut (anciens imports)', () => {
  it('expose les mêmes fonctions et constantes', () => {
    expect(legacy.computePrice).toBe(computePrice);
    expect(legacy.isHoliday).toBe(isHoliday);
    expect(legacy.PRICING).toBe(PRICING);
    expect(PRICING.PLATFORM_FEE).toBe(0.2);
    expect(PRICING.VAT).toBe(0.21);
  });
});
