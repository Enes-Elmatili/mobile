const { shotsFor, missingRequiredShots, nextQueue, MAX_PHOTOS } = require('../lib/request/photos');
const { PHOTO_GUIDES, GENERIC_SHOTS, SHOT_KEYS, SHOT_ICONS } = require('../constants/photoGuides');

describe('shotsFor — consignes par prestation', () => {
  it('une prestation connue renvoie ses prises', () => {
    expect(shotsFor('fuite-eau').map((s) => s.key)).toEqual(['leak', 'under_sink', 'meter']);
  });
  it('une prestation inconnue ou absente reçoit le guide générique, rien de requis', () => {
    expect(shotsFor('inconnue')).toEqual(GENERIC_SHOTS);
    expect(shotsFor(null)).toEqual(GENERIC_SHOTS);
    expect(GENERIC_SHOTS.every((s) => !s.required)).toBe(true);
  });
  it('chaque clé de prise a une icône', () => {
    for (const key of SHOT_KEYS) expect(SHOT_ICONS[key]).toBeTruthy();
  });
  it('les 39 prestations du catalogue ont un guide', () => {
    expect(Object.keys(PHOTO_GUIDES)).toHaveLength(39);
  });
});

describe('missingRequiredShots', () => {
  const specs = shotsFor('ouverture-porte-blindee'); // door_full + lock_close requis
  it('liste les prises requises sans photo', () => {
    expect(missingRequiredShots([], specs).map((s) => s.key)).toEqual(['door_full', 'lock_close']);
    expect(missingRequiredShots([{ key: 'lock_close', uri: 'a', width: 1, height: 1 }], specs).map((s) => s.key)).toEqual(['door_full']);
  });
  it('rien ne manque quand tout est pris ; les photos libres ne comptent pas', () => {
    const shots = [{ key: 'door_full', uri: 'a', width: 1, height: 1 }, { key: 'lock_close', uri: 'b', width: 1, height: 1 }, { key: null, uri: 'c', width: 1, height: 1 }];
    expect(missingRequiredShots(shots, specs)).toEqual([]);
  });
});

describe('nextQueue — la file de l’appareil photo', () => {
  const specs = shotsFor('fuite-eau'); // leak*, under_sink, meter
  it('depuis une tuile vide : cette prise puis les suivantes non faites', () => {
    expect(nextQueue(specs, [], 'under_sink').map((q) => q.key)).toEqual(['under_sink', 'meter', 'leak']);
  });
  it('une prise déjà faite en tête (reprise) ; les autres faites sont sautées', () => {
    const shots = [{ key: 'leak', uri: 'a', width: 1, height: 1 }, { key: 'meter', uri: 'b', width: 1, height: 1 }];
    expect(nextQueue(specs, shots, 'leak').map((q) => q.key)).toEqual(['leak', 'under_sink']);
  });
  it('photo libre : une seule prise, non requise', () => {
    expect(nextQueue(specs, [], null)).toEqual([{ key: null, required: false }]);
  });
  it('porte le drapeau requis', () => {
    expect(nextQueue(specs, [], 'leak')[0]).toEqual({ key: 'leak', required: true });
  });
  it('MAX_PHOTOS vaut 6 (même limite que le serveur)', () => {
    expect(MAX_PHOTOS).toBe(6);
  });
});
