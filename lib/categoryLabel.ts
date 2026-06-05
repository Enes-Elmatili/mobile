/**
 * lib/categoryLabel.ts — Traduction des noms de catégorie/sous-catégorie.
 *
 * Les catégories sont stockées en DB côté backend avec `name` (FR) + `slug`
 * (kebab-case stable). Pour afficher dans la langue de l'utilisateur, on
 * mappe le slug vers une clé i18n `category.<slug>`. Fallback sur `name`
 * si la clé n'existe pas (cas d'une nouvelle catégorie ajoutée en DB avant
 * que les traductions soient livrées).
 *
 * Usage :
 *   import { translateCategory } from '@/lib/categoryLabel';
 *   const { t } = useTranslation();
 *   <Text>{translateCategory(t, request.category)}</Text>
 *
 * ou directement depuis i18n sans hook (utilitaires non-React) :
 *   import i18n from '@/lib/i18n';
 *   import { translateCategoryRaw } from '@/lib/categoryLabel';
 *   const label = translateCategoryRaw(category);
 */
import type { TFunction } from 'i18next';
import i18nInstance from './i18n';

type CategoryLike =
  | { name?: string | null; slug?: string | null }
  | null
  | undefined;

/**
 * Avec `t` du hook useTranslation — version recommandée dans les composants.
 */
export function translateCategory(t: TFunction, cat: CategoryLike): string {
  if (!cat) return '';
  const slug = (cat.slug || '').toLowerCase().trim();
  const fallback = cat.name || '';
  if (!slug) return fallback;
  // defaultValue garantit que si `category.<slug>` n'existe pas dans la locale
  // active, on retombe sur le nom DB plutôt que d'afficher la clé brute.
  return t(`category.${slug}`, { defaultValue: fallback });
}

/**
 * Sans hook React — pour les fonctions utilitaires (formatters, scripts).
 */
export function translateCategoryRaw(cat: CategoryLike): string {
  if (!cat) return '';
  const slug = (cat.slug || '').toLowerCase().trim();
  const fallback = cat.name || '';
  if (!slug) return fallback;
  return i18nInstance.t(`category.${slug}`, { defaultValue: fallback });
}

// ── Subcategories ───────────────────────────────────────────────────────────
// Côté backend, Subcategory possède un champ `nameI18n: { fr, nl, en }` déjà
// rempli dans le seed (cf. backend/prisma/seed.js). Mobile peut donc afficher
// directement la bonne traduction sans table de mapping locale.
//
// Fallback chain : nameI18n[lang] → nameI18n.fr → name (legacy DB row sans i18n)

type SubcategoryLike =
  | {
      name?: string | null;
      nameI18n?: Record<string, string | null> | null;
    }
  | null
  | undefined;

export function translateSubcategory(
  lang: string,
  sub: SubcategoryLike,
): string {
  if (!sub) return '';
  const fallback = sub.name || '';
  const i18nMap = sub.nameI18n;
  if (!i18nMap || typeof i18nMap !== 'object') return fallback;
  const langKey = (lang || 'fr').split('-')[0].toLowerCase();
  return i18nMap[langKey] || i18nMap.fr || fallback;
}

/**
 * Wrapper qui lit la langue active depuis i18n directement.
 */
export function translateSubcategoryRaw(sub: SubcategoryLike): string {
  return translateSubcategory(i18nInstance.language, sub);
}

// ── Requests ────────────────────────────────────────────────────────────────
// Le nom de service à afficher sur un Request : préfère la sous-catégorie
// liée (si chargée via include + nameI18n), sinon retombe sur serviceType qui
// est la string snapshot stockée à la création (toujours en FR).

type RequestLike =
  | {
      serviceType?: string | null;
      title?: string | null;
      subcategory?: SubcategoryLike;
    }
  | null
  | undefined;

export function translateRequestService(
  lang: string,
  request: RequestLike,
): string {
  if (!request) return '';
  if (request.subcategory) {
    const translated = translateSubcategory(lang, request.subcategory);
    if (translated) return translated;
  }
  return request.title || request.serviceType || '';
}

export function translateRequestServiceRaw(request: RequestLike): string {
  return translateRequestService(i18nInstance.language, request);
}
