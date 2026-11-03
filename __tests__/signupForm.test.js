// Validation, libellés par phase et corps serveur du signup (lib/auth/signupForm.ts).
// Les corps envoyés à /auth/signup et /providers/register sont un contrat serveur : ces tests les figent.
const {
  passwordScore, isEmailValid, canSubmitIdentity, identityErrorKey, billingValidity,
  canSubmitZone, zoneErrorKey, phaseLabelKey, headlineKeys, ctaLabelKey, isCtaDisabled, ctaHintKey,
  radiusLabelKey, toggleId, sortCategoriesByName, requiredDocsCount, buildSignupArgs,
  buildProviderRegisterPayload, buildOnboardingData, isSocialCancel, socialConflictMessage,
} = require('@/lib/auth/signupForm');

const OK_IDENTITY = { name: 'Amina', email: 'amina@fixed.be', password: 'motdepasse' };
const OK_BILLING = { phone: '+32470123456', address: 'Rue Haute 12', postalCode: '1000', billingCity: 'Bruxelles' };
const DRAFT = {
  isProvider: true,
  name: '  Amina Diallo ',
  email: '  Amina@Fixed.BE ',
  password: ' secret123 ',
  phone: ' +32470123456 ',
  address: ' Rue Haute 12 ',
  postalCode: ' 1000 ',
  billingCity: ' Bruxelles ',
  city: ' Bruxelles ',
  radius: 7,
  selectedCats: [3, 1],
};
const CATS = [
  { id: 1, name: 'Serrurerie', icon: 'key' },
  { id: 2, name: 'Électricité', icon: 'zap' },
  { id: 3, name: 'Plomberie', icon: 'droplet' },
];

describe('force du mot de passe', () => {
  it.each([
    ['', 0], ['abc', 0], ['abcdefgh', 1], ['Abcdefgh', 2], ['Abcdefg1', 3], ['Abcdef1!', 4], ['A1!', 3],
  ])('%j → %i', (pwd, score) => { expect(passwordScore(pwd)).toBe(score); });
});

describe('phase identité', () => {
  it('email : espaces tolérés, TLD ≥ 2 lettres', () => {
    expect(isEmailValid('  a@b.be ')).toBe(true);
    expect(isEmailValid('a@b.c')).toBe(false);
    expect(isEmailValid('a b@c.be')).toBe(false);
  });
  it('valide avec nom, email et 8 caractères', () => {
    expect(canSubmitIdentity(OK_IDENTITY)).toBe(true);
    expect(canSubmitIdentity({ ...OK_IDENTITY, name: '   ' })).toBe(false);
    expect(canSubmitIdentity({ ...OK_IDENTITY, password: '1234567' })).toBe(false);
  });
  it('erreur : nom, puis email, puis mot de passe', () => {
    expect(identityErrorKey({ name: ' ', email: 'x', password: '' })).toBe('auth.su_err_name');
    expect(identityErrorKey({ name: 'A', email: 'x', password: '' })).toBe('auth.su_err_email');
    expect(identityErrorKey({ name: 'A', email: 'a@b.be', password: '' })).toBe('auth.su_err_pwd');
  });
});

describe('phase coordonnées', () => {
  it('tous les champs valides', () => {
    expect(billingValidity(OK_BILLING)).toEqual({ phone: true, address: true, postalCode: true, billingCity: true, all: true });
  });
  it('téléphone E.164 obligatoire', () => {
    expect(billingValidity({ ...OK_BILLING, phone: '0470123456' }).phone).toBe(false);
    expect(billingValidity({ ...OK_BILLING, phone: '+123456' }).phone).toBe(false);
    expect(billingValidity({ ...OK_BILLING, phone: '+1234567' }).phone).toBe(true);
  });
  it('code postal belge à 4 chiffres, adresse ≥ 3, ville ≥ 2', () => {
    const v = billingValidity({ phone: '+32470123456', address: 'ab', postalCode: '10000', billingCity: 'B' });
    expect(v).toEqual({ phone: true, address: false, postalCode: false, billingCity: false, all: false });
  });
});

describe('phase activité', () => {
  it('ville ≥ 2 et au moins un métier', () => {
    expect(canSubmitZone('Bruxelles', [1])).toBe(true);
    expect(canSubmitZone('Bruxelles', [])).toBe(false);
    expect(canSubmitZone(' B ', [1])).toBe(false);
  });
  it('erreur : ville d’abord, puis métiers', () => {
    expect(zoneErrorKey('')).toBe('auth.su_err_zone_city');
    expect(zoneErrorKey('Bruxelles')).toBe('auth.su_err_zone_cats');
  });
  it('libellé du rayon', () => {
    expect(radiusLabelKey(1)).toBe('auth.su_radius_near');
    expect(radiusLabelKey(3)).toBe('auth.su_radius_near');
    expect(radiusLabelKey(4)).toBe('auth.su_radius_mid');
    expect(radiusLabelKey(8)).toBe('auth.su_radius_mid');
    expect(radiusLabelKey(9)).toBe('auth.su_radius_far');
  });
  it('bascule d’un métier sans muter la liste', () => {
    const prev = [1, 2];
    expect(toggleId(prev, 2)).toEqual([1]);
    expect(toggleId(prev, 3)).toEqual([1, 2, 3]);
    expect(prev).toEqual([1, 2]);
  });
  it('tri par nom (fr) sans muter', () => {
    expect(sortCategoriesByName(CATS).map((c) => c.id)).toEqual([2, 3, 1]);
    expect(CATS.map((c) => c.id)).toEqual([1, 2, 3]);
  });
  it('pièces obligatoires : 6 pour un métier exempté, 7 sinon', () => {
    expect(requiredDocsCount(CATS, [1])).toBe(6);
    expect(requiredDocsCount(CATS, [1, 3])).toBe(7);
    expect(requiredDocsCount(CATS, [])).toBe(7);
  });
});

