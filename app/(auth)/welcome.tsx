// app/(auth)/welcome.tsx — FIXED Premium Welcome Screen
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { FONTS } from "@/hooks/use-app-theme";

const LOGO_WHITE = require("../../assets/logo-variants/logo-transparent-white.png");

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// ── Grid background ─────────────────────────────────────────────────────────
function GridLines() {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = "rgba(255,255,255,0.025)";

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
      {/* Fade-out mask — grid fades to bg from center downward */}
      <LinearGradient
        colors={["transparent", "transparent", C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ── Service ticker data ─────────────────────────────────────────────────────
const SERVICES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "water-outline", label: "Plomberie" },
  { icon: "flash-outline", label: "Électricité" },
  { icon: "home-outline", label: "Ménage" },
  { icon: "lock-closed-outline", label: "Serrurerie" },
  { icon: "brush-outline", label: "Peinture" },
  { icon: "hammer-outline", label: "Bricolage" },
  { icon: "flame-outline", label: "Chaudière" },
];

const TICKER_ITEM_H = 28;

// ── Colors (dark-only welcome) ──────────────────────────────────────────────
const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  greyFaint: "rgba(255,255,255,0.2)",
  border: "rgba(255,255,255,0.08)",
  green: "#3D8B3D",
  pill: "rgba(255,255,255,0.07)",
  pillBorder: "rgba(255,255,255,0.1)",
  pillText: "rgba(255,255,255,0.6)",
  outlineText: "rgba(255,255,255,0.3)",
};

