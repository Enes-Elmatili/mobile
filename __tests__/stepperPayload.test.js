// Payloads serveur, PaymentSheet et route de sortie de l'étape 4 (lib/request/requestPayload.ts).
// La forme des corps est un contrat serveur : ces tests la figent.
const {
  buildFreeRequestPayload, buildQuoteRequestPayload, buildFixedRequestPayload, buildPricingLockPayload,
  quoteSheetParams, fixedSheetParams, buildMissionRoute,
} = require('@/lib/request/requestPayload');

const NOW = new Date('2026-09-14T10:00:00Z');
const BASE = {
  serviceType: 'Débouchage',
  description: '',
  categoryId: 1,
  subcategoryId: 7,
  location: { address: 'Rue Haute 12, 1000 Bruxelles', lat: 50.84, lng: 4.35 },
  scheduledFor: '2026-09-16T07:00:00.000Z',
  preferredProviderId: undefined,
  accessSnapshot: { accessFloor: 2 },
};
const COMMON = {
  title: 'Débouchage', description: 'Service de Débouchage', serviceType: 'Débouchage', categoryId: 1, subcategoryId: 7,
  address: 'Rue Haute 12, 1000 Bruxelles', lat: 50.84, lng: 4.35, scheduledFor: '2026-09-16T07:00:00.000Z',
};

describe('POST /requests — trois flows', () => {
  it('gratuit : prix 0, jamais urgent, pricingMode free, pas de statut', () => {
    expect(buildFreeRequestPayload(BASE, NOW)).toEqual({ ...COMMON, price: 0, urgent: false, pricingMode: 'free', accessFloor: 2 });
  });
  it('devis : prix 0, PENDING_PAYMENT, mode de la sous-catégorie', () => {
    expect(buildQuoteRequestPayload({ ...BASE, isUrgent: true, pricingMode: 'estimate' }, NOW)).toEqual({
      ...COMMON, price: 0, urgent: true, status: 'PENDING_PAYMENT', pricingMode: 'estimate', accessFloor: 2,
    });
  });
  it('prix fixe : prix et jeton du verrou', () => {
    expect(buildFixedRequestPayload({ ...BASE, isUrgent: false, pricingMode: 'fixed_forfait', price: 182.7, pricingToken: 'tok' }, NOW)).toEqual({
      ...COMMON, price: 182.7, urgent: false, status: 'PENDING_PAYMENT', pricingMode: 'fixed_forfait', pricingToken: 'tok', accessFloor: 2,
    });
  });
  it('ordre des clés inchangé (prix fixe)', () => {
    expect(Object.keys(buildFixedRequestPayload({ ...BASE, isUrgent: false, pricingMode: 'fixed_forfait', price: 1, pricingToken: 't', preferredProviderId: 'p1' }, NOW)))
      .toEqual(['title', 'description', 'serviceType', 'categoryId', 'subcategoryId', 'price', 'address', 'lat', 'lng', 'urgent',
        'scheduledFor', 'status', 'pricingMode', 'pricingToken', 'preferredProviderId', 'accessFloor']);
  });
  it('note du client reprise, sous-catégorie absente omise, créneau absent → maintenant', () => {
    const p = buildFreeRequestPayload({ ...BASE, description: 'Évier bouché', subcategoryId: null, scheduledFor: null }, NOW);
    expect(p.description).toBe('Évier bouché');
    expect(p).not.toHaveProperty('subcategoryId');
    expect(p.scheduledFor).toBe(NOW.toISOString());
  });
  it('prestataire préféré transmis seulement s’il existe', () => {
    expect(buildQuoteRequestPayload({ ...BASE, isUrgent: false, pricingMode: 'diagnostic', preferredProviderId: 'p1' }, NOW).preferredProviderId).toBe('p1');
    expect(buildQuoteRequestPayload({ ...BASE, isUrgent: false, pricingMode: 'diagnostic', preferredProviderId: '' }, NOW)).not.toHaveProperty('preferredProviderId');
  });
});

