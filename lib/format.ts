// Centralized currency / number formatting (FR-BE marketplace).
// Always use these helpers — never inline toLocaleString or toFixed for money.

const LOCALE = 'fr-FR';
const NBSP = ' ';

/** Formats a number of euros as "1 234,50 €". */
export function formatEUR(amount: number, decimals: number = 2): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + NBSP + '€';
}

/** Formats a number of cents as "1 234,50 €". */
export function formatEURCents(cents: number, decimals: number = 2): string {
  return formatEUR((cents || 0) / 100, decimals);
}

/** Formats a number of euros as "1 234 €" (no decimals, for KPIs / totals). */
export function formatEURInt(amount: number): string {
  return formatEUR(amount, 0);
}

/** Heure locale « 14:32 » depuis une date ou une chaîne ISO ; '' si invalide. */
export function formatClock(value: string | number | Date | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

const LANG_LOCALE: Record<string, string> = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' };
const localeFor = (lang?: string) => LANG_LOCALE[(lang || 'fr').split('-')[0]] ?? 'fr-BE';

/** « sam. 13 sept. » dans la langue de l'app. */
export function formatDay(value: string | number | Date | null | undefined, lang?: string): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(localeFor(lang), { weekday: 'short', day: 'numeric', month: 'short' });
}

/** « jeu. 18 » — le jour court pour une date d'arrivée. */
export function formatDayShort(value: string | number | Date | null | undefined, lang?: string): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(localeFor(lang), { weekday: 'short', day: 'numeric' });
}

/** « septembre 2026 » / « septembre » si c'est l'année en cours. */
export function formatMonth(year: number, month: number, lang?: string, now: Date = new Date()): string {
  const d = new Date(year, month, 1);
  const withYear = year !== now.getFullYear();
  return d.toLocaleDateString(localeFor(lang), withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
}
