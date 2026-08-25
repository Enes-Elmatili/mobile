/**
 * Reproduit le refus mécanique des dossiers prestataires vides.
 *
 * Séquence relevée dans les logs de production (25/08/2026, 07:37 → 07:43) :
 *   07:37:51  POST /auth/verify-email 200        → OTP validé
 *   07:37:52  GET  /providers/doc-config/…       → écran DOCUMENTS monté
 *             GET  /providers/documents 200      → 0 pièce en base
 *             … 5 minutes, AUCUN POST /providers/documents …
 *   07:43:13  démarrage à froid → validation-status + connect/status
 *             → atterrissage direct sur l'écran d'ATTENTE
 *
 * L'ancienne règle de routage ne connaissait qu'un booléen :
 * `validationStatus !== 'ACTIVE'` → écran d'attente. Or `validationStatus` vaut
 * "PENDING" dès la CRÉATION de la fiche, avant la première pièce. L'écran
 * d'attente annonçait donc « dossier reçu » et ne proposait qu'un seul bouton :
 * configurer Stripe. L'étape documents devenait inatteignable, et le dossier
 * partait vide en validation — refus garanti.
 *
 * Le test rejoue la décision de routage, sans monter React Native : c'est la
 * règle qui est en cause, pas le rendu.
 */

jest.mock('../lib/api', () => ({ api: {} }));

const {
  requiredDocKeys,
  missingDocKeys,
  firstIncompleteStep,
  isDocSubmitted,
  STEP_ROUTES,
} = require('../lib/providerOnboarding');

/** L'ancienne règle, telle qu'elle vivait dans index.tsx et pending.tsx. */
function ancienneRegle({ validationStatus, stripeReady }) {
  if (validationStatus === 'ACTIVE') return '/(tabs)/provider-dashboard';
  // L'écran d'attente ne proposait que Stripe tant qu'il n'était pas connecté.
  return stripeReady ? '/onboarding/provider/pending' : '/onboarding/provider/stripe-connect';
}

/** La nouvelle : la première étape non terminée, d'après l'état réel. */
function nouvelleRegle(etat) {
  return STEP_ROUTES[firstIncompleteStep(etat)];
}

const PLOMBIER = { names: ['Plomberie'], city: 'Bruxelles', known: true };
const SERRURIER = { names: ['Serrurerie'], city: 'Bruxelles', known: true };
const SANS_METIER = { names: [], city: null, known: true };
const METIERS_INCONNUS = { names: [], city: null, known: false };

const toutesLesPieces = (trades) =>
  requiredDocKeys(trades.names).map((docKey) => ({ docKey, status: 'PENDING' }));

describe('Routage de l’onboarding prestataire', () => {
  it('REPRODUCTION — dossier vide : l’ancienne règle envoie configurer Stripe', () => {
    expect(ancienneRegle({ validationStatus: 'PENDING', stripeReady: false }))
      .toBe('/onboarding/provider/stripe-connect');
  });

  it('CORRECTIF — dossier vide : la nouvelle règle renvoie aux documents', () => {
    expect(nouvelleRegle({ trades: PLOMBIER, docs: [], stripeReady: false }))
      .toBe('/onboarding/documents');
  });

  it('Stripe ne passe devant qu’une fois toutes les pièces déposées', () => {
    const etat = { trades: PLOMBIER, docs: toutesLesPieces(PLOMBIER), stripeReady: false };
    expect(missingDocKeys(etat.docs, etat.trades.names)).toEqual([]);
    expect(nouvelleRegle(etat)).toBe('/onboarding/stripe');
  });

  it('Tout fourni → il ne reste que la validation humaine', () => {
    expect(nouvelleRegle({ trades: PLOMBIER, docs: toutesLesPieces(PLOMBIER), stripeReady: true }))
      .toBe('/onboarding/provider/pending');
  });

  it('Inscription sociale — aucun métier renseigné → gate métier, pas documents', () => {
    // Apple/Google ne passent jamais par la phase « zone » de l'inscription :
    // la fiche existe sans une seule catégorie.
    expect(nouvelleRegle({ trades: SANS_METIER, docs: [], stripeReady: false }))
      .toBe('/onboarding/activity');
  });
});

describe('Pièces exigées selon le métier', () => {
  it('Un serrurier n’a pas à fournir l’accès à la profession', () => {
    // Métier non réglementé en RBC : le lui demander le bloquait à 6/7 sans
    // qu'aucun message ne l'explique (six serruriers bloqués en août 2026).
    expect(requiredDocKeys(SERRURIER.names)).not.toContain('TRADE_LICENSE');
    expect(requiredDocKeys(SERRURIER.names)).toHaveLength(6);
  });

  it('Un plombier, si — et le repli strict aussi', () => {
    expect(requiredDocKeys(PLOMBIER.names)).toContain('TRADE_LICENSE');
    // Métiers inconnus → les 7, exactement comme requiredDocTypesFor côté
    // backend : un doute doit bloquer une activation, jamais en laisser passer.
    expect(requiredDocKeys(METIERS_INCONNUS.names)).toHaveLength(7);
  });

  it('Un serrurier complet n’est pas déclaré incomplet à cause du 7e document', () => {
    const docs = toutesLesPieces(SERRURIER);
    expect(missingDocKeys(docs, SERRURIER.names)).toEqual([]);
    expect(firstIncompleteStep({ trades: SERRURIER, docs, stripeReady: true })).toBe('review');
  });
});

describe('Comptabilisation des pièces', () => {
  it('Une pièce refusée compte comme manquante', () => {
    expect(isDocSubmitted('PENDING')).toBe(true);
    expect(isDocSubmitted('APPROVED')).toBe(true);
    expect(isDocSubmitted('REJECTED')).toBe(false);

    const docs = toutesLesPieces(PLOMBIER).map((d, i) =>
      i === 0 ? { ...d, status: 'REJECTED' } : d
    );
    expect(missingDocKeys(docs, PLOMBIER.names)).toHaveLength(1);
    expect(firstIncompleteStep({ trades: PLOMBIER, docs, stripeReady: true }))
      .toBe('documents');
  });

  it('Un dossier partiel reste sur les documents', () => {
    const docs = toutesLesPieces(PLOMBIER).slice(0, 3);
    expect(missingDocKeys(docs, PLOMBIER.names)).toHaveLength(4);
    expect(nouvelleRegle({ trades: PLOMBIER, docs, stripeReady: false }))
      .toBe('/onboarding/documents');
  });
});
