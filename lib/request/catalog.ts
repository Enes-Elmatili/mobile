// lib/request/catalog.ts
// Catalogue et adresses enregistrées du stepper de commande : filtrage des
// catégories ouvertes, catégorie initiale du rail, icônes. Pur : testé dans
// __tests__/stepperCatalog.test.js.
import type { SavedAddress, StepperCategory, StepperLocation } from './stepperTypes';

export function extractArrayPayload<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const data = (response as { data?: unknown } | null | undefined)?.data;
  if (data && Array.isArray(data)) return data as T[];
  return [];
}

// Catalogue actuel — seulement Plomberie et Serrurerie
const LAUNCH_SLUGS = ['plomberie', 'serrurerie'];
const LAUNCH_NAMES = ['plomberie', 'serrurerie'];

/** Catégories ouvertes au lancement ; tout le catalogue si aucune ne correspond. */
export function filterLaunchCategories(all: StepperCategory[]): StepperCategory[] {
  const filtered = all.filter((c) => {
    const slug = c.slug?.toLowerCase();
    return (slug !== undefined && LAUNCH_SLUGS.includes(slug)) ||
      LAUNCH_NAMES.some(n => c.name?.toLowerCase().includes(n));
  });
  return filtered.length > 0 ? filtered : all;
}

// Le rail est toujours posé sur une catégorie : celle demandée par le
// paramètre `selectedCategory` (CTA « Demander » depuis une fiche), sinon la première.
export function pickInitialCategory(categories: StepperCategory[], preselected: string | undefined): StepperCategory {
  const wanted = preselected?.toLowerCase();
  const match = wanted
    ? categories.find((c) => c.name?.toLowerCase().includes(wanted) || c.slug?.toLowerCase() === wanted)
    : null;
  return match ?? categories[0];
}

// Local Ionicons→Feather icon name bridge. Used to translate legacy category
// icon names returned by toIoniconName() into Feather glyphs without touching
// the shared mapper. Keys here are Ionicons names; values are Feather names.
const IONICON_TO_FEATHER: Record<string, string> = {
  'construct-outline':       'tool',
  'hammer-outline':          'tool',
  'settings-outline':        'settings',
  'build-outline':           'tool',
  'sparkles-outline':        'star',
  'basket-outline':          'shopping-basket',
  'water-outline':           'droplet',
  'flask-outline':           'droplet',
  'alert-circle-outline':    'alert-circle',
  'warning-outline':         'alert-triangle',
  'help-circle-outline':     'help-circle',
  'radio-button-on-outline': 'radio',
  'home-outline':            'home',
  'enter-outline':           'log-in',
  'apps-outline':            'grid',
  'bed-outline':             'home',
  'bulb-outline':            'zap',
  'flash-outline':           'zap',
  'hardware-chip-outline':   'cpu',
  'leaf-outline':            'feather',
  'cut-outline':             'scissors',
  'cube-outline':            'package',
  'car-outline':             'truck',
  'barbell-outline':         'activity',
  'color-palette-outline':   'edit-2',
  'brush-outline':           'edit-2',
  'laptop-outline':          'monitor',
  'phone-portrait-outline':  'smartphone',
  'desktop-outline':         'monitor',
  'camera-outline':          'camera',
  'paw-outline':             'github',
  'restaurant-outline':      'coffee',
  'people-outline':          'users',
  'medkit-outline':          'plus-square',
  'key-outline':             'key',
  'thermometer-outline':     'thermometer',
  'time-outline':             'clock',
  'checkmark-circle-outline': 'check-circle',
  'location-outline':         'map-pin',
  'checkmark':                'check',
};

export const toFeatherName = (name: string | undefined | null, fallback = 'tool'): string => {
  if (!name) return fallback;
  return IONICON_TO_FEATHER[name] || fallback;
};

/** Icône d'une adresse enregistrée, devinée depuis son libellé (FR/EN). */
export function savedAddressIcon(label: string | null | undefined): 'home' | 'briefcase' | 'map-pin' {
  const lbl = (label || '').toLowerCase();
  return lbl.includes('domicile') || lbl.includes('home') || lbl.includes('maison')
    ? 'home' : lbl.includes('bureau') || lbl.includes('office') || lbl.includes('travail')
    ? 'briefcase' : 'map-pin';
}

/** Le « + » d'enregistrement : adresse choisie, pas déjà enregistrée, 10 au plus. */
export function canSaveAddress(saved: SavedAddress[], location: StepperLocation | null): boolean {
  return !!location && saved.length < 10 && !saved.some((a) => a.address === location.address);
}
