// components/auth/signup/SignupIdentityPhase.tsx — phase 1 : social, nom / email / mot de passe, CGU
import React from "react";
import { View, Text } from "react-native";
import type { TextInputInstance } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme, alpha } from "@/hooks/use-app-theme";
import { AuthInput } from "@/components/auth";
import { SignupSocialRow, type SocialProvider } from "./SignupSocialRow";
import { StrengthBar } from "./StrengthBar";
import { ss } from "./signupStyles";

interface Props {
  socialLoading: SocialProvider | null;
  onApplePress: () => void;
  onGooglePress: () => void;
  name: string;
  onChangeName: (v: string) => void;
  email: string;
  onChangeEmail: (v: string) => void;
  password: string;
  onChangePassword: (v: string) => void;
  showPwd: boolean;
  onToggleShowPwd: () => void;
  emailRef: React.RefObject<TextInputInstance | null>;
  pwdRef: React.RefObject<TextInputInstance | null>;
  onSubmit: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export function SignupIdentityPhase(p: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <View style={ss.body}>
      {/* Social */}
      <SignupSocialRow
        socialLoading={p.socialLoading}
        onApplePress={p.onApplePress}
        onGooglePress={p.onGooglePress}
      />

      {/* Form */}
      <View style={ss.form}>
        <AuthInput
          themed
          label={t('auth.su_name_label')}
          icon="user"
          placeholder={t('auth.su_name_placeholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={60}
          returnKeyType="next"
          value={p.name}
          onChangeText={p.onChangeName}
          onSubmitEditing={() => p.emailRef.current?.focus()}
        />
        <AuthInput
          themed
          inputRef={p.emailRef}
          label={t('auth.su_email_label')}
          icon="mail"
          placeholder={t('auth.su_email_placeholder')}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
          value={p.email}
          onChangeText={p.onChangeEmail}
          onSubmitEditing={() => p.pwdRef.current?.focus()}
        />
        <AuthInput
          themed
          inputRef={p.pwdRef}
          label={t('auth.su_pwd_label')}
          icon="lock"
          placeholder={t('auth.su_pwd_placeholder')}
          secureTextEntry={!p.showPwd}
          autoComplete="password-new"
          textContentType="newPassword"
          autoCorrect={false}
          trailingIcon={p.showPwd ? "eye-off" : "eye"}
          onTrailingPress={p.onToggleShowPwd}
          returnKeyType="done"
          value={p.password}
          onChangeText={p.onChangePassword}
          onSubmitEditing={p.onSubmit}
        />
        {p.password.length > 0 && <StrengthBar password={p.password} />}
      </View>

      {/* CGU */}
      <View style={ss.cguRow}>
        <Feather
          name="shield"
          size={13}
          color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)}
          style={{ marginTop: 1 }}
        />
        <Text
          style={[ss.cguText, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
          maxFontSizeMultiplier={1.2}
        >
          {t('auth.su_cgu_pre')}
          <Text
            style={[ss.cguLink, { color: theme.text }]}
            onPress={p.onOpenTerms}
            accessibilityRole="link"
          >
            {t('auth.su_cgu_terms')}
          </Text>
          {t('auth.su_cgu_mid')}
          <Text
            style={[ss.cguLink, { color: theme.text }]}
            onPress={p.onOpenPrivacy}
            accessibilityRole="link"
          >
            {t('auth.su_cgu_privacy')}
          </Text>
          {t('auth.su_cgu_post')}
        </Text>
      </View>
    </View>
  );
}
