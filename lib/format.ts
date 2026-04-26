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
