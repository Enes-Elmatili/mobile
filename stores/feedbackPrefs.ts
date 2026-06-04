import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FEEDBACK_PREFS_KEY = '@fixed:feedback:prefs';

export type FeedbackPrefKey = 'sound' | 'haptics' | 'animations';

interface FeedbackPrefsState {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  reduceMotion: boolean; // runtime, from AccessibilityInfo
  hydrated: boolean;
  setPref: (key: FeedbackPrefKey, value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  hydrate: () => Promise<void>;
}

export const useFeedbackPrefs = create<FeedbackPrefsState>((set, get) => ({
  sound: true,
  haptics: true,
  animations: true,
  reduceMotion: false,
  hydrated: false,

  setPref: (key, value) => {
    set({ [key]: value } as Pick<FeedbackPrefsState, FeedbackPrefKey>);
    const { sound, haptics, animations } = get();
    AsyncStorage.setItem(FEEDBACK_PREFS_KEY, JSON.stringify({ sound, haptics, animations })).catch(() => {});
  },

  setReduceMotion: (value) => set({ reduceMotion: value }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(FEEDBACK_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        set({
          sound: p.sound ?? true,
          haptics: p.haptics ?? true,
          animations: p.animations ?? true,
        });
      }
    } catch {
      // keep defaults
    } finally {
      set({ hydrated: true });
    }
  },
}));
