// La cloche, côté modèle (lib/notifications/model.ts).
const { familyOf, sectionOf, groupBySection, timeLabel, refChip, wantsToast } = require('@/lib/notifications/model');

const t = (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k);

describe('familyOf', () => {
  it('lit la famille du catalogue, sinon la déduit des anciens champs', () => {
    expect(familyOf({ data: { family: 'money' } })).toBe('money');
    expect(familyOf({ data: { category: 'refund' } })).toBe('money');
    expect(familyOf({ data: { screen: 'Messages', senderId: 'u1' } })).toBe('message');
    expect(familyOf({ data: { type: 'kyc_status' } })).toBe('account');
    expect(familyOf({ data: { requestId: 47, screen: 'MissionView' } })).toBe('mission');
    expect(familyOf({ data: null, type: 'info' })).toBe('account');
  });
});

describe('sections', () => {
  const now = new Date(2026, 8, 19, 10, 0); // sam. 19 sept 2026 10:00
  const at = (d, h = 9) => new Date(2026, 8, d, h).toISOString();
  it('aujourd’hui / hier / cette semaine / plus tôt, par jour civil', () => {
    expect(sectionOf(at(19, 1), now)).toBe('today');
    expect(sectionOf(at(18, 23), now)).toBe('yesterday');
    expect(sectionOf(at(14), now)).toBe('week');
    expect(sectionOf(at(12), now)).toBe('earlier');
    expect(sectionOf('nope', now)).toBe('earlier');
  });
  it('regroupe dans l’ordre, du plus récent au plus ancien, sans section vide', () => {
    const items = [{ id: 'a', createdAt: at(12) }, { id: 'b', createdAt: at(19, 9) }, { id: 'c', createdAt: at(19, 8) }, { id: 'd', createdAt: at(15) }];
    const g = groupBySection(items, now);
    expect(g.map((s) => s.section)).toEqual(['today', 'week', 'earlier']);
    expect(g[0].data.map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('étiquette de temps', () => {
    expect(timeLabel(new Date(now.getTime() - 30_000).toISOString(), t, now)).toBe('notifications.time_now');
    expect(timeLabel(new Date(now.getTime() - 4 * 60_000).toISOString(), t, now)).toBe('notifications.time_ago_min:{"n":4}');
    expect(timeLabel(new Date(now.getTime() - 3 * 3600_000).toISOString(), t, now)).toBe('notifications.time_ago_hour:{"n":3}');
    expect(timeLabel(at(18, 16), t, now)).toMatch(/^notifications\.yesterday · 16:00$/);
    expect(timeLabel(at(14, 15), t, now)).toMatch(/· 15:00$/);
    expect(timeLabel(at(1, 15), t, now)).toMatch(/sept/);
  });
});

describe('puce et toast', () => {
  it('la puce dit où le tap mène', () => {
    expect(refChip({ data: { requestId: 47, screen: 'MissionView', event: 'mission.arrived' } }, t)).toEqual({ label: 'NOTIFICATIONS.CHIP_TRACK · NOTIFICATIONS.CHIP_MISSION_N', primary: true });
    expect(refChip({ data: { requestId: 47, screen: 'Documents', event: 'payment.receipt' } }, t).primary).toBe(false);
    expect(refChip({ data: { requestId: 47 } }, t).label).toBe('NOTIFICATIONS.CHIP_MISSION_N');
    expect(refChip({ data: {} }, t)).toBeNull();
  });
  it('pas de toast quand l’écran montre déjà l’événement', () => {
    expect(wantsToast({ data: { toast: false } })).toBe(false);
    expect(wantsToast({ data: {} })).toBe(true);
    expect(wantsToast({ data: null })).toBe(true);
  });
});
