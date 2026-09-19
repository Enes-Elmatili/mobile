/**
 * Garde d'onboarding prestataire — règles d'accès côté app.
 *
 * Contexte : un prestataire pouvait atteindre le dashboard et son switch
 * « En ligne » sans avoir terminé documents ni Stripe. Le serveur refuse
 * désormais (backend : services/providerGate.js), et ces règles-ci décident
 * ce que l'app fait de ce refus.
 */
import { shouldLeaveTabs, isOnlineStatus, gateCopyFor, routeAfterLogin, GATE_CODES } from '../providerGate';

describe('shouldLeaveTabs — qui a le droit de rester dans les onglets', () => {
  it('renvoie un prestataire PENDING vers son onboarding', () => {
    expect(shouldLeaveTabs(true, 'PENDING')).toBe(true);
  });

  it.each(['REJECTED', 'SUSPENDED', 'BANNED'])('renvoie un prestataire %s', (status) => {
    expect(shouldLeaveTabs(true, status)).toBe(true);
  });

  it('laisse passer un prestataire ACTIVE', () => {
    expect(shouldLeaveTabs(true, 'ACTIVE')).toBe(false);
  });

  it('ne touche pas à un client, quel que soit le statut lu', () => {
    expect(shouldLeaveTabs(false, 'PENDING')).toBe(false);
    expect(shouldLeaveTabs(false, undefined)).toBe(false);
  });

  it("ne redirige pas sur un statut absent — le profil n'est pas encore rafraîchi", () => {
    // Sans ça, un prestataire actif se ferait éjecter le temps d'un refreshMe.
    expect(shouldLeaveTabs(true, undefined)).toBe(false);
    expect(shouldLeaveTabs(true, null)).toBe(false);
    expect(shouldLeaveTabs(true, '')).toBe(false);
  });
});

describe('isOnlineStatus — lecture du statut serveur', () => {
  it('ONLINE et READY valent en ligne', () => {
    expect(isOnlineStatus('ONLINE')).toBe(true);
    expect(isOnlineStatus('READY')).toBe(true);
  });

  it('tout le reste vaut hors ligne', () => {
    expect(isOnlineStatus('OFFLINE')).toBe(false);
    expect(isOnlineStatus('BUSY')).toBe(false);
    expect(isOnlineStatus(undefined)).toBe(false);
    expect(isOnlineStatus(null)).toBe(false);
  });
});

describe('gateCopyFor — où renvoyer selon le motif de refus', () => {
  it('Stripe non finalisé → écran de configuration des paiements', () => {
    const copy = gateCopyFor(GATE_CODES.STRIPE_NOT_READY);
    expect(copy.route).toBe('/onboarding/provider/stripe-connect');
    expect(copy.titleKey).toBe('provider.gate_stripe_title');
  });

  it('dossier non validé → écran du dossier', () => {
    const copy = gateCopyFor(GATE_CODES.NOT_VALIDATED);
    expect(copy.route).toBe('/onboarding/provider/pending');
    expect(copy.titleKey).toBe('provider.gate_docs_title');
  });

  it('code inconnu ou absent → écran du dossier, qui montre tout', () => {
    expect(gateCopyFor(undefined).route).toBe('/onboarding/provider/pending');
    expect(gateCopyFor('SOMETHING_ELSE').route).toBe('/onboarding/provider/pending');
  });

  it('toutes les clés i18n existent dans les trois langues', () => {
    const locales = {
      fr: require('../../locales/fr.json'),
      en: require('../../locales/en.json'),
      nl: require('../../locales/nl.json'),
    };
    const copies = [gateCopyFor(GATE_CODES.STRIPE_NOT_READY), gateCopyFor(GATE_CODES.NOT_VALIDATED)];

    for (const [lang, dict] of Object.entries(locales)) {
      for (const copy of copies) {
        for (const key of [copy.titleKey, copy.messageKey, copy.confirmKey, copy.cancelKey]) {
          const [ns, leaf] = key.split('.');
          expect(`${lang}:${key}:${(dict as any)[ns]?.[leaf] ?? 'MANQUANT'}`)
            .not.toContain('MANQUANT');
        }
      }
    }
  });
});

describe('routeAfterLogin — où envoyer un compte qui vient de se connecter', () => {
  // Contexte : les boutons Google et Apple de login.tsx envoyaient tout compte
  // muni d'un rôle sur /(tabs)/dashboard, sans regarder le statut prestataire.
  // Un prestataire qui avait quitté son onboarding (documents, Stripe) et se
  // reconnectait en social atterrissait sur le dashboard complet. Le chemin
  // e-mail, lui, faisait la vérification : trois chemins, une seule règle.
  it('sans rôle → choix du rôle (inscription sociale interrompue)', () => {
    expect(routeAfterLogin({ roles: [], profileIncomplete: false, missingFields: [] }))
      .toEqual({ pathname: '/(auth)/role-select' });
    expect(routeAfterLogin({ roles: undefined, profileIncomplete: false, missingFields: [] }))
      .toEqual({ pathname: '/(auth)/role-select' });
  });

  it('profil de facturation incomplet → complete-profile, avec les champs manquants', () => {
    expect(
      routeAfterLogin({
        roles: ['PROVIDER'],
        profileIncomplete: true,
        missingFields: ['phone', 'address'],
        providerStatus: 'PENDING',
      }),
    ).toEqual({ pathname: '/(auth)/complete-profile', params: { missingFields: 'phone,address' } });
  });

  it('prestataire PENDING avec profil complet → dossier, jamais les onglets', () => {
    expect(routeAfterLogin({ roles: ['PROVIDER'], profileIncomplete: false, missingFields: [], providerStatus: 'PENDING' }))
      .toEqual({ pathname: '/onboarding/provider/pending' });
  });

  it.each(['REJECTED', 'SUSPENDED', undefined])('prestataire %s → dossier', (providerStatus) => {
    expect(routeAfterLogin({ roles: ['PROVIDER'], profileIncomplete: false, missingFields: [], providerStatus }))
      .toEqual({ pathname: '/onboarding/provider/pending' });
  });

  it('prestataire ACTIVE → dashboard prestataire', () => {
    expect(routeAfterLogin({ roles: ['PROVIDER'], profileIncomplete: false, missingFields: [], providerStatus: 'ACTIVE' }))
      .toEqual({ pathname: '/(tabs)/dashboard' });
  });

  it('client → dashboard client', () => {
    expect(routeAfterLogin({ roles: ['CLIENT'], profileIncomplete: false, missingFields: [] }))
      .toEqual({ pathname: '/(tabs)/dashboard' });
  });
});
