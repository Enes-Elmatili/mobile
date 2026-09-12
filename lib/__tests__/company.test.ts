/**
 * Validation locale du BCE et de l'IBAN à l'étape « Entreprise » de
 * l'onboarding. Miroir de backend/services/bceValidator.js et
 * ibanValidator.js : refuser tôt ce que le serveur refusera de toute façon.
 */
import { isValidBce, formatBce, isValidIban, formatIban } from '../company';

describe('BCE (mod-97)', () => {
  it.each(['BE 1037.044.717', 'be1037044717', '1037044717', 'BE0123456749'])('accepte %s', (v) => {
    expect(isValidBce(v)).toBe(true);
  });
  it.each(['BE 0000.000.000', 'BE 1037.044.718', '12345', 'FR 1037.044.717', ''])('refuse %s', (v) => {
    expect(isValidBce(v)).toBe(false);
  });
  it('formate en « BE 1037.044.717 »', () => {
    expect(formatBce('be1037044717')).toBe('BE 1037.044.717');
    expect(formatBce('BE0123456749')).toBe('BE 0123.456.749');
  });
});

describe('IBAN (mod-97)', () => {
  it.each(['BE68 5390 0754 7034', 'be68539007547034', 'FR76 3000 6000 0112 3456 7890 189'])('accepte %s', (v) => {
    expect(isValidIban(v)).toBe(true);
  });
  it.each(['BE68 5390 0754 7035', 'BE68', 'XX00 0000', ''])('refuse %s', (v) => {
    expect(isValidIban(v)).toBe(false);
  });
  it('formate par groupes de 4', () => {
    expect(formatIban('be68539007547034')).toBe('BE68 5390 0754 7034');
  });
});
