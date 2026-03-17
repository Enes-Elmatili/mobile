// components/IncomingCallOverlay.tsx
// ─── Global incoming call overlay — mounted in SocketContext ─────────────────

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall, onIncomingCall, type IncomingCallData } from '@/lib/webrtc/CallContext';
import * as Haptics from 'expo-haptics';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function IncomingCallOverlay() {
  const theme = useAppTheme();
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

  // Animate in/out
  useEffect(() => {
    if (incoming) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 60, friction: 10,
      }).start();
      // Pulse animation for call icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200, duration: 250, useNativeDriver: true,
      }).start();
      pulseAnim.setValue(1);
    }
  }, [incoming]);

  if (!incoming) return null;

  const initials = (incoming.callerName || '?')
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
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{incoming.callerName}</Text>
          <Text style={[s.label, { color: theme.textMuted }]}>Appel entrant…</Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.rejectBtn} onPress={rejectCall} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={COLORS.red} />
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={acceptCall} activeOpacity={0.8}>
            <Ionicons name="call" size={22} color="#FFF" />
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
    fontSize: 18, fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16, fontWeight: '800',
  },
  label: {
    fontSize: 12, fontWeight: '500', marginTop: 2,
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