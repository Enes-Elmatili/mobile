/**
 * Reproduit le rebond du sélecteur de rôle après une inscription sociale.
 *
 * Séquence relevée dans les logs de production (25/08/2026) :
 *   07:45:42  POST /api/auth/apple 200        → compte créé, roles: []
 *   07:45:46  POST /api/auth/assign-role 200  → 4 s plus tard
 *
 * Ces 4 secondes, c'est le temps qu'il faut pour re-choisir un rôle qu'on
 * venait déjà de choisir. role-select.tsx mémorise le rôle dans AsyncStorage
 * (`@fixed:signup:role`) avant d'envoyer sur signup ; les handlers sociaux de
 * signup.tsx ne relisaient jamais cette clé, et le backend ne pose aucun rôle
 * sur un compte social. `res.roles` étant vide, l'app renvoyait donc sur
 * role-select — l'étape 1 sur 3, celle que le prestataire venait de franchir.
 */

const ROLE_INTENT_KEY = '@fixed:signup:role';

/** L'ancien routage post-social, tel qu'il était dupliqué dans les deux handlers. */
async function ancienRoutage(res) {
  if (!res.roles || res.roles.length === 0) return { route: '/(auth)/role-select' };
  if (res.profileIncomplete) return { route: '/(auth)/complete-profile' };
  return { route: '/(tabs)/dashboard' };
}

/** Le nouveau : transcription de routeAfterSocial (signup.tsx). */
async function nouveauRoutage(res, { intent, assignRole }) {
  let payload = res;
  let roles = res?.roles ?? [];

  if (roles.length === 0) {
    if (intent !== 'PROVIDER' && intent !== 'CLIENT') {
      return { route: '/(auth)/role-select' };
    }
    try {
      const assigned = await assignRole(intent);
      roles = assigned?.roles ?? [intent];
      payload = { ...res, ...assigned, roles };
    } catch {
      return { route: '/(auth)/role-select', params: { role: intent } };
    }
  }

  if (payload?.profileIncomplete) return { route: '/(auth)/complete-profile' };
  if (roles.includes('PROVIDER')) return { route: '/onboarding/activity' };
  return { route: '/(tabs)/dashboard' };
}

/** Réponse type de POST /auth/apple pour un compte social tout neuf. */
const COMPTE_SOCIAL_NEUF = { token: 'jwt', roles: [], profileIncomplete: true, missingFields: ['phone', 'address'] };

describe('Inscription sociale après choix du rôle', () => {
  it('REPRODUCTION — le rôle choisi est perdu, retour à l’étape 1', async () => {
    expect(await ancienRoutage(COMPTE_SOCIAL_NEUF)).toEqual({ route: '/(auth)/role-select' });
  });

  it('CORRECTIF — le rôle mémorisé est attribué, sans redemander', async () => {
    const assignRole = jest.fn(async (role) => ({
      token: 'jwt2', roles: [role], profileIncomplete: true, missingFields: ['phone', 'address'],
    }));

    const out = await nouveauRoutage(COMPTE_SOCIAL_NEUF, { intent: 'PROVIDER', assignRole });

    expect(assignRole).toHaveBeenCalledWith('PROVIDER');
    expect(out.route).not.toBe('/(auth)/role-select');
    // Apple et Google ne fournissent ni téléphone ni adresse : la facturation
    // passe avant le reste (Model C — pas de facture sans adresse).
    expect(out.route).toBe('/(auth)/complete-profile');
  });

  it('Prestataire aux coordonnées complètes → gate métier, pas dashboard client', async () => {
    const assignRole = jest.fn(async (role) => ({ token: 'jwt2', roles: [role], profileIncomplete: false }));
    const out = await nouveauRoutage({ ...COMPTE_SOCIAL_NEUF, profileIncomplete: false }, {
      intent: 'PROVIDER', assignRole,
    });
    expect(out.route).toBe('/onboarding/activity');
  });

  it('Client — même mécanique, destination différente', async () => {
    const assignRole = jest.fn(async (role) => ({ token: 'jwt2', roles: [role], profileIncomplete: false }));
    const out = await nouveauRoutage({ ...COMPTE_SOCIAL_NEUF, profileIncomplete: false }, {
      intent: 'CLIENT', assignRole,
    });
    expect(assignRole).toHaveBeenCalledWith('CLIENT');
    expect(out.route).toBe('/(tabs)/dashboard');
  });

  it('Aucune intention mémorisée → l’écran de choix reste le repli légitime', async () => {
    const assignRole = jest.fn();
    const out = await nouveauRoutage(COMPTE_SOCIAL_NEUF, { intent: null, assignRole });
    expect(assignRole).not.toHaveBeenCalled();
    expect(out.route).toBe('/(auth)/role-select');
  });

  it('Échec d’attribution → écran de choix PRÉ-SÉLECTIONNÉ, pas une page blanche', async () => {
    const assignRole = jest.fn(async () => { throw new Error('400'); });
    const out = await nouveauRoutage(COMPTE_SOCIAL_NEUF, { intent: 'PROVIDER', assignRole });
    expect(out).toEqual({ route: '/(auth)/role-select', params: { role: 'PROVIDER' } });
  });

  it('Compte social déjà doté d’un rôle → on n’y touche pas', async () => {
    const assignRole = jest.fn();
    const out = await nouveauRoutage(
      { token: 'jwt', roles: ['CLIENT'], profileIncomplete: false },
      { intent: 'PROVIDER', assignRole },
    );
    // L'intention mémorisée ne doit jamais écraser un rôle existant : le backend
    // refuse d'ailleurs tout rôle différent (400 « déjà un rôle »).
    expect(assignRole).not.toHaveBeenCalled();
    expect(out.route).toBe('/(tabs)/dashboard');
  });
});

describe('Clé d’intention', () => {
  it('La même clé des deux côtés', () => {
    const roleSelect = require('fs').readFileSync(__dirname + '/../app/(auth)/role-select.tsx', 'utf8');
    const signup = require('fs').readFileSync(__dirname + '/../app/(auth)/signup.tsx', 'utf8');
    expect(roleSelect).toContain(`const ROLE_INTENT_KEY = "${ROLE_INTENT_KEY}"`);
    expect(signup).toContain(`const ROLE_INTENT_KEY = "${ROLE_INTENT_KEY}"`);
    // Et signup doit effectivement la RELIRE dans son routage social.
    expect(signup).toContain('AsyncStorage.getItem(ROLE_INTENT_KEY)');
  });
});