describe('POST /pricing/lock', () => {
  const lock = { categoryId: 1, subcategoryId: 7, isUrgent: true, scheduledFor: null, pricingMode: 'fixed_forfait', buildingOver10y: true, privateUse: false };
  it('champs TVA envoyés seulement si le service y est éligible', () => {
    expect(buildPricingLockPayload({ ...lock, vatEligible: true }, NOW)).toEqual({
      categoryId: 1, subcategoryId: 7, isUrgent: true, scheduledFor: NOW.toISOString(), pricingMode: 'fixed_forfait',
      buildingOver10y: true, privateUse: false,
    });
    expect(buildPricingLockPayload({ ...lock, vatEligible: false }, NOW)).toEqual({
      categoryId: 1, subcategoryId: 7, isUrgent: true, scheduledFor: NOW.toISOString(), pricingMode: 'fixed_forfait',
    });
  });
});

describe('PaymentSheet Stripe', () => {
  const COMMON_SHEET = {
    merchantDisplayName: 'Fixed',
    applePay: { merchantCountryCode: 'BE' },
    googlePay: { merchantCountryCode: 'BE', testEnv: false },
    paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
  };
  it('callout devis : pas de client Stripe', () => {
    expect(quoteSheetParams('pi_secret')).toEqual({ ...COMMON_SHEET, paymentIntentClientSecret: 'pi_secret' });
  });
  it('prix fixe : client + clé éphémère, alias setupIntent en secours', () => {
    const res = { paymentIntentClientSecret: 'pi', setupIntentClientSecret: 'si', ephemeralKey: 'ek', customer: 'cus' };
    expect(fixedSheetParams(res)).toEqual({
      ...COMMON_SHEET, paymentIntentClientSecret: 'pi', customerEphemeralKeySecret: 'ek', customerId: 'cus',
    });
    expect(fixedSheetParams({ ...res, paymentIntentClientSecret: '' }).paymentIntentClientSecret).toBe('si');
  });
  it('ordre des moyens de paiement : une copie neuve à chaque appel', () => {
    expect(quoteSheetParams('a').paymentMethodOrder).not.toBe(quoteSheetParams('b').paymentMethodOrder);
  });
});

describe('buildMissionRoute — écran après paiement', () => {
  const input = {
    requestId: 42, serviceName: 'Débouchage', location: BASE.location, price: '165.00', calloutFee: '',
    isQuoteFlow: false, scheduledLabel: null, nowLabel: 'Maintenant',
  };
  it('planifié → confirmation, libellé vide par défaut', () => {
    expect(buildMissionRoute({ ...input, scheduleMode: 'later' })).toEqual({
      pathname: '/request/[id]/scheduled',
      params: {
        id: '42', serviceName: 'Débouchage', address: 'Rue Haute 12, 1000 Bruxelles', price: '165.00', calloutFee: '',
        isQuote: '', scheduledLabel: '', lat: '50.84', lng: '4.35',
      },
    });
  });
  it('maintenant → suivi de mission, « Maintenant » par défaut', () => {
    const r = buildMissionRoute({ ...input, scheduleMode: 'now', isQuoteFlow: true, calloutFee: '49.00', price: '' });
    expect(r.pathname).toBe('/request/[id]/missionview');
    expect(r.params).toMatchObject({ scheduledLabel: 'Maintenant', isQuote: '1', calloutFee: '49.00', price: '' });
  });
  it('sans adresse ni nom : chaînes vides', () => {
    const r = buildMissionRoute({ ...input, scheduleMode: 'now', location: null, serviceName: null, scheduledLabel: 'Mer. 16 à 09:00' });
    expect(r.params).toMatchObject({ address: '', serviceName: '', lat: '', lng: '', scheduledLabel: 'Mer. 16 à 09:00' });
  });
});
