/**
 * Verrouille la physique des bottom sheets (CLAUDE.md § Interfaces fluides,
 * règle 2 : damping équivalent 1.0, aucun rebond pour l'UI standard).
 *
 * Avant ce module, InvoiceSheet et QuoteSheet portaient `damping: 20` avec
 * `stiffness: 200` → ζ ≈ 0.71, soit un ressort sous-amorti qui dépasse sa
 * cible et rebondit. NotificationDetailSheet n'avait aucune config et
 * retombait sur le timing par défaut de gorhom (pas de spring du tout).
 *
 * Ce test échoue si quelqu'un remet une valeur sous-amortie sur le spring
 * standard.
 */

const {
  SHEET_SPRING,
  SHEET_SPRING_MOMENTUM,
  SHEET_SPRING_REDUCED,
  SHEET_OVER_DRAG_RESISTANCE,
} = require('../lib/motion/sheet');

/** ζ = damping / (2 × √(stiffness × mass)) */
const dampingRatio = ({ damping, stiffness, mass }) =>
  damping / (2 * Math.sqrt(stiffness * mass));

describe('physique des bottom sheets', () => {
  it('spring standard : amortissement critique, aucun rebond', () => {
    expect(dampingRatio(SHEET_SPRING)).toBeCloseTo(1.0, 5);
  });

  it("spring standard : ce n'est PAS l'ancienne valeur sous-amortie", () => {
    // damping 20 @ stiffness 200 donnait ζ ≈ 0.71 → rebond visible
    expect(SHEET_SPRING.damping).not.toBe(20);
    expect(dampingRatio({ damping: 20, stiffness: 200, mass: 1 })).toBeLessThan(0.75);
  });

  it('spring momentum : légèrement sous-amorti, mais jamais mou', () => {
    const z = dampingRatio(SHEET_SPRING_MOMENTUM);
    expect(z).toBeGreaterThan(0.7);
    expect(z).toBeLessThan(1.0);
  });

  it('reduce-motion : sur-amorti, aucune oscillation perceptible', () => {
    expect(dampingRatio(SHEET_SPRING_REDUCED)).toBeGreaterThan(1.0);
  });

  it('rubber-band : résistance en fin de course, jamais de stop dur', () => {
    expect(SHEET_OVER_DRAG_RESISTANCE).toBeGreaterThan(1);
  });
});
