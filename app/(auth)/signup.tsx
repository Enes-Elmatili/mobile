// app/(auth)/signup.tsx — signup multi-phase (inverted gradient)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import { toFeatherName } from "@/lib/iconMapper";
import { CLIENT_FLOW, PROVIDER_FLOW } from "@/constants/onboardingFlows";
import { getRequiredDocuments } from "@/constants/kycRequirements";
import Slider from "@react-native-community/slider";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthInput,
  AuthLink,
  AuthPhoneInput,
  AuthAddressAutocomplete,
  authT,
  alpha,
} from "@/components/auth";
import type { ParsedAddress } from "@/components/auth";

WebBrowser.maybeCompleteAuthSession();

const { height: SCREEN_H } = Dimensions.get("window");

// ── SVG logos ───────────────────────────────────────────────────────────────
function AppleLogo() {
  return (
    <Svg width={15} height={18} viewBox="0 0 15 18" fill="none">
      <Path
        d="M12.4 9.6C12.4 7.8 13.5 6.7 13.5 6.7C12.5 5.3 11 5.2 10.4 5.2C9.1 5.1 7.9 6 7.2 6C6.5 6 5.5 5.2 4.4 5.2C2.8 5.3 1 6.4 1 9.1C1 10.9 1.7 12.8 2.6 14C3.3 15 4 15.8 5 15.8C5.9 15.8 6.3 15.2 7.5 15.2C8.7 15.2 9 15.8 10 15.8C11 15.8 11.7 14.9 12.4 13.9C13 13.1 13.3 12.2 13.3 12.1C13.3 12.1 12.4 11.8 12.4 9.6Z"
        fill={alpha(authT.textOnDark, 0.85)}
      />
      <Path
        d="M9.5 3.5C10.1 2.8 10.5 1.8 10.4 0.8C9.5 0.9 8.4 1.4 7.8 2.2C7.2 2.9 6.7 3.9 6.9 4.9C7.9 4.9 8.9 4.3 9.5 3.5Z"
        fill={alpha(authT.textOnDark, 0.85)}
      />
    </Svg>
  );
}

function GoogleLogo() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none">
      <Path d="M16.5 8.7C16.5 8.1 16.4 7.5 16.3 7H8.5V10.3H13C12.8 11.3 12.2 12.1 11.3 12.6V14.8H14C15.6 13.3 16.5 11.2 16.5 8.7Z" fill="#4285F4" />
      <Path d="M8.5 17C10.8 17 12.7 16.2 14 14.8L11.3 12.6C10.5 13.1 9.6 13.4 8.5 13.4C6.3 13.4 4.4 11.9 3.7 9.9H1V12.2C2.3 14.8 5.2 17 8.5 17Z" fill="#34A853" />
      <Path d="M3.7 9.9C3.5 9.4 3.4 8.8 3.4 8.2C3.4 7.6 3.5 7 3.7 6.5V4.2H1C0.4 5.4 0 6.8 0 8.2C0 9.6 0.4 11 1 12.2L3.7 9.9Z" fill="#FBBC05" />
      <Path d="M8.5 3C9.7 3 10.8 3.4 11.7 4.3L14.1 1.9C12.7 0.7 10.8 0 8.5 0C5.2 0 2.3 2.2 1 4.8L3.7 7.1C4.4 5.1 6.3 3 8.5 3Z" fill="#EA4335" />
    </Svg>
  );
}

type ToastType = "success" | "error" | "info";

// ── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ color = authT.textOnDark }: { color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 750, easing: Easing.linear, useNativeDriver: true })
    );
    a.start();
    return () => a.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2.5,
          borderColor: color,
          borderTopColor: "transparent",
        }}
      />
    </Animated.View>
  );
}

// ── Password strength ───────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const { t } = useTranslation();
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const barColors = [COLORS.red, COLORS.amber, COLORS.amber, COLORS.greenBrand];
  const labels = [t('auth.su_strength_1'), t('auth.su_strength_2'), t('auth.su_strength_3'), t('auth.su_strength_4')];
  return (
    <View style={str.wrap}>
      <View style={str.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              str.segment,
              { backgroundColor: i < score ? barColors[score - 1] : alpha(authT.textOnLight, 0.1) },
            ]}
          />
        ))}
      </View>
      <Text style={[str.label, { color: score > 0 ? barColors[score - 1] : alpha(authT.textOnLight, 0.3) }]}>
        {score > 0 ? labels[score - 1] : ""}
      </Text>
    </View>
  );
}
const str = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -2, marginBottom: 4 },
  barRow: { flex: 1, flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 11, width: 40 },
});

