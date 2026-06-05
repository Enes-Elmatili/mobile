import * as Haptics from 'expo-haptics';
import i18n from '../i18n';
import { FEEDBACK_EVENTS, FeedbackEventName, FeedbackEventDef, HapticKind, ToastType, SoundKey } from './events';
import { useFeedbackStore } from './store';
import { useFeedbackPrefs } from '../../stores/feedbackPrefs';

// Sound player is registered at runtime by FeedbackHost (useSoundManager is a hook).
let soundPlayer: ((key: SoundKey) => void) | null = null;
export function __setSoundPlayer(fn: ((key: SoundKey) => void) | null) { soundPlayer = fn; }

function fireHaptic(kind: HapticKind) {
  try {
    switch (kind) {
      case 'light':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'heavy':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
      case 'selection': Haptics.selectionAsync(); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'error':   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
    }
  } catch { /* never block UX */ }
}

function pushToast(type: ToastType, messageKey: string, fallback?: string) {
  const message = fallback ?? i18n.t(messageKey);
  useFeedbackStore.getState().pushToast({ type, message });
}

export const feedback = {
  event(name: FeedbackEventName) {
    const def: FeedbackEventDef | undefined = FEEDBACK_EVENTS[name];
    if (!def) { if (__DEV__) console.warn(`[feedback] unknown event ${name}`); return; }
    const prefs = useFeedbackPrefs.getState();

    if (def.haptic && prefs.haptics) fireHaptic(def.haptic);
    if (def.sound && prefs.sound && soundPlayer) soundPlayer(def.sound);
    if (def.toast) pushToast(def.toast.type, def.toast.messageKey);

    const animationsOk = prefs.animations && !prefs.reduceMotion;
    if (def.celebrate && animationsOk) {
      useFeedbackStore.getState().setCelebration({ kind: def.celebrate.kind, title: i18n.t(def.celebrate.titleKey) });
    }
  },

  haptic(kind: HapticKind) {
    if (useFeedbackPrefs.getState().haptics) fireHaptic(kind);
  },

  /** Direct toast — message may be an i18n key or a literal string. */
  toast(message: string, type: ToastType = 'info') {
    const resolved = i18n.exists(message) ? i18n.t(message) : message;
    useFeedbackStore.getState().pushToast({ type, message: resolved });
  },

  success(messageKey: string) { this.haptic('success'); this.toast(messageKey, 'success'); },
  info(messageKey: string)    { this.toast(messageKey, 'info'); },
  error(messageKey: string)   { this.haptic('error'); this.toast(messageKey, 'error'); },

  confirm(opts: { titleKey: string; messageKey?: string; confirmKey: string; cancelKey: string; destructive?: boolean }): Promise<boolean> {
    if (useFeedbackPrefs.getState().haptics) fireHaptic('warning');
    return new Promise<boolean>((resolve) => {
      useFeedbackStore.getState().setConfirm({
        title: i18n.t(opts.titleKey),
        message: opts.messageKey ? i18n.t(opts.messageKey) : undefined,
        confirmLabel: i18n.t(opts.confirmKey),
        cancelLabel: i18n.t(opts.cancelKey),
        destructive: !!opts.destructive,
        resolve,
      });
    });
  },

  actionSheet(opts: { titleKey?: string; options: { labelKey: string; destructive?: boolean }[]; cancelKey: string }): Promise<number | null> {
    if (useFeedbackPrefs.getState().haptics) fireHaptic('selection');
    return new Promise<number | null>((resolve) => {
      useFeedbackStore.getState().setActionSheet({
        title: opts.titleKey ? i18n.t(opts.titleKey) : undefined,
        options: opts.options.map((o) => ({ label: i18n.t(o.labelKey), destructive: o.destructive })),
        cancelLabel: i18n.t(opts.cancelKey),
        resolve,
      });
    });
  },
};
