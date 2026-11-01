// État du dossier et contenu de l'écran d'attente prestataire (lib/onboarding/pendingDossier.ts).
// lib/providerOnboarding importe lib/api, qui exige l'URL d'API au chargement.
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';
const {
  statusFromValidation, companyFlagsFromProvider, docLabelFallback, pendingFirstName, hasBioText, BIO_MIN_LENGTH,
  deriveDossier, resumeRoute, timelineRows, incompleteReason, outcomeContent,
} = require('@/lib/onboarding/pendingDossier');

const SEVEN = ['ID_FRONT', 'ID_BACK', 'BCE_CERTIFICATE', 'INSURANCE_RC_PRO', 'TRADE_LICENSE', 'CRIMINAL_RECORD', 'IBAN_PROOF'];
const PLOMBIER = { names: ['Plomberie'], city: 'Bruxelles', known: true };
const SERRURIER = { names: ['Serrurerie'], city: 'Bruxelles', known: true };
const COMPANY_OK = { vatPresent: true, vatVerified: true, ibanPresent: true };
const docs = (keys, status = 'PENDING') => keys.map((docKey, i) => ({ id: `d${i}`, docKey, status }));

describe('statut serveur → état d’écran', () => {
  it.each([
    ['ACTIVE', 'approved'], ['REJECTED', 'rejected'], ['SUSPENDED', 'suspended'], ['BANNED', 'banned'], ['PENDING', 'pending'],
    ['active', null], ['', null], [undefined, null], [null, null],
  ])('%j → %j', (raw, expected) => { expect(statusFromValidation(raw)).toBe(expected); });
});

describe('entreprise', () => {
  it('drapeaux depuis /providers/me', () => {
    expect(companyFlagsFromProvider({ vatNumber: 'BE0123', vatVerifiedAt: null, bankIban: 'BE68…' }))
      .toEqual({ vatPresent: true, vatVerified: false, ibanPresent: true });
    expect(companyFlagsFromProvider({})).toEqual({ vatPresent: false, vatVerified: false, ibanPresent: false });
  });
});

describe('libellés et profil', () => {
  it('libellé de repli d’une pièce', () => {
    expect(docLabelFallback('ID_FRONT')).toBe("Carte d'identité — recto");
    expect(docLabelFallback('piece_inconnue')).toBe('piece inconnue');
  });
  it('prénom : premier mot du nom, vide sans nom', () => {
    expect(pendingFirstName({ name: '  Amina  Diallo ' })).toBe('Amina');
    expect(pendingFirstName(null)).toBe('');
    expect(pendingFirstName({})).toBe('');
  });
  it('bio renseignée si non vide après trim', () => {
    expect(hasBioText('Plombier depuis 10 ans')).toBe(true);
    expect(hasBioText('   ')).toBe(false);
    expect(hasBioText(undefined)).toBe(false);
    expect(BIO_MIN_LENGTH).toBe(10);
  });
});

describe('état du dossier', () => {
  it('métiers pas encore lus → rien d’avéré côté pièces', () => {
    const d = deriveDossier({ trades: null, documents: [], company: null });
    expect(d.docsIncomplete).toBe(false);
    expect(d.companyIncomplete).toBe(false);
    expect(d.fileIncomplete).toBe(false);
    expect(d.requiredKeys).toHaveLength(7);
  });
  it('plombier sans pièces : 0/7, incomplet', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: [], company: COMPANY_OK });
    expect(d).toMatchObject({ docsIncomplete: true, submittedCount: 0, fileIncomplete: true, tradesMissing: false });
    expect(d.missingKeys).toHaveLength(7);
  });
  it('serrurier : 6 pièces suffisent, les refusées ne comptent pas', () => {
    const six = SEVEN.filter((k) => k !== 'TRADE_LICENSE');
    expect(deriveDossier({ trades: SERRURIER, documents: docs(six), company: COMPANY_OK }).fileIncomplete).toBe(false);
    const d = deriveDossier({ trades: SERRURIER, documents: docs(six, 'REJECTED'), company: COMPANY_OK });
    expect(d.docsIncomplete).toBe(true);
    expect(d.submittedCount).toBe(0);
  });
  it('profil métier vide avéré', () => {
    expect(deriveDossier({ trades: { names: [], city: null, known: true }, documents: [], company: null }).tradesMissing).toBe(true);
    expect(deriveDossier({ trades: { names: [], city: null, known: false }, documents: [], company: null }).tradesMissing).toBe(false);
  });
  it('BCE ou IBAN absent → entreprise incomplète ; BCE non confirmé VIES → en cours, pas un manque', () => {
    const full = docs(SEVEN, 'APPROVED');
    expect(deriveDossier({ trades: PLOMBIER, documents: full, company: { ...COMPANY_OK, ibanPresent: false } }).companyIncomplete).toBe(true);
    const vies = deriveDossier({ trades: PLOMBIER, documents: full, company: { ...COMPANY_OK, vatVerified: false } });
    expect(vies).toMatchObject({ companyIncomplete: false, vatPendingVies: true, fileIncomplete: false });
  });
});

