// app/(auth)/signup.tsx — signup multi-phase (flat theme-aware, v2 éditorial)
// Les phases sont rendues par components/auth/signup/* ; la validation, les
// libellés par phase et les corps serveur vivent dans lib/auth/signupForm.ts.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, BackHandler } from "react-native";
import type { TextInputInstance } from "react-native";
import Animated from "react-native-reanimated";
import { useEntrance } from "@/lib/motion/useEntrance";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTranslation } from "react-i18next";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthLink,
  AuthMasthead,
  AuthEyebrow,
  AuthStepper,
} from "@/components/auth";
import {
  billingValidity,
  buildOnboardingData,
  buildProviderRegisterPayload,
  buildSignupArgs,
  canSubmitIdentity,
  canSubmitZone,
  ctaHintKey,
  ctaLabelKey,
  headlineKeys,
  identityErrorKey,
  isCtaDisabled,
  phaseLabelKey,
  toggleId,
  zoneErrorKey,
  type SignupCategory,
  type SignupDraft,
  type SignupPhase,
} from "@/lib/auth/signupForm";
import { SignupCreating } from "@/components/auth/signup/SignupCreating";
import { SignupIdentityPhase } from "@/components/auth/signup/SignupIdentityPhase";
import { SignupBillingPhase } from "@/components/auth/signup/SignupBillingPhase";
import { SignupZonePhase } from "@/components/auth/signup/SignupZonePhase";
import { useSocialSignIn } from "@/components/auth/signup/useSocialSignIn";

WebBrowser.maybeCompleteAuthSession();

type ToastType = "success" | "error" | "info";

// Rôle choisi à role-select (étape 1/3), relu ici et par le routage social.
const ROLE_INTENT_KEY = "@fixed:signup:role";

