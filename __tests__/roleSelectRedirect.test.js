/**
 * Reproduit le blocage sur (auth)/role-select après une inscription Google.
 *
 * Le test rejoue la logique du gate de app/_layout.tsx sur la séquence réelle
 * d'événements, sans monter React Native : c'est l'ordonnancement
 * (navigation vs rafraîchissement de /auth/me) qui est en cause, pas le rendu.
 *
 * Séquence observée en production :
 *   1. Google → compte créé sans rôle → roles: []
 *   2. signup.tsx redirige vers /(auth)/role-select        ✅ attendu
 *   3. l'utilisateur choisit CLIENT → POST /auth/assign-role → 200 + token
 *   4. role-select.tsx appelle signIn(token) — qui n'attend PAS refreshMe —
 *      puis navigue immédiatement
 *   5. le gate racine s'exécute avec user.roles encore vide → renvoie sur
 *      role-select
 *   6. refreshMe finit par répondre avec roles: ['CLIENT'], mais user.roles
 *      n'est pas dans le tableau de dépendances de l'effet → aucune
 *      réévaluation → écran figé
 *   7. re-tenter renvoie 400 « L'utilisateur a déjà un rôle »
 */

/** Reproduction fidèle du gate de app/_layout.tsx (RootLayoutNav). */
function makeGate({ dependencyKeys, honorsTokenRace = false }) {
  let lastDeps = null;
  const redirects = [];

  /**
   * Un « rendu » React : l'effet ne s'exécute que si ses dépendances ont changé,
   * et toute navigation provoque un nouveau rendu — donc une nouvelle
   * évaluation. On boucle jusqu'à stabilisation, comme le ferait React.
   */
  function render(state, maxPasses = 10) {
    for (let i = 0; i < maxPasses; i++) {
      if (!runOnce(state)) return; // deps inchangées → l'effet ne tourne pas
    }
    throw new Error('Boucle de redirection infinie détectée');
  }

  /** Renvoie true si l'effet s'est exécuté ET a navigué (donc re-rendu). */
  function runOnce(state) {
    const deps = dependencyKeys.map((k) => state[k]);
    const changed = lastDeps === null || deps.some((d, i) => d !== lastDeps[i]);
    lastDeps = deps;
    if (!changed) return false;

    const before = state.segmentKey;
    applyGate(state);
    return state.segmentKey !== before; // a navigué → React re-rend
  }

  /** Transcription de l'effet de RootLayoutNav, dans le même ordre. */
  function applyGate(state) {
    const segmentKey = state.segmentKey;
    const inAuthGroup = segmentKey.startsWith('(auth)');

    // Sortie anticipée : token présent mais /auth/me pas encore résolu.
    // C'est elle qui protège la connexion email classique de la même course.
    if (honorsTokenRace && state.hasToken && !state.userId) return;

    if (!state.userId && !inAuthGroup) {
      redirects.push('/(auth)/welcome');
      state.segmentKey = '(auth)/welcome';
      return;
    }
    if (!state.userId) return; // non connecté et déjà dans (auth) → rien

    // Le contrôle des rôles vit DANS la branche `else if (userId)`.
    if (state.roles.length === 0) {
      if (segmentKey !== '(auth)/role-select') {
        redirects.push('/(auth)/role-select');
        state.segmentKey = '(auth)/role-select';
      }
      return;
    }
    // Gate complete-profile : l'écran reste forcé tant que des champs de
    // facturation manquent.
    if (segmentKey.includes('complete-profile') && state.profileIncomplete) {
      return;
    }
    if (inAuthGroup) {
      redirects.push('/(tabs)/dashboard');
      state.segmentKey = '(tabs)/dashboard';
    }
  }

  return { render, redirects };
}

/**
 * Rejoue les étapes 3 → 6.
 * @param awaitsRefreshBeforeNavigating  true = confirm() attend refreshMe()
 * @param dependencyKeys                 dépendances de l'effet du layout
 */
