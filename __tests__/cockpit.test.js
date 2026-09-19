// L'accueil prestataire : table de vérité du stade (lib/cockpit/stage.ts) et
// de la journée (lib/cockpit/day.ts).
const { cockpitStageOf, cockpitCameraMode } = require('@/lib/cockpit/stage');
const { providerDisc, clientDisc } = require('@/stores/nav');
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
    expect(providerDisc('net')).toBe('hidden');
  });
  it('GPS refusé : rien n’arrive, en ligne ou non', () => {
    expect(cockpitStageOf({ online: true, gpsDenied: true })).toBe('gps');
    expect(cockpitStageOf({ online: false, gpsDenied: true })).toBe('gps');
  });
  it('caméra et forme du disque (stores/nav)', () => {
    expect(cockpitCameraMode('off')).toBe('none');
    expect(cockpitCameraMode('gps')).toBe('none');
    expect(cockpitCameraMode('on')).toBe('me');
    expect(cockpitCameraMode('incoming')).toBe('me');
    expect(providerDisc('off')).toBe('go');
    expect(providerDisc('on')).toBe('stop');
    expect(providerDisc('busy')).toBe('hidden'); // la feuille de mission porte l'action
    expect(providerDisc('incoming')).toBe('hidden');
    expect(providerDisc('gps')).toBe('hidden');
  });
  it('le disque du client : « + » au repos, la flèche quand une demande vit', () => {
    expect(clientDisc(false)).toBe('plus');
    expect(clientDisc(true)).toBe('track');
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

describe('géométrie par appareil (lib/cockpit/geometry.ts)', () => {
  const { cockpitGeometry, CONTENT_MAX_WIDTH } = require('@/lib/cockpit/geometry');
  // Dessus de la barre flottante : 64 + max(inset, 12) + 10 (components/ui/FixedTabBar).
  const bar = (bottomInset) => 64 + Math.max(bottomInset, 12) + 10;
  it('iPhone SE (375×667, inset bas 0) : dense, la journée respire au-dessus de la barre', () => {
    const g = cockpitGeometry({ width: 375, height: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 }, cls: 'compact', tabBarHeight: bar(0) });
    expect(g.denseHeight).toBe(true);
    expect(g.barTop).toBe(86);
    expect(g.stripBottom).toBe(86 + 12);
    // Il reste une carte visible entre l'étiquette d'état et la journée.
    expect(667 - g.mapPaddingTop - g.mapPaddingBottom).toBeGreaterThan(200);
    expect(g.contentWidth).toBe(375 - 32);
  });
  it('iPhone 15 Pro (393×852, inset bas 34) : taille normale, étiquette sous la rangée du haut', () => {
    const g = cockpitGeometry({ width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 }, cls: 'compact', tabBarHeight: bar(34) });
    expect(g.denseHeight).toBe(false);
    expect(g.barTop).toBe(108);
    expect(g.stateTop).toBe(59 + 8 + 44 + 10);
    expect(g.marginLeft).toBe(16);
    expect(g.veilLabelTop).toBeGreaterThan(0.2);
    expect(g.veilLabelTop).toBeLessThan(0.5);
  });
  it('Android 360×640 à trois boutons (inset bas 48) : dense, et il reste de la carte', () => {
    const g = cockpitGeometry({ width: 360, height: 640, insets: { top: 24, bottom: 48, left: 0, right: 0 }, cls: 'compact', tabBarHeight: bar(48) });
    expect(g.denseHeight).toBe(true);
    expect(g.barTop).toBe(122);
    expect(640 - g.mapPaddingTop - g.mapPaddingBottom).toBeGreaterThan(150);
  });
  it('Fold ouvert (673×841, regular, barre latérale) : largeur de lecture centrée, le disque flotte toujours en bas', () => {
    const g = cockpitGeometry({ width: 673, height: 841, insets: { top: 24, bottom: 24, left: 0, right: 0 }, cls: 'regular', tabBarHeight: bar(24) });
    expect(g.contentWidth).toBe(CONTENT_MAX_WIDTH);
    expect(g.marginLeft).toBe((673 - CONTENT_MAX_WIDTH) / 2);
    expect(g.marginLeft).toBe(g.marginRight);
    expect(g.barTop).toBe(98);
  });
  it('encoche latérale (insets gauche 24 / droite 0) : marges asymétriques', () => {
    const g = cockpitGeometry({ width: 540, height: 720, insets: { top: 0, bottom: 0, left: 24, right: 0 }, cls: 'compact', tabBarHeight: 86 });
    expect(g.marginLeft).toBe(24 + 16);
    expect(g.marginRight).toBe(16);
    expect(g.contentWidth).toBe(540 - 24 - 32);
  });
});
