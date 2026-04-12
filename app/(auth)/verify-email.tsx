// app/(auth)/verify-email.tsx — FIXED Premium Verify Email (dark design)
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated, Easing, Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { CLIENT_FLOW, PROVIDER_FLOW } from "@/constants/onboardingFlows";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme, FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;
const ROLE_INTENT_KEY = "@fixed:signup:role";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  bg:          darkTokens.bg,
  white:       darkTokens.text,
  grey:        darkTokens.textMuted,
  border:      "rgba(255,255,255,0.08)",
  cardBg:      darkTokens.cardBg,
  inputBg:     darkTokens.cardBg,
  green:       COLORS.greenBrand,
  amber:       COLORS.amber,
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

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { refreshMe, signOut } = useAuth();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(r => setRole(r));
  }, []);

  // Poll /auth/me every 4s — single effect, no re-trigger on state change
  useEffect(() => {
    let cancelled = false;
    pollRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await api.get("/auth/me");
        if (res?.user?.emailVerified && !cancelled) {
          if (pollRef.current) clearInterval(pollRef.current);
          setVerified(true);
          refreshMe().catch(() => {});
        }
      } catch {}
    }, 4000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
    } catch {}
    finally { setResending(false); }
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let detectedRole = await AsyncStorage.getItem(ROLE_INTENT_KEY);
    if (!detectedRole) {
      try {
        const res = await api.get("/auth/me");
        if (res?.user?.roles?.includes("PROVIDER")) detectedRole = "PROVIDER";
      } catch {}
    }
    await AsyncStorage.removeItem(ROLE_INTENT_KEY).catch(() => {});
    if (detectedRole === "PROVIDER") {
      router.replace("/onboarding/documents");
    } else {
      await AsyncStorage.removeItem("onboarding_data").catch(() => {});
      router.replace("/(tabs)/dashboard");
    }
  };

  // Step indicator
  const stepNum = role === "PROVIDER"
    ? PROVIDER_FLOW.steps.VERIFY_EMAIL
    : CLIENT_FLOW.steps.VERIFY_EMAIL;
  const totalSteps = role === "PROVIDER" ? PROVIDER_FLOW.totalSteps : CLIENT_FLOW.totalSteps;

  // Animations
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyTy = useRef(new Animated.Value(14)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(14)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpAnim = useRef(new Animated.Value(0.5)).current;

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
          Animated.timing(glowOpAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOpAnim, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Pulsing dot for "checking" state
  const pulseOp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (verified) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOp, { toValue: 0.35, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseOp, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [verified]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOpAnim, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.025)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Header */}
      <Animated.View style={[s.header, { paddingTop: insets.top + 12, opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
        <View style={s.navRow}>
          <View style={{ width: 36 }} />
          <View style={s.stepIndicator}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View key={i} style={[s.stepBar, i < stepNum ? s.stepBarActive : s.stepBarInactive]} />
            ))}
            <Text style={s.stepLabel}>
              <Text style={s.stepLabelBold}>{String(stepNum).padStart(2, "0")}</Text>
              {" / "}
              {String(totalSteps).padStart(2, "0")}
            </Text>
          </View>
        </View>

        {/* Icon */}
        <View style={s.iconRow}>
          <View style={[s.iconWrap, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }, verified && s.iconWrapVerified]}>
            <Feather
              name={verified ? "check-circle" : "mail"}
              size={34}
              color={verified ? C.green : theme.text}
            />
            {!verified && (
              <Animated.View style={[s.iconDot, { opacity: pulseOp }]} />
            )}
          </View>
        </View>

        <Text style={[s.logoEyebrow, { color: theme.textMuted }]}>
          {verified ? "Confirmation" : "Vérification"}
        </Text>
        <Text style={[s.logoWordmark, { color: theme.text }]}>
          {verified ? (
            <>EMAIL{"\n"}<Text style={[s.logoWordmarkOutline, { color: theme.textMuted }]}>VÉRIFIÉ !</Text></>
          ) : (
            <>VÉRIFIEZ{"\n"}<Text style={[s.logoWordmarkOutline, { color: theme.textMuted }]}>VOTRE EMAIL.</Text></>
          )}
        </Text>
      </Animated.View>

      {/* Body */}
      <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
        <Text style={[s.subtitle, { color: theme.textSub }]}>
          {verified
            ? "Votre adresse email a été confirmée avec succès."
            : <>
                {"Un lien a été envoyé à\n"}
                <Text style={[s.emailText, { color: theme.text }]}>{email || "votre adresse email"}</Text>
              </>
          }
        </Text>

        {!verified && (
          <>
            {/* Info card */}
            <View style={[s.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Feather name="info" size={16} color={theme.textMuted} style={{ marginTop: 1 }} />
              <Text style={[s.infoText, { color: theme.textSub }]}>
                Cliquez sur le lien dans l'email pour activer votre compte. Le lien expire dans 48 heures.
              </Text>
            </View>

            {/* Resend button */}
            <TouchableOpacity
              style={[s.resendBtn, { borderColor: theme.borderLight }, (resending || resent) && { borderColor: theme.textDisabled }]}
              onPress={handleResend}
              disabled={resending || resent}
              activeOpacity={0.7}
            >
              {resending
                ? <ActivityIndicator size="small" color={theme.text} />
                : resent
                  ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="check" size={14} color={theme.textMuted} />
                      <Text style={[s.resendText, { color: theme.textMuted }]}>Email renvoyé</Text>
                    </View>
                  )
                  : <Text style={[s.resendText, { color: theme.text }]}>Renvoyer le lien</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[s.actions, { paddingBottom: insets.bottom + 16, opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: theme.accent }, !verified && { opacity: 0.35 }]}
          onPress={handleContinue}
          disabled={!verified}
          activeOpacity={0.9}
        >
          <Text style={[s.btnPrimaryText, { color: theme.accentText }]}>CONTINUER</Text>
          <View style={[s.arrowPill, { backgroundColor: theme.bg }]}>
            <Feather name="arrow-right" size={14} color={theme.text} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            signOut();
            router.replace("/(auth)/welcome");
          }}
          activeOpacity={0.6}
          style={s.logoutLink}
        >
          <Feather name="log-out" size={14} color={theme.textMuted} />
          <Text style={[s.logoutText, { color: theme.textSub }]}>Se déconnecter</Text>
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
    paddingTop: 50, // fallback; overridden inline with insets.top + 12
    paddingHorizontal: 28,
    zIndex: 2,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 28,
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

  iconRow: { marginBottom: 20 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.cardBg,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start",
  },
  iconWrapVerified: {
    backgroundColor: "rgba(61,139,61,0.1)",
    borderColor: "rgba(61,139,61,0.3)",
  },
  iconDot: {
    position: "absolute", bottom: -5, right: -5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.amber, borderWidth: 2.5, borderColor: C.bg,
  },

  logoEyebrow: {
    fontFamily: FONTS.sans, fontSize: 11, letterSpacing: 3,
    color: C.grey, textTransform: "uppercase", marginBottom: 4,
  },
  logoWordmark: {
    fontFamily: FONTS.bebas, fontSize: 42, color: C.white,
    letterSpacing: 2, lineHeight: 46,
  },
  logoWordmarkOutline: { color: C.outlineText },

  // Body
  body: {
    flex: 1, paddingHorizontal: 28, paddingTop: 24,
    gap: 20, zIndex: 2,
  },
  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15, lineHeight: 22,
    color: C.grey,
  },
  emailText: {
    fontFamily: FONTS.mono, fontSize: 14, color: C.white,
  },
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16,
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 13,
    lineHeight: 20, color: "rgba(255,255,255,0.5)",
  },
  resendBtn: {
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  resendText: {
    fontFamily: FONTS.sansMedium, fontSize: 13, letterSpacing: 0.5,
    color: C.white,
  },

  // Actions
  actions: {
    paddingHorizontal: 28,
    paddingBottom: 32, // fallback; overridden inline with insets.bottom + 16
    gap: 12, zIndex: 2,
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
  hint: {
    fontFamily: FONTS.sansLight, fontSize: 12, color: "rgba(255,255,255,0.2)",
    textAlign: "center",
  },
  logoutLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 8, marginTop: 4,
  },
  logoutText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.grey,
    textDecorationLine: "underline", textDecorationColor: "rgba(255,255,255,0.12)",
  },
});
