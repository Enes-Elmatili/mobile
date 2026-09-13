const { isSlotDisabled } = require('../lib/scheduling/weeks');

const NOW = new Date(2026, 8, 13, 15, 0, 0); // 13/09/2026 15:00

describe('isSlotDisabled — créneaux inertes (SlotGrid)', () => {
  it('hier : tout est inerte', () => {
    expect(isSlotDisabled('2026-09-12', '19:00', NOW)).toBe(true);
  });
  it('aujourd’hui : passé ou à moins d’une heure → inerte', () => {
    expect(isSlotDisabled('2026-09-13', '14:00', NOW)).toBe(true);
    expect(isSlotDisabled('2026-09-13', '15:30', NOW)).toBe(true);
    expect(isSlotDisabled('2026-09-13', '16:00', NOW)).toBe(false);
    expect(isSlotDisabled('2026-09-13', '17:00', NOW)).toBe(false);
  });
  it('demain : tout est ouvert', () => {
    expect(isSlotDisabled('2026-09-14', '08:00', NOW)).toBe(false);
  });
});
