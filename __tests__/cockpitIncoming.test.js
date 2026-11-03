// L'accueil prestataire : les demandes entrantes et la mission à rouvrir
// (lib/cockpit/incoming.ts), le cadrage de la carte (lib/cockpit/framing.ts).
const {
  startsLater, incomingFromQueue, incomingFromSocket, mergeQueue,
  pickActiveMission, reconcileMission, missionFromAccept, isStillOpen, SOON_MS,
} = require('@/lib/cockpit/incoming');
const { extraCoverOf, routeKeyOf, meToneOf, INCOMING_COVER_RATIO } = require('@/lib/cockpit/framing');

const NOW = Date.parse('2026-09-14T10:00:00Z');
const inMinutes = (m) => new Date(NOW + m * 60000).toISOString();
const t = (key) => `«${key}»`;

describe('startsLater', () => {
  it('au-delà de 30 min : à venir ; à 30 min pile : maintenant', () => {
    expect(startsLater(inMinutes(31), NOW)).toBe(true);
    expect(startsLater(inMinutes(30), NOW)).toBe(false);
    expect(startsLater(inMinutes(-10), NOW)).toBe(false);
    expect(SOON_MS).toBe(30 * 60 * 1000);
  });
  it('sans créneau ou date illisible : jamais « à venir »', () => {
    expect(startsLater(null, NOW)).toBe(false);
    expect(startsLater(undefined, NOW)).toBe(false);
    expect(startsLater('', NOW)).toBe(false);
    expect(startsLater('pas une date', NOW)).toBe(false);
  });
});

describe('incomingFromQueue', () => {
  it('une ligne REST complète', () => {
    const r = { id: 42, serviceType: 'Plomberie', description: 'Fuite', price: 8000, address: 'Rue Neuve 1', lat: 50.85, lng: 4.35, urgent: true, pricingMode: 'fixed', status: 'PUBLISHED', calloutFee: 2500, client: { name: 'Léa' } };
    const req = incomingFromQueue(r);
    expect(req).toMatchObject({ requestId: '42', title: 'Plomberie', description: 'Fuite', price: 8000, address: 'Rue Neuve 1', latitude: 50.85, longitude: 4.35, urgent: true, pricingMode: 'fixed', isQuote: false, calloutFee: 2500, client: { name: 'Léa' } });
    expect(req.raw).toBe(r);
    expect(req.brief).toBeTruthy();
  });
  it('les replis : catégorie, puis « Mission » ; devis si QUOTE_PENDING', () => {
    expect(incomingFromQueue({ id: 1, category: { name: 'Serrurerie' } }).title).toBe('Serrurerie');
    const bare = incomingFromQueue({ id: 2, status: 'QUOTE_PENDING', calloutFee: null });
    expect(bare).toMatchObject({ title: 'Mission', description: '', price: 0, address: '', urgent: false, isQuote: true, calloutFee: undefined, client: { name: 'Client' } });
  });
  it('la fiche du serveur passe telle quelle', () => {
    const brief = { id: 3, status: 'PUBLISHED' };
    expect(incomingFromQueue({ id: 3, brief }).brief).toBe(brief);
  });
});

describe('incomingFromSocket', () => {
  it('requestId prime sur id ; latitude prime sur lat', () => {
    const req = incomingFromSocket({ requestId: 7, id: 99, latitude: 1, lat: 2, longitude: 3, lng: 4 }, t);
    expect(req.requestId).toBe('7');
    expect(req.latitude).toBe(1);
    expect(req.longitude).toBe(3);
    expect(incomingFromSocket({ id: 99, lat: 2, lng: 4 }, t)).toMatchObject({ requestId: '99', latitude: 2, longitude: 4 });
  });
  it('les libellés de repli viennent de la traduction', () => {
    const req = incomingFromSocket({ id: 1 }, t);
    expect(req).toMatchObject({
      title: '«provider.mission»', address: '«provider.unknown_address»', price: 0, urgent: false, isQuote: false, pricingMode: null,
      client: { name: '«provider.client»', avatarUrl: null, city: null },
    });
    expect(incomingFromSocket({ id: 1, serviceType: 'Peinture', clientName: 'Marc' }, t)).toMatchObject({ title: 'Peinture', client: { name: 'Marc' } });
  });
  it('un prix à 0 reste 0 ; le client et sa ville passent', () => {
    const req = incomingFromSocket({ id: 1, title: 'Fuite', price: 0, distance: 1.2, client: { id: 'c1', name: 'Ana', avatarUrl: 'a.png', city: 'Ixelles' } }, t);
    expect(req).toMatchObject({ title: 'Fuite', price: 0, distance: 1.2, clientId: 'c1', client: { name: 'Ana', avatarUrl: 'a.png', city: 'Ixelles' } });
  });
});

describe('mergeQueue', () => {
  const a = incomingFromQueue({ id: 1 });
  const b = incomingFromQueue({ id: 2 });
  const c = incomingFromQueue({ id: 3 });
  it('ajoute à la suite ce qui est neuf', () => {
    expect(mergeQueue([a], [a, b], new Set()).map((r) => r.requestId)).toEqual(['1', '2']);
  });
  it('ignore les demandes refusées', () => {
    expect(mergeQueue([a], [b, c], new Set(['2'])).map((r) => r.requestId)).toEqual(['1', '3']);
  });
  it('rien de neuf : même référence (pas de re-rendu)', () => {
    const prev = [a, b];
    expect(mergeQueue(prev, [a, b], new Set())).toBe(prev);
    expect(mergeQueue(prev, [c], new Set(['3']))).toBe(prev);
  });
});

