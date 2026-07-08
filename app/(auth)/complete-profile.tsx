// app/(auth)/complete-profile.tsx — gate screen for users missing billing fields
// (flat theme-aware, v2 éditorial)
// Non-dismissable: no back button, no skip. User MUST complete to proceed.
// Receives missing field names via route param "missingFields" (comma-separated).
// Uses Option A: missingFields supplied by the login response, not /auth/me.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthInput,
  AuthPhoneInput,
  AuthAddressAutocomplete,
  AuthMasthead,
  AuthEyebrow,
} from "@/components/auth";
import type { ParsedAddress } from "@/components/auth";

type ToastType = "success" | "error" | "info";

// ── Validation helpers ───────────────────────────────────────────────────────
const POSTAL_RE = /^\d{4}$/;

type MissingField = "name" | "phone" | "address" | "postalCode" | "city";

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CompleteProfile() {
  const router = useRouter();
  const { refreshMe, signOut } = useAuth();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ missingFields?: string }>();

  // Parse the missing fields from route param.
  // Falls back to all fields if param is absent (safety net).
  const missing: MissingField[] = (
    params.missingFields
      ? params.missingFields.split(",").filter(Boolean)
      : ["name", "phone", "address", "postalCode", "city"]
  ) as MissingField[];

  const needs = (field: MissingField) => missing.includes(field);

  // Form state — only for the fields that are actually missing
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  // Inline errors
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [postalCodeError, setPostalCodeError] = useState("");
  const [cityError, setCityError] = useState("");

  // Refs no longer needed — AuthPhoneInput and AuthAddressAutocomplete handle focus internally

  const [loading, setLoading] = useState(false);

  // Toast
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    feedback.toast(message, type);
  }, []);

  // Entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Validation
  const validate = (): boolean => {
    let valid = true;
    if (needs("name")) {
      if (name.trim().length < 2) { setNameError(t("auth.cp_err_name")); valid = false; } else setNameError("");
    }
    if (needs("phone")) {
      if (!/^\+\d{7,}$/.test(phone.trim())) { setPhoneError(t("auth.su_err_phone")); valid = false; } else setPhoneError("");
    }
    if (needs("address") || needs("postalCode") || needs("city")) {
      if (address.trim().length < 3) { setAddressError(t("auth.cp_err_address")); valid = false; } else setAddressError("");
      if (!POSTAL_RE.test(postalCode.trim())) { setPostalCodeError(t("auth.cp_err_postal")); valid = false; } else setPostalCodeError("");
      if (city.trim().length < 2) { setCityError(t("auth.cp_err_city")); valid = false; } else setCityError("");
    }
    return valid;
  };

  // address/postalCode/city are filled together by AuthAddressAutocomplete
  const needsAddressBlock = needs("address") || needs("postalCode") || needs("city");
  const isFormValid: boolean = (
    (!needs("name") || name.trim().length >= 2) &&
    (!needs("phone") || /^\+\d{7,}$/.test(phone.trim())) &&
    (!needsAddressBlock || (address.trim().length >= 3 && POSTAL_RE.test(postalCode.trim()) && city.trim().length >= 2))
  );

  const onSubmit = async () => {
    if (!validate()) {
      feedback.haptic('error');
      return;
    }
    feedback.haptic('medium');
    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (needs("name")) payload.name = name.trim();
      if (needs("phone")) payload.phone = phone.trim();
      if (needs("address")) payload.address = address.trim();
      if (needs("postalCode")) payload.postalCode = postalCode.trim();
      if (needs("city")) payload.city = city.trim();

      await api.patch("/me/profile", payload);
      await refreshMe();
      feedback.haptic('success');
      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      feedback.haptic('error');
      showToast(err.message || t("auth.cp_err_update"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* No back button — screen is non-dismissable. Gate hors flux d'étapes → pas de stepper. */}
        <View style={s.header}>
          <AuthMasthead />
        </View>

        <View style={s.airTop} />

        <AuthEyebrow label={t("auth.cp_kicker")} />
        <AuthHeadline themed title={t("auth.cp_title")} subtitle={t("auth.cp_sub")} />

        <View style={s.body}>
          <View style={s.form}>
            {needs("name") && (
              <AuthInput
                themed
                label={t("auth.cp_name_label")}
                icon="user"
                placeholder={t("auth.su_name_placeholder")}
                autoCapitalize="words"
                maxLength={60}
                returnKeyType="next"
                value={name}
                onChangeText={(v) => { setName(v); if (nameError) setNameError(""); }}
                onSubmitEditing={() => { /* focus handled by phone picker / address autocomplete */ }}
                error={nameError || undefined}
              />
            )}
            {needs("phone") && (
              <AuthPhoneInput
                themed
                onChangeFormattedText={(e164) => { setPhone(e164); if (phoneError) setPhoneError(""); }}
                onChangeText={() => { if (phoneError) setPhoneError(""); }}
                error={phoneError || undefined}
              />
            )}
            {needsAddressBlock && (
              <AuthAddressAutocomplete
                themed
                onAddressSelected={(p: ParsedAddress) => {
                  setAddress(p.street);
                  setPostalCode(p.postalCode);
                  setCity(p.city);
                  if (addressError) setAddressError("");
                  if (postalCodeError) setPostalCodeError("");
                  if (cityError) setCityError("");
                }}
                error={addressError || undefined}
              />
            )}
          </View>
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label={t("auth.cp_save_cta")}
          onPress={onSubmit}
          loading={loading}
          disabled={loading || !isFormValid}
          variant="flat"
        />

        {/* Échappatoire : si le PATCH échoue en boucle, l'utilisateur peut sortir */}
        <TouchableOpacity
          onPress={() => {
            feedback.haptic("light");
            signOut();
            router.replace("/(auth)/welcome");
          }}
          activeOpacity={0.6}
          style={s.logoutLink}
          accessibilityRole="button"
          accessibilityLabel={t("auth.sign_out")}
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
            {t("auth.sign_out")}
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
  body: {
    paddingTop: 14,
    gap: 12,
  },
  form: {
    gap: 10,
  },
  spacer: { flex: 1, minHeight: 24 },
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
