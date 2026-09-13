/**
 * Chaque preset de lib/motion/springs.ts déclare un ratio d'amortissement ζ.
 * Ce test le recalcule depuis (damping, stiffness, mass) : si quelqu'un écrit
 * un damping en dur, ζ dérive et le test tombe.
 */
const { MOTION, spring } = require('../lib/motion/springs');

const zeta = ({ damping, stiffness, mass }) => damping / (2 * Math.sqrt(stiffness * mass));

describe('presets de mouvement', () => {
  it.each([
    ['unfold', 1.0], ['pane', 1.0], ['recenter', 1.0], ['count', 1.0], ['trace', 1.0], ['tab', 1.0],
    ['take', 0.85], ['breathe', 0.9], ['land', 0.8], ['island', 0.9], ['pull', 0.8], ['tabIcon', 0.9],
  ])('%s → ζ = %s', (name, expected) => {
    expect(zeta(MOTION[name])).toBeCloseTo(expected, 5);
  });

  it('spring(k, ζ) dérive le damping, ne le devine pas', () => {
    const s = spring(200, 1.0);
    expect(s.stiffness).toBe(200);
    expect(s.mass).toBe(1);
    expect(s.damping).toBeCloseTo(28.284, 2);
  });

  it("aucun preset n'est sous-amorti au point de rebondir visiblement (ζ ≥ 0,7)", () => {
    for (const p of Object.values(MOTION)) expect(zeta(p)).toBeGreaterThanOrEqual(0.7);
  });
});
