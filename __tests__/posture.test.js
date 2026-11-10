// iOS 27.1 : ce que la charnière veut dire pour la mise en page (lib/layout/posture).
import { creaseFor, foldLayoutFor, foldLineFor, splitRatioFor } from '@/lib/layout/posture';

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

// Ce qu'on ne doit jamais chevaucher : la bande du pli, À PLAT COMME ENTROUVERT.
// À plat le pli ne sépare pas l'écran, mais il reste visible sous le doigt et
// sous l'œil : le contenu s'arrête avant, reprend après.
describe('foldLineFor', () => {
  it('sans charnière : pas de pli', () => {
    expect(foldLineFor(undefined, DUO)).toBeNull();
  });

  it('à plat (fully-open) : la bande du pli, en repère conteneur', () => {
    expect(foldLineFor({ posture: 'fully-open', fold: { ...VFOLD, separating: false } }, DUO)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('entrouvert : la même bande', () => {
    expect(foldLineFor({ posture: 'partially-open', fold: { ...VFOLD, separating: true } }, DUO)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('conteneur décalé (sidebar, rail) : bords relatifs au conteneur', () => {
    expect(foldLineFor({ posture: 'fully-open', fold: { ...VFOLD, separating: false } }, { x: 88, y: 0, width: 863, height: 669 }))
      .toEqual({ start: 367.5, end: 407.5 });
  });

  it('fermé : pas de pli', () => {
    expect(foldLineFor({ posture: 'closed', fold: { ...VFOLD, separating: false } }, DUO)).toBeNull();
  });

  it('pli horizontal (Duo tourné) : pas de pli vertical à éviter en colonnes', () => {
    expect(foldLineFor({ posture: 'fully-open', fold: { ...HFOLD, separating: false } }, DUO_TALL)).toBeNull();
  });

  it('pli hors du conteneur ou trop près d\'un bord : pas de pli', () => {
    expect(foldLineFor({ posture: 'fully-open', fold: { ...VFOLD, separating: false } }, { x: 500, y: 0, width: 367, height: 669 })).toBeNull();
  });
});

// ── normalizeHinge : la charnière telle que la mise en page doit la lire ─────
// Doc Apple (tech talk « Strike a pose with adaptive layouts on iPhone Duo ») :
// « When flat, it's inactive and has a width of zero » ; aucune notification
// ne garantit une relecture des régions réservées au pliage / dépliage.
describe('normalizeHinge', () => {
  const { normalizeHinge, HINGE_BAND, foldLineFor } = require('@/lib/layout/posture');
  const WIN = { width: 951, height: 669 };
  const SCENE = { x: 0, y: 0, width: 867, height: 669 };

  it('à plat, pli de largeur nulle : position gardée, largeur physique posée', () => {
    const raw = { posture: 'fully-open', fold: { x: 475.5, y: 0, width: 0, height: 669, separating: false }, window: WIN };
    const h = normalizeHinge(raw, WIN, true);
    expect(h.fold.width).toBe(HINGE_BAND);
    expect(h.fold.x).toBe(455.5);
    expect(foldLineFor(h, SCENE)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('pli rapporté de 40 pt (simulateur) : inchangé', () => {
    const raw = { posture: 'fully-open', fold: { x: 455.5, y: 0, width: 40, height: 669, separating: false }, window: WIN };
    expect(foldLineFor(normalizeHinge(raw, WIN, true), SCENE)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('pli mesuré pour la fenêtre pliée (466 pt) puis déplié sans relecture : périmé, reposé au milieu de la fenêtre', () => {
    const stale = { posture: 'fully-open', fold: { x: 213, y: 0, width: 40, height: 678, separating: false }, window: { width: 466, height: 678 } };
    expect(foldLineFor(normalizeHinge(stale, WIN, true), SCENE)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('posture « fermé » restée en mémoire alors que la fenêtre est celle du Duo ouvert : pli au milieu de la fenêtre', () => {
    const h = normalizeHinge({ posture: 'closed', fold: null, window: { width: 466, height: 678 } }, WIN, true);
    expect(h.posture).toBe('fully-open');
    expect(foldLineFor(h, SCENE)).toEqual({ start: 455.5, end: 495.5 });
  });

  it('rail à gauche : la coupure suit la FENÊTRE, pas le milieu de la scène décalée', () => {
    const h = normalizeHinge(undefined, WIN, true);
    expect(foldLineFor(h, { x: 84, y: 0, width: 867, height: 669 })).toEqual({ start: 371.5, end: 411.5 });
  });

  it('Duo plié (fenêtre compacte) : rien d’inventé', () => {
    const raw = { posture: 'closed', fold: null, window: { width: 466, height: 678 } };
    expect(normalizeHinge(raw, { width: 466, height: 678 }, true)).toEqual(raw);
  });

  it('sans module natif (Android, Expo Go, jest) : on ne devine rien', () => {
    expect(normalizeHinge(undefined, WIN, false)).toBeUndefined();
  });

  it('entrouvert : la région active (marges comprises) prime si elle est plus large', () => {
    const raw = { posture: 'partially-open', fold: { x: 445.5, y: 0, width: 60, height: 669, separating: true }, window: WIN };
    expect(foldLineFor(normalizeHinge(raw, WIN, true), SCENE)).toEqual({ start: 445.5, end: 505.5 });
  });
});
