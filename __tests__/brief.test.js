const { briefFromLegacy, briefOf, netFor, accessLabel, etaMinutes, isQuoteMode } = require('../lib/mission/brief');

const t = (k, o) => (o?.n != null ? `${k}:${o.n}` : k);

describe('briefOf — la fiche du serveur, sinon le repli', () => {
  it('renvoie la fiche du serveur telle quelle', () => {
    const brief = { id: 1, money: { net: 71 } };
    expect(briefOf({ brief })).toBe(brief);
  });
  it('repli : un payload socket ancien devient une fiche cohérente', () => {
    const b = briefFromLegacy({ requestId: '42', title: 'Fuite d’eau', price: 89, address: 'Av. Louise 143', urgent: true, distance: 2.1, client: { name: 'Sophie M.' }, latitude: 50.8, longitude: 4.3 });
    expect(b.id).toBe(42);
    expect(b.service.name).toBe('Fuite d’eau');
    expect(b.money.gross).toBe(89);
    expect(b.place).toEqual({ address: 'Av. Louise 143', lat: 50.8, lng: 4.3, distanceKm: 2.1 });
    expect(b.client.name).toBe('Sophie M.');
    expect(b.schedule.mode).toBe('now');
    expect(b.access).toBeNull();
    expect(b.photos).toEqual([]);
  });
  it('repli : une opportunité planifiée avec accès', () => {
    const b = briefFromLegacy({ id: 7, serviceType: 'Débouchage', createdAt: '2026-09-13T09:00:00Z', preferredTimeStart: '2026-09-15T10:00:00Z', accessFloor: 3, accessHasElevator: true, category: { name: 'Plomberie', icon: 'droplet' } });
    expect(b.schedule.mode).toBe('slot');
    expect(b.access).toEqual({ buildingType: null, floor: 3, hasElevator: true, notes: null });
    expect(b.service.categoryIcon).toBe('droplet');
  });
});

describe('netFor', () => {
  it('prend le net du serveur, sinon brut × 0,8, sinon null', () => {
    expect(netFor({ money: { net: 71.2, gross: 89 } })).toBe(71.2);
    expect(netFor({ money: { net: null, gross: 89 } })).toBe(71.2);
    expect(netFor({ money: { net: null, gross: null } })).toBeNull();
    expect(netFor({ money: { net: null, gross: 0 } })).toBeNull();
  });
});

describe('accessLabel / etaMinutes / isQuoteMode', () => {
  it('compose étage et ascenseur', () => {
    expect(accessLabel({ access: { floor: 3, hasElevator: true, buildingType: null, notes: null } }, t)).toBe('mission.floor_short:3, mission.elevator_short');
    expect(accessLabel({ access: { floor: 0, hasElevator: false, buildingType: null, notes: null } }, t)).toBe('ext.missions_ground_floor, mission.no_elevator_short');
    expect(accessLabel({ access: { floor: null, hasElevator: null, buildingType: 'house', notes: null } }, t)).toBe('ext.missions_building_house');
    expect(accessLabel({ access: null }, t)).toBeNull();
  });
  it('ETA ≈ 3 min par km, au moins 1', () => {
    expect(etaMinutes(2.1)).toBe(6);
    expect(etaMinutes(0.1)).toBe(1);
    expect(etaMinutes(null)).toBeNull();
  });
  it('devis = estimate ou diagnostic', () => {
    expect(isQuoteMode('estimate')).toBe(true);
    expect(isQuoteMode('fixed_forfait')).toBe(false);
  });
});
