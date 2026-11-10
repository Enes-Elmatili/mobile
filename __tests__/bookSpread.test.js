/**
 * BookSpread : sur le Duo déplié, deux pages autour du pli — la gauche s'arrête
 * au bord du pli, la droite reprend après lui. Plus de colonne centrée à
 * cheval sur la charnière.
 */
jest.mock('react-native-safe-area-context', () => ({}));
jest.mock('../lib/layout/hinge', () => ({ useHinge: () => undefined, useHingeAngle: () => ({ value: 180 }) }));
const { bookColumnsFor } = require('../lib/layout/BookSpread');
const { foldLineFor } = require('../lib/layout/posture');

const FLAT = { posture: 'fully-open', fold: { x: 455.5, y: 0, width: 40, height: 669, separating: false } };

describe('bookColumnsFor', () => {
  it('Duo, rail à droite (scène 0–867) : page gauche jusqu’au pli, gouttière = pli', () => {
    const line = foldLineFor(FLAT, { x: 0, y: 0, width: 867, height: 669 });
    expect(bookColumnsFor(line, 867)).toEqual({ left: 455.5, gutter: 40 });
  });

  it('Duo, rail à gauche (scène 84–951) : la page gauche est plus étroite, le pli reste le pli', () => {
    const line = foldLineFor(FLAT, { x: 84, y: 0, width: 867, height: 669 });
    expect(bookColumnsFor(line, 867)).toEqual({ left: 371.5, gutter: 40 });
  });

  it('sans pli connu : deux moitiés séparées par une gouttière', () => {
    const cols = bookColumnsFor(null, 1000);
    expect(cols.left * 2 + cols.gutter).toBe(1000);
  });

  it('largeur nulle (avant mesure) : jamais de page négative', () => {
    expect(bookColumnsFor(null, 0).left).toBe(0);
  });
});
