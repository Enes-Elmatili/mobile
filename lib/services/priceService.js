/* eslint-disable no-magic-numbers */

/**
 * Jours fériés BE (fixes + mobiles via Pâques)
 * ------------------------------------------------
 */

export function isHoliday(date) {
  const year = date.getFullYear()

  // 🔹 Jours fériés fixes
  const fixedHolidays = [
    `${year}-01-01`, // Jour de l'An
    `${year}-05-01`, // Fête du Travail
    `${year}-07-21`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ]

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const formatted = `${y}-${m}-${d}`

  if (fixedHolidays.includes(formatted)) return true

  // 🔹 Jours fériés mobiles (calcul depuis Pâques)
  const easter = getEasterDate(year)
  const ascension = addDays(easter, 39)
  const pentecote = addDays(easter, 49)
  const lundiPaques = addDays(easter, 1)
  const lundiPentecote = addDays(easter, 50)

  const mobileHolidays = [easter, ascension, pentecote, lundiPaques, lundiPentecote]
  return mobileHolidays.some((h) => h.toDateString() === date.toDateString())
}

/** Algorithme de Meeus/Jones/Butcher pour Pâques */
function getEasterDate(year) {
  const f = Math.floor
  const a = year % 19
  const b = f(year / 100)
  const c = year % 100
  const d = f(b / 4)
  const e = b % 4
  const g = f((8 * b + 13) / 25)
  const h = (19 * a + b - d - g + 15) % 30
  const i = f(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = f((a + 11 * h + 22 * l) / 451)
  const month = f((h + l - 7 * m + 114) / 31)
  const day = 1 + ((h + l - 7 * m + 114) % 31)
  return new Date(year, month - 1, day)
}

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/**
 * Constantes tarifaires (adapter à ton métier)
 * ------------------------------------------------
 */
export const PRICING = {
  VAT: 0.21,
  PLATFORM_FEE: 0.25,
  STRIPE_PCT: 0.015,
  STRIPE_FIXED_CENTS: 25, // 0.25 €
  KM_INCLUDED: 10, // km inclus
  KM_RATE_CENTS: 60, // 0.60 € / km
  // Multiplicateurs
  MULT_EVENING: 1.3, // ≥ 18:00 et < 23:00
  MULT_NIGHT: 2.0, // ≥ 23:00 ou < 07:00
  MULT_SATURDAY: 1.3,
  MULT_SUNDAY_OR_HOLIDAY: 1.5,
}

/**
 * Helpers arrondis en cents
 */
function toCents(euros) {
  return Math.round(Number(euros) * 100)
}
function centsToEuros(cents) {
  return cents / 100
}
function fmtEuros(cents) {
  return centsToEuros(cents).toFixed(2)
}
function mulPctCents(baseCents, pct) {
  return Math.round(Number(baseCents) * Number(pct))
}

/**
 * Calcule un prix INDICATIF côté client (affichage uniquement).
 * Le serveur reste la source de vérité au checkout.
 */
export function computePrice({
  baseRate,     // €/h (VENANT DU SERVEUR, pas hardcodé localement)
  hours = 1,
  isUrgent = false,
  distanceKm = 0,
  requestDate,
  isFlat = false,
  flatAmount = 0, // € si isFlat
}) {
  const {
    VAT,
    PLATFORM_FEE,
    STRIPE_PCT,
    STRIPE_FIXED_CENTS,
    KM_INCLUDED,
    KM_RATE_CENTS,
    MULT_EVENING,
    MULT_NIGHT,
    MULT_SATURDAY,
    MULT_SUNDAY_OR_HOLIDAY,
  } = PRICING

  const date = requestDate instanceof Date ? requestDate : new Date(requestDate)
  const day = date.getDay() // 0 = dimanche, 6 = samedi
  const hour = date.getHours()

  // Multiplicateurs horaires & jours
  let multiplier = 1
  if (hour >= 18 && hour < 23) multiplier *= MULT_EVENING
  if (hour >= 23 || hour < 7) multiplier *= MULT_NIGHT
  if (day === 6) multiplier *= MULT_SATURDAY
  if (day === 0 || isHoliday(date)) multiplier *= MULT_SUNDAY_OR_HOLIDAY

  // Base HTVA en cents
  const baseHTVA_cents = isFlat
    ? toCents(flatAmount || 0)
    : toCents(Number(baseRate || 0) * Number(hours || 0))

  // Base ajustée
  const adjustedBase_cents = Math.round(baseHTVA_cents * multiplier)

  // Urgence (50% de la base ajustée)
  const urgentFee_cents = isUrgent ? mulPctCents(adjustedBase_cents, 0.5) : 0

  // Déplacement (10 km inclus)
  const extraKm = Math.max(0, Number(distanceKm || 0) - KM_INCLUDED)
  const travelFee_cents = Math.max(0, Math.round(extraKm * KM_RATE_CENTS))

  // Sous-total HTVA
  const subtotalHTVA_cents = adjustedBase_cents + urgentFee_cents + travelFee_cents

  // Frais plateforme (25% HTVA)
  const platformFee_cents = mulPctCents(subtotalHTVA_cents, PLATFORM_FEE)

  // Total HTVA
  const totalHTVA_cents = subtotalHTVA_cents + platformFee_cents

  // TVA
  const vat_cents = mulPctCents(totalHTVA_cents, VAT)

  // Total TVAC (encaissé)
  const totalTVAC_cents = totalHTVA_cents + vat_cents

  // Frais Stripe (sur TVAC)
  const stripePct_cents = mulPctCents(totalTVAC_cents, STRIPE_PCT)
  const stripeFee_cents = stripePct_cents + STRIPE_FIXED_CENTS

  // Total final (TVAC + Stripe)
  const finalTotal_cents = totalTVAC_cents + stripeFee_cents

  return {
    cents: {
      baseHTVA: baseHTVA_cents,
      adjustedBase: adjustedBase_cents,
      urgentFee: urgentFee_cents,
      travelFee: travelFee_cents,
      platformFee: platformFee_cents,
      totalHTVA: totalHTVA_cents,
      vat: vat_cents,
      totalTVAC: totalTVAC_cents,
      stripeFee: stripeFee_cents,
      finalTotal: finalTotal_cents,
    },
    // Affichage
    baseHTVA: fmtEuros(baseHTVA_cents),
    multiplier,
    adjustedBase: fmtEuros(adjustedBase_cents),
    urgentFee: fmtEuros(urgentFee_cents),
    travelFee: fmtEuros(travelFee_cents),
    platformFee: fmtEuros(platformFee_cents),
    totalHTVA: fmtEuros(totalHTVA_cents),
    totalTVAC: fmtEuros(totalTVAC_cents),
    stripeFee: fmtEuros(stripeFee_cents),
    finalTotal: fmtEuros(finalTotal_cents),
  }
}

// Deprecated in favor of @fixed/core. Kept to avoid breaking old imports.
export default { computePrice, isHoliday, PRICING }
