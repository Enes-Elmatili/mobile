// app/call/active.tsx — Full-screen VoIP call UI
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall } from '@/lib/webrtc/CallContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getStatusLabel(state: string): string {
  switch (state) {
    case 'outgoing':   return 'Appel en cours...';
    case 'incoming':   return 'Appel entrant...';
    case 'connecting': return 'Connexion...';
    case 'connected':  return 'En ligne';
    case 'ended':      return 'Appel terminé';
    default:           return '';
  }
}

// ─── Pulsing ring animation ──────────────────────────────────────────────────

function PulseRing() {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.8, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[cs.pulseRing, { borderColor: theme.heroSub, transform: [{ scale }], opacity }]} />
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const {
    callState, callInfo, isMuted, isSpeaker, callDuration,
    hangup, toggleMute, toggleSpeaker,
  } = useCall();

  // Auto-dismiss when call ends
  useEffect(() => {
    if (callState === 'idle') {
      router.back();
    }
  }, [callState]);

  const isRinging = callState === 'outgoing' || callState === 'connecting';
  const isConnected = callState === 'connected';
  const isEnded = callState === 'ended';

  const initials = (callInfo?.remoteName || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Call screen always uses dark background
  return (
    <View style={[cs.root, { backgroundColor: theme.heroBg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Top section: Avatar + Name + Status ── */}
      <View style={cs.topSection}>
        <View style={cs.avatarContainer}>
          {isRinging && <PulseRing />}
          <View style={[cs.avatar, { backgroundColor: theme.surface, shadowOpacity: theme.shadowOpacity }]}>
            <Text style={[cs.avatarText, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{initials}</Text>
          </View>
        </View>

        <Text style={[cs.name, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{callInfo?.remoteName || 'Inconnu'}</Text>
        <Text style={[cs.status, { color: theme.heroSub, fontFamily: isConnected ? FONTS.mono : FONTS.sans }]}>
          {isConnected ? formatDuration(callDuration) : getStatusLabel(callState)}
        </Text>

        {callInfo?.requestId && (
          <View style={[cs.requestBadge, { backgroundColor: theme.surface }]}>
            <Text style={[cs.requestBadgeText, { fontFamily: FONTS.mono, color: theme.heroSub }]}>
              Mission #{String(callInfo.requestId).slice(-6).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* ── Bottom section: Controls ── */}
      {!isEnded && (
        <View style={cs.controls}>
          {/* Mute */}
          <TouchableOpacity
            style={[cs.controlBtn, isMuted && [cs.controlBtnActive, { backgroundColor: theme.cardBg }]]}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={26}
              color={isMuted ? theme.heroBg : theme.heroText}
            />
            <Text style={[cs.controlLabel, { fontFamily: FONTS.sansMedium, color: theme.heroSub }, isMuted && { color: theme.heroBg }]}>
              {isMuted ? 'Muet' : 'Micro'}
            </Text>
          </TouchableOpacity>

          {/* Hangup */}
          <TouchableOpacity style={cs.hangupBtn} onPress={hangup} activeOpacity={0.8}>
            <Ionicons name="call" size={32} color={theme.heroText} style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>

          {/* Speaker */}
          <TouchableOpacity
            style={[cs.controlBtn, isSpeaker && [cs.controlBtnActive, { backgroundColor: theme.cardBg }]]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSpeaker ? 'volume-high' : 'volume-medium'}
              size={26}
              color={isSpeaker ? theme.heroBg : theme.heroText}
            />
            <Text style={[cs.controlLabel, { fontFamily: FONTS.sansMedium, color: theme.heroSub }, isSpeaker && { color: theme.heroBg }]}>
              HP
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isEnded && (
        <View style={cs.endedSection}>
          <Ionicons name="checkmark-circle" size={48} color={theme.heroSub} />
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Top ────
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2,
  },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },
  avatarText: {
    fontSize: 36, letterSpacing: 1,
  },

  name: {
    fontSize: 32, letterSpacing: -0.5,
  },
  status: {
    fontSize: 16,
  },

  requestBadge: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 4,
  },
  requestBadgeText: {
    fontSize: 11, letterSpacing: 0.5,
  },

  // ── Controls ────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingBottom: 20,
  },
  controlBtn: {
    width: 64, height: 80,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
    gap: 6,
  },
  controlBtnActive: {
    borderRadius: 20,
  },
  controlLabel: {
    fontSize: 11,
  },

  hangupBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: COLORS.red, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
    }),
  },

  // ── Ended ────
  endedSection: {
    paddingBottom: 60,
    alignItems: 'center',
  },
});
