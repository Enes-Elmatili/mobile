// screens/WelcomeSplash.tsx
// FIXED — Premium Welcome / Onboarding Splash
// Stack: React Native + Expo + expo-router
// Dependencies: expo install expo-haptics expo-linear-gradient

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle as SvgCircle } from "react-native-svg";
import { router } from "expo-router";

const { height: SCREEN_H } = Dimensions.get("window");

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
const SCREENS = [
  {
    tag: "MÉNAGE · BRICOLAGE · PLOMBERIE",
    headline: "Votre problème.\nNotre expert.",
    sub: "Un prestataire qualifié chez vous en moins de 30 minutes.",
    visual: "home",
  },
  {
    tag: "SUIVI EN TEMPS RÉEL",
    headline: "Suivez chaque\nétape en direct.",
    sub: "De l'acceptation à l'arrivée, gardez le contrôle total.",
    visual: "track",
  },
  {
    tag: "PAIEMENT SÉCURISÉ",
    headline: "Payez en un\ngeste. C'est fixé.",
    sub: "Prix transparent, pas de surprise. Paiement Stripe intégré.",
    visual: "pay",
  },
];

// ─────────────────────────────────────────────
// VISUAL: Radar / Concentric rings
// ─────────────────────────────────────────────
function RadarVisual({ active }: { active: boolean }) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.5)).current;
  const opacity2 = useRef(new Animated.Value(0.35)).current;
  const opacity3 = useRef(new Animated.Value(0.2)).current;
  const orbitAngle = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const pulseAnim = (val: Animated.Value, opVal: Animated.Value, opBase: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(val, {
              toValue: 1.1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opVal, {
              toValue: opBase * 0.4,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(val, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opVal, {
              toValue: opBase,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

    pulseAnim(ring1, opacity1, 0.5, 0).start();
    pulseAnim(ring2, opacity2, 0.35, 400).start();
    pulseAnim(ring3, opacity3, 0.2, 800).start();

    Animated.loop(
      Animated.timing(orbitAngle, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [active, fadeIn, opacity1, opacity2, opacity3, orbitAngle, ring1, ring2, ring3]);

  const orbitRotate = orbitAngle.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const rings = [
    { size: 80, scale: ring1, op: opacity1, border: 2 },
    { size: 150, scale: ring2, op: opacity2, border: 1 },
    { size: 220, scale: ring3, op: opacity3, border: 1 },
  ];

  return (
    <Animated.View style={[styles.visualContainer, { opacity: fadeIn }]}>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: r.size,
            height: r.size,
            borderRadius: r.size / 2,
            borderWidth: r.border,
            borderColor: "#fff",
            opacity: r.op,
            transform: [{ scale: r.scale }],
          }}
        />
      ))}
      {/* Center dot */}
      <View style={styles.centerDot} />
      {/* Orbiting dot */}
      <Animated.View
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          alignItems: "center",
          transform: [{ rotate: orbitRotate }],
        }}
      >
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: "rgba(255,255,255,0.6)",
            position: "absolute",
            top: -40,
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// VISUAL: Route / Tracking
// ─────────────────────────────────────────────
function TrackVisual({ active }: { active: boolean }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pathProgress = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const endDotScale = useRef(new Animated.Value(0)).current;
  const movingDotY = useRef(new Animated.Value(0)).current;
  const movingDotX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(pathProgress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.parallel([
        Animated.spring(endDotScale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Moving dot loop
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(movingDotY, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(movingDotX, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 1800);
  }, [active, dotOpacity, endDotScale, fadeIn, movingDotX, movingDotY, pathProgress]);

  const moveDotTranslateY = movingDotY.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -90, -180],
  });
  const moveDotTranslateX = movingDotX.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 65, 135],
  });

  // Tracé animé de la courbe : strokeDashoffset passe de 400 → 0 au fil de pathProgress
  const TRACK_PATH_LENGTH = 400;
  const animatedTrackOffset = pathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_PATH_LENGTH, 0],
  });

  return (
    <Animated.View style={[styles.visualContainer, { opacity: fadeIn }]}>
      {/* Dashed background path + animated progress path */}
      <Svg
        width={260}
        height={260}
        viewBox="0 0 260 260"
        style={{ position: "absolute" }}
      >
        {/* Fond en tirets */}
        <Path
          d="M 60 220 Q 60 130 130 130 Q 200 130 200 40"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
          strokeDasharray="6,6"
          fill="none"
        />
        {/* Ligne animée qui se trace au fil de pathProgress */}
        <AnimatedPath
          d="M 60 220 Q 60 130 130 130 Q 200 130 200 40"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2}
          fill="none"
          strokeDasharray={TRACK_PATH_LENGTH}
          strokeDashoffset={animatedTrackOffset}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Start point */}
      <View
        style={{
          position: "absolute",
          bottom: 28,
          left: 48,
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: "rgba(255,255,255,0.4)",
        }}
      />

      {/* End point */}
      <Animated.View
        style={{
          position: "absolute",
          top: 26,
          right: 50,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: "#fff",
          transform: [{ scale: endDotScale }],
          shadowColor: "#fff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
        }}
      />

      {/* Moving dot */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 32,
          left: 52,
          width: 9,
          height: 9,
          borderRadius: 4.5,
          backgroundColor: "#fff",
          opacity: dotOpacity,
          transform: [
            { translateY: moveDotTranslateY },
            { translateX: moveDotTranslateX },
          ],
          shadowColor: "#fff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        }}
      />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// VISUAL: Checkmark / Payment confirmed
// ─────────────────────────────────────────────
function PayVisual({ active }: { active: boolean }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const circleProgress = useRef(new Animated.Value(0)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(circleProgress, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(checkProgress, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [active, checkProgress, circleProgress, fadeIn]);

  const circumference = 2 * Math.PI * 60;
  const circleDash = circleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const checkDash = checkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  return (
    <Animated.View style={[styles.visualContainer, { opacity: fadeIn }]}>
      <Svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background circle */}
        <SvgCircle
          cx={70}
          cy={70}
          r={60}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1.5}
          fill="none"
        />
        {/* Animated circle */}
        <AnimatedSvgCircle
          cx={70}
          cy={70}
          r={60}
          stroke="#fff"
          strokeWidth={2}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circleDash}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        {/* Animated checkmark */}
        <AnimatedPath
          d="M 45 72 L 63 88 L 98 53"
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="80"
          strokeDashoffset={checkDash}
        />
      </Svg>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// VISUAL SWITCHER
// ─────────────────────────────────────────────
function VisualSwitcher({ type, active }: { type: string; active: boolean }) {
  if (type === "home") return <RadarVisual active={active} />;
  if (type === "track") return <TrackVisual active={active} />;
  if (type === "pay") return <PayVisual active={active} />;
  return null;
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function WelcomeSplash() {
  const [phase, setPhase] = useState("splash"); // splash | onboarding
  const [currentScreen, setCurrentScreen] = useState(0);
  const [contentActive, setContentActive] = useState(false);
  const transitioningRef = useRef(false);

  // Splash animations
  const lineScaleX = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(10)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Onboarding content animations
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagTransY = useRef(new Animated.Value(10)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTransY = useRef(new Animated.Value(18)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const subTransY = useRef(new Animated.Value(14)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTransY = useRef(new Animated.Value(12)).current;

  // Dot widths
  const dotWidths = useRef(SCREENS.map(() => new Animated.Value(8))).current;

  // useRef pour stabiliser la référence — évite que animateContentIn/animateDots
  // soient recréées à chaque render et re-déclenchent le useEffect splash
  const ease = useRef(Easing.bezier(0.16, 1, 0.3, 1)).current;

  // ── Splash sequence ──
  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.delay(400),
      // Line expand
      Animated.timing(lineScaleX, {
        toValue: 1,
        duration: 700,
        easing: ease,
        useNativeDriver: true,
      }),
      // Logo fade in
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 800,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      // Tagline
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 700,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 700,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      // Hold
      Animated.delay(1200),
      // Fade out splash
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    sequence.start(() => {
      setPhase("onboarding");
      animateContentIn();
      animateDots(0);
    });
  }, [animateContentIn, animateDots, ease, lineScaleX, logoOpacity, logoTranslateY, splashOpacity, taglineOpacity, taglineTranslateY]);

  // ── Content animations ──
  const animateContentIn = useCallback(() => {
    tagOpacity.setValue(0);
    tagTransY.setValue(10);
    headlineOpacity.setValue(0);
    headlineTransY.setValue(18);
    subOpacity.setValue(0);
    subTransY.setValue(14);
    ctaOpacity.setValue(0);
    ctaTransY.setValue(12);

    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(tagTransY, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(headlineTransY, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(subTransY, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(ctaTransY, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
    ]).start(() => setContentActive(true));
  }, [ctaOpacity, ctaTransY, ease, headlineOpacity, headlineTransY, subOpacity, subTransY, tagOpacity, tagTransY]);

  const animateContentOut = useCallback(() => {
    setContentActive(false);
    return new Promise((resolve) => {
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(headlineOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(subOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(ctaOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(resolve);
    });
  }, [ctaOpacity, headlineOpacity, subOpacity, tagOpacity]);

  const animateDots = useCallback((idx: number) => {
    SCREENS.forEach((_, i) => {
      Animated.timing(dotWidths[i], {
        toValue: i === idx ? 28 : 8,
        duration: 400,
        easing: ease,
        useNativeDriver: false,
      }).start();
    });
  }, [dotWidths, ease]);

  // ── Navigation ──
  const goToScreen = useCallback(
    async (idx: number) => {
      if (idx === currentScreen || transitioningRef.current) return;
      transitioningRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await animateContentOut();
      setCurrentScreen(idx);
      animateDots(idx);
      setTimeout(() => {
        animateContentIn();
        transitioningRef.current = false;
      }, 80);
    },
    [currentScreen]
  );

  const nextScreen = useCallback(() => {
    if (currentScreen < SCREENS.length - 1) {
      goToScreen(currentScreen + 1);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push("/onboarding/role-selector");
    }
  }, [currentScreen, goToScreen]);

  const prevScreen = useCallback(() => {
    if (currentScreen > 0) goToScreen(currentScreen - 1);
  }, [currentScreen, goToScreen]);

  // ── Swipe gesture ──
  // Les refs évitent le stale-closure : panResponder est créé une seule fois
  // mais ses callbacks appellent toujours la version la plus récente des handlers.
  const nextScreenRef = useRef(nextScreen);
  const prevScreenRef = useRef(prevScreen);
  nextScreenRef.current = nextScreen;
  prevScreenRef.current = prevScreen;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) nextScreenRef.current();
        else if (gs.dx > 50) prevScreenRef.current();
      },
    })
  ).current;

  const screen = SCREENS[currentScreen];

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Subtle ambient glow */}
      <LinearGradient
        colors={["rgba(255,255,255,0.04)", "transparent"]}
        style={styles.ambientGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.7 }}
      />

      {/* ═══ SPLASH PHASE ═══ */}
      {phase === "splash" && (
        <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
          {/* Expanding line */}
          <Animated.View
            style={[
              styles.splashLine,
              { transform: [{ scaleX: lineScaleX }] },
            ]}
          />

          {/* Logo */}
          <Animated.Text
            style={[
              styles.splashLogo,
              {
                opacity: logoOpacity,
                transform: [{ translateY: logoTranslateY }],
              },
            ]}
          >
            FIXED
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text
            style={[
              styles.splashTagline,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslateY }],
              },
            ]}
          >
            SERVICES À LA DEMANDE
          </Animated.Text>
        </Animated.View>
      )}

      {/* ═══ ONBOARDING PHASE ═══ */}
      {phase === "onboarding" && (
        <View style={styles.onboardingContainer} {...panResponder.panHandlers}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.topLogo}>FIXED</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/onboarding/role-selector");
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.skipBtn}>Passer</Text>
            </TouchableOpacity>
          </View>

          {/* Content area */}
          <View style={styles.contentArea}>
            {/* Tag */}
            <Animated.Text
              style={[
                styles.tag,
                {
                  opacity: tagOpacity,
                  transform: [{ translateY: tagTransY }],
                },
              ]}
            >
              {screen.tag}
            </Animated.Text>

            {/* Visual */}
            <View style={styles.visualWrapper}>
              <VisualSwitcher type={screen.visual} active={contentActive} />
            </View>

            {/* Headline */}
            <Animated.Text
              style={[
                styles.headline,
                {
                  opacity: headlineOpacity,
                  transform: [{ translateY: headlineTransY }],
                },
              ]}
            >
              {screen.headline}
            </Animated.Text>

            {/* Subtitle */}
            <Animated.Text
              style={[
                styles.subtitle,
                {
                  opacity: subOpacity,
                  transform: [{ translateY: subTransY }],
                },
              ]}
            >
              {screen.sub}
            </Animated.Text>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Dots */}
            <View style={styles.dotsRow}>
              {SCREENS.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => goToScreen(i)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                >
                  <Animated.View
                    style={[
                      styles.dot,
                      {
                        width: dotWidths[i],
                        backgroundColor:
                          i === currentScreen
                            ? "#fff"
                            : "rgba(255,255,255,0.15)",
                      },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* CTA */}
            <Animated.View
              style={{
                opacity: ctaOpacity,
                transform: [{ translateY: ctaTransY }],
              }}
            >
              <TouchableOpacity
                style={styles.ctaButton}
                activeOpacity={0.85}
                onPress={nextScreen}
              >
                <Text style={styles.ctaText}>
                  {currentScreen < SCREENS.length - 1
                    ? "Continuer"
                    : "Commencer"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Home indicator placeholder */}
            <View style={styles.homeIndicator} />
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.5,
    zIndex: 0,
  },

  // ── Splash ──
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  splashLine: {
    width: 56,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginBottom: 26,
  },
  splashLogo: {
    fontFamily: "System",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 10,
    color: "#fff",
  },
  splashTagline: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 4,
    color: "rgba(255,255,255,0.3)",
    marginTop: 16,
  },

  // ── Onboarding ──
  onboardingContainer: {
    flex: 1,
    zIndex: 5,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 28,
  },
  topLogo: {
    fontFamily: "System",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 4,
    color: "#fff",
  },
  skipBtn: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.5,
  },

  // ── Content ──
  contentArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },
  tag: {
    fontFamily: "System",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 3,
    color: "rgba(255,255,255,0.28)",
    textTransform: "uppercase",
    marginBottom: 36,
  },
  visualWrapper: {
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 44,
  },
  visualContainer: {
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  headline: {
    fontFamily: "System",
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  subtitle: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "300",
    lineHeight: 22,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    paddingHorizontal: 48,
    marginTop: 14,
  },

  // ── Bottom ──
  bottomControls: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    letterSpacing: 0.5,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginTop: 16,
  },
});