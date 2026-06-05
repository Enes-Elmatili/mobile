// app/(auth)/complete-profile.tsx — gate screen for users missing billing fields
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
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthInput,
  AuthPhoneInput,
  AuthAddressAutocomplete,
} from "@/components/auth";
import type { ParsedAddress } from "@/components/auth";

type ToastType = "success" | "error" | "info";

// ── Validation helpers ───────────────────────────────────────────────────────
const POSTAL_RE = /^\d{4}$/;

type MissingField = "name" | "phone" | "address" | "postalCode" | "city";

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CompleteProfile() {
  const router = useRouter();
  const { refreshMe } = useAuth();
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
      if (name.trim().length < 2) { setNameError("Nom trop court — 2 caractères min."); valid = false; } else setNameError("");
    }
    if (needs("phone")) {
      if (!/^\+\d{7,}$/.test(phone.trim())) { setPhoneError("Numéro de téléphone invalide"); valid = false; } else setPhoneError("");
    }
    if (needs("address") || needs("postalCode") || needs("city")) {
      if (address.trim().length < 3) { setAddressError("Sélectionne ton adresse dans la liste"); valid = false; } else setAddressError("");
      if (!POSTAL_RE.test(postalCode.trim())) { setPostalCodeError(""); valid = false; }
      if (city.trim().length < 2) { setCityError(""); valid = false; }
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
      showToast(err.message || "Mise à jour impossible, réessaie");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen variant="inverted" scrollable>
      <StatusBar barStyle="light-content" />

      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* No back button — screen is non-dismissable */}
        <View style={s.topRow} />

        <AuthHeadline
          kicker="PROFIL INCOMPLET"
          title="COMPLÉTEZ\n{accent}VOTRE PROFIL.{/accent}"
          subtitle="Ces informations sont requises pour utiliser FIXED."
          align="left"
        />

        <View style={s.body}>
          <View style={s.form}>
            {needs("name") && (
              <AuthInput
                label="Nom complet *"
                icon="user"
                placeholder="Prénom et nom"
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
                onChangeFormattedText={(e164) => { setPhone(e164); if (phoneError) setPhoneError(""); }}
                onChangeText={() => { if (phoneError) setPhoneError(""); }}
                error={phoneError || undefined}
              />
            )}
            {needsAddressBlock && (
              <AuthAddressAutocomplete
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
          label="ENREGISTRER"
          onPress={onSubmit}
          loading={loading}
          disabled={loading || !isFormValid}
        />
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    marginTop: 4,
    marginBottom: 24,
  },
  body: {
    paddingTop: 14,
    gap: 12,
  },
  form: {
    gap: 10,
  },
  spacer: { flex: 1, minHeight: 24 },
});
