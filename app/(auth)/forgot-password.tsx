// app/(auth)/forgot-password.tsx — forgot password (flat theme-aware, v2 éditorial)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthInput,
  AuthMasthead,
  AuthEyebrow,
} from "@/components/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(t('auth.forgot_password_empty'));
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('auth.invalid_email'));
      return;
    }
    feedback.haptic('medium');
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(trimmed);
      setSent(true);
      feedback.haptic('success');
    } catch {
      setError(t('auth.forgot_password_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    feedback.haptic('light');
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.header}>
          <View style={s.backAbs}>
            <AuthBackButton onPress={handleBack} themed />
          </View>
          <AuthMasthead />
        </View>

        <View style={s.airTop} />

        <View
          style={[
            s.iconWrap,
            sent
              ? { backgroundColor: alpha(theme.brandDot, 0.12), borderColor: alpha(theme.brandDot, 0.35) }
              : { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
          ]}
        >
          <Feather
            name={sent ? "check-circle" : "unlock"}
            size={34}
            color={sent ? theme.greenText : theme.text}
          />
        </View>

        <AuthEyebrow label={t('auth.login')} />
        <AuthHeadline
          themed
          title={sent ? t('auth.forgot_password_sent_title') : t('auth.forgot_password_title')}
          subtitle={sent ? t('auth.forgot_password_sent_sub') : t('auth.forgot_password_sub')}
        />

        <View style={s.body}>
          {sent ? (
            <>
              <Text style={[s.emailText, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
                {email.trim().toLowerCase()}
              </Text>

              <View style={[s.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                <Feather name="info" size={16} color={alpha(theme.text, 0.55)} style={{ marginTop: 1 }} />
                <Text style={[s.infoText, { color: alpha(theme.text, 0.55) }]} maxFontSizeMultiplier={1.2}>
                  {t('auth.forgot_password_info')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <AuthInput
                themed
                label={t('auth.email_label')}
                icon="mail"
                placeholder={t('auth.email_placeholder_value')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
                error={error}
              />
            </>
          )}
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label={sent ? t('auth.back_to_login_cta') : t('auth.send_link')}
          onPress={sent ? handleBack : handleSubmit}
          loading={loading}
          disabled={!sent && !email.trim()}
          variant="flat"
        />

        {!sent && (
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={s.secondaryLink}>
            <Text
              style={[
                s.secondaryLinkText,
                {
                  color: alpha(theme.text, theme.isDark ? 0.5 : 0.68),
                  textDecorationColor: alpha(theme.text, theme.isDark ? 0.3 : 0.45),
                },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              {t('auth.back_to_login_link')}
            </Text>
          </TouchableOpacity>
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
  emailText: {
    fontFamily: FONTS.monoMedium,
    fontSize: 14,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  spacer: { flex: 1, minHeight: 24 },
  secondaryLink: {
    alignItems: "center",
    paddingVertical: 6,
    paddingBottom: 4,
  },
  secondaryLinkText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
