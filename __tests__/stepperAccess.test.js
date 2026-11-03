// Infos d'accès de l'étape 3 (lib/request/access.ts) : défaut profil et snapshot mission.
const { buildProfileUpdate, buildAccessSnapshot } = require('@/lib/request/access');

const EMPTY = { buildingType: null, floorNum: '', hasElevator: null, accessNotes: '', clientLanguage: null };

describe('buildProfileUpdate — PATCH /me en quittant l’étape 3', () => {
  it('rien de saisi → objet vide (pas d’appel)', () => { expect(buildProfileUpdate(EMPTY)).toEqual({}); });
  it('reprend les champs saisis, étage numérique', () => {
    expect(buildProfileUpdate({ buildingType: 'apartment', floorNum: '3', hasElevator: false, clientLanguage: 'nl' }))
      .toEqual({ buildingType: 'apartment', floor: 3, hasElevator: false, language: 'nl' });
  });
  it('étage illisible → null, étage vide → absent', () => {
    expect(buildProfileUpdate({ ...EMPTY, floorNum: 'rdc' })).toEqual({ floor: null });
    expect(buildProfileUpdate({ ...EMPTY, floorNum: '   ' })).toEqual({});
  });
  it('« 0 » (rez) part comme null — comportement historique', () => {
    expect(buildProfileUpdate({ ...EMPTY, floorNum: '0' })).toEqual({ floor: null });
  });
  it('n’embarque jamais les consignes d’accès', () => {
    expect(buildProfileUpdate({ ...EMPTY, accessNotes: 'digicode 1234' })).not.toHaveProperty('accessNotes');
  });
});

describe('buildAccessSnapshot — infos propres à la mission', () => {
  it('rien de saisi → objet vide', () => { expect(buildAccessSnapshot(EMPTY)).toEqual({}); });
  it('préfixe access*, consignes nettoyées, rez-de-chaussée conservé', () => {
    expect(buildAccessSnapshot({
      buildingType: 'house', floorNum: '0', hasElevator: true, accessNotes: '  sonner 2x  ', clientLanguage: 'fr',
    })).toEqual({
      accessBuildingType: 'house', accessFloor: 0, accessHasElevator: true, accessNotes: 'sonner 2x', clientLanguage: 'fr',
    });
  });
  it('consignes blanches ignorées, étage illisible ignoré', () => {
    expect(buildAccessSnapshot({ ...EMPTY, accessNotes: '   ', floorNum: 'x' })).toEqual({});
  });
});
