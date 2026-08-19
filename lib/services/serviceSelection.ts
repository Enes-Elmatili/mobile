/**
 * Décision « quel flow de paiement pour le service choisi ? » — extraite de
 * NewRequestStepper pour être testable sans monter React Native.
 *
 * ⚠️ Contrat à respecter : cette logique DOIT rester alignée sur le serveur
 * (`backend/routes/requests.js`), qui tranche ainsi :
 *
 *     const isFreeService = !isQuoteFlow && dbBasePrice !== null && dbBasePrice === 0;
 *
 * Le `!== null` est la clé. En base, `Category.price` est NULL pour les 10
 * catégories : seule une sous-catégorie porte un prix. Côté app, l'ancienne
 * expression collapsait ce NULL en 0 (`... || selectedCategory?.price || 0`),
 * donc une catégorie choisie SANS sous-catégorie passait pour un service
 * gratuit. Conséquence en production (rejet Apple 2.1(a) du 18/08/2026) :
 *
 *   1. étape 2 : on tape « Serrurerie », le CTA « Continuer » était actif
 *   2. isFreeService = true → l'étape 4 affiche « Service gratuit / Aucun
 *      paiement requis », aucune PaymentSheet n'est préparée
 *   3. POST /requests part avec price 0 et SANS pricingToken
 *   4. le serveur voit dbBasePrice = null → service payant → 400
 *      PRICING_TOKEN_REQUIRED
 *   5. l'app affiche « Impossible de préparer le paiement » et le CTA reste
 *      mort : impossible de réserver, « Réessayer » rejoue le même échec
 *
 * Règle : un prix INCONNU n'est jamais gratuit, et une catégorie sans prix
 * n'est pas réservable.
 */

export type PricedSubcategory = {
  id?: number;
  basePrice?: number | null;
  price?: number | null;
  pricingMode?: string | null;
  calloutFee?: number | null;
};

export type PricedCategory = {
  id?: number;
  price?: number | null;
  subcategories?: PricedSubcategory[] | null;
};

export type ServiceSelection = {
  /** Prix réellement déclaré en base — `null` si aucun (jamais collapsé en 0). */
  rawBasePrice: number | null;
  /** Variante numérique pour computePrice, qui attend un number. */
  basePrice: number;
  pricingMode: string;
  calloutFee: number;
  isQuoteFlow: boolean;
  /** Gratuit uniquement si la base CONFIRME un prix à 0. */
  isFreeService: boolean;
  /** La catégorie a des sous-catégories → en choisir une est obligatoire. */
  requiresSubcategory: boolean;
  /** Catégorie sans sous-catégorie, réservable seulement si elle porte un prix. */
  categoryBookableAlone: boolean;
  /** Le service est complètement choisi → l'étape 2 peut laisser passer. */
  serviceChosen: boolean;
  /** Catégorie ni déclinée ni tarifée → non réservable, à annoncer à l'écran. */
  categoryUnavailable: boolean;
};

const QUOTE_MODES = ['estimate', 'diagnostic'];

export function resolveServiceSelection(
  category: PricedCategory | null | undefined,
  subcategory: PricedSubcategory | null | undefined,
): ServiceSelection {
  // `??` et non `||` : un prix à 0 est une valeur légitime, pas une absence.
  const rawBasePrice =
    subcategory?.basePrice ?? subcategory?.price ?? category?.price ?? null;

  const pricingMode = subcategory?.pricingMode || 'fixed_forfait';
  const calloutFee = subcategory?.calloutFee || 0;
  const isQuoteFlow = QUOTE_MODES.includes(pricingMode);

  const isFreeService =
    pricingMode === 'free' || (rawBasePrice === 0 && !isQuoteFlow);

  const requiresSubcategory = (category?.subcategories?.length ?? 0) > 0;
  const categoryBookableAlone = !requiresSubcategory && category?.price != null;

  const serviceChosen =
    !!category && (!!subcategory || categoryBookableAlone);

  const categoryUnavailable =
    !!category && !requiresSubcategory && !categoryBookableAlone;

  return {
    rawBasePrice,
    basePrice: rawBasePrice ?? 0,
    pricingMode,
    calloutFee,
    isQuoteFlow,
    isFreeService,
    requiresSubcategory,
    categoryBookableAlone,
    serviceChosen,
    categoryUnavailable,
  };
}
