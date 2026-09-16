// Table de vérité du stade prestataire (lib/mission/providerStage.ts).
const { providerStageOf, providerMapMode } = require('@/lib/mission/providerStage');

describe('providerStageOf', () => {
  const acc = { status: 'ACCEPTED' };
  it('sans demande → loading ; terminée → done ; annulée/republiée → gone', () => {
    expect(providerStageOf(null)).toBe('loading');
    expect(providerStageOf({ status: 'DONE' })).toBe('done');
    expect(providerStageOf({ status: 'CANCELLED' })).toBe('gone');
    expect(providerStageOf({ status: 'PUBLISHED' })).toBe('gone');
  });
  it('en route, puis sur place à 60 m ou sur « je suis arrivé »', () => {
    expect(providerStageOf(acc)).toBe('en_route');
    expect(providerStageOf(acc, { near: true })).toBe('on_site');
    expect(providerStageOf(acc, { arrivedTapped: true })).toBe('on_site');
  });
  it('photo avant → code ; code vérifié → intervention ; photo après → clôture', () => {
    expect(providerStageOf(acc, { beforePhoto: true })).toBe('code');
    expect(providerStageOf({ status: 'ONGOING' }, { beforePhoto: true, pinVerified: true })).toBe('working');
    expect(providerStageOf({ status: 'ONGOING' }, { beforePhoto: true, pinVerified: true, afterPhoto: true })).toBe('closing');
  });
  it('devis : rédiger, attendre, puis reprendre', () => {
    expect(providerStageOf({ status: 'ONGOING' }, { beforePhoto: true, pinVerified: true, isQuote: true })).toBe('quote_write');
    expect(providerStageOf({ status: 'QUOTE_SENT' }, { beforePhoto: true, pinVerified: true, isQuote: true, hasQuote: true })).toBe('quote_wait');
    expect(providerStageOf({ status: 'QUOTE_ACCEPTED' }, { beforePhoto: true, pinVerified: true, isQuote: true, hasQuote: true })).toBe('working');
    expect(providerStageOf({ status: 'ONGOING' }, { beforePhoto: true, pinVerified: true, isQuote: true, hasQuote: true })).toBe('working');
  });
  it('la carte : suit en route, bandeau sur place, effacée pendant l’intervention', () => {
    expect(providerMapMode('en_route')).toBe('me');
    expect(providerMapMode('code')).toBe('band');
    expect(providerMapMode('working')).toBe('none');
  });
});
