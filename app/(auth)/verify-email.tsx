// app/(auth)/verify-email.tsx — vérification par code OTP 6 chiffres (flat theme-aware, v2 éditorial)
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
import { FONTS, COLORS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthMasthead,
  AuthEyebrow,
  AuthStepper,
} from "@/components/auth";

const ROLE_INTENT_KEY = "@fixed:signup:role";
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { refreshMe, signOut } = useAuth();
  const { t } = useTranslation();
  const theme = useAppTheme();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [verified, setVerified] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedRef = useRef(false);

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
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* Header : masthead + stepper macro (3/3) — pas de back, gate volontaire */}
        <View style={s.header}>
          <AuthMasthead />
          <AuthStepper total={3} current={3} accessibilityLabel={t('ext.verify_step')} />
        </View>

        <View style={s.airTop} />

        {/* Icon */}
        <View
          style={[
            s.iconWrap,
            { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
            verified && {
              backgroundColor: alpha(theme.brandDot, 0.12),
              borderColor: alpha(theme.brandDot, 0.35),
            },
            !!errorMsg && { borderColor: alpha(COLORS.red, 0.4) },
          ]}
        >
          <Feather
            name={verified ? "check-circle" : "mail"}
            size={30}
            color={verified ? theme.greenText : theme.text}
          />
          {!verified && (
            <Animated.View
              style={[
                s.iconDot,
                { borderColor: theme.bg, opacity: pulseOp },
                !!errorMsg && { backgroundColor: COLORS.red },
              ]}
            />
          )}
        </View>

        <AuthEyebrow label={verified ? t('auth.ve_label_ok') : t('auth.ve_label')} />
        <AuthHeadline themed title={verified ? t('auth.ve_title_ok') : t('auth.ve_title')} />

        {/* Body */}
        <View style={s.body}>
          <Text style={[s.subtitle, { color: alpha(theme.text, 0.56) }]} maxFontSizeMultiplier={1.2}>
            {verified ? (
              t('auth.ve_sub_ok')
            ) : (
              <>
                {t('auth.ve_sub') + "\n"}
                <Text style={[s.emailText, { color: theme.text }]}>{email || t('auth.ve_sub_fallback')}</Text>
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
                          { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
                          !!char && { borderColor: alpha(theme.text, 0.35) },
                          isFocus && [s.otpBoxFocus, { borderColor: alpha(theme.text, 0.4) }],
                          !!errorMsg && [
                            s.otpBoxError,
                            { backgroundColor: alpha(COLORS.red, 0.08), borderColor: alpha(COLORS.red, 0.65) },
                          ],
                        ]}
                      >
                        {char ? (
                          <Text
                            style={[s.otpChar, { color: errorMsg ? COLORS.red : theme.text }]}
                            maxFontSizeMultiplier={1.2}
                          >
                            {char}
                          </Text>
                        ) : isFocus ? (
                          <Animated.View style={[s.otpCursor, { backgroundColor: theme.text, opacity: blinkOp }]} />
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
                  <Text style={s.errorText} maxFontSizeMultiplier={1.2}>{errorMsg}</Text>
                </View>
              )}

              {/* Renvoi + validation auto */}
              <View style={s.metaRow}>
                {cooldown > 0 ? (
                  <Text
                    style={[s.metaFaint, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {t('auth.ve_resend_in', { time: fmtCooldown })}
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resending}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.ve_resend_cta')}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color={alpha(theme.text, 0.6)} />
                    ) : (
                      <Text
                        style={[
                          s.metaLink,
                          { color: theme.text, textDecorationColor: alpha(theme.text, 0.4) },
                        ]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {t('auth.ve_resend_cta')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                <View style={s.metaRight}>
                  {submitting ? (
                    <ActivityIndicator size="small" color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)} />
                  ) : (
                    <Feather name="zap" size={11} color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)} />
                  )}
                  <Text
                    style={[s.metaMuted, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {t('auth.ve_auto')}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={s.spacer} />

        {!verified && (
          <View style={s.hintRow}>
            <Feather
              name="mail"
              size={12}
              color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)}
              style={{ marginTop: 1 }}
            />
            <Text
              style={[s.hintText, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
              maxFontSizeMultiplier={1.2}
            >
              {t('auth.ve_hint')}
            </Text>
          </View>
        )}

        <AuthCTA
          label={verified ? t('auth.ve_continue') : t('auth.ve_verify')}
          onPress={() => (verified ? handleContinue() : submitCode(code))}
          loading={submitting}
          disabled={!verified && code.length < CODE_LENGTH}
          variant="flat"
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
          <Feather name="log-out" size={14} color={alpha(theme.text, theme.isDark ? 0.5 : 0.68)} />
          <Text
            style={[
              s.logoutText,
              {
                color: alpha(theme.text, theme.isDark ? 0.5 : 0.68),
                textDecorationColor: alpha(theme.text, theme.isDark ? 0.3 : 0.45),
              },
            ]}
            maxFontSizeMultiplier={1.2}
          >
            {t('onboarding.signout')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { position: "relative" },
  airTop: { flex: 0.55, minHeight: 12 },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
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
  },

  body: {
    paddingTop: 16,
    gap: 16,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  emailText: {
    fontFamily: FONTS.monoMedium,
    fontSize: 14,
  },

  otpRow: {
    flexDirection: "row",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFocus: {
    borderWidth: 1.5,
  },
  otpBoxError: {
    borderWidth: 1.5,
  },
  otpChar: {
    fontFamily: FONTS.bebas,
    fontSize: 28,
    transform: [{ translateY: 1 }],
  },
  otpCursor: {
    width: 1.5,
    height: 24,
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
  },
  metaLink: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textDecorationLine: "underline",
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
    textDecorationLine: "underline",
  },
});