describe('pickActiveMission', () => {
  const items = [
    { id: 1, status: 'DONE' },
    { id: 2, status: 'ACCEPTED', preferredTimeStart: inMinutes(120) },
    { id: 3, status: 'ONGOING' },
    { id: 4, status: 'QUOTE_SENT', preferredTimeStart: inMinutes(10) },
  ];
  it('la première active, non planifiée à plus de 30 min', () => {
    expect(pickActiveMission(items, null, NOW).id).toBe(3);
    expect(pickActiveMission([items[1], items[3]], null, NOW).id).toBe(4);
  });
  it('le lien profond passe devant, même planifiée plus tard', () => {
    expect(pickActiveMission(items, '2', NOW).id).toBe(2);
  });
  it('un lien vers une mission inactive ou inconnue retombe sur la dérivation', () => {
    expect(pickActiveMission(items, '1', NOW).id).toBe(3);
    expect(pickActiveMission(items, '999', NOW).id).toBe(3);
  });
  it('rien d’actif : aucune', () => {
    expect(pickActiveMission([items[0], items[1]], null, NOW)).toBeFalsy();
  });
});

describe('reconcileMission', () => {
  const found = { id: 3, status: 'ONGOING', serviceType: 'Plomberie', address: 'Rue A', client: { name: 'Léa' }, lat: 50.8, lng: 4.3 };
  it('la mission trouvée remplace tout', () => {
    expect(reconcileMission(null, found, [found])).toEqual({ id: 3, serviceType: 'Plomberie', status: 'ONGOING', address: 'Rue A', clientName: 'Léa', lat: 50.8, lng: 4.3 });
    expect(reconcileMission(null, { id: 5, status: 'ACCEPTED' }, [])).toMatchObject({ clientName: null, lat: null, lng: null });
  });
  it('une mission optimiste inconnue de la liste reste en place', () => {
    const prev = { id: 9, status: 'ACCEPTED', clientName: null, lat: null, lng: null };
    expect(reconcileMission(prev, null, [{ id: 1, status: 'DONE' }])).toBe(prev);
  });
  it('connue de la liste mais plus active : retirée', () => {
    const prev = { id: 9, status: 'ACCEPTED', clientName: null, lat: null, lng: null };
    expect(reconcileMission(prev, null, [{ id: '9', status: 'DONE' }])).toBeNull();
    expect(reconcileMission(null, undefined, [])).toBeNull();
  });
});

describe('missionFromAccept', () => {
  const request = incomingFromSocket({ id: 12, title: 'Fuite', address: 'Rue B', latitude: 50.1, longitude: 4.1, client: { name: 'Ana' } }, t);
  it('la réponse du serveur prime', () => {
    expect(missionFromAccept(request, { serviceType: 'Plomberie', status: 'ONGOING', address: 'Rue C', client: { name: 'Léa' }, lat: 1, lng: 2 }))
      .toEqual({ id: 12, serviceType: 'Plomberie', status: 'ONGOING', address: 'Rue C', clientName: 'Léa', lat: 1, lng: 2 });
  });
  it('sinon la demande reçue, et ACCEPTED par défaut', () => {
    expect(missionFromAccept(request, {})).toEqual({ id: 12, serviceType: 'Fuite', status: 'ACCEPTED', address: 'Rue B', clientName: 'Ana', lat: 50.1, lng: 4.1 });
  });
});

describe('isStillOpen', () => {
  it('publiée ou en attente de devis, sans prestataire', () => {
    expect(isStillOpen({ status: 'PUBLISHED' })).toBe(true);
    expect(isStillOpen({ status: 'QUOTE_PENDING', providerId: null })).toBe(true);
  });
  it('prise, annulée ou absente : non', () => {
    expect(isStillOpen({ status: 'PUBLISHED', providerId: 'p1' })).toBe(false);
    expect(isStillOpen({ status: 'CANCELLED' })).toBe(false);
    expect(isStillOpen(null)).toBe(false);
    expect(isStillOpen(undefined)).toBe(false);
  });
});

describe('cadrage de la carte', () => {
  it('la fiche entrante couvre 55 % de l’écran, moins la journée', () => {
    expect(INCOMING_COVER_RATIO).toBe(0.55);
    expect(extraCoverOf('incoming', 800, 100, null)).toBe(340);
    expect(extraCoverOf('incoming', 800, 500, 999)).toBe(0);
  });
  it('en mission : la hauteur de la feuille, si elle est connue', () => {
    expect(extraCoverOf('busy', 800, 100, 420)).toBe(320);
    expect(extraCoverOf('busy', 800, 100, 50)).toBe(0);
    expect(extraCoverOf('busy', 800, 100, null)).toBe(0);
  });
  it('ailleurs : rien de plus', () => {
    for (const stage of ['off', 'on', 'gps', 'net']) expect(extraCoverOf(stage, 800, 100, 420)).toBe(0);
  });
  it('la clé d’itinéraire arrondit à 4 décimales', () => {
    expect(routeKeyOf(null)).toBe('');
    expect(routeKeyOf({ latitude: 50.846612, longitude: 4.352849 })).toBe('50.8466,4.3528');
  });
  it('mon repère : grisé sans GPS, éteint hors ligne, allumé sinon', () => {
    expect(meToneOf('gps')).toBe('gps');
    expect(meToneOf('off')).toBe('off');
    for (const stage of ['on', 'incoming', 'busy', 'net']) expect(meToneOf(stage)).toBe('on');
  });
});
