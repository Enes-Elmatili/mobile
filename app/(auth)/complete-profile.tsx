// app/(auth)/complete-profile.tsx — gate screen for users missing billing fields
// Non-dismissable: no back button, no skip. User MUST complete to proceed.
// Receives missing field names via route param "missingFields" (comma-separated).
// Uses Option A: missingFields supplied by the login response, not /auth/me.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthInput,
  authT,
  alpha,
} from "@/components/auth";

// ── Toast ────────────────────────────────────────────────────────────────────
type ToastType = "error" | "success" | "info";
interface ToastMsg {
  id: number;
  type: ToastType;
  message: string;
}

function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const ty = useRef(new Animated.Value(-72)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -72, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(onDone);
    }, 3200);
    return () => clearTimeout(t);
  }, []);
  const icon = msg.type === "error" ? "x-circle" : msg.type === "success" ? "check-circle" : "info";
  const color = msg.type === "error" ? COLORS.red : msg.type === "success" ? COLORS.greenBrand : authT.textOnDark;
  return (
    <Animated.View style={[ts.pill, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Feather name={icon as any} size={16} color={color} />
      <Text style={ts.text}>{msg.message}</Text>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 9999,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(authT.dark, 0.95),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.12),
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 10 },
    }),
  },
  text: { fontFamily: FONTS.sansMedium, fontSize: 14, color: authT.textOnDark, flex: 1 },
});

// ── Validation helpers ───────────────────────────────────────────────────────
const POSTAL_RE = /^\d{4}$/;

type MissingField = "name" | "phone" | "address" | "postalCode" | "city";

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CompleteProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Refs for focus chains
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const postalCodeRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(false);

  // Toast
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counter.current;
    setMsgs((p) => [...p, { id, type, message }]);
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
      if (phone.trim().length < 6) { setPhoneError("Numéro de téléphone invalide — 6 chiffres min."); valid = false; } else setPhoneError("");
    }
    if (needs("address")) {
      if (address.trim().length < 3) { setAddressError("Adresse trop courte — 3 caractères min."); valid = false; } else setAddressError("");
    }
    if (needs("postalCode")) {
      if (!POSTAL_RE.test(postalCode.trim())) { setPostalCodeError("Code postal invalide — 4 chiffres requis"); valid = false; } else setPostalCodeError("");
    }
    if (needs("city")) {
      if (city.trim().length < 2) { setCityError("Ville trop courte — 2 caractères min."); valid = false; } else setCityError("");
    }
    return valid;
  };

  const isFormValid: boolean = (
    (!needs("name") || name.trim().length >= 2) &&
    (!needs("phone") || phone.trim().length >= 6) &&
    (!needs("address") || address.trim().length >= 3) &&
    (!needs("postalCode") || POSTAL_RE.test(postalCode.trim())) &&
    (!needs("city") || city.trim().length >= 2)
  );

  const onSubmit = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(err.message || "Mise à jour impossible, réessaie");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen variant="inverted" scrollable>
      <StatusBar barStyle="light-content" />

      {/* Toast layer */}
      <View style={[ts.layer, { top: insets.top + 8 }]} pointerEvents="none">
        {msgs.map((m) => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs((p) => p.filter((x) => x.id !== m.id))} />
        ))}
      </View>

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
                onSubmitEditing={() => needs("phone") ? phoneRef.current?.focus() : needs("address") ? addressRef.current?.focus() : needs("postalCode") ? postalCodeRef.current?.focus() : cityRef.current?.focus()}
                error={nameError || undefined}
              />
            )}
            {needs("phone") && (
              <AuthInput
                inputRef={phoneRef}
                label="Téléphone *"
                icon="phone"
                placeholder="+32 470 00 00 00"
                keyboardType="phone-pad"
                returnKeyType="next"
                value={phone}
                onChangeText={(v) => { setPhone(v); if (phoneError) setPhoneError(""); }}
                onSubmitEditing={() => needs("address") ? addressRef.current?.focus() : needs("postalCode") ? postalCodeRef.current?.focus() : cityRef.current?.focus()}
                error={phoneError || undefined}
              />
            )}
            {needs("address") && (
              <AuthInput
                inputRef={addressRef}
                label="Adresse *"
                icon="map-pin"
                placeholder="Rue de la Loi 16"
                autoCapitalize="words"
                returnKeyType="next"
                value={address}
                onChangeText={(v) => { setAddress(v); if (addressError) setAddressError(""); }}
                onSubmitEditing={() => needs("postalCode") ? postalCodeRef.current?.focus() : cityRef.current?.focus()}
                error={addressError || undefined}
              />
            )}
            {needs("postalCode") && (
              <AuthInput
                inputRef={postalCodeRef}
                label="Code postal *"
                icon="hash"
                placeholder="1000"
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="next"
                value={postalCode}
                onChangeText={(v) => { setPostalCode(v); if (postalCodeError) setPostalCodeError(""); }}
                onSubmitEditing={() => needs("city") ? cityRef.current?.focus() : onSubmit()}
                error={postalCodeError || undefined}
              />
            )}
            {needs("city") && (
              <AuthInput
                inputRef={cityRef}
                label="Ville *"
                icon="map"
                placeholder="Bruxelles"
                autoCapitalize="words"
                returnKeyType="done"
                value={city}
                onChangeText={(v) => { setCity(v); if (cityError) setCityError(""); }}
                onSubmitEditing={onSubmit}
                error={cityError || undefined}
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
