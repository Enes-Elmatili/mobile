// app/(auth)/reset-password.tsx — reset password (flat theme-aware, v2 éditorial)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { COLORS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthInput,
  AuthMasthead,
  AuthEyebrow,
} from "@/components/auth";

export default function ResetPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    (async () => {
      try {
        const res: any = await api.auth.validateResetToken(token);
        setTokenValid(!!res?.valid);
      } catch {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  // Entrance
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError(t("auth.rp_err_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.rp_err_mismatch"));
      return;
    }
    if (!token) return;

    feedback.haptic('medium');
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      feedback.haptic('success');
    } catch (e: any) {
      setError(e?.data?.error || t("auth.rp_err_generic"));
    } finally {
      setLoading(false);
    }
  };

  // State machine for header content
  let title = t("auth.rp_title");
  let subtitle = t("auth.rp_sub");
  let iconName: keyof typeof Feather.glyphMap = "key";
  let iconColor = theme.text;
  let iconBgVariant: "default" | "success" | "error" = "default";

  if (validating) {
    title = t("auth.rp_validating_title");
    subtitle = t("auth.rp_validating_sub");
  } else if (!token || !tokenValid) {
    title = t("auth.rp_invalid_title");
    subtitle = t("auth.rp_invalid_sub");
    iconName = "x-circle";
    iconColor = COLORS.red;
    iconBgVariant = "error";
  } else if (done) {
    title = t("auth.rp_done_title");
    subtitle = t("auth.rp_done_sub");
    iconName = "check-circle";
    iconColor = theme.greenText;
    iconBgVariant = "success";
  }

  // CTA wiring per state
  const ctaProps = (() => {
    if (validating) return null;
    if (done) {
      return {
        label: t("auth.login_cta"),
        onPress: () => {
          feedback.haptic('medium');
          router.replace("/(auth)/login");
        },
      };
    }
    if (!tokenValid) {
      return {
        label: t("auth.rp_request_new_cta"),
        onPress: () => {
          feedback.haptic('medium');
          router.replace("/(auth)/forgot-password");
        },
      };
    }
    return {
      label: t("auth.rp_reset_cta"),
      onPress: handleSubmit,
      loading,
      disabled: password.length < 8 || password !== confirm,
    };
  })();

  return (
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.header}>
          <View style={s.backAbs}>
            <AuthBackButton
              onPress={() => {
                feedback.haptic('light');
                router.replace("/(auth)/login");
              }}
              themed
            />
          </View>
          <AuthMasthead />
        </View>

        <View style={s.airTop} />

        <View
          style={[
            s.iconWrap,
            iconBgVariant === "default" && { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
            iconBgVariant === "success" && {
              backgroundColor: alpha(theme.brandDot, 0.12),
              borderColor: alpha(theme.brandDot, 0.35),
            },
            iconBgVariant === "error" && {
              backgroundColor: alpha(COLORS.red, 0.12),
              borderColor: alpha(COLORS.red, 0.35),
            },
          ]}
        >
          {validating ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Feather name={iconName} size={34} color={iconColor} />
          )}
        </View>

        <AuthEyebrow label={t("auth.login")} />
        <AuthHeadline themed title={title} subtitle={subtitle} />

        <View style={s.body}>
          {tokenValid && !done && !validating && (
            <View style={s.form}>
              <AuthInput
                themed
                label={t("auth.rp_new_label")}
                icon="lock"
                placeholder={t("auth.rp_new_placeholder")}
                secureTextEntry={!showPwd}
                autoComplete="password-new"
                textContentType="newPassword"
                autoCorrect={false}
                trailingIcon={showPwd ? "eye-off" : "eye"}
                onTrailingPress={() => setShowPwd((p) => !p)}
                returnKeyType="next"
                autoFocus
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <AuthInput
                themed
                inputRef={confirmRef}
                label={t("common.confirm")}
                icon="lock"
                placeholder={t("auth.rp_confirm_placeholder")}
                secureTextEntry={!showPwd}
                autoComplete="password-new"
                textContentType="newPassword"
                autoCorrect={false}
                returnKeyType="done"
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
                error={
                  error ??
                  (confirm.length > 0 && password !== confirm
                    ? t("auth.rp_err_mismatch")
                    : undefined)
                }
              />
            </View>
          )}
        </View>

        <View style={s.spacer} />

        {ctaProps && (
          <AuthCTA
            label={ctaProps.label}
            onPress={ctaProps.onPress}
            loading={ctaProps.loading}
            disabled={ctaProps.disabled}
            variant="flat"
          />
        )}
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { position: "relative" },
  backAbs: { position: "absolute", left: 0, top: 11, zIndex: 1 },
  airTop: { flex: 0.55, minHeight: 12 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  body: {
    paddingTop: 18,
    gap: 18,
  },
  form: {
    gap: 12,
  },
  spacer: { flex: 1, minHeight: 24 },
});
