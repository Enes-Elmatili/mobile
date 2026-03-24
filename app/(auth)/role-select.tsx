// app/(auth)/role-select.tsx — Sélection du rôle (premium dark)
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated, Easing, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '@/lib/api';
import { FONTS } from '@/hooks/use-app-theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GRID_SIZE = 40;
const ROLE_INTENT_KEY = '@fixed:signup:role';

// ── Colors (dark-only) ──────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0A',
  white: '#FAFAFA',
  grey: '#888888',
  border: 'rgba(255,255,255,0.08)',
  cardBg: '#141414',
  iconBg: 'rgba(255,255,255,0.06)',
  iconBorder: 'rgba(255,255,255,0.08)',
  selectedCardBg: 'rgba(255,255,255,0.04)',
  outlineText: 'rgba(255,255,255,0.3)',
  radioBorder: 'rgba(255,255,255,0.2)',
  loginMuted: 'rgba(255,255,255,0.3)',
  loginText: 'rgba(255,255,255,0.7)',
};

// ── Grid background ─────────────────────────────────────────────────────────
function GridLines() {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = 'rgba(255,255,255,0.025)';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
      <LinearGradient
        colors={['transparent', 'transparent', C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ── Role Card ───────────────────────────────────────────────────────────────
function RoleCard({
  icon, title, subtitle, isSelected, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const radioDot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(radioDot, {
      toValue: isSelected ? 1 : 0,
      friction: 6, tension: 200,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[
          s.card,
          isSelected && s.cardSelected,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Icon */}
        <View style={[s.cardIcon, isSelected && s.cardIconSelected]}>
          <Ionicons name={icon} size={20} color={isSelected ? C.bg : 'rgba(255,255,255,0.7)'} />
        </View>

        {/* Text */}
        <View style={s.cardText}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{subtitle}</Text>
        </View>

        {/* Radio */}
        <View style={[s.radio, isSelected && s.radioSelected]}>
          <Animated.View style={[s.radioInner, { transform: [{ scale: radioDot }] }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function RoleSelect() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [selected, setSelected] = useState<'CLIENT' | 'PROVIDER' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAuthenticated = !!user;

  // Entrance animations
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroTy = useRef(new Animated.Value(16)).current;
  const cardsOp = useRef(new Animated.Value(0)).current;
  const cardsTy = useRef(new Animated.Value(16)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(16)).current;

  // Glow
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.6)).current;

  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  useEffect(() => {
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(headerOp, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(headerTy, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(heroTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardsOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(cardsTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(actionsOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(actionsTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOp, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.6, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const select = (role: 'CLIENT' | 'PROVIDER') => {
    setSelected(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = async () => {
    if (!selected || submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isAuthenticated) {
      setSubmitting(true);
      try {
        const res = await api.auth.assignRole(selected);
        if (res?.token) {
          await signIn(res.token);
        }
        if (selected === 'PROVIDER') {
          router.replace('/onboarding/documents');
          return;
        }
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || "Impossible d'attribuer le rôle");
        setSubmitting(false);
      }
    } else {
      await AsyncStorage.setItem(ROLE_INTENT_KEY, selected);
      router.push('/(auth)/signup');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Background */}
      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.03)', 'transparent']}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
        <View style={s.headerRow}>
          {!isAuthenticated ? (
            <Pressable
              style={s.backBtn}
              onPress={() => { Haptics.selectionAsync(); router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'); }}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={s.logoEyebrow}>Inscription</Text>
          <View style={{ width: 36 }} />
        </View>
      </Animated.View>

      {/* Hero */}
      <Animated.View style={[s.hero, { opacity: heroOp, transform: [{ translateY: heroTy }] }]}>
        <Text style={s.heroKicker}>Étape 1 sur 3</Text>
        <View>
          <Text style={s.heroTitle}>JE SUIS</Text>
          <Text style={[s.heroTitle, s.heroTitleOutline]}>QUI ?</Text>
        </View>
        <Text style={s.heroSub}>Choisissez votre profil pour personnaliser l'expérience.</Text>
      </Animated.View>

      {/* Cards — flex spacer pushes actions to bottom */}
      <View style={{ flex: 1, justifyContent: 'flex-start' }}>
        <Animated.View style={[s.cards, { opacity: cardsOp, transform: [{ translateY: cardsTy }] }]}>
          <RoleCard
            icon="person-outline"
            title="CLIENT"
            subtitle={'Je cherche un prestataire\npour mon domicile'}
            isSelected={selected === 'CLIENT'}
            onPress={() => select('CLIENT')}
          />
          <RoleCard
            icon="construct-outline"
            title="PRESTATAIRE"
            subtitle={'Je propose mes services\net gère mes missions'}
            isSelected={selected === 'PROVIDER'}
            onPress={() => select('PROVIDER')}
          />
        </Animated.View>
      </View>

      {/* Actions */}
      <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
        <TouchableOpacity
          style={[s.btnPrimary, !selected && s.btnPrimaryDisabled, submitting && { opacity: 0.6 }]}
          activeOpacity={0.9}
          onPress={confirm}
          disabled={!selected || submitting}
        >
          <Text style={s.btnPrimaryText}>{submitting ? 'CHARGEMENT...' : 'CONTINUER'}</Text>
          {selected && (
            <View style={s.arrowPill}>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </View>
          )}
        </TouchableOpacity>

        {!isAuthenticated && (
          <TouchableOpacity
            style={s.loginRow}
            activeOpacity={0.7}
            onPress={() => { Haptics.selectionAsync(); router.push('/(auth)/login'); }}
          >
            <Text style={s.loginLabel}>Déjà un compte ?</Text>
            <Text style={s.loginLink}>Se connecter</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Glow ──
  glowWrap: {
    position: 'absolute',
    top: -120,
    left: (SCREEN_W - 480) / 2,
    width: 480,
    height: 480,
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 240,
  },

  // ── Header ──
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 28,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEyebrow: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 3,
    color: C.grey,
    textTransform: 'uppercase',
  },

  // ── Hero ──
  hero: {
    paddingTop: 28,
    paddingHorizontal: 32,
    zIndex: 2,
  },
  heroKicker: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: C.grey,
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: FONTS.bebas,
    fontSize: SCREEN_H < 700 ? 50 : 58,
    lineHeight: SCREEN_H < 700 ? 60 : 68,
    color: C.white,
    letterSpacing: 1,
  },
  heroTitleOutline: {
    color: C.outlineText,
  },
  heroSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    lineHeight: 20,
    color: C.grey,
    marginTop: 6,
  },

  // ── Cards ──
  cards: {
    paddingTop: 28,
    paddingHorizontal: 28,
    gap: 14,
    zIndex: 2,
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 24,
  },
  cardSelected: {
    borderColor: C.white,
    backgroundColor: C.selectedCardBg,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.iconBg,
    borderWidth: 1,
    borderColor: C.iconBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconSelected: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FONTS.bebas,
    fontSize: 26,
    color: C.white,
    letterSpacing: 2,
    lineHeight: 30,
    marginBottom: 3,
  },
  cardSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 12,
    color: C.grey,
    lineHeight: 17,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.radioBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: C.white,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.white,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    gap: 12,
    zIndex: 2,
  },
  btnPrimary: {
    width: '100%',
    height: 60,
    backgroundColor: C.white,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnPrimaryDisabled: {
    opacity: 0.3,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas,
    fontSize: 20,
    letterSpacing: 3,
    color: C.bg,
  },
  arrowPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  loginLabel: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    color: C.loginMuted,
  },
  loginLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.loginText,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.2)',
  },
});
