// app/(auth)/signup.tsx — FIXED Premium Signup (dark design)
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform, KeyboardAvoidingView,
  Easing, StatusBar, ScrollView, ActivityIndicator, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line, Path, G, Defs, ClipPath, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuthRequest, ResponseType } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { toFeatherName } from "@/lib/iconMapper";
import { CLIENT_FLOW, PROVIDER_FLOW } from "@/constants/onboardingFlows";
import Slider from "@react-native-community/slider";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// ── Colors (dark-only) — sourced from theme tokens so charter updates propagate ────────────
const C = {
  bg:          darkTokens.bg,
  white:       darkTokens.text,
  grey:        darkTokens.textMuted,
  greyFaint:   "rgba(255,255,255,0.2)",
  border:      "rgba(255,255,255,0.08)",
  cardBg:      darkTokens.cardBg,
  inputBg:     darkTokens.cardBg,
  green:       COLORS.greenBrand,
  red:         COLORS.red,
  amber:       COLORS.amber,
  outlineText: "rgba(255,255,255,0.3)",
};

// ── Grid background ─────────────────────────────────────────────────────────
function GridLines() {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = "rgba(255,255,255,0.025)";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
      <LinearGradient
        colors={["transparent", "transparent", C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ── SVG Icons ───────────────────────────────────────────────────────────────
function AppleLogo() {
  return (
    <Svg width={15} height={18} viewBox="0 0 15 18" fill="none">
      <Path d="M12.4 9.6C12.4 7.8 13.5 6.7 13.5 6.7C12.5 5.3 11 5.2 10.4 5.2C9.1 5.1 7.9 6 7.2 6C6.5 6 5.5 5.2 4.4 5.2C2.8 5.3 1 6.4 1 9.1C1 10.9 1.7 12.8 2.6 14C3.3 15 4 15.8 5 15.8C5.9 15.8 6.3 15.2 7.5 15.2C8.7 15.2 9 15.8 10 15.8C11 15.8 11.7 14.9 12.4 13.9C13 13.1 13.3 12.2 13.3 12.1C13.3 12.1 12.4 11.8 12.4 9.6Z" fill="rgba(255,255,255,0.75)" />
      <Path d="M9.5 3.5C10.1 2.8 10.5 1.8 10.4 0.8C9.5 0.9 8.4 1.4 7.8 2.2C7.2 2.9 6.7 3.9 6.9 4.9C7.9 4.9 8.9 4.3 9.5 3.5Z" fill="rgba(255,255,255,0.75)" />
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

// ── Toast ────────────────────────────────────────────────────────────────────
type ToastType = "error" | "success" | "info";
interface ToastMsg { id: number; type: ToastType; message: string }

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
  const color = msg.type === "error" ? C.red : msg.type === "success" ? C.green : C.white;
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
    top: 56, // fallback; overridden inline with insets.top
    left: 20, right: 20, zIndex: 9999, gap: 8,
  },
  pill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.cardBg,
    borderWidth: 1, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 10 },
    }),
  },
  text: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.white, flex: 1 },
});

// ── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ color = C.bg }: { color?: string }) {
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
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: color, borderTopColor: "transparent" }} />
    </Animated.View>
  );
}

// ── Password strength ───────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const barColors = [C.red, C.amber, C.amber, C.green];
  const labels = ["Faible", "Moyen", "Bon", "Fort"];
  return (
    <View style={str.wrap}>
      <View style={str.barRow}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[str.segment, { backgroundColor: i < score ? barColors[score - 1] : "rgba(255,255,255,0.08)" }]} />
        ))}
      </View>
      <Text style={[str.label, { color: score > 0 ? barColors[score - 1] : "rgba(255,255,255,0.2)" }]}>
        {score > 0 ? labels[score - 1] : ""}
      </Text>
    </View>
  );
}
const str = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -4, marginBottom: 4 },
  barRow: { flex: 1, flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 11, width: 40 },
});

// ── Constants ───────────────────────────────────────────────────────────────
const ROLE_INTENT_KEY = "@fixed:signup:role";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CITY_OPTIONS = [
  { value: "Bruxelles", label: "Bruxelles" },
];

const RADIUS_OPTIONS = [
  { value: 5, label: "5 km", hint: "Quartier" },
  { value: 10, label: "10 km", hint: "Ville" },
  { value: 20, label: "20 km", hint: "Agglo." },
  { value: 30, label: "30 km", hint: "Grand bassin" },
  { value: 50, label: "50 km", hint: "Région" },
  { value: 100, label: "100 km", hint: "Élargie" },
];

interface Category { id: number; name: string; icon?: string }