describe('reprise de l’onboarding', () => {
  it('route de la première étape incomplète', () => {
    expect(resumeRoute({ trades: { names: [], city: null, known: true }, company: null, documents: [], stripeConnected: false }))
      .toBe('/onboarding/activity');
    expect(resumeRoute({ trades: PLOMBIER, company: { ...COMPANY_OK, vatPresent: false }, documents: [], stripeConnected: false }))
      .toBe('/onboarding/company');
    expect(resumeRoute({ trades: PLOMBIER, company: COMPANY_OK, documents: [], stripeConnected: false }))
      .toBe('/onboarding/documents');
    expect(resumeRoute({ trades: PLOMBIER, company: COMPANY_OK, documents: docs(SEVEN), stripeConnected: false }))
      .toBe('/onboarding/stripe');
  });
  it('tout est fait → documents (jamais l’écran d’attente lui-même)', () => {
    expect(resumeRoute({ trades: PLOMBIER, company: COMPANY_OK, documents: docs(SEVEN), stripeConnected: true }))
      .toBe('/onboarding/documents');
  });
  it('entreprise pas encore lue → supposée complète', () => {
    expect(resumeRoute({ trades: PLOMBIER, company: null, documents: docs(SEVEN), stripeConnected: false }))
      .toBe('/onboarding/stripe');
  });
});

describe('timeline', () => {
  const states = (rows) => rows.map((r) => r.state);
  it('entreprise incomplète : 1re étape active, le reste en attente', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: [], company: { ...COMPANY_OK, ibanPresent: false } });
    const rows = timelineRows(d, false);
    expect(states(rows)).toEqual(['active', 'active', 'idle', 'idle', 'idle']);
    expect(rows[0].eta).toEqual({ key: 'onboarding.pending_company_missing' });
    expect(rows[1].eta).toEqual({ key: 'onboarding.pending_docs_progress', params: { sent: 0, total: 7 } });
  });
  it('dossier complet sans Stripe : Stripe actif', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: docs(SEVEN), company: COMPANY_OK });
    const rows = timelineRows(d, false);
    expect(states(rows)).toEqual(['done', 'done', 'active', 'idle', 'idle']);
    expect(rows[2].eta).toEqual({ key: 'onboarding.pending_stripe_missing' });
  });
  it('tout est fait : vérification en cours, ETA toujours fournie', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: docs(SEVEN), company: COMPANY_OK });
    const rows = timelineRows(d, true);
    expect(states(rows)).toEqual(['done', 'done', 'done', 'active', 'idle']);
    expect(rows[3].eta).toEqual({ key: 'onboarding.pending_verifying_eta' });
    expect(rows[4]).toMatchObject({ last: true });
    expect(rows[4].eta).toBeUndefined();
  });
  it('BCE en attente VIES : ETA dédiée sur la 1re étape', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: docs(SEVEN), company: { ...COMPANY_OK, vatVerified: false } });
    expect(timelineRows(d, true)[0]).toMatchObject({ state: 'done', eta: { key: 'onboarding.pending_company_vies_pending' } });
  });
  it('libellés dans l’ordre', () => {
    const d = deriveDossier({ trades: null, documents: [], company: null });
    expect(timelineRows(d, false).map((r) => r.labelKey)).toEqual([
      'onboarding.pending_step_company', 'onboarding.pending_step_received', 'onboarding.pending_step_stripe',
      'onboarding.pending_step_verifying', 'onboarding.pending_step_activated',
    ]);
  });
});

describe('motif « dossier incomplet »', () => {
  it('métiers d’abord', () => {
    const d = deriveDossier({ trades: { names: [], city: null, known: true }, documents: [], company: { ...COMPANY_OK, vatPresent: false } });
    expect(incompleteReason(d, { ...COMPANY_OK, vatPresent: false })).toEqual({ key: 'onboarding.pending_incomplete_trades' });
  });
  it('puis entreprise : BCE manquant, ou seulement l’IBAN', () => {
    const noBce = { ...COMPANY_OK, vatPresent: false };
    const noIban = { ...COMPANY_OK, ibanPresent: false };
    expect(incompleteReason(deriveDossier({ trades: PLOMBIER, documents: [], company: noBce }), noBce).key).toBe('onboarding.pending_incomplete_bce');
    expect(incompleteReason(deriveDossier({ trades: PLOMBIER, documents: [], company: noIban }), noIban).key).toBe('onboarding.pending_incomplete_iban');
  });
  it('enfin les pièces manquantes', () => {
    const d = deriveDossier({ trades: PLOMBIER, documents: docs(['ID_FRONT']), company: COMPANY_OK });
    const r = incompleteReason(d, COMPANY_OK);
    expect(r.key).toBe('onboarding.pending_incomplete_docs');
    expect(r.missingKeys).toHaveLength(6);
    expect(r.missingKeys).not.toContain('ID_FRONT');
  });
});

describe('écrans de sortie', () => {
  it('refusé : renvoi aux documents, motif « refus »', () => {
    expect(outcomeContent('rejected')).toMatchObject({
      icon: 'x', tone: 'red', reasonLabel: 'onboarding.rejected_reason_label', cta: 'onboarding.rejected_cta', route: '/onboarding/documents',
    });
  });
  it('suspendu / banni : support', () => {
    expect(outcomeContent('suspended')).toMatchObject({ icon: 'slash', tone: 'white', cta: 'onboarding.suspended_cta', route: '/support' });
    expect(outcomeContent('banned')).toMatchObject({ icon: 'slash', tone: 'red', cta: 'onboarding.banned_cta', route: '/support' });
    expect(outcomeContent('banned').reasonLabel).toBe('onboarding.status_reason_label');
  });
});
