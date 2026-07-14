// components/IncomingCallOverlay.tsx
// ─── Global incoming call overlay — mounted in SocketContext ─────────────────

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing, Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall, onIncomingCall, type IncomingCallData } from '@/lib/webrtc/CallContext';
import { feedback } from '@/lib/feedback/feedback';
import { cleanName } from '@/lib/displayName';
import { RINGTONE_SOUND } from '@/hooks/useSoundManager';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useTranslation } from 'react-i18next';

// Android : [attente, vibration, pause] — iOS : durées entre deux vibrations.
const RING_VIBRATION_PATTERN = Platform.OS === 'android' ? [0, 800, 1600] : [800, 1600];

export default function IncomingCallOverlay() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const { acceptCall, rejectCall } = useCall();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Animate in/out
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (incoming) {
      feedback.haptic('warning');
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 60, friction: 10,
      }).start();
      // Pulse animation for call icon — store ref so we can stop it later.
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200, duration: 250, useNativeDriver: true,
      }).start();
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [incoming]);

  if (!incoming) return null;

  const initials = cleanName(incoming.callerName, { fallback: '?' })
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Animated.View
      style={[
        s.overlay,
        { paddingTop: insets.top + 12, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[s.card, { backgroundColor: theme.cardBg }]}>
        {/* Avatar */}
        <Animated.View style={[s.avatar, { backgroundColor: theme.surface }, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={[s.avatarText, { color: theme.text }]}>{initials}</Text>
        </Animated.View>

        {/* Info */}
        <View style={s.info}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{cleanName(incoming.callerName, { fallback: t('ext.call_unknown') })}</Text>
          <Text style={[s.label, { color: theme.textMuted }]}>{t('provider.incoming_call')}</Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.rejectBtn}
            onPress={rejectCall}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Refuser l'appel"
          >
            <Feather name="x" size={22} color={COLORS.red} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.acceptBtn}
            onPress={acceptCall}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Accepter l'appel"
          >
            <Feather name="phone" size={22} color="#FFF" />
          </TouchableOpacity>
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
    fontSize: 18, fontFamily: FONTS.bebas, letterSpacing: 0.5,
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