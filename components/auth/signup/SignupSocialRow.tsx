// components/auth/signup/SignupSocialRow.tsx — boutons Apple / Google + séparateur « ou »
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import { PressScale } from '@/components/ui/PressScale';
import { AppleLogo, GoogleLogo } from "./SignupLogos";
import { SignupSpinner } from "./SignupSpinner";

export type SocialProvider = "apple" | "google";

interface Props {
  socialLoading: SocialProvider | null;
  onApplePress: () => void;
  onGooglePress: () => void;
}

export function SignupSocialRow({ socialLoading, onApplePress, onGooglePress }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const isBusy = !!socialLoading;

  // Style thème partagé des boutons sociaux (Apple / Google).
  const socialBtnTheme = { backgroundColor: theme.cardBg, borderColor: alpha(theme.text, 0.15) };

  return (
    <>
      <View style={s.socialRow}>
        {Platform.OS === "ios" && (
          <PressScale
            style={[s.socialBtn, socialBtnTheme]}
            onPress={onApplePress}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={t("auth.su_continue_apple")}
          >
            {socialLoading === "apple" ? (
              <SignupSpinner color={theme.text} />
            ) : (
              <>
                <AppleLogo color={theme.text} />
                <Text style={[s.socialText, { color: theme.text }]} maxFontSizeMultiplier={1.2}>Apple</Text>
              </>
            )}
          </PressScale>
        )}
        <PressScale
          style={[s.socialBtn, socialBtnTheme]}
          onPress={onGooglePress}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t("auth.su_continue_google")}
        >
          {socialLoading === "google" ? (
            <SignupSpinner color={theme.text} />
          ) : (
            <>
              <GoogleLogo />
              <Text style={[s.socialText, { color: theme.text }]} maxFontSizeMultiplier={1.2}>Google</Text>
            </>
          )}
        </PressScale>
      </View>

      <View style={s.divider}>
        <View style={[s.dividerLine, { backgroundColor: alpha(theme.text, 0.11) }]} />
        <Text
          style={[s.dividerLabel, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
          maxFontSizeMultiplier={1.2}
        >
          {t('auth.su_or')}
        </Text>
        <View style={[s.dividerLine, { backgroundColor: alpha(theme.text, 0.11) }]} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  socialText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2,
  },
});
