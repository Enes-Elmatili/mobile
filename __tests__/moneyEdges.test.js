// Les cas limites de l'argent affiché au prestataire : net de la fiche mission
// (lib/mission/brief.ts) et relevé des gains (lib/gains/model.ts). Un net à 0
// n'est pas « inconnu », un remboursement est négatif et ne compte pas comme
// mission, les frais de déplacement des anciens payloads sont en centimes.
const { netFor, briefFromLegacy, briefOf, workOf, FALLBACK_NET_RATE } = require('@/lib/mission/brief');
const { lineState, toLine, groupByMonth, inTransit, ledgerOf, estimateArrival, DEFAULT_PAYOUT_DELAY_DAYS } = require('@/lib/gains/model');

const DAY = 24 * 3600 * 1000;
const money = (m) => ({ money: { gross: null, net: null, calloutFee: null, pricingMode: null, ...m } });

describe('netFor — le net affiché', () => {
  it('un net serveur à 0 est respecté (pas de repli brut × 0,8)', () => {
    expect(netFor(money({ gross: 100, net: 0 }))).toBe(0);
  });
  it('repli brut × 0,8 arrondi au centime', () => {
    expect(FALLBACK_NET_RATE).toBe(0.8);
    expect(netFor(money({ gross: 30.69 }))).toBe(24.55);
    expect(netFor(money({ gross: 89 }))).toBe(71.2);
    expect(netFor(money({ gross: 0.01 }))).toBe(0.01);
  });
  it('brut nul ou absent (devis à venir) → null', () => {
    expect(netFor(money({ gross: 0 }))).toBeNull();
    expect(netFor(money({}))).toBeNull();
  });
});

describe('briefFromLegacy — les montants', () => {
  it('price prime sur estimatedPrice, chaînes converties', () => {
    expect(briefFromLegacy({ price: '89.5', estimatedPrice: 70 }).money.gross).toBe(89.5);
    expect(briefFromLegacy({ estimatedPrice: '70' }).money.gross).toBe(70);
    expect(briefFromLegacy({ price: 0 }).money.gross).toBe(0);
    expect(briefFromLegacy({}).money.gross).toBeNull();
  });
  it('calloutFee ancien : centimes → euros ; 0 reste 0 ; absent → null', () => {
    expect(briefFromLegacy({ calloutFee: 3500 }).money.calloutFee).toBe(35);
    expect(briefFromLegacy({ calloutFee: '4990' }).money.calloutFee).toBe(49.9);
    expect(briefFromLegacy({ calloutFee: 0 }).money.calloutFee).toBe(0);
    expect(briefFromLegacy({}).money.calloutFee).toBeNull();
  });
  it('le net n’est jamais inventé par le repli (calculé à l’affichage)', () => {
    const b = briefFromLegacy({ price: 100, pricingMode: 'fixed_forfait' });
    expect(b.money.net).toBeNull();
    expect(b.money.pricingMode).toBe('fixed_forfait');
    expect(netFor(b)).toBe(80);
  });
  it('item vide ou nul : fiche cohérente, id 0, statut PUBLISHED', () => {
    for (const item of [null, undefined, {}]) {
      const b = briefOf(item);
      expect(b.id).toBe(0);
      expect(b.status).toBe('PUBLISHED');
      expect(b.photos).toEqual([]);
      expect(b.client).toBeNull();
      expect(b.access).toBeNull();
    }
  });
});

describe('workOf — photos du chantier', () => {
  it('fiche serveur si présente, sinon champs bruts, sinon null', () => {
    const work = { beforePhotoUrl: 'a', beforePhotoAt: 't1', afterPhotoUrl: 'b', afterPhotoAt: 't2' };
    expect(workOf({ brief: { work } })).toBe(work);
    expect(workOf({ beforePhotoUrl: 'x', afterPhotoAt: 't' })).toEqual({ beforePhotoUrl: 'x', beforePhotoAt: null, afterPhotoUrl: null, afterPhotoAt: 't' });
    expect(workOf(null)).toEqual({ beforePhotoUrl: null, beforePhotoAt: null, afterPhotoUrl: null, afterPhotoAt: null });
  });
});

