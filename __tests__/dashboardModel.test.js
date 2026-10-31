// L'accueil client (lib/dashboard/*) : tri des demandes, statuts, libellés, cibles de navigation.
const {
  PREVIEW_COUNT, EXPANDED_COUNT, isScheduledFuture, activeMissionOf, searchingMissionOf, quoteMissionOf,
  activityRequestsOf, upcomingRequestsOf, visibleActivity, withRequestStatus,
} = require('@/lib/dashboard/missions');
const { getStatusInfo, activityBadgeTone, upcomingKindOf, getServiceIcon } = require('@/lib/dashboard/status');
const { getGreeting, secondsLeft, formatMinSec, countdownOf, isTomorrow, haversineEtaMinutes, firstNumber, arrivalLabel } = require('@/lib/dashboard/time');
const { missionViewParams, quoteHref, upcomingHref } = require('@/lib/dashboard/navigation');
const { SERVICE_CARDS, LAUNCH_CARDS } = require('@/lib/dashboard/services');
const { COLORS } = require('@/hooks/use-app-theme');

const NOW = Date.parse('2026-09-14T10:00:00Z');
const inMinutes = (m) => new Date(NOW + m * 60000).toISOString();
const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const req = (id, status, extra = {}) => ({ id, status, title: `t${id}`, createdAt: inMinutes(-60), ...extra });

describe('isScheduledFuture', () => {
  it('sans créneau → faux', () => {
    expect(isScheduledFuture({}, NOW)).toBe(false);
    expect(isScheduledFuture({ preferredTimeStart: null }, NOW)).toBe(false);
  });
  it('créneau futur → vrai, passé ou maintenant → faux', () => {
    expect(isScheduledFuture({ preferredTimeStart: inMinutes(1) }, NOW)).toBe(true);
    expect(isScheduledFuture({ preferredTimeStart: inMinutes(0) }, NOW)).toBe(false);
    expect(isScheduledFuture({ preferredTimeStart: inMinutes(-5) }, NOW)).toBe(false);
  });
});

describe("l'îlot noir : active, sinon recherche, sinon devis", () => {
  const list = [
    req('1', 'PUBLISHED'),
    req('2', 'accepted', { preferredTimeStart: inMinutes(120) }), // planifiée : pas active
    req('3', 'ONGOING'),
    req('4', 'QUOTE_SENT'),
  ];
  it('la mission active ignore les acceptées planifiées plus tard', () => {
    expect(activeMissionOf(list, NOW).id).toBe('3');
    expect(activeMissionOf([list[1]], NOW)).toBeNull();
    expect(activeMissionOf(undefined, NOW)).toBeNull();
  });
  it('le statut est insensible à la casse', () => {
    expect(activeMissionOf([req('9', 'accepted')], NOW).id).toBe('9');
  });
  it('pas de recherche affichée quand une mission est active', () => {
    const active = activeMissionOf(list, NOW);
    expect(searchingMissionOf(list, active, NOW)).toBeNull();
    expect(searchingMissionOf(list, null, NOW).id).toBe('1');
  });
  it('une recherche planifiée future ne prend pas l’îlot', () => {
    expect(searchingMissionOf([req('5', 'PUBLISHED', { preferredTimeStart: inMinutes(60) })], null, NOW)).toBeNull();
  });
  it('le devis ne vient qu’en dernier', () => {
    const quotes = [req('6', 'QUOTE_PENDING'), req('7', 'QUOTE_SENT')];
    expect(quoteMissionOf(quotes, null, null, NOW).id).toBe('6');
    expect(quoteMissionOf(quotes, list[2], null, NOW)).toBeNull();
    expect(quoteMissionOf(quotes, null, list[0], NOW)).toBeNull();
    expect(quoteMissionOf([req('8', 'QUOTE_SENT', { preferredTimeStart: inMinutes(30) })], null, null, NOW)).toBeNull();
  });
});

