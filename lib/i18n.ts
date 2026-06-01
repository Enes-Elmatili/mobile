/**
 * lib/i18n.ts — Initialisation de react-i18next
 *
 * - Détecte la langue du device via expo-localization
 * - Mappe vers fr / en (les seules locales bundlées actuellement)
 * - Fallback sur 'fr' si la langue du device n'est pas supportée
 * - Import side-effect dans app/_layout.tsx : import '@/lib/i18n'
 *
 * NL : pas encore traduit. Les devices NL retombent sur 'fr' (marché beta belge,
 * fr plus probable que en pour Ixelles). À étendre quand locales/nl.json sera fait.
 *
 * Usage dans les composants :
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <Text>{t('profile.title')}</Text>
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import fr from '../locales/fr.json';
import en from '../locales/en.json';

const SUPPORTED = ['fr', 'en'] as const;
type Supported = typeof SUPPORTED[number];

function pickDeviceLanguage(): Supported {
  try {
    const locales = Localization.getLocales();
    for (const loc of locales) {
      const code = (loc.languageCode || '').toLowerCase();
      if (code === 'fr' || code === 'en') return code;
      if (code === 'nl') return 'fr'; // marché belge, fr > en pour beta Ixelles
    }
  } catch {
    // ignore — fallback ci-dessous
  }
  return 'fr';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: pickDeviceLanguage(),
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React Native échappe déjà
    },
    compatibilityJSON: 'v4', // Requis pour React Native (pas de Intl.PluralRules complet)
  });

export default i18n;