describe('libellés par phase', () => {
  it('eyebrow', () => {
    expect(phaseLabelKey('identity')).toBe('auth.su_phase_identity');
    expect(phaseLabelKey('billing')).toBe('auth.su_phase_coords');
    expect(phaseLabelKey('zone')).toBe('auth.su_phase_activity');
  });
  it('titre : activité seulement pour un prestataire en phase zone', () => {
    expect(headlineKeys('billing', true)).toEqual({ title: 'auth.su_coords_title', subtitle: 'auth.su_coords_sub' });
    expect(headlineKeys('zone', true)).toEqual({ title: 'auth.su_activity_title', subtitle: 'auth.su_activity_sub' });
    expect(headlineKeys('zone', false)).toEqual({ title: 'auth.su_identity_title', subtitle: 'auth.su_identity_sub' });
    expect(headlineKeys('identity', true)).toEqual({ title: 'auth.su_identity_title', subtitle: 'auth.su_identity_sub' });
  });
  it('CTA : « continuer » tant qu’une phase suit', () => {
    expect(ctaLabelKey('identity', false)).toBe('auth.su_continue');
    expect(ctaLabelKey('billing', true)).toBe('auth.su_continue');
    expect(ctaLabelKey('billing', false)).toBe('auth.su_create');
    expect(ctaLabelKey('zone', true)).toBe('auth.su_create');
  });
  it('CTA désactivé et raison affichée', () => {
    const none = { canIdentity: false, canBilling: false, canZone: false };
    const all = { canIdentity: true, canBilling: true, canZone: true };
    expect(isCtaDisabled('identity', none)).toBe(true);
    expect(isCtaDisabled('billing', { ...none, canIdentity: true })).toBe(true);
    expect(isCtaDisabled('zone', all)).toBe(false);
    expect(ctaHintKey('identity', none)).toBe('auth.su_err_identity');
    expect(ctaHintKey('billing', none)).toBe('auth.su_err_coords');
    expect(ctaHintKey('zone', none)).toBe('auth.su_err_activity');
    expect(ctaHintKey('identity', all)).toBeNull();
  });
});

describe('corps serveur', () => {
  it('signup : email normalisé, mot de passe brut, coordonnées nettoyées, ordre des clés', () => {
    const args = buildSignupArgs(DRAFT);
    expect(args).toEqual({
      email: 'amina@fixed.be',
      password: ' secret123 ',
      name: 'Amina Diallo',
      extras: { role: 'PROVIDER', phone: '+32470123456', address: 'Rue Haute 12', postalCode: '1000', city: 'Bruxelles' },
    });
    expect(Object.keys(args.extras)).toEqual(['role', 'phone', 'address', 'postalCode', 'city']);
  });
  it('signup client, nom vide → undefined', () => {
    const args = buildSignupArgs({ ...DRAFT, isProvider: false, name: '   ' });
    expect(args.name).toBeUndefined();
    expect(args.extras.role).toBe('CLIENT');
  });
  it('providers.register', () => {
    expect(buildProviderRegisterPayload(DRAFT)).toEqual({ name: 'Amina Diallo', city: 'Bruxelles', radius: 7, categoryIds: [3, 1] });
  });
  it('onboarding_data : métiers choisis dans l’ordre du catalogue', () => {
    expect(buildOnboardingData(DRAFT, CATS)).toEqual({
      name: 'Amina Diallo', city: 'Bruxelles', radius: 7, categoryIds: [3, 1],
      categories: [{ id: 1, name: 'Serrurerie' }, { id: 3, name: 'Plomberie' }],
    });
  });
});

describe('erreurs sociales', () => {
  it('annulation Apple silencieuse', () => {
    expect(isSocialCancel({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isSocialCancel({ code: '1001' })).toBe(true);
    expect(isSocialCancel({ code: 'AUTRE' })).toBe(false);
    expect(isSocialCancel(null)).toBe(false);
    expect(isSocialCancel('oups')).toBe(false);
  });
  it('409 : message serveur en priorité, sinon message de l’erreur', () => {
    expect(socialConflictMessage({ status: 409, data: { error: 'Compte Google existant' }, message: 'x' }))
      .toEqual({ message: 'Compte Google existant' });
    expect(socialConflictMessage({ status: 409, message: 'Conflit' })).toEqual({ message: 'Conflit' });
    expect(socialConflictMessage({ status: 409 })).toEqual({ message: undefined });
  });
  it('autre statut → pas un conflit', () => {
    expect(socialConflictMessage({ status: 500, message: 'x' })).toBeNull();
    expect(socialConflictMessage(undefined)).toBeNull();
  });
});