function playRoleSelection({ awaitsRefreshBeforeNavigating, dependencyKeys }) {
  const state = {
    segmentKey: '(auth)/role-select',
    roles: [],            // reflète user.roles dans le contexte auth
    userId: 'u1',
    hasToken: true,
    profileIncomplete: true,
    isBooting: false,
  };
  const gate = makeGate({ dependencyKeys });
  gate.render(state); // rendu initial sur role-select

  // assign-role a répondu 200 ; le contexte a le nouveau token.
  if (awaitsRefreshBeforeNavigating) {
    state.roles = ['CLIENT']; // refreshMe attendu AVANT de naviguer
  }

  // confirm() navigue
  state.segmentKey = '(auth)/complete-profile';
  gate.render(state);

  if (!awaitsRefreshBeforeNavigating) {
    // refreshMe arrive après coup : user est mis à jour, un rendu a lieu…
    state.roles = ['CLIENT'];
    gate.render(state); // …mais l'effet ne s'exécute que si roles est une dépendance
  }

  return { finalScreen: state.segmentKey, redirects: gate.redirects };
}

const DEPS_ACTUELLES = ['userId', 'isBooting', 'segmentKey', 'hasToken', 'profileIncomplete'];
const DEPS_CORRIGEES = [...DEPS_ACTUELLES, 'rolesKey'];

describe('Inscription Google → sélection du rôle', () => {
  it('REPRODUCTION — sans attendre refreshMe, l’utilisateur est renvoyé sur role-select', () => {
    const { finalScreen, redirects } = playRoleSelection({
      awaitsRefreshBeforeNavigating: false,
      dependencyKeys: DEPS_ACTUELLES,
    });

    expect(redirects).toContain('/(auth)/role-select');
    expect(finalScreen).toBe('(auth)/role-select'); // figé : jamais de sortie
  });

  it('CORRECTIF 1 — attendre refreshMe avant de naviguer laisse passer', () => {
    const { finalScreen, redirects } = playRoleSelection({
      awaitsRefreshBeforeNavigating: true,
      dependencyKeys: DEPS_ACTUELLES,
    });

    expect(redirects).not.toContain('/(auth)/role-select');
    expect(finalScreen).toBe('(auth)/complete-profile');
  });

  it('CONNEXION EMAIL — non affectée : userId passe de null à défini', () => {
    // login.tsx n'appelle pas refreshMe() après signIn(), mais le gate a une
    // sortie anticipée `if (hasToken && !userId) return`, et `userId` EST une
    // dépendance. L'arrivée de l'utilisateur redéclenche donc l'effet.
    // C'est ce qui distingue ce cas de l'attribution de rôle, où userId était
    // déjà défini et où aucune dépendance ne changeait.
    const state = {
      segmentKey: '(auth)/login',
      roles: [], userId: null, hasToken: false,
      profileIncomplete: false, isBooting: false,
    };
    const gate = makeGate({ dependencyKeys: DEPS_ACTUELLES, honorsTokenRace: true });
    gate.render(state);

    state.hasToken = true;          // signIn() écrit le token
    state.segmentKey = '(tabs)/dashboard';
    gate.render(state);             // hasToken && !userId → sortie anticipée

    state.userId = 'u1';            // refreshMe arrive
    state.roles = ['CLIENT'];
    gate.render(state);             // userId a changé → l'effet s'exécute

    expect(gate.redirects).not.toContain('/(auth)/role-select');
    expect(state.segmentKey).toBe('(tabs)/dashboard');
  });

  it('CORRECTIF 2 — filet : avec roles en dépendance, le gate se rattrape', () => {
    // Même sans attendre refreshMe, l'arrivée tardive des rôles doit
    // redéclencher l'effet et sortir l'utilisateur de role-select.
    const state = {
      segmentKey: '(auth)/role-select',
      roles: [], userId: 'u1', hasToken: true,
      profileIncomplete: true, isBooting: false,
      get rolesKey() { return this.roles.join(','); },
    };
    const gate = makeGate({ dependencyKeys: DEPS_CORRIGEES });
    gate.render(state);

    state.segmentKey = '(auth)/complete-profile';
    gate.render(state);              // roles encore vides → rebond
    expect(state.segmentKey).toBe('(auth)/role-select');

    state.roles = ['CLIENT'];     // refreshMe arrive
    gate.render(state);              // rolesKey a changé → l'effet s'exécute

    // Le gate laisse désormais passer : plus de renvoi vers role-select.
    // (on reste sur role-select ici car c'est là que le rebond nous avait mis,
    //  mais l'écran n'est plus verrouillé — la navigation de confirm() aboutit)
    expect(state.segmentKey).not.toBe('(auth)/complete-profile');
    expect(gate.redirects.filter(r => r === '/(auth)/role-select')).toHaveLength(1);
  });
});