describe('activité récente et « À venir »', () => {
  const list = [
    req('1', 'DONE'),
    req('2', 'CANCELLED'),
    req('3', 'QUOTE_REFUSED'),
    req('4', 'QUOTE_SENT'),
    req('5', 'QUOTE_ACCEPTED'),
    req('6', 'PUBLISHED', { preferredTimeStart: inMinutes(300) }),
    req('7', 'ACCEPTED', { preferredTimeStart: inMinutes(60) }),
    req('8', 'DONE', { preferredTimeStart: inMinutes(30) }),
    req('9', 'EXPIRED'),
  ];
  it("l'activité exclut annulées, devis et planifiées futures", () => {
    expect(activityRequestsOf(list, NOW).map((r) => r.id)).toEqual(['1', '9']);
    expect(activityRequestsOf(undefined, NOW)).toEqual([]);
  });
  it('« À venir » : planifiées futures non terminées, par date croissante', () => {
    expect(upcomingRequestsOf(list, NOW).map((r) => r.id)).toEqual(['7', '6']);
    expect(upcomingRequestsOf(undefined, NOW)).toEqual([]);
  });
  it('3 lignes par défaut, 6 au plus après « Voir plus »', () => {
    const many = Array.from({ length: 10 }, (_, i) => i);
    expect(PREVIEW_COUNT).toBe(3);
    expect(EXPANDED_COUNT).toBe(6);
    expect(visibleActivity(many, false)).toEqual([0, 1, 2]);
    expect(visibleActivity(many, true)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('withRequestStatus', () => {
  const data = { me: { id: 'u' }, stats: {}, requests: [req('1', 'PUBLISHED'), req(2, 'PUBLISHED')] };
  it('patche la ligne visée (id comparé en chaîne) sans toucher aux autres', () => {
    const next = withRequestStatus(data, '2', 'ACCEPTED');
    expect(next.requests.map((r) => r.status)).toEqual(['PUBLISHED', 'ACCEPTED']);
    expect(next.requests[0]).toBe(data.requests[0]);
    expect(data.requests[1].status).toBe('PUBLISHED');
  });
  it('sans données → inchangé', () => { expect(withRequestStatus(null, '1', 'DONE')).toBeNull(); });
});

describe('statuts', () => {
  it('libellé, icône et LED par statut', () => {
    expect(getStatusInfo('done', t)).toEqual({ label: 'dashboard.status_done', icon: 'check-circle', ledColor: COLORS.green });
    expect(getStatusInfo('QUOTE_REFUSED', t).label).toBe('dashboard.status_cancelled');
    expect(getStatusInfo('PUBLISHED', t).ledColor).toBe(COLORS.amber);
  });
  it('statut inconnu → le statut brut, icône d’aide', () => {
    expect(getStatusInfo('weird', t)).toEqual({ label: 'WEIRD', icon: 'help-circle', ledColor: COLORS.amber });
    expect(getStatusInfo('', t).label).toBe('PENDING');
  });
  it.each([
    ['CANCELLED', 'cancelled'], ['expired', 'cancelled'], ['PUBLISHED', 'pending'], ['PENDING', 'pending'],
    ['PENDING_PAYMENT', 'pending'], ['ACCEPTED', 'pending'], ['ONGOING', 'pending'], ['QUOTE_PENDING', 'pending'],
    ['DONE', 'done'], ['QUOTE_SENT', 'done'], [undefined, 'done'],
  ])('badge d’activité %s → %s', (status, tone) => { expect(activityBadgeTone(status)).toBe(tone); });
  it('carte « À venir » : devis, acceptée, paiement en attente', () => {
    expect(upcomingKindOf({ status: 'published', pricingMode: 'estimate' })).toEqual({ isQuote: true, isAccepted: false, isPendingPayment: false });
    expect(upcomingKindOf({ status: 'ACCEPTED', pricingMode: 'diagnostic' }).isAccepted).toBe(true);
    expect(upcomingKindOf({ status: 'PENDING_PAYMENT', pricingMode: 'fixed' })).toEqual({ isQuote: false, isAccepted: false, isPendingPayment: true });
    expect(upcomingKindOf({})).toEqual({ isQuote: false, isAccepted: false, isPendingPayment: false });
  });
  it.each([
    [undefined, 'tool'], ['Plomberie', 'droplet'], ['Serrurerie', 'key'], ['Électricité', 'zap'],
    ['Chauffage', 'zap'], ['Jardinage', 'feather'], ['Ménage', 'star'], ['Demenagement', 'package'],
    // « Déménagement » contient « ménage » : testé avant, il prend l'étoile (comportement historique).
    ['Déménagement', 'star'],
    ['Peinture', 'edit-2'], ['Autre', 'tool'],
  ])('icône du service %s → %s', (label, icon) => { expect(getServiceIcon(label)).toBe(icon); });
});

describe('libellés temporels', () => {
  it('salut selon l’heure', () => {
    expect(getGreeting(t, 8)).toBe('dashboard.greeting_morning');
    expect(getGreeting(t, 12)).toBe('dashboard.greeting_afternoon');
    expect(getGreeting(t, 18)).toBe('dashboard.greeting_evening');
  });
  it('compte à rebours de la recherche', () => {
    expect(secondsLeft(null, NOW)).toBeNull();
    expect(secondsLeft(new Date(NOW + 90_500).toISOString(), NOW)).toBe(90);
    expect(secondsLeft(inMinutes(-1), NOW)).toBe(0);
    expect(formatMinSec(900)).toBe('15:00');
    expect(formatMinSec(65)).toBe('1:05');
  });
  it('compte à rebours d’une demande planifiée', () => {
    const at = (m) => new Date(NOW + m * 60000);
    expect(countdownOf(null, NOW)).toEqual({ label: '', fraction: 0 });
    expect(countdownOf(at(2 * 1440 + 14 * 60), NOW).label).toBe('2J 14H');
    expect(countdownOf(at(3 * 60 + 5), NOW).label).toBe('3H 05M');
    expect(countdownOf(at(45), NOW).label).toBe('45M');
    expect(countdownOf(at(0.5), NOW).label).toBe('< 1M');
    expect(countdownOf(at(-10), NOW)).toEqual({ label: '< 1M', fraction: 0 });
    expect(countdownOf(at(24 * 60), NOW).fraction).toBe(0.5);
    expect(countdownOf(at(72 * 60), NOW).fraction).toBe(1);
  });
  it('demain, au calendrier local', () => {
    const now = new Date(2026, 8, 30, 23, 0);
    expect(isTomorrow(new Date(2026, 9, 1, 9, 0), now)).toBe(true);
    expect(isTomorrow(new Date(2026, 8, 30, 23, 30), now)).toBe(false);
    expect(isTomorrow(new Date(2026, 9, 2, 0, 0), now)).toBe(false);
  });
  it('ETA à vol d’oiseau : ~1,4 × la distance à 30 km/h', () => {
    const a = { lat: 50.85, lng: 4.35 };
    expect(haversineEtaMinutes(a, a)).toBe(0);
    // ~11,1 km plein nord → 11,1 × 1,4 / 30 h ≈ 31,1 min → 32
    expect(haversineEtaMinutes(a, { lat: 50.95, lng: 4.35 })).toBe(32);
  });
  it('premier nombre d’un texte', () => {
    expect(firstNumber('21 mins')).toBe('21');
    expect(firstNumber('Arrivée dans 7 min')).toBe('7');
    expect(firstNumber('Prestataire en route')).toBeNull();
  });
  it('arrivée imminente à une minute ou moins', () => {
    expect(arrivalLabel(1, t)).toBe('dashboard.arrival_imminent');
    expect(arrivalLabel(0, t)).toBe('dashboard.arrival_imminent');
    expect(arrivalLabel(12, t)).toBe('dashboard.arrival_in_min:{"min":12}');
    expect(arrivalLabel(null, t)).toBe('dashboard.arrival_in_min:{"min":null}');
  });
});

describe('navigation', () => {
  it('paramètres du suivi : valeurs par défaut en chaînes vides', () => {
    const nowLabel = jest.fn(() => 'maintenant');
    expect(missionViewParams({ id: 42 }, 'fr-BE', nowLabel)).toEqual({
      id: '42', serviceName: '', address: '', price: '', scheduledLabel: 'maintenant', expiresAt: '', lat: '', lng: '',
    });
    expect(nowLabel).toHaveBeenCalledTimes(1);
  });
  it('paramètres du suivi : titre, puis serviceType, puis name ; créneau formaté', () => {
    const nowLabel = jest.fn(() => 'maintenant');
    const p = missionViewParams({
      id: '7', serviceType: 'Plomberie', name: 'x', address: 'Rue 1', price: 80,
      preferredTimeStart: '2026-09-14T10:00:00Z', expiresAt: 'E', lat: 50.1, lng: 4.2,
    }, 'fr-BE', nowLabel);
    expect(p).toMatchObject({ id: '7', serviceName: 'Plomberie', address: 'Rue 1', price: '80', expiresAt: 'E', lat: '50.1', lng: '4.2' });
    expect(p.scheduledLabel).toBe(new Date('2026-09-14T10:00:00Z').toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    expect(nowLabel).not.toHaveBeenCalled();
    expect(missionViewParams({ id: 1, title: 'T', serviceType: 'S' }, 'fr-BE', nowLabel).serviceName).toBe('T');
  });
  it('scheduledFor passe avant preferredTimeStart', () => {
    const a = missionViewParams({ id: 1, scheduledFor: '2026-09-20T08:00:00Z', preferredTimeStart: '2026-09-14T10:00:00Z' }, 'en-GB', () => '');
    expect(a.scheduledLabel).toBe(new Date('2026-09-20T08:00:00Z').toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  });
  it('devis : relecture si envoyé, suivi sinon', () => {
    expect(quoteHref({ id: 3, status: 'quote_sent' })).toEqual({ pathname: '/request/[id]/quote-review', params: { id: '3' } });
    expect(quoteHref({ id: 3, status: 'QUOTE_PENDING' })).toEqual({ pathname: '/request/[id]/missionview', params: { id: '3' } });
  });
  it('« À venir » : reprise du paiement si jamais finalisé, récap sinon', () => {
    expect(upcomingHref({ id: 5, status: 'PENDING_PAYMENT' })).toEqual({ pathname: '/request/[id]/resume-payment', params: { id: '5' } });
    expect(upcomingHref({ id: 5, status: 'ACCEPTED' })).toEqual({ pathname: '/request/[id]/scheduled', params: { id: '5', mode: 'recap' } });
  });
});

describe('catalogue de services', () => {
  it('au lancement : Plomberie et Serrurerie seulement', () => {
    expect(SERVICE_CARDS).toHaveLength(6);
    expect(LAUNCH_CARDS.map((c) => c.key)).toEqual(['plomberie', 'serrurerie']);
    expect(LAUNCH_CARDS.map((c) => c.icon)).toEqual(['droplet', 'key']);
  });
});