// ── Ticker Component ────────────────────────────────────────────────────────
function ServiceTicker() {
  const translateY = useRef(new Animated.Value(0)).current;
  const idxRef = useRef(0);

  // Duplicate first item at end for seamless loop
  const items = [...SERVICES, SERVICES[0]];

  useEffect(() => {
    const total = SERVICES.length;

    const cycle = () => {
      idxRef.current += 1;

      Animated.timing(translateY, {
        toValue: -idxRef.current * TICKER_ITEM_H,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // When we reach the duplicate last item, snap back to start invisibly
        if (idxRef.current >= total) {
          idxRef.current = 0;
          translateY.setValue(0);
        }
      });
    };

    const interval = setInterval(cycle, 2200);
    return () => clearInterval(interval);
  }, [translateY]);

  return (
    <View style={s.tickerWrap}>
      <Text style={s.tickerLabel}>TEL QUE</Text>
      <View style={s.tickerWindow}>
        <Animated.View style={[s.tickerTrack, { transform: [{ translateY }] }]}>
          {items.map((svc, i) => (
            <View key={i} style={s.tickerItem}>
              <View style={s.tickerBadge}>
                <Ionicons name={svc.icon} size={12} color={C.pillText} />
                <Text style={s.tickerBadgeText}>{svc.label}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

// ── Green Dot (splash) ──────────────────────────────────────────────────────
function GreenDot() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring1Op = useRef(new Animated.Value(0.8)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring2Op = useRef(new Animated.Value(0.8)).current;
  const coreOp = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ringAnim = (scale: Animated.Value, op: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(op, { toValue: 0, duration: 2400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

    ringAnim(ring1, ring1Op, 0).start();
    ringAnim(ring2, ring2Op, 600).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(coreOp, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
        Animated.timing(coreOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const ringScale1 = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] });
  const ringScale2 = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] });

  return (
    <View style={s.greenDotWrap}>
      <Animated.View style={[s.greenRing, { opacity: ring1Op, transform: [{ scale: ringScale1 }] }]} />
      <Animated.View style={[s.greenRing, { opacity: ring2Op, transform: [{ scale: ringScale2 }] }]} />
      <Animated.View style={[s.greenCore, { opacity: coreOp }]} />
    </View>
  );
}

// ── Trust Dot ───────────────────────────────────────────────────────────────
function TrustBadge() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={s.trustRow}>
      <Animated.View style={[s.trustDot, { opacity }]} />
      <Text style={s.trustLabel}>14 prestataires actifs à Bruxelles</Text>
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Welcome() {
  const [phase, setPhase] = useState<"splash" | "main">("splash");

  // Splash anims
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const logoOp = useRef(new Animated.Value(0)).current;
  const logoTy = useRef(new Animated.Value(20)).current;
  const tagOp = useRef(new Animated.Value(0)).current;
  const tagTy = useRef(new Animated.Value(10)).current;
  const loaderWidth = useRef(new Animated.Value(0)).current;

  // Main screen anims
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroTy = useRef(new Animated.Value(16)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(16)).current;

  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  // ── Splash sequence ──
  useEffect(() => {
    // Logo + tagline reveal
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 900, easing: ease, useNativeDriver: true }),
        Animated.timing(logoTy, { toValue: 0, duration: 900, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(tagOp, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(tagTy, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();

    // Loading bar (non-native driver for width)
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(loaderWidth, { toValue: 1, duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }),
    ]).start();

    // Transition to main
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setPhase("main");
        animateMain();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const animateMain = useCallback(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(headerTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(heroTy, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(actionsOp, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(actionsTy, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // ── Glow animation ──
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
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

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Grid lines ── */}
      <GridLines />

      {/* ── Background glow ── */}
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.035)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* ── Splash overlay ── */}
      {phase === "splash" && (
        <Animated.View style={[s.splashContainer, { opacity: splashOpacity }]}>
          {/* Subtle center glow */}
          <View style={s.splashGlow}>
            <LinearGradient
              colors={["rgba(255,255,255,0.018)", "transparent"]}
              style={s.splashGlowGradient}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>

          {/* Logo image + tagline */}
          <Animated.View style={[s.splashLockup, { opacity: logoOp, transform: [{ translateY: logoTy }] }]}>
            <Image source={LOGO_WHITE} style={s.splashLogoImg} resizeMode="contain" />
          </Animated.View>

          <Animated.View style={[s.splashTagRow, { opacity: tagOp, transform: [{ translateY: tagTy }] }]}>
            <GreenDot />
            <Text style={s.splashTagline}>Services à la demande</Text>
          </Animated.View>

          {/* Loading bar */}
          <View style={s.loaderTrack}>
            <Animated.View
              style={[
                s.loaderFill,
                {
                  width: loaderWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      )}

      {/* ── Main screen ── */}
      {phase === "main" && (
        <View style={s.mainContainer}>
          {/* Header */}
          <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
            <View style={s.logoLockup}>
              <Text style={s.logoEyebrow}>Services à domicile</Text>
              <Text style={s.logoWordmark}>FIXED</Text>
            </View>
          </Animated.View>

          {/* Hero */}
          <Animated.View style={[s.hero, { opacity: heroOp, transform: [{ translateY: heroTy }] }]}>
            <Text style={s.heroKicker}>Bruxelles  ·  Disponible maintenant</Text>

            <View style={s.heroTitleWrap}>
              <Text style={s.heroTitle}>UN PRO</Text>
              <Text style={s.heroTitle}>
                CHEZ <Text style={s.heroTitleOutline}>VOUS</Text>
              </Text>
              <Text style={s.heroTitle}>EN 30 MIN</Text>
            </View>

            <Text style={s.heroSub}>
              Plomberie, électricité, ménage — réservé en quelques secondes.
            </Text>

            <ServiceTicker />
          </Animated.View>

          {/* Actions */}
          <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
            <TrustBadge />

            {/* Primary CTA */}
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(auth)/role-select");
              }}
            >
              <Text style={s.btnPrimaryText}>CRÉER UN COMPTE</Text>
              <View style={s.arrowPill}>
                <Ionicons name="arrow-forward" size={14} color={C.white} />
              </View>
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerLabel}>Déjà un compte ?</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Secondary CTA */}
            <TouchableOpacity
              style={s.btnSecondary}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(auth)/login");
              }}
            >
              <Ionicons name="log-in-outline" size={16} color="rgba(255,255,255,0.4)" />
              <Text style={s.btnSecondaryText}>Se connecter</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Background glow ──
  glowWrap: {
    position: "absolute",
    top: -120,
    left: (SCREEN_W - 480) / 2,
    width: 480,
    height: 480,
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 240,
  },

  // ── Splash ──
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: C.bg,
  },
  splashGlow: {
    position: "absolute",
    width: 500,
    height: 500,
  },
  splashGlowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 250,
  },
  splashLockup: {
    alignItems: "center",
  },
  splashLogoImg: {
    width: 200,
    height: 60,
  },
  splashTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  splashTagline: {
    fontFamily: FONTS.sansLight,
    fontSize: 10,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
  },

  // ── Green dot ──
  greenDotWrap: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  greenRing: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.green,
  },
  greenCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Loader ──
  loaderTrack: {
    position: "absolute",
    bottom: 80,
    width: 40,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  loaderFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1,
  },

  // ── Main screen ──
  mainContainer: {
    flex: 1,
  },

  // ── Header ──
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 44,
    paddingHorizontal: 32,
  },
  logoLockup: {
    gap: 1,
  },
  logoEyebrow: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    letterSpacing: 3,
    color: C.grey,
    textTransform: "uppercase",
  },
  logoWordmark: {
    fontFamily: FONTS.bebas,
    fontSize: 36,
    color: C.white,
    letterSpacing: 4,
    lineHeight: 40,
  },

  // ── Hero ──
  hero: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  heroKicker: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: C.grey,
    marginBottom: 12,
  },
  heroTitleWrap: {
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: FONTS.bebas,
    fontSize: SCREEN_H < 700 ? 48 : 56,
    lineHeight: SCREEN_H < 700 ? 58 : 66,
    color: C.white,
    letterSpacing: 1,
  },
  heroTitleOutline: {
    color: C.outlineText,
  },
  heroSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 14,
    lineHeight: 22,
    color: C.grey,
    maxWidth: 260,
  },

  // ── Ticker ──
  tickerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
  },
  tickerLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 2,
    color: C.greyFaint,
    textTransform: "uppercase",
  },
  tickerWindow: {
    height: TICKER_ITEM_H,
    overflow: "hidden",
    flex: 1,
  },
  tickerTrack: {
    flexDirection: "column",
  },
  tickerItem: {
    height: TICKER_ITEM_H,
    justifyContent: "center",
  },
  tickerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: C.pillBorder,
    borderRadius: 100,
  },
  tickerBadgeText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.pillText,
    letterSpacing: 0.3,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    gap: 12,
  },

  // ── Trust ──
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingBottom: 4,
  },
  trustDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  trustLabel: {
    fontFamily: FONTS.sansLight,
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 1,
  },

  // ── Primary button ──
  btnPrimary: {
    width: "100%",
    height: 60,
    backgroundColor: C.white,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
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
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Divider ──
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.greyFaint,
    letterSpacing: 1,
  },

  // ── Secondary button ──
  btnSecondary: {
    width: "100%",
    height: 60,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  btnSecondaryText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.white,
    letterSpacing: 0.5,
  },
});
