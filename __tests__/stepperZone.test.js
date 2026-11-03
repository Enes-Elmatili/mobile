// Zone de service de l'étape 1 (lib/request/zone.ts) : Région de Bruxelles-Capitale.
const { checkLocation, addressHasStreetNumber } = require('@/lib/request/zone');

const postal = (code) => [{ types: ['postal_code'], short_name: code, long_name: code }];

describe('checkLocation — le code postal Google fait autorité', () => {
  it.each([['1000', true], ['1050', true], ['1210', true], ['1212', true], ['1213', false], ['1300', false], ['0999', false]])(
    '%s → %s', (code, ok) => { expect(checkLocation('Rue X 1, Ailleurs', postal(code))).toBe(ok); },
  );
  it('code postal hors zone même si la commune est bruxelloise', () => {
    expect(checkLocation('Rue X 1, Ixelles', postal('1410'))).toBe(false);
  });
  it('long_name en secours du short_name', () => {
    expect(checkLocation('x', [{ types: ['postal_code'], long_name: '1060' }])).toBe(true);
  });
});

describe('checkLocation — sans code postal, nom de commune hors premier segment', () => {
  it('commune FR ou NL reconnue', () => {
    expect(checkLocation('Avenue Louise 143, 1050 Ixelles, Belgique')).toBe(true);
    expect(checkLocation('Kerkstraat 2, Sint-Gillis')).toBe(true);
    expect(checkLocation('Rue de la Station 5, Woluwe-Saint-Lambert')).toBe(true);
  });
  it('« Chaussée de Bruxelles » à Waterloo n’est pas bruxelloise', () => {
    expect(checkLocation('Chaussée de Bruxelles 100, Waterloo')).toBe(false);
  });
  it('un seul segment : on cherche dans toute la chaîne', () => {
    expect(checkLocation('Schaerbeek')).toBe(true);
    expect(checkLocation('Namur')).toBe(false);
  });
  it('composants sans code postal → repli sur le nom', () => {
    expect(checkLocation('Rue Haute 12, Bruxelles', [{ types: ['route'], short_name: 'Rue Haute' }])).toBe(true);
  });
});

describe('addressHasStreetNumber', () => {
  it('vrai avec un street_number, faux sinon, undefined sans composants', () => {
    expect(addressHasStreetNumber([{ types: ['street_number'], short_name: '12' }])).toBe(true);
    expect(addressHasStreetNumber([{ types: ['route'] }])).toBe(false);
    expect(addressHasStreetNumber(undefined)).toBeUndefined();
  });
});
