const { buildWeeks, findDay } = require('../lib/scheduling/weeks');

// Samedi 13 septembre 2026, 15:00 (heure locale).
const NOW = new Date(2026, 8, 13, 15, 0, 0);

describe('buildWeeks — semaines du planning (WeekStrip)', () => {
  it('commence le lundi de la semaine courante et fait 7 jours par semaine', () => {
    const weeks = buildWeeks(NOW, 5);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].days).toHaveLength(7);
    expect(weeks[0].from.iso).toBe('2026-09-07');
    expect(weeks[0].to.iso).toBe('2026-09-13');
    expect(weeks[0].days[0].dayIndex).toBe(1); // lundi
    expect(weeks[0].days[6].dayIndex).toBe(0); // dimanche
  });
  it('enchaîne les semaines sans trou', () => {
    const weeks = buildWeeks(NOW, 3);
    expect(weeks[1].from.iso).toBe('2026-09-14');
    expect(weeks[2].to.iso).toBe('2026-09-27');
  });
  it('marque les jours passés et aujourd’hui', () => {
    const [w0, w1] = buildWeeks(NOW, 2);
    expect(w0.days.slice(0, 6).every((d) => d.isPast)).toBe(true);
    expect(w0.days[6].isPast).toBe(false);
    expect(w0.days[6].isToday).toBe(true);
    expect(w1.days.some((d) => d.isPast || d.isToday)).toBe(false);
  });
  it('passe le changement de mois', () => {
    const weeks = buildWeeks(new Date(2026, 8, 28, 9, 0, 0), 1);
    expect(weeks[0].from.iso).toBe('2026-09-28');
    expect(weeks[0].to.iso).toBe('2026-10-04');
    expect(weeks[0].to.month).toBe(9);
  });
  it('findDay retrouve un jour par iso', () => {
    const weeks = buildWeeks(NOW, 2);
    expect(findDay(weeks, '2026-09-16')?.date).toBe(16);
    expect(findDay(weeks, '2027-01-01')).toBeNull();
    expect(findDay(weeks, null)).toBeNull();
  });
});
