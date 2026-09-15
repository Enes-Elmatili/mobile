// Le relevé des gains en pur (lib/gains/model.ts).
const { cityOf, estimateArrival, lineState, toLine, groupByMonth, inTransit, ledgerOf } = require('@/lib/gains/model');

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse('2026-09-14T10:00:00Z');
const tx = (over = {}) => ({ id: 't1', type: 'CREDIT', amount: 24545, reference: 'transfer_tr_1', createdAt: '2026-09-13T18:31:00Z', requestId: 43, mission: { id: 43, serviceName: 'Fuite d’eau', address: 'Avenue Louise 1, 1050 Ixelles', completedAt: '2026-09-13T18:31:00Z', gross: 30681, commissionRate: 0.2, net: 24545 }, ...over });

describe('gains', () => {
  it('cityOf', () => {
    expect(cityOf('Avenue Louise 1, 1050 Ixelles')).toBe('Ixelles');
    expect(cityOf('Rue Haute 12, 1000 Bruxelles')).toBe('Bruxelles');
    expect(cityOf(null)).toBeNull();
  });
  it('estimateArrival = virement + délai', () => {
    expect(estimateArrival('2026-09-13T18:31:00Z', 7)).toBe(Date.parse('2026-09-13T18:31:00Z') + 7 * DAY);
  });
  it('lineState : en route, puis virée après le délai ou un payout arrivé', () => {
    expect(lineState(tx(), [], NOW, 7).state).toBe('arriving');
    expect(lineState(tx(), [], NOW + 8 * DAY, 7).state).toBe('paid');
    const payout = { id: 'po', amount: 24545, status: 'paid', arrivalDate: NOW + DAY, createdAt: NOW };
    expect(lineState(tx(), [payout], NOW, 7).state).toBe('paid');
    expect(lineState(tx({ type: 'DEBIT' }), [], NOW, 7)).toEqual({ state: 'refunded', arrivesAt: null });
  });
  it('toLine : net signé, titre, commune', () => {
    const l = toLine(tx(), [], NOW, 7, 'fr');
    expect(l.net).toBe(24545); expect(l.title).toBe('Fuite d’eau'); expect(l.city).toBe('Ixelles'); expect(l.missionId).toBe(43);
    expect(toLine(tx({ type: 'DEBIT', amount: 100 }), [], NOW, 7, 'fr').net).toBe(-100);
    expect(toLine(tx({ mission: null, requestId: null }), [], NOW, 7, 'fr').title).toBeNull();
  });
  it('groupByMonth : mois décroissants, net et missions distinctes', () => {
    const lines = [
      toLine(tx(), [], NOW, 7, 'fr'),
      toLine(tx({ id: 't2', requestId: 44, mission: { ...tx().mission, id: 44, completedAt: '2026-09-12T08:00:00Z' } }), [], NOW, 7, 'fr'),
      toLine(tx({ id: 't3', requestId: 30, mission: { ...tx().mission, id: 30, completedAt: '2026-08-02T08:00:00Z' } }), [], NOW, 7, 'fr'),
      toLine(tx({ id: 't4', type: 'DEBIT', amount: 545, requestId: 44, mission: { ...tx().mission, id: 44, completedAt: '2026-09-12T09:00:00Z' } }), [], NOW, 7, 'fr'),
    ];
    const g = groupByMonth(lines);
    expect(g.map((x) => x.key)).toEqual(['2026-09', '2026-08']);
    expect(g[0].net).toBe(24545 * 2 - 545);
    expect(g[0].missions).toBe(2);
    expect(g[0].lines[0].key).toBe('t1');
  });
  it('inTransit somme les crédits en route', () => {
    const lines = [toLine(tx(), [], NOW, 7, 'fr'), toLine(tx({ id: 't2', createdAt: '2026-09-01T00:00:00Z' }), [], NOW, 7, 'fr')];
    const t = inTransit(lines);
    expect(t.amount).toBe(24545); expect(t.missions).toBe(1); expect(t.arrivesAt).toBe(estimateArrival('2026-09-13T18:31:00Z', 7));
  });
  it('ledgerOf : trois lignes depuis la mission, taux dérivé sinon', () => {
    expect(ledgerOf(toLine(tx(), [], NOW, 7, 'fr'))).toEqual({ gross: 30681, commission: 6136, rate: 0.2, net: 24545 });
    const l = toLine(tx({ mission: { ...tx().mission, commissionRate: null } }), [], NOW, 7, 'fr');
    expect(ledgerOf(l).rate).toBe(0.2);
    expect(ledgerOf(toLine(tx({ mission: null }), [], NOW, 7, 'fr'))).toEqual({ gross: null, commission: null, rate: null, net: 24545 });
  });
});

describe('cityOf ignore le pays', () => {
  it('« Rue de Livourne 13, Saint-Gilles, Belgique » → Saint-Gilles', () => {
    expect(cityOf('Rue de Livourne 13, Saint-Gilles, Belgique')).toBe('Saint-Gilles');
    expect(cityOf('Rue Haute 12, 1000 Bruxelles, Belgium')).toBe('Bruxelles');
  });
});
