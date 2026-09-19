// L'accueil prestataire : table de vérité du stade (lib/cockpit/stage.ts) et
// de la journée (lib/cockpit/day.ts).
const { cockpitStageOf, cockpitCameraMode, goShape } = require('@/lib/cockpit/stage');
const { remindersOf, nextMissionOf, inLabel, clockOf } = require('@/lib/cockpit/day');

describe('cockpitStageOf', () => {
  it('hors ligne / en ligne / demande pour vous', () => {
    expect(cockpitStageOf({ online: false })).toBe('off');
    expect(cockpitStageOf({ online: true })).toBe('on');
    expect(cockpitStageOf({ online: true, hasIncoming: true })).toBe('incoming');
    // Hors ligne, une demande résiduelle ne monte pas.
    expect(cockpitStageOf({ online: false, hasIncoming: true })).toBe('off');
  });
  it('la mission en cours prime sur tout, même sans GPS', () => {
    expect(cockpitStageOf({ online: true, hasMission: true, hasIncoming: true })).toBe('busy');
    expect(cockpitStageOf({ online: false, hasMission: true, gpsDenied: true })).toBe('busy');
  });
  it('sans réseau : on le dit, sauf en mission ; passe avant le GPS', () => {
    expect(cockpitStageOf({ online: true, noNetwork: true })).toBe('net');
    expect(cockpitStageOf({ online: false, noNetwork: true, gpsDenied: true })).toBe('net');
    expect(cockpitStageOf({ online: true, noNetwork: true, hasMission: true })).toBe('busy');
    expect(cockpitCameraMode('net')).toBe('none');
    expect(goShape('net')).toBe('hidden');
  });
  it('GPS refusé : rien n’arrive, en ligne ou non', () => {
    expect(cockpitStageOf({ online: true, gpsDenied: true })).toBe('gps');
    expect(cockpitStageOf({ online: false, gpsDenied: true })).toBe('gps');
  });
  it('caméra et forme du GO', () => {
    expect(cockpitCameraMode('off')).toBe('none');
    expect(cockpitCameraMode('gps')).toBe('none');
    expect(cockpitCameraMode('on')).toBe('me');
    expect(cockpitCameraMode('incoming')).toBe('me');
    expect(goShape('off')).toBe('go');
    expect(goShape('on')).toBe('stop');
    expect(goShape('incoming')).toBe('hidden');
    expect(goShape('busy')).toBe('hidden');
    expect(goShape('gps')).toBe('hidden');
  });
});

describe('journée', () => {
  const now = Date.parse('2026-09-17T10:00:00Z');
  const iso = (min) => new Date(now + min * 60000).toISOString();
  it('rappels : virements si Stripe non finalisé, un devis par mission QUOTE_PENDING', () => {
    expect(remindersOf([], null)).toEqual([]);
    expect(remindersOf([], { needsOnboarding: true })).toEqual([{ kind: 'payouts' }]);
    expect(remindersOf([], { payoutsEnabled: false })).toEqual([{ kind: 'payouts' }]);
    expect(remindersOf([{ id: 51, status: 'QUOTE_PENDING' }, { id: 52, status: 'DONE' }], { payoutsEnabled: true }))
      .toEqual([{ kind: 'quote', requestId: 51 }]);
  });
  it('prochaine mission : la plus proche acceptée à venir, ambre à moins de 30 min', () => {
    const m = [
      { id: 1, status: 'ACCEPTED', preferredTimeStart: iso(120), serviceType: 'Fuite', address: 'Rue X 1, 1050 Ixelles', client: { name: 'Marie D.' } },
      { id: 2, status: 'ACCEPTED', preferredTimeStart: iso(12) },
      { id: 3, status: 'DONE', preferredTimeStart: iso(5) },
      { id: 4, status: 'ACCEPTED', preferredTimeStart: iso(-60) },
      { id: 5, status: 'ACCEPTED' },
    ];
    const n = nextMissionOf(m, now);
    expect(n.id).toBe(2);
    expect(n.inMin).toBe(12);
    expect(n.soon).toBe(true);
    expect(nextMissionOf([m[0]], now)).toMatchObject({ id: 1, inMin: 120, soon: false, clientName: 'Marie D.' });
    // Un créneau commencé depuis moins de 15 min compte encore comme « maintenant ».
    expect(nextMissionOf([{ id: 9, status: 'ACCEPTED', preferredTimeStart: iso(-10) }], now)).toMatchObject({ id: 9, soon: true });
    expect(nextMissionOf([m[3], m[4]], now)).toBeNull();
  });
  it('chrono « depuis » sans zéro inutile', () => {
    const t0 = 1_000_000;
    expect(clockOf(t0, t0 + 12_000)).toBe('0:12');
    expect(clockOf(t0, t0 + (42 * 60 + 17) * 1000)).toBe('42:17');
    expect(clockOf(t0, t0 + (3600 + 125) * 1000)).toBe('1:02:05');
    expect(clockOf(t0 + 5000, t0)).toBe('0:00');
  });
  it('kicker « dans … »', () => {
    const t = (k, o) => (o ? `${k}:${o.n}` : k);
    expect(inLabel(-5, t)).toBe('cockpit.next_now');
    expect(inLabel(12, t)).toBe('cockpit.next_in_min:12');
    expect(inLabel(125, t)).toBe('cockpit.next_in_h:2');
  });
});
