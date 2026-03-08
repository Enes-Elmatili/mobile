/**
 * lib/i18n.ts — Initialisation de react-i18next
 *
 * - Détecte la langue du device via expo-localization
 * - Fallback sur 'fr' si la langue n'est pas supportée
 * - Import side-effect dans app/_layout.tsx : import '@/lib/i18n'
 *
 * Usage dans les composants :
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <Text>{t('profile.title')}</Text>
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from '../locales/fr.json';
import en from '../locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React Native échappe déjà
    },
    compatibilityJSON: 'v4', // Requis pour React Native (pas de Intl.PluralRules complet)
  });

export default i18n;
