// lib/mission/providerStage.ts
// Le stade de la mission côté prestataire, fonction pure du statut serveur et
// des faits du terrain. L'ordre du serveur est strict : photo avant → code →
// (devis) → intervention → photo après → clôture.
export type ProviderStage =
  | 'loading'
  | 'en_route'      // ACCEPTED, pas encore sur place
  | 'on_site'       // à moins de 60 m (ou « je suis arrivé ») : photo avant
  | 'code'          // photo avant faite : le code du client
  | 'quote_write'   // devis : rédiger le devis
  | 'quote_wait'    // devis envoyé, le client décide
  | 'working'       // intervention en cours
  | 'closing'       // photo après faite : terminer
  | 'done'
  | 'gone';         // annulée, réassignée…

export type ProviderFacts = {
  near?: boolean;
  arrivedTapped?: boolean;
  beforePhoto?: boolean;
  pinVerified?: boolean;
  afterPhoto?: boolean;
  isQuote?: boolean;
  hasQuote?: boolean;
};

export function providerStageOf(request: { status?: string | null } | null | undefined, f: ProviderFacts = {}): ProviderStage {
  if (!request) return 'loading';
  const st = (request.status || '').toUpperCase();
  if (st === 'DONE' || st === 'COMPLETED') return 'done';
  if (['CANCELLED', 'REFUNDED', 'PUBLISHED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'PENDING_PAYMENT'].includes(st)) return 'gone';
  if (st === 'QUOTE_SENT') return 'quote_wait';
  if (!f.beforePhoto) return f.near || f.arrivedTapped ? 'on_site' : 'en_route';
  if (!f.pinVerified && st !== 'ONGOING' && st !== 'QUOTE_ACCEPTED') return 'code';
  if (f.isQuote && !f.hasQuote && st !== 'QUOTE_ACCEPTED') return 'quote_write';
  if (f.afterPhoto) return 'closing';
  return 'working';
}

/** Ce que la carte montre à chaque stade. */
export function providerMapMode(stage: ProviderStage): 'me' | 'band' | 'none' {
  if (stage === 'en_route') return 'me';
  if (stage === 'on_site' || stage === 'code' || stage === 'quote_write' || stage === 'quote_wait') return 'band';
  return 'none';
}
