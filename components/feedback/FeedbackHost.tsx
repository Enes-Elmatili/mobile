import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { useFeedbackStore } from '@/lib/feedback/store';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { useSoundManager } from '@/hooks/useSoundManager';
import { __setSoundPlayer } from '@/lib/feedback/feedback';
import { Toast } from './Toast';
import { CelebrationOverlay } from './CelebrationOverlay';
import { ConfirmSheet } from './ConfirmSheet';
import { ActionSheet } from './ActionSheet';

export function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const celebration = useFeedbackStore((s) => s.celebration);
  const { play } = useSoundManager();
  const setReduceMotion = useFeedbackPrefs((s) => s.setReduceMotion);
  const hydrate = useFeedbackPrefs((s) => s.hydrate);

  // Register the sound player into the singleton engine.
  useEffect(() => { __setSoundPlayer(play); return () => __setSoundPlayer(null); }, [play]);

  // Hydrate prefs + subscribe to OS reduce-motion.
  useEffect(() => {
    hydrate();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  return (
    <>
      <View style={s.toastStack} pointerEvents="box-none">
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
    left: 20, right: 20, zIndex: 9999, gap: 8,
  },
});