// ── Signup screen ───────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const { t } = useTranslation();
  const theme = useAppTheme();

  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(setRole);
  }, []);
  const isProvider = role === "PROVIDER";

  const [phase, setPhase] = useState<SignupPhase>("identity");
  // Apple / Google : état, requête OAuth, routage post-auth (même position
  // qu'avant dans l'ordre des hooks).
  const { socialLoading, handleGooglePress, handleAppleSignIn } = useSocialSignIn(ROLE_INTENT_KEY);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const emailRef = useRef<TextInputInstance>(null);
  const pwdRef = useRef<TextInputInstance>(null);

  // Mémorise que api.auth.signup a réussi : si providers.register échoue ensuite,
  // le retry ne rejoue QUE l'enregistrement provider (sinon 409 « email déjà utilisé »).
  const signupDoneRef = useRef(false);

  // Billing state
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [postalCodeError, setPostalCodeError] = useState("");
  const [billingCityError, setBillingCityError] = useState("");

  const billing = billingValidity({ phone, address, postalCode, billingCity });
  const canBilling = billing.all;

  // Zone state (provider)
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(5);
  const [categories, setCategories] = useState<SignupCategory[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState(false);

  // Toast
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    feedback.toast(message, type);
  }, []);

  // Entrée : jouée au montage, rejouée à chaque changement de phase.
  const entrance = useEntrance(16);
  const animateIn = entrance.replay;

  // Categories loader. Les setters (stables) sont cités en dépendances : le
  // compilateur les infère comme tels et ne préserverait pas le mémo sinon.
  const loadCategories = useCallback(() => {
    setCatsLoading(true);
    setCatsError(false);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
    Promise.race([api.taxonomies.list(), timeout])
      .then((res) => setCategories(res?.data ?? res ?? []))
      .catch(() => {
        setCatsError(true);
        showToast(t('auth.su_err_cats_load'));
      })
      .finally(() => setCatsLoading(false));
  }, [showToast, t, setCategories, setCatsError, setCatsLoading]);

  useEffect(() => {
    if (phase === "zone" && isProvider && categories.length === 0) loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois à l'entrée dans la phase
  }, [phase, isProvider]);

  // Validation
  const identity = { name, email, password };
  const canIdentity = canSubmitIdentity(identity);
  const canZone = canSubmitZone(city, selectedCats);
  const validity = { canIdentity, canBilling, canZone };

  // Navigation
  const goToBilling = () => {
    if (!canIdentity) {
      feedback.haptic('error');
      showToast(t(identityErrorKey(identity)));
      return;
    }
    feedback.haptic('light');
    setPhase("billing");
    animateIn();
  };

  const validateBillingFields = (): boolean => {
    let valid = true;
    if (!billing.phone) { setPhoneError(t('auth.su_err_phone')); valid = false; } else setPhoneError("");
    if (!billing.address) { setAddressError(t('auth.su_err_address')); valid = false; } else setAddressError("");
    if (!billing.postalCode) { setPostalCodeError(t('auth.su_err_postal')); valid = false; } else setPostalCodeError("");
    if (!billing.billingCity) { setBillingCityError(t('auth.su_err_city')); valid = false; } else setBillingCityError("");
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

  // Bouton retour matériel Android : revient à la phase précédente au lieu de
  // quitter tout le signup ; à la phase 1 (identité), demande confirmation.
  useEffect(() => {
    const onHardwareBack = () => {
      if (phase === "creating") return true; // création en cours → bloquer
      if (phase === "zone" || phase === "billing") {
        goBack();
        return true;
      }
      // phase "identity" → confirmation avant de quitter
      feedback.confirm({
        title: t("auth.su_quit_title"),
        message: t("auth.su_quit_msg"),
        confirm: t("auth.su_quit_confirm"),
        cancel: t("common.continue"),
        destructive: true,
      }).then((ok) => {
        if (ok) {
          if (router.canGoBack()) router.back();
          else router.replace("/(auth)/welcome");
        }
      });
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le retour matériel ne dépend que de la phase
  }, [phase]);

  const toggleCat = (id: number) => {
    feedback.haptic('light');
    setSelectedCats((prev) => toggleId(prev, id));
  };

  // Account creation
  const createAccount = async () => {
    if (isProvider && !canZone) {
      feedback.haptic('error');
      showToast(t(zoneErrorKey(city)));
      return;
    }
    if (!isProvider && !canBilling) return;

    feedback.haptic('medium');
    setPhase("creating");

    const draft: SignupDraft = {
      isProvider, name, email, password, phone, address, postalCode, billingCity, city, radius, selectedCats,
    };
    try {
      // Ne rejoue pas le signup si le compte a déjà été créé lors d'une tentative
      // précédente (échec au niveau providers.register uniquement).
      if (!signupDoneRef.current) {
        const args = buildSignupArgs(draft);
        await api.auth.signup(args.email, args.password, args.name, args.extras);
        signupDoneRef.current = true;
      }

      if (isProvider) {
        await api.providers.register(buildProviderRegisterPayload(draft));
        await refreshMe();
        await AsyncStorage.setItem("onboarding_data", JSON.stringify(buildOnboardingData(draft, categories)));
      }

      feedback.haptic('success');
      router.replace({ pathname: "/(auth)/verify-email", params: { email: email.trim().toLowerCase() } });
    } catch (err: unknown) {
      feedback.haptic('error');
      showToast((err as { message?: string }).message || t('auth.su_err_signup'));
      setPhase(isProvider ? "zone" : "billing");
    }
  };

  // ── Creating phase ──
  if (phase === "creating") {
    return <SignupCreating isProvider={isProvider} />;
  }

  // Progress — le stepper macro (role-select 1/3 → signup 2/3 → verify 3/3)
  // vit sous le masthead ; la progression interne (identité → coordonnées →
  // activité) est portée par l'eyebrow par phase.
  const phaseLabel = t(phaseLabelKey(phase));

  // ── Headline per phase ──
  const headline = headlineKeys(phase, isProvider);
  const headlineProps = { title: t(headline.title), subtitle: t(headline.subtitle) };

  // Raison de désactivation du CTA — sinon bouton grisé inexpliqué
  const hintKey = ctaHintKey(phase, validity);

  return (
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, entrance.style]}>
        {/* Header : back flottant + masthead + stepper macro (2/3) */}
        <View style={s.header}>
          <View style={s.backAbs}>
            <AuthBackButton onPress={goBack} themed />
          </View>
          <AuthMasthead />
          <AuthStepper total={3} current={2} accessibilityLabel={t('ext.signup_step')} />
        </View>

        <View style={s.airTop} />

        <AuthEyebrow label={phaseLabel} />
        <AuthHeadline themed {...headlineProps} />

        {/* === IDENTITY PHASE === */}
        {phase === "identity" && (
          <SignupIdentityPhase
            socialLoading={socialLoading}
            onApplePress={handleAppleSignIn}
            onGooglePress={handleGooglePress}
            name={name}
            onChangeName={setName}
            email={email}
            onChangeEmail={setEmail}
            password={password}
            onChangePassword={setPassword}
            showPwd={showPwd}
            onToggleShowPwd={() => setShowPwd((p) => !p)}
            emailRef={emailRef}
            pwdRef={pwdRef}
            onSubmit={goToBilling}
            onOpenTerms={() => router.push("/settings/cgu")}
            onOpenPrivacy={() => router.push("/settings/privacy")}
          />
        )}

        {/* === BILLING PHASE === */}
        {phase === "billing" && (
          <SignupBillingPhase
            address={address}
            postalCode={postalCode}
            billingCity={billingCity}
            setPhone={setPhone}
            setAddress={setAddress}
            setPostalCode={setPostalCode}
            setBillingCity={setBillingCity}
            phoneError={phoneError}
            addressError={addressError}
            postalCodeError={postalCodeError}
            billingCityError={billingCityError}
            setPhoneError={setPhoneError}
            setAddressError={setAddressError}
            setPostalCodeError={setPostalCodeError}
            setBillingCityError={setBillingCityError}
          />
        )}

        {/* === ZONE PHASE === */}
        {phase === "zone" && isProvider && (
          <SignupZonePhase
            city={city}
            setCity={setCity}
            radius={radius}
            setRadius={setRadius}
            categories={categories}
            catsLoading={catsLoading}
            catsError={catsError}
            selectedCats={selectedCats}
            onToggleCat={toggleCat}
            onRetryCats={loadCategories}
          />
        )}

        <View style={s.spacer} />

        <AuthCTA
          label={t(ctaLabelKey(phase, isProvider))}
          onPress={() => {
            if (phase === "identity") goToBilling();
            else if (phase === "billing" && isProvider) goToZone();
            else createAccount();
          }}
          disabled={isCtaDisabled(phase, validity)}
          variant="flat"
        />

        {hintKey ? (
          <Text
            style={[s.ctaHint, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
            maxFontSizeMultiplier={1.2}
          >
            {t(hintKey)}
          </Text>
        ) : null}

        {phase === "identity" && (
          <AuthLink
            themed
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

  header: { position: "relative" },
  backAbs: { position: "absolute", left: 0, top: 11, zIndex: 1 },
  airTop: { flex: 0.55, minHeight: 12 },

  spacer: { flex: 1, minHeight: 24 },

  ctaHint: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 2,
  },
});
