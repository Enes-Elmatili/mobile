// components/onboarding/OnboardingLayout.tsx — Dark premium wrapper for onboarding screens
import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  Dimensions, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { FONTS } from "@/hooks/use-app-theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  outlineText: "rgba(255,255,255,0.3)",
};

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

interface Props {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  showBack?: boolean;
  title: string;
  subtitle?: string;
  cta?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryCta?: {
    label: string;
    onPress: () => void;
  };
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  showBack = true,
  title,
  subtitle,
  cta,
  secondaryCta,
}: Props) {
  const canGoBack = router.canGoBack();
  const shouldShowBack = showBack && (!!onBack || canGoBack);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  // Glow animation
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOp, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.025)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Header */}
      <View style={s.header}>
        <View style={s.navRow}>
          {shouldShowBack ? (
            <TouchableOpacity
              style={s.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}

          <View style={s.stepIndicator}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View key={i} style={[s.stepBar, i < currentStep ? s.stepBarActive : s.stepBarInactive]} />
            ))}
            <Text style={s.stepLabel}>
              <Text style={s.stepLabelBold}>{String(currentStep).padStart(2, "0")}</Text>
              {" / "}
              {String(totalSteps).padStart(2, "0")}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.title}>{title}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          <View style={s.content}>{children}</View>
        </ScrollView>

        {/* CTA */}
        {cta && (
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.btnPrimary, cta.disabled && { opacity: 0.4 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                cta.onPress();
              }}
              disabled={cta.disabled || cta.loading}
              activeOpacity={0.9}
            >
              <Text style={s.btnPrimaryText}>
                {cta.loading ? "CHARGEMENT..." : cta.label.toUpperCase()}
              </Text>
              {!cta.loading && !cta.disabled && (
                <View style={s.arrowPill}>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </View>
              )}
            </TouchableOpacity>

            {secondaryCta && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  secondaryCta.onPress();
                }}
                style={s.secondaryCta}
                activeOpacity={0.7}
              >
                <Text style={s.secondaryCtaText}>{secondaryCta.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  glowWrap: {
    position: "absolute", top: -80,
    left: (SCREEN_W - 420) / 2, width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingHorizontal: 28,
    zIndex: 2,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  stepBar: { height: 2, borderRadius: 2 },
  stepBarActive: { width: 36, backgroundColor: C.white },
  stepBarInactive: { width: 20, backgroundColor: "rgba(255,255,255,0.12)" },
  stepLabel: {
    fontFamily: FONTS.sans, fontSize: 10, letterSpacing: 2,
    color: "rgba(255,255,255,0.25)", marginLeft: 4,
  },
  stepLabelBold: { color: "rgba(255,255,255,0.5)" },

  // Content
  scrollContent: {
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 24,
  },
  title: {
    fontFamily: FONTS.bebas, fontSize: 36, color: C.white,
    letterSpacing: 1, lineHeight: 40, marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 14, lineHeight: 22,
    color: C.grey, marginBottom: 28,
  },
  content: { flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    paddingTop: 12, gap: 12, zIndex: 2,
  },
  btnPrimary: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 2, color: C.bg, flexShrink: 1,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },
  secondaryCta: { alignItems: "center", paddingVertical: 4 },
  secondaryCtaText: {
    fontFamily: FONTS.sansMedium, fontSize: 13,
    color: C.outlineText,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.12)",
  },
});
