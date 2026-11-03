// lib/request/pricing.ts
// Montants affichés par le stepper de commande (étape 4) : TVA du service,
// remise promo, HT, paramètres de prix passés à l'écran suivant. Pur : testé
// dans __tests__/stepperPricing.test.js.
import { formatEUR, formatEURCents } from '@/lib/format';
import type { AppliedPromo, PriceDetails, StepperCategory, StepperSubcategory } from './stepperTypes';

export const stripEuro = (s: string) => String(s ?? '').replace(/\s*€\s*$/, '').trim();

/** HT affiché = TTC − TVA (le mockup : 182,70 − 8,70 = 174,00). */
export function htEuros(dp: PriceDetails | null | undefined): string {
  const c = dp?.cents;
  if (c && Number.isFinite(c.totalTVAC) && Number.isFinite(c.vat)) {
    return formatEURCents(c.totalTVAC - c.vat);
  }
  const num = (x: string | number | null | undefined) => parseFloat(String(x ?? '0').replace(/\s/g, '').replace(',', '.')) || 0;
  return formatEUR(Math.max(0, num(dp?.totalTVAC) - num(dp?.vat)));
}

/** Montant « 182,70 » → 182.7 (0 si illisible) — valeur que compte AmountCardB. */
export function parseEuroAmount(euros: string): number {
  const n = parseFloat(String(euros).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Delta affiché un instant au-dessus du montant : « + 12,50 € » / « − 3,00 € ». */
export function formatPriceDelta(delta: number): string {
  return `${delta > 0 ? '+' : '−'} ${Math.abs(delta).toFixed(2).replace('.', ',')} €`;
}

// ── TVA service : 6% rénovation (logement >=10 ans + usage privé) sinon 21% ──
// privateUse dérivé du type de bâtiment (bureau = usage pro → 21%).
// vatEligible : la serrurerie / le dépannage non immobilier reste à 21%.
export function resolveServiceVat(input: {
  category: Pick<StepperCategory, 'slug'> | null | undefined;
  subcategory: Pick<StepperSubcategory, 'isImmovableWork'> | null | undefined;
  buildingType: string | null;
  buildingOver10y: boolean;
}): { vatEligible: boolean; privateUse: boolean; vatRate: number } {
  const { category, subcategory, buildingType, buildingOver10y } = input;
  const vatEligible = String(category?.slug || '').toLowerCase() !== 'serrurerie'
    && (subcategory?.isImmovableWork !== false);
  const privateUse  = buildingType !== 'office';
  const vatRate     = (vatEligible && buildingOver10y && privateUse) ? 0.06 : 0.21;
  return { vatEligible, privateUse, vatRate };
}

// ── Montants remisés (offre de lancement, mode fixe) ──
// Source de vérité = appliedPromo (validé serveur). Fallbacks défensifs.
export function fixedAmountsCents(displayTotal: number, appliedPromo: AppliedPromo | null): {
  nominalCents: number;
  discountedCents: number;
} {
  const nominalCents = appliedPromo?.nominalCents ?? Math.round(displayTotal * 100);
  const discountedCents = appliedPromo
    ? Math.max(0, nominalCents - appliedPromo.discountCents)
    : nominalCents;
  return { nominalCents, discountedCents };
}

/** Montant du callout (flow devis) sans le « € » : confirmé serveur, sinon celui de la sous-catégorie. */
export function calloutEuros(confirmedCalloutCents: number | null, calloutFee: number): string {
  return stripEuro(confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : formatEUR(calloutFee));
}

/** Montant à droite du CTA de l'étape 4 (aucun pour un service gratuit). */
export function ctaAmount(input: {
  isFreeService: boolean;
  isQuoteFlow: boolean;
  confirmedCalloutCents: number | null;
  calloutFee: number;
  discountedCents: number;
}): string | undefined {
  const { isFreeService, isQuoteFlow, confirmedCalloutCents, calloutFee, discountedCents } = input;
  return isFreeService
    ? undefined
    : isQuoteFlow
      ? (confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : calloutFee > 0 ? formatEUR(calloutFee) : undefined)
      : formatEURCents(discountedCents);
}

// Montant réellement débité : prix serveur verrouillé, remise promo déduite
// (jamais l'estimation client — sinon l'écran suivant affiche un faux prix).
// Pour un devis, le client n'a payé QUE le callout fee — pas le prix total.
export function chargedParams(input: {
  isQuoteFlow: boolean;
  discountedCents: number;
  confirmedCalloutCents: number | null;
}): { price: string; calloutFee: string } {
  const { isQuoteFlow, discountedCents, confirmedCalloutCents } = input;
  const price = isQuoteFlow ? '' : (discountedCents / 100).toFixed(2);
  const calloutFee = isQuoteFlow && confirmedCalloutCents != null
    ? (confirmedCalloutCents / 100).toFixed(2)
    : '';
  return { price, calloutFee };
}