describe('relevé des gains — cas limites', () => {
  const created = '2026-09-10T10:00:00Z';
  const t0 = Date.parse(created);
  const credit = (over = {}) => ({ id: 'c1', type: 'CREDIT', amount: 8000, createdAt: created, requestId: 9, mission: null, ...over });

  it('délai par défaut : 7 jours', () => {
    expect(DEFAULT_PAYOUT_DELAY_DAYS).toBe(7);
    expect(estimateArrival(created)).toBe(t0 + 7 * DAY);
    expect(estimateArrival(t0, 2)).toBe(t0 + 2 * DAY);
  });

  it('un virement antérieur au crédit, ou non arrivé, ne le marque pas « viré »', () => {
    const before = { id: 'po1', amount: 1, status: 'paid', arrivalDate: t0 - DAY, createdAt: t0 - 2 * DAY };
    const pending = { id: 'po2', amount: 1, status: 'pending', arrivalDate: t0 + DAY, createdAt: t0 + DAY };
    const noDates = { id: 'po3', amount: 1, status: 'paid', arrivalDate: null, createdAt: null };
    expect(lineState(credit(), [before, pending, noDates], t0 + DAY, 7).state).toBe('arriving');
    const after = { id: 'po4', amount: 1, status: 'paid', arrivalDate: t0 + DAY, createdAt: t0 + DAY };
    expect(lineState(credit(), [after], t0 + DAY, 7)).toEqual({ state: 'paid', arrivesAt: t0 + 7 * DAY });
  });

  it('pile au délai : viré', () => {
    expect(lineState(credit(), [], t0 + 7 * DAY, 7).state).toBe('paid');
    expect(lineState(credit(), [], t0 + 7 * DAY - 1, 7).state).toBe('arriving');
  });

  it('remboursement : net négatif, état « refunded », sans date d’arrivée', () => {
    const l = toLine(credit({ id: 'd1', type: 'DEBIT', amount: 2500 }), [], t0, 7, 'fr');
    expect(l.net).toBe(-2500);
    expect(l.state).toBe('refunded');
    expect(l.arrivesAt).toBeNull();
    expect(l.missionId).toBe(9);
    expect(l.title).toBeNull();
    expect(l.city).toBeNull();
    expect(l.date).toBe(created);
  });

  it('titre traduit si disponible, sinon nom de base', () => {
    const mission = { id: 3, serviceName: 'Fuite', serviceNameI18n: { nl: 'Lek' }, address: null, completedAt: null, gross: null, commissionRate: null, net: null };
    expect(toLine(credit({ mission }), [], t0, 7, 'nl').title).toBe('Lek');
    expect(toLine(credit({ mission }), [], t0, 7, 'pl').title).toBe('Fuite');
    expect(toLine(credit({ mission, requestId: null }), [], t0, 7, 'fr').missionId).toBe(3);
  });

  it('mois : le remboursement réduit le net mais ne compte pas comme mission', () => {
    const lines = [
      toLine(credit({ id: 'a', amount: 8000, requestId: 1 }), [], t0, 7, 'fr'),
      toLine(credit({ id: 'b', amount: 2000, requestId: 1 }), [], t0, 7, 'fr'),
      toLine(credit({ id: 'c', type: 'DEBIT', amount: 3000, requestId: 2 }), [], t0, 7, 'fr'),
    ];
    const [g] = groupByMonth(lines);
    expect(g.net).toBe(7000);
    expect(g.missions).toBe(1);
  });

  it('rien en route : 0, aucune mission, pas de date', () => {
    const paid = toLine(credit(), [], t0 + 30 * DAY, 7, 'fr');
    expect(inTransit([paid])).toEqual({ amount: 0, missions: 0, arrivesAt: null });
    expect(inTransit([])).toEqual({ amount: 0, missions: 0, arrivesAt: null });
  });

  it('en route : somme et première arrivée', () => {
    const a = toLine(credit({ id: 'a', amount: 1000, createdAt: '2026-09-11T10:00:00Z', requestId: 1 }), [], t0, 7, 'fr');
    const b = toLine(credit({ id: 'b', amount: 500, requestId: 2 }), [], t0, 7, 'fr');
    expect(inTransit([a, b])).toEqual({ amount: 1500, missions: 2, arrivesAt: t0 + 7 * DAY });
  });

  it('fiche argent : brut − net = commission, taux dérivé ou serveur', () => {
    const m = (over) => ({ id: 1, serviceName: null, gross: 10000, commissionRate: null, net: 8000, ...over });
    const line = (mission, amount = 8000, type = 'CREDIT') => toLine(credit({ mission, amount, type }), [], t0, 7, 'fr');
    expect(ledgerOf(line(m()))).toEqual({ gross: 10000, commission: 2000, rate: 0.2, net: 8000 });
    expect(ledgerOf(line(m({ commissionRate: 0.15 })))).toMatchObject({ rate: 0.15 });
    // Remboursement : net en valeur absolue
    expect(ledgerOf(line(m(), 8000, 'DEBIT'))).toEqual({ gross: 10000, commission: 2000, rate: 0.2, net: 8000 });
    // Sans brut : ni commission ni taux
    expect(ledgerOf(line(null))).toEqual({ gross: null, commission: null, rate: null, net: 8000 });
    expect(ledgerOf(line(m({ gross: 0 })))).toMatchObject({ gross: 0, rate: null });
  });
});