// ── Constants ───────────────────────────────────────────────────────────────
const ROLE_INTENT_KEY = "@fixed:signup:role";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CITY_OPTIONS = [{ value: "Bruxelles", label: "Bruxelles" }];

interface Category {
  id: number;
  name: string;
  icon?: string;
}

type Phase = "identity" | "billing" | "zone" | "creating";

// ── Signup screen ───────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const { refreshMe, signIn } = useAuth();
  const { t } = useTranslation();

  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(setRole);
  }, []);
  const isProvider = role === "PROVIDER";

  const [phase, setPhase] = useState<Phase>("identity");
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);

  // Google Auth — native PKCE auth-code flow via the Expo Google provider.
  // Google's iOS/Android OAuth clients reject the implicit token flow (the old
  // auth.expo.io proxy setup), so Google.useAuthRequest selects the right
  // per-platform client, builds the native reverse-client-id redirect, runs
  // PKCE, and returns an id_token that the backend verifies by audience.
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.authentication?.idToken ?? googleResponse.params?.id_token;
      const accessToken = googleResponse.authentication?.accessToken ?? googleResponse.params?.access_token;
      if (idToken || accessToken) handleGoogleSignIn({ idToken, accessToken });
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async (tokens: { idToken?: string; accessToken?: string }) => {
    setSocialLoading("google");
    try {
      const res = await api.auth.google(tokens);
      if (!res?.token) throw new Error();
      await signIn(res.token, res.missingFields ?? []);
      await refreshMe();
      // Routing priority:
      //   1. No roles yet → role-select
      //   2. Profile incomplete (missing billing fields) → complete-profile
      //   3. Otherwise → dashboard
      if (!res.roles || res.roles.length === 0) {
        router.replace("/(auth)/role-select");
      } else if (res.profileIncomplete) {
        router.replace({
          pathname: "/(auth)/complete-profile",
          params: { missingFields: (res.missingFields ?? []).join(",") },
        });
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (e: any) {
      if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast(t('auth.su_err_social'));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      const res = await api.auth.apple(
        credential.identityToken!,
        credential.fullName
          ? {
              givenName: credential.fullName.givenName ?? undefined,
              familyName: credential.fullName.familyName ?? undefined,
            }
          : undefined,
        credential.email ?? undefined
      );
      if (!res?.token) throw new Error();
      await signIn(res.token, res.missingFields ?? []);
      await refreshMe();
      if (!res.roles || res.roles.length === 0) {
        router.replace("/(auth)/role-select");
      } else if (res.profileIncomplete) {
        router.replace({
          pathname: "/(auth)/complete-profile",
          params: { missingFields: (res.missingFields ?? []).join(",") },
        });
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED" || e?.code === "1001") {
        // silent cancel
      } else if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast(t('auth.su_err_social'));
    } finally {
      setSocialLoading(null);
    }
  };

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);

  // Billing state
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [postalCodeError, setPostalCodeError] = useState("");
  const [billingCityError, setBillingCityError] = useState("");

  const POSTAL_RE = /^\d{4}$/;
  // E.164 phone (set by AuthPhoneInput via onChangeFormattedText): starts with + and has enough digits
  const isPhoneValid = /^\+\d{7,}$/.test(phone.trim());
  const isAddressValid = address.trim().length >= 3;
  const isPostalCodeValid = POSTAL_RE.test(postalCode.trim());
  const isBillingCityValid = billingCity.trim().length >= 2;
  const canBilling = isPhoneValid && isAddressValid && isPostalCodeValid && isBillingCityValid;

  // Zone state (provider)
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(5);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState(false);

  // Toast
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    feedback.toast(message, type);
  }, []);

  // Entrance
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const animateIn = useCallback(() => {
    fade.setValue(0);
    slide.setValue(16);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  useEffect(() => {
    animateIn();
  }, []);

  // Categories loader
  const loadCategories = useCallback(() => {
    setCatsLoading(true);
    setCatsError(false);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
    Promise.race([api.taxonomies.list(), timeout])
      .then((res: any) => setCategories(res?.data ?? res ?? []))
      .catch(() => {
        setCatsError(true);
        showToast(t('auth.su_err_cats_load'));
      })
      .finally(() => setCatsLoading(false));
  }, []);

  useEffect(() => {
    if (phase === "zone" && isProvider && categories.length === 0) loadCategories();
  }, [phase, isProvider]);

  // Validation
  const isEmailValid = EMAIL_RE.test(email.trim());
  const canIdentity = name.trim().length > 0 && isEmailValid && password.length >= 8;
  const canZone = city.trim().length >= 2 && selectedCats.length > 0;

  // Navigation
  const goToBilling = () => {
    if (!canIdentity) {
      feedback.haptic('error');
      if (!name.trim()) showToast(t('auth.su_err_name'));
      else if (!isEmailValid) showToast(t('auth.su_err_email'));
      else showToast(t('auth.su_err_pwd'));
      return;
    }
    feedback.haptic('light');
    setPhase("billing");
    animateIn();
  };

  const validateBillingFields = (): boolean => {
    let valid = true;
    if (!isPhoneValid) { setPhoneError(t('auth.su_err_phone')); valid = false; } else setPhoneError("");
    if (!isAddressValid) { setAddressError(t('auth.su_err_address')); valid = false; } else setAddressError("");
    if (!isPostalCodeValid) { setPostalCodeError(t('auth.su_err_postal')); valid = false; } else setPostalCodeError("");
    if (!isBillingCityValid) { setBillingCityError(t('auth.su_err_city')); valid = false; } else setBillingCityError("");
    return valid;
  };

  const goToZone = () => {
    if (!validateBillingFields()) {
      feedback.haptic('error');
      return;
    }
    feedback.haptic('light');
    setPhase("zone");
    animateIn();
  };

  const goBack = () => {
    feedback.haptic('light');
    if (phase === "zone") {
      setPhase("billing");
      animateIn();
    } else if (phase === "billing") {
      setPhase("identity");
      animateIn();
    } else if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  const toggleCat = (id: number) => {
    feedback.haptic('light');
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Account creation
  const createAccount = async () => {
    if (isProvider && !canZone) {
      feedback.haptic('error');
      if (city.trim().length < 2) showToast(t('auth.su_err_zone_city'));
      else showToast(t('auth.su_err_zone_cats'));
      return;
    }
    if (!isProvider && !canBilling) return;

    feedback.haptic('medium');
    setPhase("creating");

    try {
      await api.auth.signup(
        email.trim().toLowerCase(),
        password,
        name.trim() || undefined,
        {
          role: isProvider ? "PROVIDER" : "CLIENT",
          phone: phone.trim(),
          address: address.trim(),
          postalCode: postalCode.trim(),
          city: billingCity.trim(),
        }
      );

      if (isProvider) {
        const selectedCatObjects = categories.filter((c) => selectedCats.includes(c.id));
        await api.providers.register({
          name: name.trim(),
          city: city.trim(),
          categoryIds: selectedCats,
        });
        await refreshMe();
        await AsyncStorage.setItem(
          "onboarding_data",
          JSON.stringify({
            name: name.trim(),
            city: city.trim(),
            radius,
            categoryIds: selectedCats,
            categories: selectedCatObjects.map((c) => ({ id: c.id, name: c.name })),
          })
        );
      }

      feedback.haptic('success');
      router.replace({ pathname: "/(auth)/verify-email", params: { email: email.trim().toLowerCase() } });
    } catch (err: any) {
      feedback.haptic('error');
      showToast(err.message || t('auth.su_err_signup'));
      setPhase(isProvider ? "zone" : "billing");
    }
  };

  // Progress — stepper unifié 01→06 (provider) / 01→03 (client).
  // identity(01) → billing/coordonnées(02) → zone/activité(03) ; la suite
  // (vérification, documents, paiements) vit sur les écrans suivants.
  const flow = isProvider ? PROVIDER_FLOW : CLIENT_FLOW;
  const totalSteps = flow.totalSteps;
  const stepNum =
    phase === "identity"
      ? flow.steps.IDENTITY
      : phase === "billing"
        ? flow.steps.COORDS
        : PROVIDER_FLOW.steps.ACTIVITY;
  const phaseLabel =
    phase === "identity"
      ? t('auth.su_phase_identity')
      : phase === "billing"
        ? t('auth.su_phase_coords')
        : t('auth.su_phase_activity');

  const isBusy = !!socialLoading;

  // ── Creating phase ──
  if (phase === "creating") {
    return (
      <View style={s.creatingRoot}>
        <StatusBar barStyle="light-content" />
        <Spinner color={authT.textOnDark} />
        <Text style={s.creatingText}>{t('auth.creating_account')}</Text>
        {isProvider && <Text style={s.creatingSub}>{t('auth.configuring_provider')}</Text>}
      </View>
    );
  }

  // ── Headline per phase ──
  const headlineProps =
    phase === "billing"
      ? { kicker: t('auth.su_kicker'), title: t('auth.su_coords_title'), subtitle: t('auth.su_coords_sub') }
      : isProvider && phase === "zone"
        ? { kicker: t('auth.su_kicker'), title: t('auth.su_activity_title'), subtitle: t('auth.su_activity_sub') }
        : { kicker: t('auth.su_kicker'), title: t('auth.su_identity_title'), subtitle: t('auth.su_identity_sub') };

  return (
    <AuthScreen variant="inverted" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* Top row: back + step indicator */}
        <View style={s.topRow}>
          <AuthBackButton onPress={goBack} />
          <View style={s.stepIndicator}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View key={i} style={[s.stepBar, i < stepNum ? s.stepBarActive : s.stepBarInactive]} />
            ))}
            <Text style={s.stepLabel}>
              <Text style={s.stepLabelBold}>{phaseLabel} · {String(stepNum).padStart(2, "0")}</Text>
              {" / "}
              {String(totalSteps).padStart(2, "0")}
            </Text>
          </View>
        </View>

        <AuthHeadline {...headlineProps} align="left" />

        {/* === IDENTITY PHASE === */}
        {phase === "identity" && (
          <View style={s.body}>
            {/* Social */}
            <View style={s.socialRow}>
              <TouchableOpacity style={s.socialBtn} onPress={handleAppleSignIn} disabled={isBusy} activeOpacity={0.7}>
                {socialLoading === "apple" ? (
                  <Spinner color={authT.textOnDark} />
                ) : (
                  <>
                    <AppleLogo />
                    <Text style={s.socialText}>Apple</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.socialBtn} onPress={() => googlePromptAsync()} disabled={isBusy || !googleRequest} activeOpacity={0.7}>
                {socialLoading === "google" ? (
                  <Spinner color={authT.textOnDark} />
                ) : (
                  <>
                    <GoogleLogo />
                    <Text style={s.socialText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerLabel}>{t('auth.su_or')}</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Form */}
            <View style={s.form}>
              <AuthInput
                label={t('auth.su_name_label')}
                icon="user"
                placeholder={t('auth.su_name_placeholder')}
                autoCapitalize="words"
                maxLength={60}
                returnKeyType="next"
                value={name}
                onChangeText={setName}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              <AuthInput
                inputRef={emailRef}
                label={t('auth.su_email_label')}
                icon="mail"
                placeholder={t('auth.su_email_placeholder')}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => pwdRef.current?.focus()}
              />
              <AuthInput
                inputRef={pwdRef}
                label={t('auth.su_pwd_label')}
                icon="lock"
                placeholder={t('auth.su_pwd_placeholder')}
                secureTextEntry={!showPwd}
                trailingIcon={showPwd ? "eye-off" : "eye"}
                onTrailingPress={() => setShowPwd((p) => !p)}
                returnKeyType="done"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={isProvider ? goToZone : createAccount}
              />
              {password.length > 0 && <StrengthBar password={password} />}
            </View>

            {/* CGU */}
            <View style={s.cguRow}>
              <Feather name="shield" size={13} color={alpha(authT.textOnLight, 0.3)} style={{ marginTop: 1 }} />
              <Text style={s.cguText}>
                {t('auth.su_cgu_pre')}
                <Text style={s.cguLink}>{t('auth.su_cgu_terms')}</Text>
                {t('auth.su_cgu_mid')}
                <Text style={s.cguLink}>{t('auth.su_cgu_privacy')}</Text>
                {t('auth.su_cgu_post')}
              </Text>
            </View>
          </View>
        )}

        {/* === BILLING PHASE === */}
        {phase === "billing" && (
          <View style={s.body}>
            <View style={s.form}>
              <AuthPhoneInput
                onChangeFormattedText={(e164) => { setPhone(e164); if (phoneError) setPhoneError(""); }}
                onChangeText={() => { if (phoneError) setPhoneError(""); }}
                error={phoneError || undefined}
              />
              <AuthAddressAutocomplete
                onAddressSelected={(p: ParsedAddress) => {
                  setAddress(p.street);
                  setPostalCode(p.postalCode);
                  setBillingCity(p.city);
                  if (addressError) setAddressError("");
                  if (postalCodeError) setPostalCodeError("");
                  if (billingCityError) setBillingCityError("");
                }}
                error={addressError || undefined}
              />
              {!!postalCode && !!billingCity && (
                <View style={s.autofillRow}>
                  <Feather name="zap" size={11} color={alpha(authT.textOnLight, 0.45)} />
                  <Text style={s.autofillText}>
                    {postalCode} {billingCity} — {t('auth.su_autofill_suffix')}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.cguRow}>
              <Feather name="lock" size={13} color={alpha(authT.textOnLight, 0.3)} style={{ marginTop: 1 }} />
              <Text style={s.cguText}>{t('auth.su_billing_note')}</Text>
            </View>
          </View>
        )}

        {/* === ZONE PHASE === */}
        {phase === "zone" && isProvider && (
          <View style={s.body}>
            <View>
              <Text style={s.sectionLabel}>{t('auth.su_zone_city')}</Text>
              <View style={s.cityDropdown}>
                {CITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.cityOption, city === opt.value && s.cityOptionActive]}
                    onPress={() => {
                      feedback.haptic('selection');
                      setCity(opt.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="map-pin"
                      size={15}
                      color={city === opt.value ? authT.textOnLight : alpha(authT.textOnDark, 0.6)}
                    />
                    <Text style={[s.cityOptionText, city === opt.value && s.cityOptionTextActive]}>{opt.label}</Text>
                    {city === opt.value && <Feather name="check-circle" size={18} color={authT.textOnLight} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={s.sectionLabel}>{t('auth.su_zone_radius')}</Text>
              <View style={s.sliderWrap}>
                <View style={s.sliderValueRow}>
                  <Text style={s.sliderValue}>{radius} km</Text>
                  <Text style={s.sliderAnnotation}>
                    {radius <= 3
                      ? t('auth.su_radius_near')
                      : radius <= 8
                        ? t('auth.su_radius_mid')
                        : t('auth.su_radius_far')}
                  </Text>
                </View>
                <Slider
                  minimumValue={1}
                  maximumValue={15}
                  step={1}
                  value={radius}
                  onValueChange={(v: number) => setRadius(v)}
                  minimumTrackTintColor={authT.textOnDark}
                  maximumTrackTintColor={alpha(authT.textOnDark, 0.15)}
                  thumbTintColor={authT.textOnDark}
                  style={{ width: "100%", height: 40 }}
                />
                <View style={s.sliderLabels}>
                  <Text style={s.sliderLabelText}>1 km</Text>
                  <Text style={s.sliderLabelText}>15 km</Text>
                </View>
              </View>
            </View>

            <View>
              <Text style={s.sectionLabel}>{t('auth.su_zone_cats')}</Text>
              {catsLoading ? (
                <View style={s.centered}>
                  <ActivityIndicator size="large" color={alpha(authT.textOnDark, 0.6)} />
                </View>
              ) : catsError && categories.length === 0 ? (
                <TouchableOpacity style={s.centered} onPress={loadCategories} activeOpacity={0.7}>
                  <Feather name="refresh-cw" size={24} color={alpha(authT.textOnDark, 0.5)} />
                  <Text style={s.retryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.catGrid}>
                  {[...categories]
                    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                    .map((cat) => {
                      const sel = selectedCats.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[s.chip, sel && s.chipActive]}
                          onPress={() => toggleCat(cat.id)}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name={toFeatherName(cat.icon, "briefcase") as any}
                            size={15}
                            color={sel ? authT.textOnLight : alpha(authT.textOnDark, 0.55)}
                          />
                          <Text numberOfLines={1} style={[s.chipText, sel && s.chipTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )}
              {selectedCats.length > 0 && (
                <Text style={s.catCount}>
                  {t('auth.su_cat_count', {
                    count: selectedCats.length,
                    docs: getRequiredDocuments(
                      categories.filter((c) => selectedCats.includes(c.id)).map((c) => c.name)
                    ).filter((d) => d.required).length,
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={s.spacer} />

        <AuthCTA
          label={
            phase === "identity" || (phase === "billing" && isProvider)
              ? t('auth.su_continue')
              : t('auth.su_create')
          }
          onPress={() => {
            if (phase === "identity") goToBilling();
            else if (phase === "billing" && isProvider) goToZone();
            else createAccount();
          }}
          disabled={
            (phase === "identity" && !canIdentity) ||
            (phase === "billing" && !canBilling) ||
            (phase === "zone" && !canZone)
          }
        />

        {phase === "identity" && (
          <AuthLink
            prefix={t('auth.su_already')}
            action={t('auth.su_signin')}
            onPress={() => {
              feedback.haptic('light');
              router.push("/(auth)/login");
            }}
          />
        )}
      </Animated.View>
    </AuthScreen>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex: { flex: 1 },

  creatingRoot: {
    flex: 1,
    backgroundColor: authT.dark,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  creatingText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: authT.textOnDark,
    marginTop: 8,
  },
  creatingSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: alpha(authT.textOnDark, 0.55),
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepBar: { height: 2, borderRadius: 2 },
  stepBarActive: { width: 22, backgroundColor: authT.textOnDark },
  stepBarInactive: { width: 12, backgroundColor: alpha(authT.textOnDark, 0.15) },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: alpha(authT.textOnDark, 0.3),
    marginLeft: 4,
  },
  stepLabelBold: { color: alpha(authT.textOnDark, 0.6) },

  body: {
    paddingTop: 14,
    gap: 12,
  },

  // Social
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    height: 46,
    backgroundColor: alpha(authT.dark, 0.85),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  socialText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: alpha(authT.textOnDark, 0.85),
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
    backgroundColor: alpha(authT.textOnLight, 0.18),
  },
  dividerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: alpha(authT.textOnLight, 0.55),
    letterSpacing: 2,
  },

  form: {
    gap: 10,
  },

  // CGU
  cguRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 2,
  },
  cguText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: alpha(authT.textOnLight, 0.5),
  },
  cguLink: {
    color: authT.textOnLight,
    textDecorationLine: "underline",
  },

  // Zone — section labels (sit in light/transition zone)
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: alpha(authT.textOnLight, 0.55),
    marginBottom: 10,
  },

  // City
  cityDropdown: {
    gap: 8,
  },
  cityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    borderRadius: 14,
  },
  cityOptionActive: {
    backgroundColor: authT.textOnDark,
    borderColor: authT.textOnDark,
  },
  cityOptionText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: alpha(authT.textOnDark, 0.85),
  },
  cityOptionTextActive: {
    color: authT.textOnLight,
  },

  // Slider
  sliderWrap: {
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sliderValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  sliderValue: {
    fontFamily: FONTS.bebas,
    fontSize: 28,
    color: authT.textOnDark,
    letterSpacing: 1.5,
  },
  sliderAnnotation: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: alpha(authT.textOnDark, 0.4),
    flexShrink: 1,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderLabelText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: alpha(authT.textOnDark, 0.45),
    letterSpacing: 1,
  },

  // Categories
  centered: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: alpha(authT.textOnDark, 0.55),
    textDecorationLine: "underline",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    borderRadius: 100,
    minWidth: "47%",
    flexGrow: 1,
  },
  chipActive: {
    backgroundColor: authT.textOnDark,
    borderColor: authT.textOnDark,
  },
  chipText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: alpha(authT.textOnDark, 0.9),
    letterSpacing: 0.2,
  },
  chipTextActive: {
    color: authT.textOnLight,
  },
  catCount: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: alpha(authT.textOnLight, 0.6),
    letterSpacing: 1.2,
    marginTop: 10,
  },

  autofillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
  },
  autofillText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: alpha(authT.textOnLight, 0.5),
  },

  spacer: { flex: 1, minHeight: 24 },
});
