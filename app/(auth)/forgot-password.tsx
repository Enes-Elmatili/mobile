// app/(auth)/forgot-password.tsx — forgot password (inverted gradient)
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
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthInput,
  authT,
  alpha,
} from "@/components/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
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
    <AuthScreen variant="inverted" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          <AuthBackButton onPress={handleBack} />
        </View>

        <View style={[s.iconWrap, sent && s.iconWrapSent]}>
          <Feather
            name={sent ? "check-circle" : "unlock"}
            size={34}
            color={sent ? COLORS.greenBrand : authT.textOnDark}
          />
        </View>

        <AuthHeadline
          title={sent ? t('auth.forgot_password_sent_title') : t('auth.forgot_password_title')}
          align="left"
        />

        <View style={s.body}>
          {sent ? (
            <>
              <Text style={s.subtitle}>
                {t('auth.forgot_password_sent_sub')}{"\n"}
                <Text style={s.emailText}>{email.trim().toLowerCase()}</Text>
              </Text>

              <View style={s.infoCard}>
                <Feather name="info" size={16} color={alpha(authT.textOnDark, 0.55)} style={{ marginTop: 1 }} />
                <Text style={s.infoText}>
                  {t('auth.forgot_password_info')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={s.subtitle}>
                {t('auth.forgot_password_sub')}
              </Text>

              <AuthInput
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
        />

        <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={s.secondaryLink}>
          <Text style={s.secondaryLinkText}>{t('auth.back_to_login_link')}</Text>
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
    marginTop: 4,
    marginBottom: 24,
  },
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
  iconWrapSent: {
    backgroundColor: alpha(COLORS.greenBrand, 0.12),
    borderColor: alpha(COLORS.greenBrand, 0.35),
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
    borderRadius: 18,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: alpha(authT.textOnDark, 0.55),
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
    color: alpha(authT.textOnLight, 0.5),
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnLight, 0.2),
  },
});
