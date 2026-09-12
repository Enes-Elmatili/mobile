/**
 * Normalisation des numéros de téléphone saisis à l'inscription.
 *
 * Contexte : AuthPhoneInput concaténait « +indicatif » + tous les chiffres
 * tapés. Un Belge tape 0470 12 34 56 → +320470123456, faux numéro (SMS et
 * appels prestataire↔client perdus). Même dérive avec +32… ou 0032… tapés
 * dans le champ (autofill iOS) → +3232….
 */
import { toE164, splitInternational } from '../phone';

describe('toE164 — indicatif + saisie locale', () => {
  it('retire le 0 de tête (préfixe national belge)', () => {
    expect(toE164('32', '0470 12 34 56')).toBe('+32470123456');
  });

  it('accepte un numéro sans 0', () => {
    expect(toE164('32', '470 12 34 56')).toBe('+32470123456');
  });

  it("ne double pas l'indicatif tapé avec +", () => {
    expect(toE164('32', '+32 470 12 34 56')).toBe('+32470123456');
  });

  it("ne double pas l'indicatif tapé avec 00", () => {
    expect(toE164('32', '0032470123456')).toBe('+32470123456');
  });

  it('gère +indicatif suivi du 0 national (double erreur)', () => {
    expect(toE164('32', '+32 0470 12 34 56')).toBe('+32470123456');
  });

  it('respecte un autre indicatif tapé en international (le chip est ignoré)', () => {
    expect(toE164('32', '+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it("conserve le 0 pour l'Italie, où il fait partie du numéro", () => {
    expect(toE164('39', '06 1234 5678')).toBe('+390612345678');
  });

  it('français : retire le 0 national', () => {
    expect(toE164('33', '06 12 34 56 78')).toBe('+33612345678');
  });

  it('vide → vide', () => {
    expect(toE164('32', '')).toBe('');
    expect(toE164('32', '   ')).toBe('');
  });

  it('ne garde que les chiffres (espaces, points, tirets, parenthèses)', () => {
    expect(toE164('32', '(0)470.12-34 56')).toBe('+32470123456');
  });
});

describe('splitInternational — ce que le champ doit afficher', () => {
  it('un numéro local reste local, sans 0 de tête', () => {
    expect(splitInternational('32', '0470123456')).toEqual({ callingCode: '32', local: '470123456' });
  });

  it('un +32… tapé dans le champ est replié sur le chip', () => {
    expect(splitInternational('32', '+32470123456')).toEqual({ callingCode: '32', local: '470123456' });
  });

  it('un autre indicatif international bascule le chip', () => {
    expect(splitInternational('32', '+33612345678')).toEqual({ callingCode: '33', local: '612345678' });
  });

  it("n'invente pas d'indicatif sur une saisie partielle « + »", () => {
    expect(splitInternational('32', '+')).toEqual({ callingCode: '32', local: '' });
  });
});
