/** Fonctions pures de lib/motion : formatage, révélation, découpage, gestes. */
import { formatCount } from '../motion/useCountingValue';
import { revealIndex } from '../motion/useRevealCount';
import { splitDigits } from '../motion/useDigitReel';
import { rubberBand, projectRelease, shouldConfirm } from '../motion/gestures';
import { cascadeDelay } from '../motion/useCascade';

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

describe('revealIndex', () => {
  it('0 → 0 éléments, 1 → tous', () => {
    expect(revealIndex(0, 40)).toBe(0);
    expect(revealIndex(1, 40)).toBe(40);
  });
  it('arrondit vers le haut pour ne jamais casser un segment déjà entamé', () => {
    expect(revealIndex(0.5, 41)).toBe(21);
    expect(revealIndex(0.01, 40)).toBe(1);
  });
  it('borné', () => {
    expect(revealIndex(1.4, 40)).toBe(40);
    expect(revealIndex(-1, 40)).toBe(0);
  });
});

describe('splitDigits', () => {
  it('découpe un entier en chiffres', () => {
    expect(splitDigits(6)).toEqual([6]);
    expect(splitDigits(21)).toEqual([2, 1]);
  });
  it('tolère une chaîne avec du texte ("21 min" → [2,1])', () => {
    expect(splitDigits('21 min')).toEqual([2, 1]);
  });
  it('vide ou non numérique → []', () => {
    expect(splitDigits('')).toEqual([]);
    expect(splitDigits('—')).toEqual([]);
  });
});

describe('rubberBand', () => {
  it('identité dans la piste', () => {
    expect(rubberBand(50, 0, 100)).toBe(50);
  });
  it('résistance 3,5 au-delà des bornes', () => {
    expect(rubberBand(135, 0, 100)).toBeCloseTo(110, 5);
    expect(rubberBand(-35, 0, 100)).toBeCloseTo(-10, 5);
  });
});

describe('projectRelease', () => {
  it("projette la position avec 200 ms d'élan", () => {
    expect(projectRelease(40, 500)).toBe(140);
  });
  it('un élan négatif recule', () => {
    expect(projectRelease(40, -300)).toBe(-20);
  });
});

describe('shouldConfirm', () => {
  const track = 260;
  it('position ≥ 95 % → confirme même sans élan', () => {
    expect(shouldConfirm(250, 0, track)).toBe(true);
  });
  it('position à mi-course sans élan → non', () => {
    expect(shouldConfirm(130, 0, track)).toBe(false);
  });
  it('position à mi-course avec un flick → oui (projection ≥ 90 %)', () => {
    expect(shouldConfirm(130, 600, track)).toBe(true);
  });
  it("flick vers l'arrière → non", () => {
    expect(shouldConfirm(200, -900, track)).toBe(false);
  });
});

describe('cascadeDelay', () => {
  it('index × pas, jamais négatif', () => {
    expect(cascadeDelay(0)).toBe(0);
    expect(cascadeDelay(3)).toBe(120);
    expect(cascadeDelay(2, 50)).toBe(100);
    expect(cascadeDelay(-1)).toBe(0);
  });
});
