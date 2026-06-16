// app/(auth)/verify-email.tsx — vérification par code OTP 6 chiffres (inverted gradient)
// Redesign onboarding : le lien email devient un code saisi sur place, validé
// automatiquement à la saisie. Le polling /auth/me reste en fallback pour le
// chemin "clic sur le lien" des anciens emails.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTranslation } from "react-i18next";
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
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { refreshMe, signOut } = useAuth();
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [verified, setVerified] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(setRole);
  }, []);

  // Countdown renvoi
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  const handleContinue = useCallback(async () => {
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
  }, [router]);

  const markVerified = useCallback(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    setVerified(true);
    setErrorMsg(null);
    feedback.haptic("success");
    refreshMe().catch(() => {});
    // Validation automatique → on enchaîne sans demander de tap supplémentaire
    setTimeout(() => { handleContinue(); }, 1100);
  }, [handleContinue, refreshMe]);

  // Fallback : l'utilisateur a cliqué le lien dans l'email
  useEffect(() => {
    let cancelled = false;
    pollRef.current = setInterval(async () => {
      if (cancelled || verifiedRef.current) return;
      try {
        const res = await api.get("/auth/me");
        if (res?.user?.emailVerified && !cancelled) markVerified();
      } catch {}
    }, 4000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shake (erreur de code)
  const shakeX = useRef(new Animated.Value(0)).current;
  const runShake = useCallback(() => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 3, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  const submitCode = useCallback(async (value: string) => {
    if (submitting || verifiedRef.current) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post("/auth/verify-email", { code: value });
      markVerified();
    } catch (e: any) {
      feedback.haptic("error");
      runShake();
      const reason = e?.data?.reason;
      const remaining = e?.data?.attemptsRemaining;
      if (reason === "EXPIRED" || reason === "NO_CODE") {
        setErrorMsg(t('auth.ve_err_expired'));
      } else if (reason === "LOCKED") {
        setErrorMsg(t('auth.ve_err_locked'));
      } else if (typeof remaining === "number") {
        setErrorMsg(
          remaining > 0
            ? t('auth.ve_err_wrong', { count: remaining })
            : t('auth.ve_err_wrong_none')
        );
      } else {
        setErrorMsg(e?.data?.error || e?.message || t('auth.ve_err_generic'));
      }
      // Le champ se vide automatiquement, prêt pour une nouvelle saisie
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 250);
    } finally {
      setSubmitting(false);
    }
  }, [markVerified, runShake, submitting]);

  const onChangeCode = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (errorMsg) setErrorMsg(null);
    if (digits.length === CODE_LENGTH) submitCode(digits);
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      feedback.success(t('auth.ve_resent'));
      setCooldown(RESEND_COOLDOWN_S);
      setCode("");
      setErrorMsg(null);
      inputRef.current?.focus();
    } catch (e: any) {
      feedback.error(e?.data?.error || t('auth.ve_resend_fail'));
    } finally {
      setResending(false);
    }
  };

  const flow = role === "PROVIDER" ? PROVIDER_FLOW : CLIENT_FLOW;
  const stepNum = flow.steps.VERIFY_EMAIL;
  const totalSteps = flow.totalSteps;

  // Entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  // Pulsing dot (en attente de code) + curseur clignotant
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

  const blinkOp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkOp, { toValue: 0, duration: 0, delay: 600, useNativeDriver: true }),
        Animated.timing(blinkOp, { toValue: 1, duration: 0, delay: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const fmtCooldown = `00:${String(cooldown).padStart(2, "0")}`;
  const focusedIndex = Math.min(code.length, CODE_LENGTH - 1);

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
              <Text style={s.stepLabelBold}>{t('auth.ve_label')} · {String(stepNum).padStart(2, "0")}</Text>
              {" / "}
              {String(totalSteps).padStart(2, "0")}
            </Text>
          </View>
        </View>

        {/* Icon */}
        <View style={[s.iconWrap, verified && s.iconWrapVerified, !!errorMsg && s.iconWrapError]}>
          <Feather
            name={verified ? "check-circle" : "mail"}
            size={30}
            color={verified ? COLORS.greenBrand : authT.textOnDark}
          />
          {!verified && (
            <Animated.View
              style={[s.iconDot, { opacity: pulseOp }, !!errorMsg && { backgroundColor: COLORS.red }]}
            />
          )}
        </View>

        <AuthHeadline
          kicker={verified ? t('auth.ve_label_ok') : t('auth.ve_label')}
          title={verified ? t('auth.ve_title_ok') : t('auth.ve_title')}
          align="left"
        />

        {/* Body */}
        <View style={s.body}>
          <Text style={s.subtitle}>
            {verified ? (
              t('auth.ve_sub_ok')
            ) : (
              <>
                {t('auth.ve_sub') + "\n"}
                <Text style={s.emailText}>{email || t('auth.ve_sub_fallback')}</Text>
              </>
            )}
          </Text>

          {!verified && (
            <>
              {/* OTP boxes + champ caché */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => inputRef.current?.focus()}
                accessibilityLabel={t('auth.ve_a11y')}
              >
                <Animated.View style={[s.otpRow, { transform: [{ translateX: shakeX }] }]}>
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                    const char = code[i] ?? "";
                    const isFocus = inputFocused && i === focusedIndex && !submitting;
                    return (
                      <View
                        key={i}
                        style={[
                          s.otpBox,
                          !!char && s.otpBoxFilled,
                          isFocus && s.otpBoxFocus,
                          !!errorMsg && s.otpBoxError,
                        ]}
                      >
                        {char ? (
                          <Text style={[s.otpChar, !!errorMsg && s.otpCharError]}>{char}</Text>
                        ) : isFocus ? (
                          <Animated.View style={[s.otpCursor, { opacity: blinkOp }]} />
                        ) : null}
                      </View>
                    );
                  })}
                </Animated.View>
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={onChangeCode}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                autoFocus
                caretHidden
                style={s.hiddenInput}
                editable={!submitting && !verified}
              />

              {/* Erreur */}
              {!!errorMsg && (
                <View style={s.errorRow}>
                  <Feather name="x" size={14} color={COLORS.red} />
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Renvoi + validation auto */}
              <View style={s.metaRow}>
                {cooldown > 0 ? (
                  <Text style={s.metaFaint}>{t('auth.ve_resend_in', { time: fmtCooldown })}</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.7}>
                    {resending ? (
                      <ActivityIndicator size="small" color={alpha(authT.textOnDark, 0.6)} />
                    ) : (
                      <Text style={s.metaLink}>{t('auth.ve_resend_cta')}</Text>
                    )}
                  </TouchableOpacity>
                )}
                <View style={s.metaRight}>
                  {submitting ? (
                    <ActivityIndicator size="small" color={alpha(authT.textOnDark, 0.55)} />
                  ) : (
                    <Feather name="zap" size={11} color={alpha(authT.textOnDark, 0.55)} />
                  )}
                  <Text style={s.metaMuted}>{t('auth.ve_auto')}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={s.spacer} />

        {!verified && (
          <View style={s.hintRow}>
            <Feather name="mail" size={12} color={alpha(authT.textOnLight, 0.4)} style={{ marginTop: 1 }} />
            <Text style={s.hintText}>{t('auth.ve_hint')}</Text>
          </View>
        )}

        <AuthCTA
          label={verified ? t('auth.ve_continue') : t('auth.ve_verify')}
          onPress={() => (verified ? handleContinue() : submitCode(code))}
          loading={submitting}
          disabled={!verified && code.length < CODE_LENGTH}
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
          <Text style={s.logoutText}>{t('onboarding.signout')}</Text>
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
  stepBarActive: { width: 24, backgroundColor: authT.textOnDark },
  stepBarInactive: { width: 14, backgroundColor: alpha(authT.textOnDark, 0.15) },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: alpha(authT.textOnDark, 0.3),
    marginLeft: 4,
  },
  stepLabelBold: { color: alpha(authT.textOnDark, 0.6) },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: alpha(authT.textOnDark, 0.14),
    backgroundColor: alpha(authT.dark, 0.85),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  iconWrapVerified: {
    backgroundColor: alpha(COLORS.greenBrand, 0.12),
    borderColor: alpha(COLORS.greenBrand, 0.35),
  },
  iconWrapError: {
    borderColor: alpha(COLORS.red, 0.4),
  },
  iconDot: {
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.amber,
    borderWidth: 2.5,
    borderColor: authT.dark,
  },

  body: {
    paddingTop: 16,
    gap: 16,
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

  otpRow: {
    flexDirection: "row",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: {
    borderColor: alpha(authT.textOnDark, 0.35),
  },
  otpBoxFocus: {
    borderWidth: 1.5,
    borderColor: alpha(authT.textOnDark, 0.65),
  },
  otpBoxError: {
    backgroundColor: alpha(COLORS.red, 0.08),
    borderWidth: 1.5,
    borderColor: alpha(COLORS.red, 0.65),
  },
  otpChar: {
    fontFamily: FONTS.bebas,
    fontSize: 28,
    color: authT.textOnDark,
    transform: [{ translateY: 1 }],
  },
  otpCharError: {
    color: COLORS.red,
  },
  otpCursor: {
    width: 1.5,
    height: 24,
    backgroundColor: authT.textOnDark,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: COLORS.red,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaFaint: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: alpha(authT.textOnDark, 0.35),
  },
  metaLink: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: authT.textOnDark,
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnDark, 0.4),
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaMuted: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: alpha(authT.textOnDark, 0.55),
  },

  spacer: { flex: 1, minHeight: 24 },

  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 14,
  },
  hintText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: alpha(authT.textOnLight, 0.55),
  },

  logoutLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    paddingBottom: 4,
    marginTop: 10,
  },
  logoutText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: alpha(authT.textOnLight, 0.55),
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnLight, 0.2),
  },
});
