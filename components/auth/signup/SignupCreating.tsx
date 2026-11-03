// components/auth/signup/SignupCreating.tsx — phase « creating » (compte en cours de création)
import React from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { useTranslation } from "react-i18next";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import { SignupSpinner } from "./SignupSpinner";

export function SignupCreating({ isProvider }: { isProvider: boolean }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <View style={[s.creatingRoot, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <SignupSpinner color={theme.text} />
      <Text style={[s.creatingText, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
        {t('auth.creating_account')}
      </Text>
      {isProvider && (
        <Text
          style={[s.creatingSub, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
          maxFontSizeMultiplier={1.2}
        >
          {t('auth.configuring_provider')}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  creatingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  creatingText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    marginTop: 8,
  },
  creatingSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
});
