// Formatage des montants et dates (lib/format.ts) : tous les euros de l'app
// passent par ici. Un centime perdu ou un « NaN € » à l'écran se voit tout de
// suite chez un client qui paie — on fige les cas limites.
import {
  formatEUR, formatEURCents, formatEURInt, formatClock, localeFor, formatDay, formatDayShort, formatMonth,
} from '../format';

// ICU sépare les milliers par une espace fine insécable (U+202F) et place une
// espace insécable (U+00A0) avant « € » : on normalise pour lire les attendus.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatEUR', () => {
  it('« 1 234,50 € » : virgule décimale, milliers groupés, € après une insécable', () => {
    const out = formatEUR(1234.5);
    expect(plain(out)).toBe('1 234,50 €');
    expect(out.endsWith(' €')).toBe(true);
  });

  it('négatifs : signe conservé (remboursement, débit)', () => {
    expect(plain(formatEUR(-12.5))).toBe('-12,50 €');
    expect(plain(formatEUR(-1234))).toBe('-1 234,00 €');
  });

  it('arrondi au centime, demi vers le haut', () => {
    expect(plain(formatEUR(0.005))).toBe('0,01 €');
    expect(plain(formatEUR(19.994))).toBe('19,99 €');
    expect(plain(formatEUR(1234567.891))).toBe('1 234 567,89 €');
  });

  it('décimales choisies', () => {
    expect(plain(formatEUR(12, 0))).toBe('12 €');
    expect(plain(formatEUR(12.3456, 3))).toBe('12,346 €');
  });

  it('valeurs non finies ou absentes → 0,00 € (jamais « NaN € »)', () => {
    for (const v of [NaN, Infinity, -Infinity, null, undefined, '12' as any]) {
      expect(plain(formatEUR(v as any))).toBe('0,00 €');
    }
  });
});

describe('formatEURCents', () => {
  it('centimes → euros', () => {
    expect(plain(formatEURCents(1999))).toBe('19,99 €');
    expect(plain(formatEURCents(123456))).toBe('1 234,56 €');
    expect(plain(formatEURCents(1))).toBe('0,01 €');
  });

  it('négatifs (remboursement)', () => {
    expect(plain(formatEURCents(-2500))).toBe('-25,00 €');
  });

  it('null / undefined / NaN / -0 → 0,00 €', () => {
    expect(plain(formatEURCents(null as any))).toBe('0,00 €');
    expect(plain(formatEURCents(undefined as any))).toBe('0,00 €');
    expect(plain(formatEURCents(NaN))).toBe('0,00 €');
    expect(plain(formatEURCents(-0))).toBe('0,00 €');
  });

  it('sans décimales : arrondi à l’euro, demi vers le haut', () => {
    expect(plain(formatEURCents(12349, 0))).toBe('123 €');
    expect(plain(formatEURCents(12350, 0))).toBe('124 €');
  });
});

describe('formatEURInt', () => {
  it('KPI sans décimales', () => {
    expect(plain(formatEURInt(1234.4))).toBe('1 234 €');
    expect(plain(formatEURInt(0))).toBe('0 €');
  });
});

describe('localeFor', () => {
  it('Belgique d’abord, polonais en pl-PL, défaut fr-BE', () => {
    expect(localeFor('fr')).toBe('fr-BE');
    expect(localeFor('nl')).toBe('nl-BE');
    expect(localeFor('en')).toBe('en-GB');
    expect(localeFor('pl')).toBe('pl-PL');
    expect(localeFor('en-US')).toBe('en-GB');
    expect(localeFor('NL-be')).toBe('nl-BE');
    expect(localeFor('de')).toBe('fr-BE');
    expect(localeFor(null)).toBe('fr-BE');
    expect(localeFor(undefined)).toBe('fr-BE');
    expect(localeFor('')).toBe('fr-BE');
  });
});

describe('dates', () => {
  it('formatClock : « HH:MM » sur 24 h, vide si invalide', () => {
    const d = new Date(2026, 8, 13, 14, 32);
    expect(formatClock(d)).toBe('14:32');
    expect(formatClock(d.getTime())).toBe('14:32');
    expect(formatClock(d.toISOString())).toBe('14:32');
    expect(formatClock(null)).toBe('');
    expect(formatClock(undefined)).toBe('');
    expect(formatClock('nimporte')).toBe('');
  });

  it('formatDay / formatDayShort : jour court dans la langue, vide si invalide', () => {
    const d = new Date(2026, 8, 13, 12, 0); // dimanche 13 septembre 2026
    expect(formatDay(d, 'fr')).toBe(d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' }));
    expect(formatDay(d, 'fr')).toMatch(/13/);
    expect(formatDay(d, 'pl')).toBe(d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }));
    expect(formatDayShort(d, 'en')).toBe(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
    expect(formatDay(null)).toBe('');
    expect(formatDay('x')).toBe('');
    expect(formatDayShort(undefined)).toBe('');
    expect(formatDayShort('x')).toBe('');
  });

  it('formatMonth : l’année seulement si ce n’est pas l’année en cours', () => {
    const now = new Date(2026, 5, 1);
    expect(formatMonth(2026, 8, 'fr', now)).toBe('septembre');
    expect(formatMonth(2025, 8, 'fr', now)).toBe('septembre 2025');
  });
});
