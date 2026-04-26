// app/(auth)/reset-password.tsx — reset password (inverted gradient)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
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

export default function ResetPassword() {
  const router = useRouter();
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
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (!token) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.data?.error || "Une erreur est survenue. Le lien a peut-être expiré.");
    } finally {
      setLoading(false);
    }
  };

  // State machine for header content
  let title = "NOUVEAU\n{accent}MOT DE PASSE.{/accent}";
  let subtitle = "Choisissez un nouveau mot de passe pour votre compte.";
  let iconName: keyof typeof Feather.glyphMap = "key";
  let iconColor = authT.textOnDark;
  let iconBgVariant: "default" | "success" | "error" = "default";

  if (validating) {
    title = "VÉRIFICATION\n{accent}DU LIEN…{/accent}";
    subtitle = "Validation en cours, veuillez patienter.";
  } else if (!token || !tokenValid) {
    title = "LIEN\n{accent}INVALIDE.{/accent}";
    subtitle = "Ce lien de réinitialisation est expiré ou invalide. Demandez un nouveau lien.";
    iconName = "x-circle";
    iconColor = COLORS.red;
    iconBgVariant = "error";
  } else if (done) {
    title = "MOT DE PASSE\n{accent}MODIFIÉ !{/accent}";
    subtitle = "Votre mot de passe a été réinitialisé avec succès. Connectez-vous avec votre nouveau mot de passe.";
    iconName = "check-circle";
    iconColor = COLORS.greenBrand;
    iconBgVariant = "success";
  }

  // CTA wiring per state
  const ctaProps = (() => {
    if (validating) return null;
    if (done) {
      return {
        label: "SE CONNECTER",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.replace("/(auth)/login");
        },
      };
    }
    if (!tokenValid) {
      return {
        label: "DEMANDER UN NOUVEAU LIEN",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.replace("/(auth)/forgot-password");
        },
      };
    }
    return {
      label: "RÉINITIALISER",
      onPress: handleSubmit,
      loading,
      disabled: password.length < 8 || password !== confirm,
    };
  })();

  return (
    <AuthScreen variant="inverted" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          <AuthBackButton
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(auth)/login");
            }}
          />
        </View>

        <View
          style={[
            s.iconWrap,
            iconBgVariant === "success" && s.iconWrapSuccess,
            iconBgVariant === "error" && s.iconWrapError,
          ]}
        >
          {validating ? (
            <ActivityIndicator size="small" color={authT.textOnDark} />
          ) : (
            <Feather name={iconName} size={34} color={iconColor} />
          )}
        </View>

        <AuthHeadline title={title} align="left" />

        <View style={s.body}>
          <Text style={s.subtitle}>{subtitle}</Text>

          {tokenValid && !done && !validating && (
            <View style={s.form}>
              <AuthInput
                label="Nouveau mot de passe"
                icon="lock"
                placeholder="Min. 8 caractères"
                secureTextEntry={!showPwd}
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
                inputRef={confirmRef}
                label="Confirmer"
                icon="lock"
                placeholder="Confirmez le mot de passe"
                secureTextEntry={!showPwd}
                returnKeyType="done"
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
                error={error}
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
          />
        )}
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
  iconWrapSuccess: {
    backgroundColor: alpha(COLORS.greenBrand, 0.12),
    borderColor: alpha(COLORS.greenBrand, 0.35),
  },
  iconWrapError: {
    backgroundColor: alpha(COLORS.red, 0.12),
    borderColor: alpha(COLORS.red, 0.35),
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
  form: {
    gap: 12,
  },
  spacer: { flex: 1, minHeight: 24 },
});
