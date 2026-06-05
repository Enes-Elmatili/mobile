/**
 * lib/i18n.ts — Initialisation de react-i18next
 *
 * Langues supportées : fr, nl, en (cf. landing trilingue).
 * Détection device via expo-localization :
 *   - fr (fr-FR, fr-BE, fr-CA…) → fr
 *   - nl (nl-NL, nl-BE)         → nl
 *   - autre / non détectable     → en (fallback international)
 *
 * Import side-effect dans app/_layout.tsx : import '@/lib/i18n'
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
import nl from '../locales/nl.json';
import en from '../locales/en.json';

const SUPPORTED = ['fr', 'nl', 'en'] as const;
type Supported = typeof SUPPORTED[number];

function pickDeviceLanguage(): Supported {
  try {
    const locales = Localization.getLocales();
    for (const loc of locales) {
      const code = (loc.languageCode || '').toLowerCase();
      if (code === 'fr' || code === 'nl' || code === 'en') return code;
    }
  } catch {
    // ignore — fallback ci-dessous
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      nl: { translation: nl },
      en: { translation: en },
    },
    lng: pickDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React Native échappe déjà
    },
    compatibilityJSON: 'v4', // Requis pour React Native (pas de Intl.PluralRules complet)
  });

export default i18n;
