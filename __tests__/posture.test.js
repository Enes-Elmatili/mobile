// iOS 27.1 : ce que la charnière veut dire pour la mise en page (lib/layout/posture).
import { creaseFor, foldLayoutFor, splitRatioFor } from '@/lib/layout/posture';

// Écran interne du Duo, orientation naturelle : 951 × 669, pli vertical de 40 pt au milieu.
const DUO = { x: 0, y: 0, width: 951, height: 669 };
const VFOLD = { x: 455.5, y: 0, width: 40, height: 669 };
// Tourné : 669 × 951, le pli devient horizontal.
const DUO_TALL = { x: 0, y: 0, width: 669, height: 951 };
const HFOLD = { x: 0, y: 455.5, width: 669, height: 40 };

describe('foldLayoutFor', () => {
  it('sans charnière : à plat', () => {
    expect(foldLayoutFor(undefined, DUO)).toEqual({ kind: 'flat' });
  });

  it('à plat, le pli ne sépare pas : on garde nos proportions', () => {
    expect(foldLayoutFor({ posture: 'fully-open', fold: { ...VFOLD, separating: false } }, DUO)).toEqual({ kind: 'flat' });
  });

  it('entrouvert, pli vertical : livre, bords du pli', () => {
    expect(foldLayoutFor({ posture: 'partially-open', fold: { ...VFOLD, separating: true } }, DUO))
      .toEqual({ kind: 'book', start: 455.5, end: 495.5 });
  });

  it('entrouvert, pli horizontal : table', () => {
    expect(foldLayoutFor({ posture: 'partially-open', fold: { ...HFOLD, separating: true } }, DUO_TALL))
      .toEqual({ kind: 'tabletop', start: 455.5, end: 495.5 });
  });

  it('repère du conteneur : une sidebar de 88 pt décale le pli', () => {
    const frame = { x: 88, y: 0, width: 863, height: 669 };
    expect(foldLayoutFor({ posture: 'partially-open', fold: { ...VFOLD, separating: true } }, frame))
      .toEqual({ kind: 'book', start: 367.5, end: 407.5 });
  });

  it('pli trop près du bord du conteneur (moitié inutilisable) : à plat', () => {
    const narrow = { x: 300, y: 0, width: 651, height: 669 };
    expect(foldLayoutFor({ posture: 'partially-open', fold: { ...VFOLD, separating: true } }, narrow)).toEqual({ kind: 'flat' });
  });

  it('conteneur pas encore mesuré : à plat', () => {
    expect(foldLayoutFor({ posture: 'partially-open', fold: { ...VFOLD, separating: true } }, { x: 0, y: 0, width: 0, height: 0 })).toEqual({ kind: 'flat' });
  });
});

describe('splitRatioFor', () => {
  it('livre : la séparation tombe sur le pli', () => {
    expect(splitRatioFor({ kind: 'book', start: 455.5, end: 495.5 }, 951, 0.42)).toBeCloseTo(455.5 / 951, 6);
  });
  it('à plat ou table : le ratio de base', () => {
    expect(splitRatioFor({ kind: 'flat' }, 951, 0.42)).toBe(0.42);
    expect(splitRatioFor({ kind: 'tabletop', start: 400, end: 440 }, 951, 0.42)).toBe(0.42);
  });
});

describe('creaseFor', () => {
  it('à plat : aucune ombre ; vers 90° : pleine ; bornée', () => {
    expect(creaseFor(180)).toBe(0);
    expect(creaseFor(135)).toBeCloseTo(0.5, 6);
    expect(creaseFor(90)).toBe(1);
    expect(creaseFor(30)).toBe(1);
    expect(creaseFor(null)).toBe(0);
    expect(creaseFor(NaN)).toBe(0);
  });
});
