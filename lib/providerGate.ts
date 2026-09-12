// lib/providerGate.ts
// Décisions d'accès prestataire, isolées du rendu pour être testables et pour
// que l'app et le serveur parlent des mêmes règles (backend : services/providerGate.js).
//
// Deux questions, deux fonctions :
//   1. Ce prestataire a-t-il sa place dans les onglets ? (garde de navigation)
//   2. Le serveur vient de refuser le passage en ligne — que montre-t-on, et
//      vers quelle étape renvoie-t-on ?

/** Codes de refus émis par le backend sur provider:status_rejected. */
export const GATE_CODES = {
  NOT_VALIDATED: 'PROVIDER_NOT_VALIDATED',
  STRIPE_NOT_READY: 'PROVIDER_STRIPE_NOT_READY',
} as const;

/** Statuts serveur qui signifient « en ligne, joignable par le matching ». */
export function isOnlineStatus(status?: string | null): boolean {
  return status === 'ONLINE' || status === 'READY';
}

/**
 * Un prestataire non validé n'a rien à faire dans les onglets : il repart sur
 * son onboarding.
 *
 * providerStatus absent = profil pas encore rafraîchi. On ne redirige jamais
 * sur une valeur manquante, sinon un prestataire actif se fait éjecter le
 * temps d'un refreshMe.
 */
export function shouldLeaveTabs(isProvider: boolean, providerStatus?: string | null): boolean {
  if (!isProvider) return false;
  if (!providerStatus) return false;
  return providerStatus !== 'ACTIVE';
}

export interface GateCopy {
  titleKey: string;
  messageKey: string;
  confirmKey: string;
  cancelKey: string;
  /** Écran qui porte l'étape manquante. */
  route: '/onboarding/provider/stripe-connect' | '/onboarding/provider/pending';
}

/**
 * Quoi dire et où renvoyer selon le motif de refus. Tout code inconnu retombe
 * sur le dossier : c'est le seul écran qui montre l'état complet, donc la
 * sortie la moins trompeuse quand on ne sait pas ce qui bloque.
 */
export function gateCopyFor(code?: string | null): GateCopy {
  if (code === GATE_CODES.STRIPE_NOT_READY) {
    return {
      titleKey: 'provider.gate_stripe_title',
      messageKey: 'provider.gate_stripe_msg',
      confirmKey: 'provider.gate_stripe_cta',
      cancelKey: 'provider.gate_later',
      route: '/onboarding/provider/stripe-connect',
    };
  }
  return {
    titleKey: 'provider.gate_docs_title',
    messageKey: 'provider.gate_docs_msg',
    confirmKey: 'provider.gate_docs_cta',
    cancelKey: 'provider.gate_later',
    route: '/onboarding/provider/pending',
  };
}
