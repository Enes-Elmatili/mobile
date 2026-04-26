// app/(auth)/verify-email.tsx — verify email (inverted gradient)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { CLIENT_FLOW, PROVIDER_FLOW } from "@/constants/onboardingFlows";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  authT,
  alpha,
} from "@/components/auth";

const ROLE_INTENT_KEY = "@fixed:signup:role";

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { refreshMe, signOut } = useAuth();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(setRole);
  }, []);

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
    } catch {} finally {
      setResending(false);
    }
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

  const stepNum = role === "PROVIDER"
    ? PROVIDER_FLOW.steps.VERIFY_EMAIL
    : CLIENT_FLOW.steps.VERIFY_EMAIL;
  const totalSteps = role === "PROVIDER" ? PROVIDER_FLOW.totalSteps : CLIENT_FLOW.totalSteps;

  // Entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

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
    <AuthScreen variant="inverted">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* Step indicator (top right) */}
        <View style={s.topRow}>
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
        <View style={[s.iconWrap, verified && s.iconWrapVerified]}>
          <Feather
            name={verified ? "check-circle" : "mail"}
            size={34}
            color={verified ? COLORS.greenBrand : authT.textOnDark}
          />
          {!verified && <Animated.View style={[s.iconDot, { opacity: pulseOp }]} />}
        </View>

        <AuthHeadline
          kicker={verified ? "CONFIRMATION" : "VÉRIFICATION"}
          title={
            verified
              ? "EMAIL\n{accent}VÉRIFIÉ !{/accent}"
              : "VÉRIFIEZ\n{accent}VOTRE EMAIL.{/accent}"
          }
          align="left"
        />

        {/* Body */}
        <View style={s.body}>
          <Text style={s.subtitle}>
            {verified ? (
              "Votre adresse email a été confirmée avec succès."
            ) : (
              <>
                {"Un lien a été envoyé à\n"}
                <Text style={s.emailText}>{email || "votre adresse email"}</Text>
              </>
            )}
          </Text>

          {!verified && (
            <>
              <View style={s.infoCard}>
                <Feather name="info" size={16} color={alpha(authT.textOnDark, 0.55)} style={{ marginTop: 1 }} />
                <Text style={s.infoText}>
                  Cliquez sur le lien dans l'email pour activer votre compte. Le lien expire dans 48 heures.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.resendBtn, (resending || resent) && s.resendBtnDisabled]}
                onPress={handleResend}
                disabled={resending || resent}
                activeOpacity={0.7}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={authT.textOnDark} />
                ) : resent ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check" size={14} color={alpha(authT.textOnDark, 0.55)} />
                    <Text style={[s.resendText, { color: alpha(authT.textOnDark, 0.55) }]}>Email renvoyé</Text>
                  </View>
                ) : (
                  <Text style={s.resendText}>Renvoyer le lien</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label="CONTINUER"
          onPress={handleContinue}
          disabled={!verified}
        />

        <TouchableOpacity
          onPress={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            signOut();
            router.replace("/(auth)/welcome");
          }}
          activeOpacity={0.6}
          style={s.logoutLink}
        >
          <Feather name="log-out" size={14} color={alpha(authT.textOnLight, 0.5)} />
          <Text style={s.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginBottom: 24,
  },
  stepIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBar: { height: 2, borderRadius: 2 },
  stepBarActive: { width: 36, backgroundColor: authT.textOnDark },
  stepBarInactive: { width: 20, backgroundColor: alpha(authT.textOnDark, 0.15) },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: alpha(authT.textOnDark, 0.3),
    marginLeft: 4,
  },
  stepLabelBold: { color: alpha(authT.textOnDark, 0.6) },

  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: alpha(authT.textOnDark, 0.14),
    backgroundColor: alpha(authT.dark, 0.85),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  iconWrapVerified: {
    backgroundColor: alpha(COLORS.greenBrand, 0.12),
    borderColor: alpha(COLORS.greenBrand, 0.35),
  },
  iconDot: {
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.amber,
    borderWidth: 2.5,
    borderColor: authT.dark,
  },

  body: {
    paddingTop: 18,
    gap: 18,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 22,
    color: alpha(authT.textOnDark, 0.65),
  },
  emailText: {
    fontFamily: FONTS.monoMedium,
    fontSize: 14,
    color: authT.textOnDark,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 16,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: alpha(authT.textOnDark, 0.55),
  },
  resendBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: alpha(authT.dark, 0.6),
    borderColor: alpha(authT.textOnDark, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  resendBtnDisabled: {
    backgroundColor: alpha(authT.dark, 0.4),
    borderColor: alpha(authT.textOnDark, 0.1),
  },
  resendText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    letterSpacing: 0.5,
    color: authT.textOnDark,
  },

  spacer: { flex: 1, minHeight: 24 },

  logoutLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    paddingBottom: 4,
  },
  logoutText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: alpha(authT.textOnLight, 0.55),
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnLight, 0.2),
  },
});
