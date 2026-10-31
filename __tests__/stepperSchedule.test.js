// Planning de l'étape 3 du stepper (lib/request/schedule.ts).
const {
  getTimeGroups, buildScheduledLabel, buildScheduledFor, buildRequestDateIso, isScheduleReady,
} = require('@/lib/request/schedule');

const NOW = new Date('2026-09-14T10:00:00Z');
const day = { iso: '2026-09-16', dayIndex: 3, date: 16, month: 8, year: 2026, isPast: false, isToday: false };
const dayLabel = (d) => (d.dayIndex === 3 ? 'Mer.' : '?');

describe('getTimeGroups', () => {
  it('matin, après-midi, soir — libellés traduits', () => {
    const groups = getTimeGroups((k) => k);
    expect(groups.map((g) => g.label)).toEqual(['stepper.morning', 'stepper.afternoon', 'stepper.evening']);
    expect(groups.map((g) => g.slots)).toEqual([
      ['08:00', '09:00', '10:00', '11:00'], ['14:00', '15:00', '16:00', '17:00'], ['18:00', '19:00'],
    ]);
  });
});

describe('buildScheduledLabel', () => {
  const base = { dayIso: null, time: null, day: null, dayLabel, nowLabel: 'Maintenant' };
  it('maintenant → libellé « maintenant »', () => {
    expect(buildScheduledLabel({ ...base, mode: 'now', dayIso: day.iso, time: '09:00', day })).toBe('Maintenant');
  });
  it('planifié et complet → « jour date à heure »', () => {
    expect(buildScheduledLabel({ ...base, mode: 'later', dayIso: day.iso, time: '09:00', day })).toBe('Mer. 16 à 09:00');
  });
  it('planifié mais incomplet (ou aucun mode) → null', () => {
    expect(buildScheduledLabel({ ...base, mode: 'later', dayIso: day.iso, day })).toBeNull();
    expect(buildScheduledLabel({ ...base, mode: 'later', time: '09:00' })).toBeNull();
    expect(buildScheduledLabel({ ...base, mode: null })).toBeNull();
  });
  it('jour introuvable dans les semaines → blancs conservés', () => {
    expect(buildScheduledLabel({ ...base, mode: 'later', dayIso: '2030-01-01', time: '18:00' })).toBe('  à 18:00');
  });
});

describe('buildScheduledFor / buildRequestDateIso', () => {
  const local = (iso, time) => new Date(`${iso}T${time}:00`).toISOString();
  it('maintenant → l’horloge injectée', () => {
    expect(buildScheduledFor('now', day.iso, '09:00', NOW)).toBe(NOW.toISOString());
    expect(buildRequestDateIso('now', day.iso, '09:00', NOW)).toBe(NOW.toISOString());
  });
  it('planifié → heure LOCALE du créneau', () => {
    expect(buildScheduledFor('later', day.iso, '09:00', NOW)).toBe(local(day.iso, '09:00'));
    expect(buildRequestDateIso('later', day.iso, '09:00', NOW)).toBe(local(day.iso, '09:00'));
  });
  it('incomplet → null pour le serveur, maintenant pour l’estimation', () => {
    expect(buildScheduledFor('later', day.iso, null, NOW)).toBeNull();
    expect(buildScheduledFor(null, null, null, NOW)).toBeNull();
    expect(buildRequestDateIso('later', null, '09:00', NOW)).toBe(NOW.toISOString());
  });
});

describe('isScheduleReady', () => {
  it.each([
    ['now', null, null, true],
    ['later', '2026-09-16', '09:00', true],
    ['later', '2026-09-16', null, false],
    ['later', null, '09:00', false],
    [null, '2026-09-16', '09:00', false],
  ])('%s / %s / %s → %s', (mode, iso, time, ready) => {
    expect(isScheduleReady(mode, iso, time)).toBe(ready);
  });
});
