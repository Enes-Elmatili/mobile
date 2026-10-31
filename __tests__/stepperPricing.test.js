// Montants affichés par l'étape 4 du stepper (lib/request/pricing.ts).
const {
  stripEuro, htEuros, parseEuroAmount, formatPriceDelta, resolveServiceVat,
  fixedAmountsCents, calloutEuros, ctaAmount, chargedParams,
} = require('@/lib/request/pricing');

// formatEUR sépare le montant du « € » par une espace insécable.
const eur = (s) => s.replace(/ /g, ' ');

describe('stripEuro', () => {
  it('retire le « € » final et les espaces', () => {
    expect(stripEuro('182,70 €')).toBe('182,70');
    expect(stripEuro(' 12,00 € ')).toBe('12,00');
  });
  it('laisse un montant sans symbole intact', () => { expect(stripEuro('99,00')).toBe('99,00'); });
});

describe('htEuros — HT = TTC − TVA', () => {
  it('préfère les centimes quand ils sont là (182,70 − 8,70 = 174,00)', () => {
    expect(eur(htEuros({ cents: { totalTVAC: 18270, vat: 870 }, totalTVAC: '999.00', vat: '1.00' }))).toBe('174,00 €');
  });
  it('retombe sur les montants texte, virgule ou point', () => {
    expect(eur(htEuros({ totalTVAC: '121.00', vat: '21.00' }))).toBe('100,00 €');
    expect(eur(htEuros({ totalTVAC: '121,00', vat: '21,00' }))).toBe('100,00 €');
  });
  it('jamais négatif, 0 sans prix', () => {
    expect(eur(htEuros({ totalTVAC: '5', vat: '9' }))).toBe('0,00 €');
    expect(eur(htEuros(null))).toBe('0,00 €');
  });
});

describe('parseEuroAmount / formatPriceDelta (AmountCardB)', () => {
  it('lit « 182,70 » et « 182.70 », 0 si illisible', () => {
    expect(parseEuroAmount('182,70')).toBe(182.7);
    expect(parseEuroAmount('1 182.70')).toBe(1182.7);
    expect(parseEuroAmount('—')).toBe(0);
  });
  it('delta signé, virgule décimale', () => {
    expect(formatPriceDelta(12.5)).toBe('+ 12,50 €');
    expect(formatPriceDelta(-3)).toBe('− 3,00 €');
    expect(formatPriceDelta(0)).toBe('− 0,00 €');
  });
});

describe('resolveServiceVat — 6% rénovation sinon 21%', () => {
  const plomberie = { slug: 'plomberie' };
  it('logement de +10 ans, usage privé, travaux immobiliers → 6%', () => {
    expect(resolveServiceVat({ category: plomberie, subcategory: {}, buildingType: 'house', buildingOver10y: true }))
      .toEqual({ vatEligible: true, privateUse: true, vatRate: 0.06 });
  });
  it('logement récent → 21%', () => {
    expect(resolveServiceVat({ category: plomberie, subcategory: null, buildingType: null, buildingOver10y: false }).vatRate).toBe(0.21);
  });
  it('bureau = usage pro → 21%', () => {
    const r = resolveServiceVat({ category: plomberie, subcategory: null, buildingType: 'office', buildingOver10y: true });
    expect(r).toEqual({ vatEligible: true, privateUse: false, vatRate: 0.21 });
  });
  it('la serrurerie (toute casse) et le non immobilier ne sont pas éligibles', () => {
    expect(resolveServiceVat({ category: { slug: 'Serrurerie' }, subcategory: null, buildingType: 'house', buildingOver10y: true }))
      .toEqual({ vatEligible: false, privateUse: true, vatRate: 0.21 });
    expect(resolveServiceVat({ category: plomberie, subcategory: { isImmovableWork: false }, buildingType: 'house', buildingOver10y: true }).vatEligible)
      .toBe(false);
  });
  it('isImmovableWork null/absent reste éligible', () => {
    expect(resolveServiceVat({ category: null, subcategory: { isImmovableWork: null }, buildingType: null, buildingOver10y: true }).vatRate).toBe(0.06);
  });
});

describe('fixedAmountsCents — remise promo validée serveur', () => {
  it('sans promo : nominal = remisé = TTC affiché', () => {
    expect(fixedAmountsCents(182.7, null)).toEqual({ nominalCents: 18270, discountedCents: 18270 });
  });
  it('avec promo : le nominal serveur fait foi', () => {
    expect(fixedAmountsCents(182.7, { code: 'LAUNCH25', discountCents: 2500, nominalCents: 19000 }))
      .toEqual({ nominalCents: 19000, discountedCents: 16500 });
  });
  it('jamais négatif', () => {
    expect(fixedAmountsCents(10, { code: 'X', discountCents: 5000, nominalCents: 1000 }).discountedCents).toBe(0);
  });
  it('arrondi au centime', () => { expect(fixedAmountsCents(0.105, null).nominalCents).toBe(11); });
});

describe('calloutEuros / ctaAmount', () => {
  it('le callout confirmé serveur l’emporte sur celui de la sous-catégorie', () => {
    expect(calloutEuros(4900, 39)).toBe('49,00');
    expect(calloutEuros(null, 39)).toBe('39,00');
  });
  const base = { isFreeService: false, isQuoteFlow: false, confirmedCalloutCents: null, calloutFee: 0, discountedCents: 16500 };
  it('service gratuit → aucun montant', () => { expect(ctaAmount({ ...base, isFreeService: true })).toBeUndefined(); });
  it('prix fixe → montant remisé', () => { expect(eur(ctaAmount(base))).toBe('165,00 €'); });
  it('devis → callout confirmé, sinon callout > 0, sinon rien', () => {
    expect(eur(ctaAmount({ ...base, isQuoteFlow: true, confirmedCalloutCents: 4900 }))).toBe('49,00 €');
    expect(eur(ctaAmount({ ...base, isQuoteFlow: true, calloutFee: 39 }))).toBe('39,00 €');
    expect(ctaAmount({ ...base, isQuoteFlow: true })).toBeUndefined();
  });
});

describe('chargedParams — montant réellement débité, passé à l’écran suivant', () => {
  it('prix fixe : montant remisé, pas de callout', () => {
    expect(chargedParams({ isQuoteFlow: false, discountedCents: 16500, confirmedCalloutCents: 4900 }))
      .toEqual({ price: '165.00', calloutFee: '' });
  });
  it('devis : le callout seul, jamais le prix total', () => {
    expect(chargedParams({ isQuoteFlow: true, discountedCents: 16500, confirmedCalloutCents: 4900 }))
      .toEqual({ price: '', calloutFee: '49.00' });
    expect(chargedParams({ isQuoteFlow: true, discountedCents: 16500, confirmedCalloutCents: null }))
      .toEqual({ price: '', calloutFee: '' });
  });
});
