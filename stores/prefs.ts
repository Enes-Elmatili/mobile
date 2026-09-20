// stores/prefs.ts — les réglages de l'app qui étaient introuvables : le thème
// (système / clair / sombre) et la langue (FR / NL / EN). Persistés, appliqués
// sur place : use-app-theme lit le thème, i18n reçoit la langue.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/lib/i18n';

export const PREFS_KEY = '@fixed:prefs';
export type ThemePref = 'system' | 'light' | 'dark';
export type LanguagePref = 'fr' | 'nl' | 'en';
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark'];
export const LANGUAGE_PREFS: LanguagePref[] = ['fr', 'nl', 'en'];

type PrefsState = {
  theme: ThemePref;
  /** null = la langue du téléphone (choix de i18n au démarrage). */
  language: LanguagePref | null;
  hydrated: boolean;
  setTheme: (t: ThemePref) => void;
  setLanguage: (l: LanguagePref) => void;
  hydrate: () => Promise<void>;
};

const persist = (s: Pick<PrefsState, 'theme' | 'language'>) => AsyncStorage.setItem(PREFS_KEY, JSON.stringify(s)).catch(() => {});

export const usePrefs = create<PrefsState>((set, get) => ({
  theme: 'system',
  language: null,
  hydrated: false,
  setTheme: (theme) => { set({ theme }); persist({ theme, language: get().language }); },
  setLanguage: (language) => {
    set({ language });
    if (i18n.language !== language) i18n.changeLanguage(language).catch(() => {});
    persist({ theme: get().theme, language });
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const theme: ThemePref = THEME_PREFS.includes(p.theme) ? p.theme : 'system';
        const language: LanguagePref | null = LANGUAGE_PREFS.includes(p.language) ? p.language : null;
        set({ theme, language });
        if (language && i18n.language !== language) await i18n.changeLanguage(language).catch(() => {});
      }
    } catch { /* défauts */ }
    finally { set({ hydrated: true }); }
  },
}));

/** La langue effective : le choix, sinon celle que i18n a prise au démarrage. */
export function currentLanguage(): LanguagePref {
  const l = (i18n.language || 'fr').slice(0, 2);
  return (LANGUAGE_PREFS as string[]).includes(l) ? (l as LanguagePref) : 'fr';
}
