// app/request/[id]/pin.tsx
// ─── Page dédiée : affichage du code PIN à communiquer au prestataire ────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Animated, Easing, Platform, StatusBar, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSocket } from '@/lib/SocketContext';

export default function PinPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const providerName = params.providerName as string | undefined;
  const serviceName = params.serviceName as string | undefined;
  const { socket, joinRoom, leaveRoom } = useSocket();

  const [pinCode, setPinCode] = useState<string | null>((params.pinCode as string) || null);
  const [pinVerified, setPinVerified] = useState(false);
  const [verifiedAnim] = useState(() => new Animated.Value(0));

  // Animations d'entrée
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const digitAnims = useRef<Animated.Value[]>([]).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Empêcher le retour arrière accidentel ──────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      // On laisse le retour possible mais ça ramène à missionview
      return false;
    });
    return () => handler.remove();
  }, []);

  // ─── Animation d'entrée ──────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  // ─── Animation des digits (staggered) ───────────────────────────────────
  useEffect(() => {
    if (!pinCode) return;
    // Init digit anims
    while (digitAnims.length < pinCode.length) {
      digitAnims.push(new Animated.Value(0));
    }
    const stagger = pinCode.split('').map((_, i) =>
      Animated.sequence([
        Animated.delay(i * 120),
        Animated.spring(digitAnims[i], {
          toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(stagger).start();
  }, [pinCode]);

  // ─── Pulse doux sur le conteneur PIN ─────────────────────────────────────
  useEffect(() => {
    if (pinVerified) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pinVerified]);

  // ─── Polling PIN fallback ────────────────────────────────────────────────
  const pinPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPin = useCallback(async () => {
    try {
      const token = await (await import('@/lib/storage')).tokenStorage.getToken();
      const baseUrl = (await import('@/lib/config')).default.apiUrl;
      const res = await fetch(`${baseUrl}/requests/${id}/pin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.pinCode) setPinCode(data.pinCode);
      if (data?.pinVerified) setPinVerified(true);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (pinCode || pinVerified) return;
    fetchPin();
    pinPollRef.current = setInterval(fetchPin, 4000);
    return () => {
      if (pinPollRef.current) { clearInterval(pinPollRef.current); pinPollRef.current = null; }
    };
  }, [pinCode, pinVerified, fetchPin]);

  useEffect(() => {
    if (pinCode && pinPollRef.current) {
      clearInterval(pinPollRef.current);
      pinPollRef.current = null;
    }
  }, [pinCode]);

  // ─── Socket events ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);

    const onPinReady = (data: any) => {
      if (String(data.requestId) === String(id) && data.pinCode) {
        setPinCode(data.pinCode);
      }
    };

    const onPinVerified = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setPinVerified(true);
      }
    };

    socket.on('mission:pin_ready', onPinReady);
    socket.on('mission:pin_verified', onPinVerified);
    return () => {
      leaveRoom('request', id);
      socket.off('mission:pin_ready', onPinReady);
      socket.off('mission:pin_verified', onPinVerified);
    };
  }, [socket, id, joinRoom, leaveRoom]);

  // ─── PIN vérifié → animation + retour missionview ───────────────────────
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!pinVerified || hasNavigatedRef.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Animated.spring(verifiedAnim, {
      toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      router.back();
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinVerified]);

  // ─── Guard ───────────────────────────────────────────────────────────────
  if (!id) {
    return (
      <SafeAreaView style={s.root}>
        <Text>Mission introuvable</Text>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Header */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </TouchableOpacity>

          {/* Icon + titre */}
          <View style={s.headerZone}>
            <View style={s.iconCircle}>
              <Ionicons
                name={pinVerified ? 'checkmark-circle' : 'key'}
                size={36}
                color={pinVerified ? '#22C55E' : '#1A1A1A'}
              />
            </View>
            <Text style={s.title}>
              {pinVerified ? 'Code vérifié !' : 'Code de vérification'}
            </Text>
            <Text style={s.subtitle}>
              {pinVerified
                ? 'Le prestataire a confirmé sa présence.\nLa mission va démarrer.'
                : `Communiquez ce code à ${providerName || 'votre prestataire'}\npour confirmer sa présence sur place.`
              }
            </Text>
          </View>

          {/* PIN digits */}
          {!pinVerified && pinCode && (
            <Animated.View style={[s.pinContainer, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.pinDigitsRow}>
                {pinCode.split('').map((digit, i) => {
                  const anim = digitAnims[i] || new Animated.Value(1);
                  return (
                    <Animated.View
                      key={i}
                      style={[s.pinDigitBox, {
                        opacity: anim,
                        transform: [{
                          scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                        }, {
                          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                        }],
                      }]}
                    >
                      <Text style={s.pinDigitText}>{digit}</Text>
                    </Animated.View>
                  );
                })}
              </View>
              <Text style={s.pinHint}>Ne partagez ce code qu'avec votre prestataire</Text>
            </Animated.View>
          )}

          {/* Verified state */}
          {pinVerified && (
            <Animated.View style={[s.verifiedCard, {
              opacity: verifiedAnim,
              transform: [{
                scale: verifiedAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              }],
            }]}>
              <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
              <Text style={s.verifiedText}>Identité confirmée</Text>
              <Text style={s.verifiedSub}>Retour au suivi en cours…</Text>
            </Animated.View>
          )}

          {/* Loading si pas encore de PIN */}
          {!pinCode && !pinVerified && (
            <View style={s.loadingZone}>
              <Animated.View style={s.loadingDot}>
                <Text style={s.loadingText}>Génération du code en cours…</Text>
              </Animated.View>
            </View>
          )}

          <View style={{ flex: 1 }} />

          {/* Info service en bas */}
          {serviceName && !pinVerified && (
            <View style={s.serviceInfo}>
              <Ionicons name="briefcase-outline" size={16} color="#ADADAD" />
              <Text style={s.serviceText}>{serviceName}</Text>
            </View>
          )}

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 8 : 40,
  },

  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F4F4F4',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },

  headerZone: { alignItems: 'center', marginBottom: 40 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F4F4F4',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: 26, fontWeight: '900', color: '#1A1A1A',
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, color: '#888', textAlign: 'center',
    lineHeight: 22, paddingHorizontal: 16,
  },

  // ─── PIN ──────────────────────────────────────────────────────────────────
  pinContainer: { alignItems: 'center', marginBottom: 24 },
  pinDigitsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    marginBottom: 16,
  },
  pinDigitBox: {
    width: 68, height: 84, borderRadius: 20,
    backgroundColor: '#F9F9F9',
    borderWidth: 2, borderColor: '#E8E8E8',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  pinDigitText: {
    fontSize: 36, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1,
  },
  pinHint: {
    fontSize: 12, color: '#ADADAD', fontWeight: '500', textAlign: 'center',
  },

  // ─── Verified ─────────────────────────────────────────────────────────────
  verifiedCard: {
    alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 24, padding: 32,
    marginHorizontal: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  verifiedText: {
    fontSize: 22, fontWeight: '800', color: '#15803D', letterSpacing: -0.3,
  },
  verifiedSub: {
    fontSize: 14, color: '#22C55E', fontWeight: '500',
  },

  // ─── Loading ──────────────────────────────────────────────────────────────
  loadingZone: { alignItems: 'center', marginTop: 20 },
  loadingDot: {
    backgroundColor: '#F4F4F4', borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '500' },

  // ─── Service info ─────────────────────────────────────────────────────────
  serviceInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  serviceText: { fontSize: 13, color: '#ADADAD', fontWeight: '500' },
});
