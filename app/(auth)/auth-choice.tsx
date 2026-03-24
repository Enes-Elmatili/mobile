// app/(auth)/auth-choice.tsx — FIXED Premium Auth Choice (dark design)
import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated, Easing, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

export default function AuthChoice() {
  const router = useRouter();

  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyTy = useRef(new Animated.Value(14)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(14)).current;

  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerOp, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(headerTy, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(bodyOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(bodyTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
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
      <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.canGoBack() ? router.back() : router.replace("/(auth)/welcome");
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={s.logoEyebrow}>Bienvenue</Text>
        <Text style={s.logoWordmark}>
          COMMENT{"\n"}
          <Text style={s.logoWordmarkOutline}>CONTINUER ?</Text>
        </Text>
      </Animated.View>

      {/* Cards */}
      <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(auth)/login");
          }}
        >
          <View style={s.cardIconWrap}>
            <Ionicons name="log-in-outline" size={20} color={C.white} />
          </View>
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>Se connecter</Text>
            <Text style={s.cardSub}>J'ai déjà un compte</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.card}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(auth)/role-select");
          }}
        >
          <View style={s.cardIconWrap}>
            <Ionicons name="person-add-outline" size={20} color={C.white} />
          </View>
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>Créer un compte</Text>
            <Text style={s.cardSub}>Nouveau sur FIXED</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
        <TouchableOpacity
          style={s.btnPrimary}
          activeOpacity={0.9}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(auth)/role-select");
          }}
        >
          <Text style={s.btnPrimaryText}>COMMENCER</Text>
          <View style={s.arrowPill}>
            <Ionicons name="arrow-forward" size={14} color={C.white} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  glowWrap: {
    position: "absolute", top: -80,
    left: (SCREEN_W - 420) / 2, width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingHorizontal: 32,
    zIndex: 2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
    marginBottom: 28,
  },
  logoEyebrow: {
    fontFamily: FONTS.sans, fontSize: 11, letterSpacing: 3,
    color: C.grey, textTransform: "uppercase", marginBottom: 4,
  },
  logoWordmark: {
    fontFamily: FONTS.bebas, fontSize: 48, color: C.white,
    letterSpacing: 2, lineHeight: 50,
  },
  logoWordmarkOutline: { color: C.outlineText },

  // Body
  body: {
    flex: 1, paddingHorizontal: 28, justifyContent: "center",
    gap: 12, zIndex: 2,
  },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 18, gap: 14,
  },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontFamily: FONTS.sansMedium, fontSize: 16, color: C.white, marginBottom: 2,
  },
  cardSub: {
    fontFamily: FONTS.sansLight, fontSize: 13, color: C.grey,
  },

  // Actions
  actions: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    zIndex: 2,
  },
  btnPrimary: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },
});
