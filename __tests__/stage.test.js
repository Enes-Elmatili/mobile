// Table de vérité du stade de suivi (lib/mission/stage.ts).
const { stageOf, isFutureScheduled, plannedEnd, minutesSince, metersBetween, ARRIVAL_RADIUS_M } = require('@/lib/mission/stage');

const NOW = Date.parse('2026-09-14T10:00:00Z');
const inMinutes = (m) => new Date(NOW + m * 60000).toISOString();

describe('stageOf', () => {
  it('sans demande → loading', () => { expect(stageOf(null)).toBe('loading'); });
  it.each([
    ['PUBLISHED', 'searching'], ['PENDING_PAYMENT', 'pending_payment'], ['QUOTE_PENDING', 'quote_pending'],
    ['QUOTE_SENT', 'quote_sent'], ['ONGOING', 'ongoing'], ['DONE', 'done'], ['COMPLETED', 'done'],
    ['CANCELLED', 'terminal'], ['REFUNDED', 'terminal'], ['QUOTE_REFUSED', 'terminal'], ['QUOTE_EXPIRED', 'terminal'], ['', 'terminal'],
  ])('%s → %s', (status, stage) => { expect(stageOf({ status }, { now: NOW })).toBe(stage); });

  it('ACCEPTED immédiat → en_route, puis at_door, puis ongoing', () => {
    const r = { status: 'ACCEPTED', preferredTimeStart: inMinutes(5) };
    expect(stageOf(r, { now: NOW })).toBe('en_route');
    expect(stageOf(r, { now: NOW, arrived: true })).toBe('at_door');
    expect(stageOf(r, { now: NOW, arrived: true, pinVerified: true })).toBe('ongoing');
    expect(stageOf(r, { now: NOW, pinVerified: true })).toBe('ongoing');
  });
  it('ACCEPTED juste après la bascule → accepted', () => {
    expect(stageOf({ status: 'ACCEPTED' }, { now: NOW, justAccepted: true })).toBe('accepted');
    expect(stageOf({ status: 'ACCEPTED' }, { now: NOW, justAccepted: true, arrived: true })).toBe('at_door');
  });
  it('ACCEPTED avec créneau > 30 min → scheduled', () => {
    expect(stageOf({ status: 'ACCEPTED', preferredTimeStart: inMinutes(31) }, { now: NOW })).toBe('scheduled');
    expect(stageOf({ status: 'ACCEPTED', preferredTimeStart: inMinutes(30) }, { now: NOW })).toBe('en_route');
  });
  it('QUOTE_ACCEPTED se suit comme une mission en route, même planifié', () => {
    expect(stageOf({ status: 'QUOTE_ACCEPTED', preferredTimeStart: inMinutes(120) }, { now: NOW })).toBe('en_route');
  });
  it('le statut est insensible à la casse', () => { expect(stageOf({ status: 'ongoing' })).toBe('ongoing'); });
});

describe('helpers', () => {
  it('isFutureScheduled', () => {
    expect(isFutureScheduled(null)).toBe(false);
    expect(isFutureScheduled('pas une date', NOW)).toBe(false);
    expect(isFutureScheduled(inMinutes(45), NOW)).toBe(true);
  });
  it('plannedEnd = démarrage + durée', () => {
    const b = { timeline: { createdAt: null, acceptedAt: null, startedAt: inMinutes(0), completedAt: null }, service: { durationMinutes: 60 } };
    expect(plannedEnd(b).toISOString()).toBe(inMinutes(60));
    expect(plannedEnd({ ...b, service: { durationMinutes: null } })).toBeNull();
    expect(plannedEnd({ ...b, timeline: { ...b.timeline, startedAt: null } })).toBeNull();
  });
  it('minutesSince', () => {
    expect(minutesSince(inMinutes(-12), NOW)).toBe(12);
    expect(minutesSince(inMinutes(3), NOW)).toBe(0);
    expect(minutesSince(null, NOW)).toBeNull();
  });
  it('metersBetween ~ 111 m par millième de degré de latitude', () => {
    expect(metersBetween(50.8, 4.35, 50.801, 4.35)).toBeGreaterThan(100);
    expect(metersBetween(50.8, 4.35, 50.801, 4.35)).toBeLessThan(120);
    expect(ARRIVAL_RADIUS_M).toBe(60);
  });
});
