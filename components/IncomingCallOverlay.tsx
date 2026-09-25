// components/IncomingCallOverlay.tsx
// ─── Global incoming call overlay — mounted in SocketContext ─────────────────

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall, onIncomingCall, type IncomingCallData } from '@/lib/webrtc/CallContext';
import { feedback } from '@/lib/feedback/feedback';
import { cleanName } from '@/lib/displayName';
import { RINGTONE_SOUND } from '@/hooks/useSoundManager';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useTranslation } from 'react-i18next';
import { PressScale } from '@/components/ui/PressScale';

// Android : [attente, vibration, pause] — iOS : durées entre deux vibrations.
const RING_VIBRATION_PATTERN = Platform.OS === 'android' ? [0, 800, 1600] : [800, 1600];

export default function IncomingCallOverlay() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const { acceptCall, rejectCall } = useCall();
  const insets = useSafeAreaInsets();
  const slideY = useSharedValue(-200);
  const pulse = useSharedValue(1);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    const unsub = onIncomingCall((data) => {
      setIncoming(data);
    });
    return unsub;
  }, []);

  // ── Sonnerie + vibration répétée tant que l'appel entrant est affiché ──
  // Stoppées dès accept/refus/fin (incoming → null) ou démontage.
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  useEffect(() => {
    if (!incoming) return;

    Vibration.vibrate(RING_VIBRATION_PATTERN, true);

    let cancelled = false;
    if (useFeedbackPrefs.getState().sound) {
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            RINGTONE_SOUND,
            { isLooping: true, shouldPlay: true },
          );
          if (cancelled) { sound.unloadAsync().catch(() => {}); return; }
          ringtoneRef.current = sound;
        } catch {
          // Ne jamais bloquer l'UX pour un échec de son — la vibration suffit.
        }
      })();
    }

    return () => {
      cancelled = true;
      Vibration.cancel();
      ringtoneRef.current?.unloadAsync().catch(() => {});
      ringtoneRef.current = null;
    };
  }, [incoming]);

  // Entrée / sortie : la carte descend sur MOTION.island (le ressort du toast) ;
  // l'avatar pulse tant que ça sonne.
  useEffect(() => {
    if (incoming) {
      feedback.haptic('warning');
      slideY.value = withSpring(0, MOTION.island);
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      slideY.value = withTiming(-200, { duration: 250 });
      cancelAnimation(pulse);
      pulse.value = 1;
    }
    return () => cancelAnimation(pulse);
  }, [incoming, pulse, slideY]);

  if (!incoming) return null;

  const initials = cleanName(incoming.callerName, { fallback: '?' })
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Animated.View style={[s.overlay, { paddingTop: insets.top + 12 }, slideStyle]}>
      <View style={[s.card, { backgroundColor: theme.cardBg }]}>
        {/* Avatar */}
        <Animated.View style={[s.avatar, { backgroundColor: theme.surface }, pulseStyle]}>
          <Text style={[s.avatarText, { color: theme.text }]}>{initials}</Text>
        </Animated.View>

        {/* Info */}
        <View style={s.info}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{cleanName(incoming.callerName, { fallback: t('ext.call_unknown') })}</Text>
          <Text style={[s.label, { color: theme.textMuted }]}>{t('provider.incoming_call')}</Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <PressScale
            style={s.rejectBtn}
            onPress={rejectCall}
            accessibilityRole="button"
            accessibilityLabel="Refuser l'appel"
          >
            <Feather name="x" size={22} color={COLORS.red} />
          </PressScale>
          <PressScale
            style={s.acceptBtn}
            onPress={acceptCall}
            accessibilityRole="button"
            accessibilityLabel="Accepter l'appel"
          >
            <Feather name="phone" size={22} color="#FFF" />
          </PressScale>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10000,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 20 },
    }),
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18, fontFamily: FONTS.bebas, includeFontPadding: false, letterSpacing: 0.5,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16, fontFamily: FONTS.sansMedium,
  },
  label: {
    fontSize: 12, fontFamily: FONTS.sans, marginTop: 2,
  },
  actions: {
    flexDirection: 'row', gap: 10,
  },
  rejectBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,59,48,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
  },
});