// ── SIGNUP ──────────────────────────────────────────────────────────────────
type Phase = "identity" | "zone" | "creating";

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshMe, signIn } = useAuth();

  // ── Role ──
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { AsyncStorage.getItem(ROLE_INTENT_KEY).then(r => setRole(r)); }, []);
  const isProvider = role === "PROVIDER";

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>("identity");
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);

  // ── Google Auth ──
  const googleDiscovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };
  const [googleRequest, googleResponse, googlePromptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
      redirectUri: "https://auth.expo.io/@eneselmatili/fixed-app",
      scopes: ["openid", "profile", "email"],
      responseType: ResponseType.Token,
    },
    googleDiscovery,
  );

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const accessToken = googleResponse.params?.access_token;
      if (accessToken) handleGoogleSignIn(accessToken);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async (accessToken: string) => {
    setSocialLoading("google");
    try {
      const res = await api.auth.google(accessToken);
      if (!res?.token) throw new Error();
      await signIn(res.token);
      if (res.roles && res.roles.length === 0) {
        router.replace("/(auth)/role-select");
      }
    } catch (e: any) {
      if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast("Connexion impossible, réessaie");
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Apple Auth ──
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
        credential.fullName ? {
          givenName: credential.fullName.givenName ?? undefined,
          familyName: credential.fullName.familyName ?? undefined,
        } : undefined,
        credential.email ?? undefined,
      );
      if (!res?.token) throw new Error();
      await signIn(res.token);
      if (res.roles && res.roles.length === 0) {
        router.replace("/(auth)/role-select");
      }
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED" || e?.code === "1001") { /* silent */ }
      else if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast("Connexion impossible, réessaie");
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Form state ──
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);

  // ── Zone state (provider) ──
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(5);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState(false);

  // ── Toast ──
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counter.current;
    setMsgs(p => [...p, { id, type, message }]);
  }, []);

  // ── Animations ──
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyTy = useRef(new Animated.Value(14)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(14)).current;

  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;

  const animateIn = useCallback(() => {
    headerOp.setValue(0); headerTy.setValue(-12);
    bodyOp.setValue(0); bodyTy.setValue(14);
    actionsOp.setValue(0); actionsTy.setValue(14);
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerOp, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(headerTy, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(bodyOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(bodyTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(actionsOp, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(actionsTy, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => { animateIn(); }, []);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOp, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // ── Load categories ──
  const loadCategories = useCallback(() => {
    setCatsLoading(true);
    setCatsError(false);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
    Promise.race([api.taxonomies.list(), timeout])
      .then((res: any) => setCategories(res?.data ?? res ?? []))
      .catch(() => { setCatsError(true); showToast("Erreur de chargement des catégories"); })
      .finally(() => setCatsLoading(false));
  }, []);

  useEffect(() => {
    if (phase === "zone" && isProvider && categories.length === 0) loadCategories();
  }, [phase, isProvider]);

  // ── Validation ──
  const isEmailValid = EMAIL_RE.test(email.trim());
  const canIdentity = name.trim().length > 0 && isEmailValid && password.length >= 8;
  const canZone = city.trim().length >= 2 && selectedCats.length > 0;

  // ── Navigation ──
  const goToZone = () => {
    if (!canIdentity) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!name.trim()) showToast("Entrez votre nom");
      else if (!isEmailValid) showToast("Adresse mail invalide");
      else showToast("Mot de passe trop court — 8 caractères min.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase("zone");
    animateIn();
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === "zone") { setPhase("identity"); animateIn(); }
    else router.canGoBack() ? router.back() : router.replace("/(auth)/welcome");
  };

  const toggleCat = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── Account creation ──
  const createAccount = async () => {
    if (isProvider && !canZone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (city.trim().length < 2) showToast("Entrez votre ville de base");
      else showToast("Sélectionnez au moins un domaine");
      return;
    }
    if (!isProvider && !canIdentity) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("creating");

    try {
      await api.auth.signup(email.trim().toLowerCase(), password, name.trim() || undefined, isProvider ? { role: "PROVIDER" } : undefined);

      if (isProvider) {
        const selectedCatObjects = categories.filter(c => selectedCats.includes(c.id));
        await api.providers.register({
          name: name.trim(),
          city: city.trim(),
          categoryIds: selectedCats,
        });
        await refreshMe();
        await AsyncStorage.setItem("onboarding_data", JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          radius,
          categoryIds: selectedCats,
          categories: selectedCatObjects.map(c => ({ id: c.id, name: c.name })),
        }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/(auth)/verify-email", params: { email: email.trim().toLowerCase() } });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(err.message || "Échec de l'inscription");
      setPhase(isProvider ? "zone" : "identity");
    }
  };

  // ── Progress ──
  const flow = isProvider ? PROVIDER_FLOW : CLIENT_FLOW;
  const totalSteps = flow.totalSteps;
  const stepNum = isProvider
    ? (phase === "identity" ? PROVIDER_FLOW.steps.SIGNUP_ID : PROVIDER_FLOW.steps.ZONE)
    : CLIENT_FLOW.steps.REGISTER;

  const isBusy = !!socialLoading;

  // ── Creating screen ──
  if (phase === "creating") {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <GridLines />
        <View style={s.creatingWrap}>
          <Spinner color={C.white} />
          <Text style={s.creatingText}>Création de votre compte...</Text>
          {isProvider && <Text style={s.creatingSubtext}>Configuration du profil prestataire</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Grid + glow */}
      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.025)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Toast */}
      <View style={[ts.layer, { top: insets.top }]} pointerEvents="none">
        {msgs.map(m => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs(p => p.filter(x => x.id !== m.id))} />
        ))}
      </View>

      <View style={{ flex: 1 }}>

        {/* Header */}
        <Animated.View style={[s.header, { paddingTop: insets.top + 12, opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
          <View style={s.navRow}>
            <TouchableOpacity style={s.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
              <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <View style={s.stepIndicator}>
              {Array.from({ length: isProvider ? totalSteps : 2 }).map((_, i) => (
                <View key={i} style={[s.stepBar, i < stepNum ? s.stepBarActive : s.stepBarInactive]} />
              ))}
              <Text style={s.stepLabel}>
                <Text style={s.stepLabelBold}>{String(stepNum).padStart(2, "0")}</Text>
                {" / "}
                {String(isProvider ? totalSteps : 2).padStart(2, "0")}
              </Text>
            </View>
          </View>

          <View style={s.titleBlock}>
            <Text style={s.logoEyebrow}>Inscription</Text>
            {phase === "identity" ? (
              <>
                <Text style={s.logoWordmark}>
                  CRÉEZ VOTRE{"\n"}
                  <Text style={s.logoWordmarkOutline}>COMPTE.</Text>
                </Text>
                <Text style={s.titleSub}>Opérationnel en moins d'une minute.</Text>
              </>
            ) : (
              <>
                <Text style={s.logoWordmark}>
                  VOTRE{"\n"}
                  <Text style={s.logoWordmarkOutline}>ACTIVITÉ.</Text>
                </Text>
                <Text style={s.titleSub}>Zone d'intervention et domaines d'expertise.</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Body */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
        <Animated.View style={[s.bodyWrapper, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
          <ScrollView
            contentContainerStyle={s.bodyScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* === IDENTITY PHASE === */}
            {phase === "identity" && (
              <>
                {/* Social */}
                <View style={s.socialRow}>
                  <TouchableOpacity style={s.socialBtn} onPress={handleAppleSignIn} disabled={isBusy} activeOpacity={0.7}>
                    {socialLoading === "apple" ? <Spinner color={C.white} /> : <><AppleLogo /><Text style={s.socialText}>Apple</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.socialBtn} onPress={() => googlePromptAsync()} disabled={isBusy || !googleRequest} activeOpacity={0.7}>
                    {socialLoading === "google" ? <Spinner color={C.white} /> : <><GoogleLogo /><Text style={s.socialText}>Google</Text></>}
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={s.divider}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerLabel}>ou</Text>
                  <View style={s.dividerLine} />
                </View>

                {/* Form */}
                <View style={s.form}>
                  {/* Name */}
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Nom complet</Text>
                    <View style={[s.inputWrap, focused === "name" && s.inputFocused]}>
                      <View style={s.inputIcon}>
                        <Feather name="user" size={15} color={focused === "name" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                      </View>
                      <TextInput
                        ref={nameRef}
                        style={s.input}
                        placeholder="Prénom et nom"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        autoCapitalize="words"
                        maxLength={60}
                        returnKeyType="next"
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocused("name")}
                        onBlur={() => setFocused(null)}
                        onSubmitEditing={() => emailRef.current?.focus()}
                      />
                    </View>
                  </View>

                  {/* Email */}
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Adresse mail</Text>
                    <View style={[s.inputWrap, focused === "email" && s.inputFocused]}>
                      <View style={s.inputIcon}>
                        <Feather name="mail" size={15} color={focused === "email" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                      </View>
                      <TextInput
                        ref={emailRef}
                        style={s.input}
                        placeholder="votre@email.com"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        returnKeyType="next"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setFocused("email")}
                        onBlur={() => setFocused(null)}
                        onSubmitEditing={() => pwdRef.current?.focus()}
                      />
                    </View>
                  </View>

                  {/* Password */}
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Mot de passe</Text>
                    <View style={[s.inputWrap, focused === "password" && s.inputFocused]}>
                      <View style={s.inputIcon}>
                        <Feather name="lock" size={14} color={focused === "password" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                      </View>
                      <TextInput
                        ref={pwdRef}
                        style={s.input}
                        placeholder="Minimum 6 caractères"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        secureTextEntry={!showPwd}
                        returnKeyType="done"
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused(null)}
                        onSubmitEditing={isProvider ? goToZone : createAccount}
                      />
                      <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.inputEnd} activeOpacity={0.6}>
                        <Feather name={showPwd ? "eye-off" : "eye"} size={17} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {password.length > 0 && <StrengthBar password={password} />}
                </View>

                {/* CGU */}
                <View style={s.cguRow}>
                  <Feather name="shield" size={13} color="rgba(255,255,255,0.2)" style={{ marginTop: 1 }} />
                  <Text style={s.cguText}>
                    En continuant, vous acceptez nos{" "}
                    <Text style={s.cguLink}>CGU</Text> et notre{" "}
                    <Text style={s.cguLink}>Politique de confidentialité</Text>.
                  </Text>
                </View>
              </>
            )}

            {/* === ZONE PHASE (provider) === */}
            {phase === "zone" && isProvider && (
              <>
                {/* City — dropdown */}
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Ville de base</Text>
                  <View style={s.cityDropdown}>
                    {CITY_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.cityOption, city === opt.value && s.cityOptionActive]}
                        onPress={() => { Haptics.selectionAsync(); setCity(opt.value); }}
                        activeOpacity={0.7}
                      >
                        <Feather name="map-pin" size={15} color={city === opt.value ? C.bg : C.grey} />
                        <Text style={[s.cityOptionText, city === opt.value && s.cityOptionTextActive]}>{opt.label}</Text>
                        {city === opt.value && <Feather name="check-circle" size={18} color={C.bg} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Radius — slider */}
                <Text style={s.sectionLabel}>Rayon d'intervention</Text>
                <View style={s.sliderWrap}>
                  <View style={s.sliderHeader}>
                    <Text style={s.sliderValue}>{radius} km</Text>
                  </View>
                  <Slider
                    minimumValue={1}
                    maximumValue={15}
                    step={1}
                    value={radius}
                    onValueChange={(v: number) => setRadius(v)}
                    minimumTrackTintColor={C.white}
                    maximumTrackTintColor="rgba(255,255,255,0.12)"
                    thumbTintColor={C.white}
                    style={{ width: '100%', height: 40 }}
                  />
                  <View style={s.sliderLabels}>
                    <Text style={s.sliderLabelText}>1 km</Text>
                    <Text style={s.sliderLabelText}>15 km</Text>
                  </View>
                </View>

                {/* Categories */}
                <Text style={[s.sectionLabel, { marginTop: 24 }]}>Vos métiers</Text>
                {catsLoading ? (
                  <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
                ) : catsError && categories.length === 0 ? (
                  <TouchableOpacity style={s.centered} onPress={loadCategories} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={24} color={C.grey} />
                    <Text style={s.retryText}>Réessayer</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.catGrid}>
                    {[...categories].sort((a, b) => a.name.localeCompare(b.name, "fr")).map(cat => {
                      const sel = selectedCats.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[s.chip, sel && s.chipActive]}
                          onPress={() => toggleCat(cat.id)}
                          activeOpacity={0.7}
                        >
                          <Feather name={toFeatherName(cat.icon, 'briefcase') as any} size={15} color={sel ? C.bg : "rgba(255,255,255,0.5)"} />
                          <Text numberOfLines={1} style={[s.chipText, sel && s.chipTextActive]}>{cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {selectedCats.length > 0 && (
                  <Text style={s.catCount}>
                    {selectedCats.length} service{selectedCats.length > 1 ? "s" : ""} sélectionné{selectedCats.length > 1 ? "s" : ""}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
        </KeyboardAvoidingView>

        {/* Actions */}
        <Animated.View style={[s.actions, { paddingBottom: insets.bottom + 16, opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
          <TouchableOpacity
            style={[s.btnPrimary, phase === "identity" && !canIdentity && { opacity: 0.4 }, phase === "zone" && !canZone && { opacity: 0.4 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (phase === "identity" && isProvider) goToZone();
              else createAccount();
            }}
            activeOpacity={0.9}
          >
            <Text style={s.btnPrimaryText}>
              {phase === "identity" && isProvider ? "CONTINUER" : "CRÉER MON COMPTE"}
            </Text>
            <View style={s.arrowPill}>
              <Feather name="arrow-right" size={14} color={C.white} />
            </View>
          </TouchableOpacity>

          {phase === "identity" && (
            <View style={s.loginRow}>
              <Text style={s.loginLabel}>Déjà un compte ?</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(auth)/login");
                }}
                activeOpacity={0.7}
              >
                <Text style={s.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Background glow
  glowWrap: {
    position: "absolute",
    top: -80,
    left: (SCREEN_W - 420) / 2,
    width: 420,
    height: 420,
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 210,
  },

  // Header
  header: {
    paddingTop: 50, // fallback; overridden inline with insets.top + 12
    paddingHorizontal: 28,
    zIndex: 2,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepBar: {
    height: 2,
    borderRadius: 2,
  },
  stepBarActive: {
    width: 36,
    backgroundColor: C.white,
  },
  stepBarInactive: {
    width: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  stepLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.25)",
    marginLeft: 4,
  },
  stepLabelBold: {
    color: "rgba(255,255,255,0.5)",
  },

  // Title
  titleBlock: {
    paddingLeft: 4,
  },
  logoEyebrow: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 3,
    color: C.grey,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  logoWordmark: {
    fontFamily: FONTS.bebas,
    fontSize: 48,
    color: C.white,
    letterSpacing: 2,
    lineHeight: 50,
    marginBottom: 8,
  },
  logoWordmarkOutline: {
    color: C.outlineText,
  },
  titleSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    color: C.grey,
  },

  // Body
  bodyWrapper: {
    flex: 1,
    zIndex: 2,
  },
  bodyScroll: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 12,
  },

  // Social
  socialRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  socialBtn: {
    flex: 1,
    height: 52,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  socialText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.2,
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.18)",
    letterSpacing: 2,
  },

  // Form
  form: {
    gap: 12,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: C.outlineText,
    paddingLeft: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: darkTokens.surface,
  },
  inputIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: FONTS.sansLight,
    fontSize: 14,
    color: C.white,
  },
  inputEnd: {
    position: "absolute",
    right: 16,
    padding: 4,
  },

  // CGU
  cguRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
  },
  cguText: {
    flex: 1,
    fontFamily: FONTS.sansLight,
    fontSize: 11,
    lineHeight: 18,
    color: "rgba(255,255,255,0.25)",
  },
  cguLink: {
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.2)",
  },

  // Zone phase
  sectionLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 12,
    marginTop: 8,
  },
  cityDropdown: { gap: 8 },
  cityOption: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  cityOptionActive: { backgroundColor: C.white, borderColor: C.white },
  cityOptionText: { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 15, color: C.white },
  cityOptionTextActive: { color: C.bg },
  sliderWrap: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16,
  },
  sliderHeader: { alignItems: "center" as const, marginBottom: 4 },
  sliderValue: { fontFamily: FONTS.bebas, fontSize: 28, color: C.white, letterSpacing: 1 },
  sliderLabels: { flexDirection: "row" as const, justifyContent: "space-between" as const },
  sliderLabelText: { fontFamily: FONTS.sans, fontSize: 11, color: C.grey },
  radiusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radiusCard: {
    width: "30%" as any,
    flexGrow: 1,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  radiusCardActive: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  radiusLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
    color: C.white,
  },
  radiusLabelActive: {
    color: C.bg,
  },
  radiusHint: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.grey,
    marginTop: 2,
  },
  radiusHintActive: {
    color: "rgba(10,10,10,0.6)",
  },

  centered: { paddingVertical: 40, alignItems: "center" },
  retryText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.grey,
    marginTop: 8,
  },

  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    width: "48%" as any,
    flexGrow: 1,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  chipActive: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    flexShrink: 1,
  },
  chipTextActive: {
    color: C.bg,
  },
  catCount: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.grey,
    textAlign: "center",
    marginTop: 12,
  },

  // Actions
  actions: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32, // fallback; overridden inline with insets.bottom + 16
    gap: 14,
    zIndex: 2,
  },
  btnPrimary: {
    width: "100%",
    height: 60,
    backgroundColor: C.white,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas,
    fontSize: 20,
    letterSpacing: 3,
    color: C.bg,
  },
  arrowPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Login link
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loginLabel: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    color: C.outlineText,
  },
  loginLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.2)",
  },

  // Creating
  creatingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  creatingText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 18,
    color: C.white,
  },
  creatingSubtext: {
    fontFamily: FONTS.sansLight,
    fontSize: 14,
    color: C.grey,
  },
});
