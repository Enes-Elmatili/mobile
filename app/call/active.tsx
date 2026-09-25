// app/call/active.tsx — Full-screen VoIP call UI
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, StatusBar,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCall, MESSAGE_FALLBACK_REASONS, type CallEndReason } from '@/lib/webrtc/CallContext';
import { usePulse } from '@/lib/motion/useLoops';
import { PressScale } from '@/components/ui/PressScale';
import { cleanName } from '@/lib/displayName';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getStatusLabel(state: string, endReason: CallEndReason | null, t: (k: string) => string): string {
  if (state === 'ended') {
    switch (endReason) {
      case 'rejected':    return t('call.rejected');
      case 'busy':        return t('call.busy');
      case 'failed':      return t('call.failed');
      case 'timeout':     return t('call.timeout');
      case 'unavailable': return t('call.unavailable');
      case 'not_allowed': return t('call.not_allowed');
      default:            return t('ext.call_ended');
    }
  }
  switch (state) {
    case 'outgoing':   return t('ext.call_outgoing');
    case 'incoming':   return t('ext.call_incoming');
    case 'connecting': return t('ext.call_connecting');
    case 'connected':  return t('ext.call_connected');
    default:           return '';
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    callState, callInfo, endReason, isMuted, callDuration,
    hangup, toggleMute, dismissEnded,
  } = useCall();
  // Pendant que ça sonne, l'avatar respire en opacité (pas d'onde autour : zéro halo).
  const ringing = usePulse(callState === 'outgoing' || callState === 'connecting', { min: 0.55, duration: 900 });
  const leavingRef = useRef(false);

  // Auto-dismiss when call ends.
  // We must track whether a non-idle state was ever observed, otherwise the
  // effect fires on initial mount (React always runs effects once on mount)
  // and calls router.back() before any call has started — which produces an
  // unhandled GO_BACK if the stack is empty.
  const hasSeenActiveRef = useRef(false);
  useEffect(() => {
    if (callState !== 'idle') {
      hasSeenActiveRef.current = true;
      return;
    }
    if (hasSeenActiveRef.current && !leavingRef.current) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    }
  }, [callState, router]);

  const isRinging = callState === 'outgoing' || callState === 'connecting';
  const isConnected = callState === 'connected';
  const isEnded = callState === 'ended';
  // Personne n'a décroché (ou l'app de l'autre est fermée) : on propose d'écrire.
  const offerMessage = isEnded && !!callInfo?.isCaller && !!endReason && MESSAGE_FALLBACK_REASONS.includes(endReason);
  const sendMessage = () => {
    if (!callInfo) return;
    leavingRef.current = true;
    const params: Record<string, string> = { userId: callInfo.remoteUserId, name: callInfo.remoteName };
    if (callInfo.requestId) params.requestId = String(callInfo.requestId);
    router.replace({ pathname: '/messages/[userId]', params });
    dismissEnded();
  };

  const initials = cleanName(callInfo?.remoteName, { fallback: '?' })
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
          <Animated.View style={[cs.avatar, { backgroundColor: theme.surface, shadowOpacity: theme.shadowOpacity }, isRinging && ringing]}>
            <Text style={[cs.avatarText, { color: theme.heroText, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{initials}</Text>
          </Animated.View>
        </View>

        <Text style={[cs.name, { color: theme.heroText, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{cleanName(callInfo?.remoteName, { fallback: t('ext.call_unknown') })}</Text>
        <Text style={[cs.status, { color: theme.heroSub, fontFamily: isConnected ? FONTS.mono : FONTS.sans }]}>
          {isConnected ? formatDuration(callDuration) : getStatusLabel(callState, endReason, t)}
        </Text>

        {callInfo?.requestId && (
          <View style={[cs.requestBadge, { backgroundColor: theme.surface }]}>
            <Text style={[cs.requestBadgeText, { fontFamily: FONTS.mono, color: theme.heroSub }]}>
              {t('call.mission_n', { id: String(callInfo.requestId).slice(-6).toUpperCase() })}
            </Text>
          </View>
        )}
      </View>

      {/* ── Bottom section: Controls ── */}
      {!isEnded && (
        <View style={cs.controls}>
          {/* Mute */}
          <PressScale
            style={[cs.controlBtn, isMuted && [cs.controlBtnActive, { backgroundColor: theme.cardBg }]]}
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? t('call.unmute_a11y') : t('call.mute_a11y')}
            accessibilityState={{ selected: isMuted }}
          >
            <Feather
              name={isMuted ? 'mic-off' : 'mic'}
              size={26}
              color={isMuted ? theme.heroBg : theme.heroText}
            />
            <Text style={[cs.controlLabel, { fontFamily: FONTS.sansMedium, color: theme.heroSub }, isMuted && { color: theme.heroBg }]}>
              {isMuted ? t('ext.call_mute') : t('ext.call_mic')}
            </Text>
          </PressScale>

          {/* Hangup */}
          <PressScale
            style={cs.hangupBtn}
            onPress={hangup}
            scale={0.94}
            accessibilityRole="button"
            accessibilityLabel={t('call.hangup_a11y')}
          >
            <Feather name="phone-off" size={32} color={theme.heroText} />
          </PressScale>

          {/* Note: bouton haut-parleur retiré — aucun routage audio natif
              implémenté (toggleSpeaker était purement cosmétique). */}
        </View>
      )}

      {offerMessage && (
        <View style={cs.fallback}>
          <Text style={[cs.fallbackHint, { color: theme.heroSub, fontFamily: FONTS.sans }]} maxFontSizeMultiplier={1.3}>{t('call.fallback_hint')}</Text>
          <PressScale onPress={sendMessage} style={[cs.fallbackBtn, { backgroundColor: theme.heroText }]} accessibilityRole="button">
            <Feather name="message-circle" size={18} color={theme.heroBg as string} />
            <Text style={[cs.fallbackBtnText, { color: theme.heroBg, fontFamily: FONTS.sansBold }]}>{t('call.send_message')}</Text>
          </PressScale>
          <PressScale onPress={dismissEnded} style={cs.fallbackClose} accessibilityRole="button">
            <Text style={[cs.fallbackCloseText, { color: theme.heroSub, fontFamily: FONTS.sansMedium }]}>{t('call.close')}</Text>
          </PressScale>
        </View>
      )}

      {isEnded && !offerMessage && (
        <View style={cs.endedSection}>
          <Feather
            name={!endReason || endReason === 'hangup' ? 'check-circle' : endReason === 'timeout' ? 'phone-missed' : 'x-circle'}
            size={48}
            color={theme.heroSub}
          />
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

  // ── Fin sans conversation : écrire ────
  fallback: { alignSelf: 'stretch', paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', gap: 12 },
  fallbackHint: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  fallbackBtn: { alignSelf: 'stretch', height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  fallbackBtnText: { fontSize: 16 },
  fallbackClose: { paddingVertical: 10, paddingHorizontal: 20 },
  fallbackCloseText: { fontSize: 15 },

  // ── Ended ────
  endedSection: {
    paddingBottom: 60,
    alignItems: 'center',
  },
});
