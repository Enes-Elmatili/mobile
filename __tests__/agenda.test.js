// L'onglet Missions comme agenda : semaine, maintenant, fil du jour, mois (lib/agenda/model.ts).
const { weeksAround, currentOf, dayTimeline, tripPairs, monthGroups, badgeCount, dayKey, startOfWeek, quoteStateOf } = require('@/lib/agenda/model');

const brief = (net, mode = 'fixed') => ({ money: { gross: net / 0.8, net, calloutFee: null, pricingMode: mode }, service: { pricingMode: mode }, photos: [], place: {}, client: null });
const T = (h, m = 0, dayOffset = 0) => { const d = new Date(2026, 8, 16, h, m, 0, 0); d.setDate(d.getDate() + dayOffset); return d.getTime(); };
const item = (id, status, at, net = 100, extra = {}) => ({ id: String(id), status, at, durationMin: 60, lat: 50.8, lng: 4.35, brief: brief(net, extra.mode), ...extra });
const now = T(14, 32);

describe('la semaine', () => {
  it('commence le lundi, marque aujourd’hui, compte les missions et signale un devis', () => {
    const items = [item(1, 'DONE', T(9)), item(2, 'ACCEPTED', T(14)), item(3, 'PUBLISHED', T(17)), item(4, 'ACCEPTED', T(10, 30, 1), 0, { mode: 'diagnostic' })];
    const weeks = weeksAround(now, items, 1, 1);
    expect(weeks).toHaveLength(3);
    const week = weeks[1];
    expect(new Date(week.start).getDay()).toBe(1);
    expect(week.days.map((d) => d.dayOfMonth)).toEqual([14, 15, 16, 17, 18, 19, 20]);
    const wed = week.days[2];
    expect(wed.isToday).toBe(true);
    expect(wed.count).toBe(2); // la mission faite (DONE) n'est pas un point
    expect(week.days[3].quote).toBe(true);
    expect(startOfWeek(now)).toBe(week.start);
  });
});

describe('maintenant', () => {
  it('la mission active, pas celle planifiée dans plus de 30 min', () => {
    expect(currentOf([item(1, 'ACCEPTED', T(17))], now)).toBeNull();
    expect(currentOf([item(1, 'ACCEPTED', T(14, 50))], now).id).toBe('1');
    expect(currentOf([item(1, 'ONGOING', T(9))], now).id).toBe('1');
    expect(currentOf([item(1, 'DONE', T(9))], now)).toBeNull();
  });
});

describe('le fil du jour', () => {
  const items = [item(1, 'DONE', T(9), 186), item(2, 'ACCEPTED', T(14), 239), item(3, 'PUBLISHED', T(17), 119), item(9, 'DONE', T(9, 0, 1), 50)];
  it('missions à l’heure, trajet puis creux entre deux, libre à la fin, net du jour', () => {
    const current = currentOf(items, now);
    const { rows, net, count } = dayTimeline(items, dayKey(now), { '1>2': 18 }, current);
    expect(count).toBe(3);
    expect(net).toBe(186 + 239 + 119);
    expect(rows.map((r) => r.kind)).toEqual(['mission', 'trip', 'gap', 'mission', 'gap', 'mission', 'free']);
    expect(rows[0]).toMatchObject({ done: true, net: 186 });
    expect(rows[1]).toEqual({ kind: 'trip', minutes: 18 });
    expect(rows[2].untilMs).toBe(T(14));
    expect(rows[3].isCurrent).toBe(true);
  });
  it('pas de creux sous 20 min, ni de « libre » si la dernière est en cours', () => {
    const tight = [item(1, 'ACCEPTED', T(14), 100), item(2, 'ACCEPTED', T(15, 10), 100)];
    const { rows } = dayTimeline(tight, dayKey(now), {}, tight[0]);
    expect(rows.map((r) => r.kind)).toEqual(['mission', 'mission', 'free']);
    const { rows: r2 } = dayTimeline([tight[1]], dayKey(now), {}, tight[1]);
    expect(r2.map((r) => r.kind)).toEqual(['mission']);
  });
  it('les annulées ne sont pas dans le fil ; une journée vide n’a pas de lignes', () => {
    expect(dayTimeline([item(1, 'CANCELLED', T(10))], dayKey(now)).rows).toEqual([]);
  });
  it('les paires à calculer ont des coordonnées des deux côtés', () => {
    const pairs = tripPairs(items, dayKey(now));
    expect(pairs.map((p) => p.key)).toEqual(['1>2', '2>3']);
    expect(tripPairs([item(1, 'ACCEPTED', T(9), 1, { lat: null }), item(2, 'ACCEPTED', T(11))], dayKey(now))).toEqual([]);
  });
});

describe('passées, par mois', () => {
  it('du plus récent, compte, net des faites seulement, lignes du plus récent', () => {
    const items = [item(1, 'DONE', T(9, 0, -1), 186), item(2, 'CANCELLED', T(9, 0, -2), 119), item(3, 'DONE', T(9, 0, -40), 239), item(4, 'ACCEPTED', T(17), 1)];
    const g = monthGroups(items);
    expect(g.map((x) => x.key)).toEqual(['2026-09', '2026-08']);
    expect(g[0]).toMatchObject({ count: 2, net: 186 });
    expect(g[0].items.map((i) => i.id)).toEqual(['1', '2']);
    expect(g[1]).toMatchObject({ count: 1, net: 239 });
  });
});

describe('le devis, côté prestataire', () => {
  it('à rédiger = mode devis + acceptée ou démarrée ; envoyé = QUOTE_SENT ; accepté = QUOTE_ACCEPTED ; jamais QUOTE_PENDING', () => {
    expect(quoteStateOf(item(1, 'ACCEPTED', T(10), 0, { mode: 'estimate' }))).toBe('todo');
    expect(quoteStateOf(item(1, 'ONGOING', T(10), 0, { mode: 'diagnostic' }))).toBe('todo');
    expect(quoteStateOf(item(1, 'QUOTE_SENT', T(10), 0, { mode: 'estimate' }))).toBe('sent');
    expect(quoteStateOf(item(1, 'QUOTE_ACCEPTED', T(10), 120, { mode: 'estimate' }))).toBe('accepted');
    expect(quoteStateOf(item(1, 'ACCEPTED', T(10), 120))).toBe('none');
    expect(quoteStateOf(item(1, 'DONE', T(10), 0, { mode: 'estimate' }))).toBe('none');
  });
  it('le fil marque le devis, les refusés/expirés vont dans les passées', () => {
    const items = [item(1, 'ONGOING', T(10), 0, { mode: 'estimate' }), item(2, 'QUOTE_REFUSED', T(9, 0, -1), 80, { mode: 'estimate' }), item(3, 'QUOTE_EXPIRED', T(9, 0, -2), 0, { mode: 'estimate' })];
    const { rows } = dayTimeline(items, dayKey(now), {}, items[0]);
    expect(rows[0]).toMatchObject({ kind: 'mission', quote: 'todo' });
    const g = monthGroups(items);
    expect(g[0]).toMatchObject({ count: 2, net: 0 });
  });
});

describe('le badge', () => {
  it('compte ce qui attend une action : à prendre + devis à rédiger', () => {
    expect(badgeCount([item(1, 'ONGOING', T(10), 0, { mode: 'estimate' }), item(2, 'ACCEPTED', T(11))], 2)).toBe(3);
  });
});
