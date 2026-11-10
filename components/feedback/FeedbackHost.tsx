import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedbackStore } from '@/lib/feedback/store';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { useSoundManager } from '@/hooks/useSoundManager';
import { __setSoundPlayer, __clearSoundPlayer } from '@/lib/feedback/feedback';
import { useLayoutClass, useSheetFrame } from '@/lib/layout';
import { Toast } from './Toast';
import { CelebrationOverlay } from './CelebrationOverlay';
import { ConfirmSheet } from './ConfirmSheet';
import { ActionSheet } from './ActionSheet';

/** Retrait du toast dans sa page (l'écran entier sur un iPhone). */
const TOAST_GUTTER = 20;

export function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const celebration = useFeedbackStore((s) => s.celebration);
  const { play } = useSoundManager();
  const setReduceMotion = useFeedbackPrefs((s) => s.setReduceMotion);
  const hydrate = useFeedbackPrefs((s) => s.hydrate);
  // Monté hors de toute scène : les insets sont ceux de la fenêtre. Sur le Duo
  // déplié, le toast se pose sur UNE page (jamais à cheval sur le pli, jamais
  // sous le rail), en haut de page — la barre d'état vit dans le rail, l'inset
  // haut y vaut 0. Sur un iPhone : marges nulles, position d'origine.
  const { isRegular } = useLayoutClass();
  const insets = useSafeAreaInsets();
  const page = useSheetFrame({ modal: true });
  const stackFrame = {
    left: page.marginLeft + TOAST_GUTTER,
    right: page.marginRight + TOAST_GUTTER,
    ...(isRegular ? { top: insets.top + 12 } : null),
  };

  // Register the sound player into the singleton engine.
  useEffect(() => { __setSoundPlayer(play); return () => __clearSoundPlayer(play); }, [play]);

  // Hydrate prefs + subscribe to OS reduce-motion.
  useEffect(() => {
    hydrate();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, [hydrate, setReduceMotion]);

  return (
    <>
      <View style={[s.toastStack, stackFrame]} pointerEvents="box-none">
        {toasts.map((t) => <Toast key={t.id} item={t} />)}
      </View>
      {celebration && <CelebrationOverlay item={celebration} />}
      <ConfirmSheet />
      <ActionSheet />
    </>
  );
}

const s = StyleSheet.create({
  toastStack: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    zIndex: 9999, gap: 8,
  },
});
