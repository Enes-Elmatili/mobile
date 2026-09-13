/** Fonctions pures de lib/motion : formatage, gestes, découpage. */
import { formatCount } from '../motion/useCountingValue';

describe('formatCount', () => {
  it("arrondit à l'entier et ajoute le suffixe", () => {
    expect(formatCount(88.6, ' €')).toBe('89 €');
    expect(formatCount(109.2, ' €')).toBe('109 €');
  });
  it('supporte les décimales demandées', () => {
    expect(formatCount(88.649, ' €', 2)).toBe('88,65 €');
  });
  it('ne renvoie jamais -0', () => {
    expect(formatCount(-0.2, ' €')).toBe('0 €');
  });
});
