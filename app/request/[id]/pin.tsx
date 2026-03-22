// app/request/[id]/pin.tsx
// ─── Page dédiée : affichage du code PIN à communiquer au prestataire ────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Animated, Easing, Platform, StatusBar, BackHandler, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSocket } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function PinPage() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const providerName = params.providerName as string | undefined;
  const serviceName = params.serviceName as string | undefined;
  const { socket, joinRoom, leaveRoom } = useSocket();

  const [pinCode, setPinCode] = useState<string | null>((params.pinCode as string) || null);
  const [pinHidden, setPinHidden] = useState(true);
  const [pinVerified, setPinVerified] = useState(false);
  const [verifiedAnim] = useState(() => new Animated.Value(0));

  // Animations d'entrée
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const digitAnims = useRef<Animated.Value[]>([]).current;

  // Animations ambiance
  const ring1Rotate = useRef(new Animated.Value(0)).current;
  const ring2Rotate = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const iconBreath = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // ─── Empêcher le retour arrière accidentel ──────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => handler.remove();
  }, []);

  // ─── Animation d'entrée ──────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
  }, []);

  // ─── Animations ambiance (rings rotation, glow, icon breath, shimmer) ──
  useEffect(() => {
    // Slow ring rotations
    Animated.loop(
      Animated.timing(ring1Rotate, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(ring2Rotate, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Glow pulse behind lock icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.6, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Icon breathing
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconBreath, { toValue: 1.06, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(iconBreath, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Shimmer sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Animation des digits (staggered) ───────────────────────────────────
  useEffect(() => {
    if (!pinCode) return;
    while (digitAnims.length < pinCode.length) {
      digitAnims.push(new Animated.Value(0));
    }
    const stagger = pinCode.split('').map((_, i) =>
      Animated.sequence([
        Animated.delay(300 + i * 150),
        Animated.spring(digitAnims[i], {
          toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(stagger).start();
  }, [pinCode]);

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
      <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textAlt, fontFamily: FONTS.sans }}>Mission introuvable</Text>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  const gradColors = theme.isDark
    ? ['#050508', '#0D0D12', '#14141B'] as const
    : ['#F2F2F2', '#EBEBEB', '#E4E4E4'] as const;

  const ring1Spin = ring1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ring2Spin = ring2Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  const glowColor = theme.isDark ? 'rgba(100,130,255,0.12)' : 'rgba(80,100,200,0.08)';

  return (
    <View style={s.root}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={gradColors} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} />

      {/* Animated decorative rings */}
      <Animated.View style={[s.decoRing, s.decoRing1, {
        borderColor: theme.isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
        transform: [{ rotate: ring1Spin }],
      }]} />
      <Animated.View style={[s.decoRing, s.decoRing2, {
        borderColor: theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        transform: [{ rotate: ring2Spin }],
      }]} />
      <Animated.View style={[s.decoRing, s.decoRing3, {
        borderColor: theme.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
        transform: [{ rotate: ring1Spin }],
      }]} />

      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Header */}
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
          </TouchableOpacity>

          <View style={{ flex: 0.55 }} />

          {/* Icon + titre */}
          <View style={s.headerZone}>
            {/* Glow behind icon */}
            {!pinVerified && (
              <Animated.View style={[s.iconGlow, { backgroundColor: glowColor, opacity: glowAnim }]} />
            )}
            <Animated.View style={[s.iconCircle, {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              transform: [{ scale: pinVerified ? 1 : iconBreath }],
            }]}>
              <Ionicons
                name={pinVerified ? 'checkmark-circle' : 'lock-closed'}
                size={36}
                color={pinVerified ? COLORS.green : theme.textAlt}
              />
            </Animated.View>
            <Text style={[s.title, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
              {pinVerified ? 'Code vérifié !' : 'Code de vérification'}
            </Text>
            {pinVerified && (
              <Text style={[s.subtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                Le prestataire a confirmé sa présence.{'\n'}La mission va démarrer.
              </Text>
            )}
          </View>

          {/* PIN digits */}
          {!pinVerified && pinCode && (
            <View style={s.pinContainer}>
              <View style={s.pinDigitsRow}>
                {pinCode.split('').map((digit, i) => {
                  const anim = digitAnims[i] || new Animated.Value(1);
                  return (
                    <Animated.View
                      key={i}
                      style={[s.pinDigitBox, {
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                        borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                        opacity: anim,
                        transform: [{
                          scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                        }, {
                          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                        }],
                      }]}
                    >
                      {pinHidden ? (
                        <View style={[s.pinDot, { backgroundColor: theme.textAlt }]} />
                      ) : (
                        <Text style={[s.pinDigitText, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{digit}</Text>
                      )}
                      {/* Shimmer overlay */}
                      <Animated.View style={[s.shimmer, {
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
                        transform: [{
                          translateX: shimmerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-80, 80],
                          }),
                        }],
                      }]} />
                    </Animated.View>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[s.toggleBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                onPress={() => setPinHidden(h => !h)}
                activeOpacity={0.7}
              >
                <Ionicons name={pinHidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={theme.textMuted} />
                <Text style={[s.toggleText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
                  {pinHidden ? 'Afficher le code' : 'Masquer le code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Verified state */}
          {pinVerified && (
            <Animated.View style={[s.verifiedCard, {
              backgroundColor: theme.isDark ? 'rgba(29,185,84,0.08)' : '#F0FDF4',
              borderColor: theme.isDark ? 'rgba(29,185,84,0.15)' : '#BBF7D0',
              opacity: verifiedAnim,
              transform: [{
                scale: verifiedAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              }],
            }]}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.green} />
              <Text style={[s.verifiedText, { color: theme.isDark ? COLORS.green : '#15803D', fontFamily: FONTS.sansMedium }]}>Identité confirmée</Text>
              <Text style={[s.verifiedSub, { color: COLORS.green, fontFamily: FONTS.sans }]}>Retour au suivi en cours...</Text>
            </Animated.View>
          )}

          {/* Loading si pas encore de PIN */}
          {!pinCode && !pinVerified && (
            <View style={s.loadingZone}>
              <Animated.View style={[s.loadingDot, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Text style={[s.loadingText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Génération du code en cours...</Text>
              </Animated.View>
            </View>
          )}

          <View style={{ flex: 1 }} />

          {/* Contacter le support */}
          <TouchableOpacity
            style={[s.supportBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
            onPress={() => router.push('/support')}
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={theme.textMuted} />
            <Text style={[s.supportText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Contacter le support</Text>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, zIndex: 1 },

  // ─── Decorative rings ──────────────────────────────────────────────────────
  decoRing: {
    position: 'absolute', borderRadius: 9999, borderWidth: 1,
  },
  decoRing1: {
    width: SCREEN_W * 1.5, height: SCREEN_W * 1.5,
    top: -SCREEN_W * 0.35, right: -SCREEN_W * 0.45,
  },
  decoRing2: {
    width: SCREEN_W * 1.2, height: SCREEN_W * 1.2,
    bottom: -SCREEN_W * 0.25, left: -SCREEN_W * 0.4,
  },
  decoRing3: {
    width: SCREEN_W * 0.9, height: SCREEN_W * 0.9,
    top: SCREEN_H * 0.25, left: -SCREEN_W * 0.2,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 8 : 40,
  },

  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },

  headerZone: { alignItems: 'center', marginBottom: 24 },

  // Glow behind lock icon
  iconGlow: {
    position: 'absolute', top: -20,
    width: 120, height: 120, borderRadius: 60,
  },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: 30,
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, textAlign: 'center',
    lineHeight: 22, paddingHorizontal: 16,
  },

  // ─── PIN ──────────────────────────────────────────────────────────────────
  pinContainer: { alignItems: 'center', marginBottom: 24 },
  pinDigitsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    marginBottom: 56,
  },
  pinDigitBox: {
    width: 68, height: 84, borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  pinDigitText: {
    fontSize: 36, letterSpacing: -1,
  },
  pinDot: {
    width: 14, height: 14, borderRadius: 7,
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0,
    width: 40, borderRadius: 20,
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    marginBottom: 12,
  },
  toggleText: {
    fontSize: 13,
  },

  // ─── Verified ─────────────────────────────────────────────────────────────
  verifiedCard: {
    alignItems: 'center', gap: 12,
    borderRadius: 24, padding: 32,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 22, letterSpacing: -0.3,
  },
  verifiedSub: {
    fontSize: 14,
  },

  // ─── Loading ──────────────────────────────────────────────────────────────
  loadingZone: { alignItems: 'center', marginTop: 20 },
  loadingDot: {
    borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  loadingText: { fontSize: 14 },

  // ─── Support ───────────────────────────────────────────────────────────────
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    marginBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  supportText: { fontSize: 14 },
});
