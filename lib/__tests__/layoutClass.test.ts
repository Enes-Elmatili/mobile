/**
 * Classe de disposition : compact (une colonne) ou regular (deux volets).
 * Seuils du spec § 4.2 : regular ⇔ largeur ≥ 600 ET hauteur ≥ 480.
 */
import { resolveLayoutClass } from '../layout/resolveLayoutClass';

describe('resolveLayoutClass', () => {
  it.each([
    ['iPhone SE', 375, 667, 'compact'],
    ['iPhone 15 Pro', 393, 852, 'compact'],
    ['iPhone Duo fermé', 466, 678, 'compact'],
    ['iPhone Duo ouvert, paysage naturel', 951, 669, 'regular'],
    ['iPhone Duo ouvert, portrait', 669, 951, 'regular'],
    ['Galaxy Z Fold ouvert', 780, 860, 'regular'],
    ['Galaxy Z Fold ouvert, clavier réduit la hauteur', 780, 400, 'compact'],
    ['iPad 11" Split View 1/3', 320, 1194, 'compact'],
    ['iPad 11" plein', 834, 1194, 'regular'],
  ])('%s (%i × %i) → %s', (_, w, h, expected) => {
    expect(resolveLayoutClass(w, h)).toBe(expected);
  });

  it('les seuils sont inclusifs', () => {
    expect(resolveLayoutClass(600, 480)).toBe('regular');
    expect(resolveLayoutClass(599, 480)).toBe('compact');
    expect(resolveLayoutClass(600, 479)).toBe('compact');
  });
});
