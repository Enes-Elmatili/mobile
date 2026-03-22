// app/(auth)/login.tsx — FIXED Premium Login (dark design)
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, ScrollView, Platform,
  Easing, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line, Path, G, Defs, ClipPath, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuthRequest, ResponseType } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { FONTS } from "@/hooks/use-app-theme";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// ── Colors (dark-only) ──────────────────────────────────────────────────────
const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  greyFaint: "rgba(255,255,255,0.2)",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  inputBg: "#111111",
  green: "#3D8B3D",
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
function AppleLogo({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 15 18" fill="none">
      <Path d="M12.4 9.6C12.4 7.8 13.5 6.7 13.5 6.7C12.5 5.3 11 5.2 10.4 5.2C9.1 5.1 7.9 6 7.2 6C6.5 6 5.5 5.2 4.4 5.2C2.8 5.3 1 6.4 1 9.1C1 10.9 1.7 12.8 2.6 14C3.3 15 4 15.8 5 15.8C5.9 15.8 6.3 15.2 7.5 15.2C8.7 15.2 9 15.8 10 15.8C11 15.8 11.7 14.9 12.4 13.9C13 13.1 13.3 12.2 13.3 12.1C13.3 12.1 12.4 11.8 12.4 9.6Z" fill="rgba(255,255,255,0.75)" />
      <Path d="M9.5 3.5C10.1 2.8 10.5 1.8 10.4 0.8C9.5 0.9 8.4 1.4 7.8 2.2C7.2 2.9 6.7 3.9 6.9 4.9C7.9 4.9 8.9 4.3 9.5 3.5Z" fill="rgba(255,255,255,0.75)" />
    </Svg>
  );
}

function GoogleLogo({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 17 17" fill="none">
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
  const icon = msg.type === "error" ? "close-circle" : msg.type === "success" ? "checkmark-circle" : "information-circle";
  const color = msg.type === "error" ? "#E53935" : msg.type === "success" ? C.green : C.white;
  return (
    <Animated.View style={[ts.pill, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={ts.text}>{msg.message}</Text>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  layer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
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

// ── LOGIN ───────────────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter();
  const { signIn, isBooting } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const pwdRef = useRef<TextInput>(null);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counter.current;
    setMsgs(p => [...p, { id, type, message }]);
  }, []);

  // ── Google Auth ──
  const googleRedirectUri = "https://auth.expo.io/@eneselmatili/fixed-app";
  const googleDiscovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  const [googleRequest, googleResponse, googlePromptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
      redirectUri: googleRedirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: ResponseType.Token,
    },
    googleDiscovery
  );

  useEffect(() => {
    if (__DEV__ && googleRequest) {
      console.log("[Google Auth] redirectUri:", googleRequest.redirectUri);
    }
  }, [googleRequest]);

  useEffect(() => {
    if (!googleResponse) return;
    if (__DEV__) console.log("[Google Auth] response type:", googleResponse.type);
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
      if (e?.status === 409) {
        showToast(e.data?.error || e.message);
      } else {
        showToast("Connexion impossible, réessaie");
      }
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
        credential.email ?? undefined
      );

      if (!res?.token) throw new Error();
      await signIn(res.token);
      if (res.roles && res.roles.length === 0) {
        router.replace("/(auth)/role-select");
      }
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED" || e?.code === "1001") {
        // Silent
      } else if (e?.status === 409) {
        showToast(e.data?.error || e.message);
      } else {
        showToast("Connexion impossible, réessaie");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Entrance animations ──
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyTy = useRef(new Animated.Value(14)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(14)).current;

  useEffect(() => {
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

  // ── Glow animation ──
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;
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

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      showToast(t('auth.fill_all_fields'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.login(email.trim().toLowerCase(), password);
      const token = res?.token;
      if (!token) throw new Error();
      await signIn(token);
    } catch {
      showToast(t('auth.invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || !!socialLoading;

  if (isBooting) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
      <StatusBar barStyle="light-content" />
      <Spinner color={C.white} />
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Grid + glow background */}
      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.025)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Toast layer */}
      <View style={ts.layer} pointerEvents="none">
        {msgs.map(m => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs(p => p.filter(x => x.id !== m.id))} />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        {/* Header */}
        <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerTy }] }]}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.canGoBack() ? router.back() : router.replace("/(auth)/welcome");
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          <Text style={s.logoWordmark}>CONNEXION</Text>
        </Animated.View>

        {/* Body */}
        <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
          {/* Social buttons */}
          <View style={s.socialRow}>
            <TouchableOpacity
              style={s.socialBtn}
              onPress={handleAppleSignIn}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              {socialLoading === "apple"
                ? <Spinner color={C.white} />
                : <>
                    <AppleLogo />
                    <Text style={s.socialText}>Apple</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={s.socialBtn}
              onPress={() => googlePromptAsync()}
              disabled={isBusy || !googleRequest}
              activeOpacity={0.7}
            >
              {socialLoading === "google"
                ? <Spinner color={C.white} />
                : <>
                    <GoogleLogo />
                    <Text style={s.socialText}>Google</Text>
                  </>
              }
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
            {/* Email */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>Email</Text>
              <View style={[s.inputWrap, focused === "email" && s.inputFocused]}>
                <View style={s.inputIcon}>
                  <Ionicons name="mail-outline" size={15} color={focused === "email" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                </View>
                <TextInput
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
                  <Ionicons name="lock-closed-outline" size={14} color={focused === "password" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                </View>
                <TextInput
                  ref={pwdRef}
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={onSubmit}
                />
                <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.inputEnd} activeOpacity={0.6}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={17} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <View style={s.forgotRow}>
              <TouchableOpacity activeOpacity={0.6} onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={s.forgotLink}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
          <TouchableOpacity
            style={[s.btnPrimary, isBusy && { opacity: 0.55 }]}

            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSubmit();
            }}
            disabled={isBusy}
            activeOpacity={0.9}
          >
            {loading
              ? <Spinner color={C.bg} />
              : <>
                  <Text style={s.btnPrimaryText}>SE CONNECTER</Text>
                  <View style={s.arrowPill}>
                    <Ionicons name="arrow-forward" size={14} color={C.white} />
                  </View>
                </>
            }
          </TouchableOpacity>

          <View style={s.registerRow}>
            <Text style={s.registerLabel}>Pas encore de compte ?</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(auth)/role-select");
              }}
              activeOpacity={0.7}
            >
              <Text style={s.registerLink}>Créer un compte</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingHorizontal: 32,
    zIndex: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoEyebrow: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 3,
    color: C.grey,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  logoWordmark: {
    fontFamily: FONTS.bebas,
    fontSize: 52,
    color: C.white,
    letterSpacing: 3,
    lineHeight: 56,
  },

  // Body
  body: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    gap: 20,
    zIndex: 2,
  },

  // Social buttons
  socialRow: {
    flexDirection: "row",
    gap: 10,
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
    gap: 14,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: "400",
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
    backgroundColor: "#161616",
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

  // Forgot password
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -4,
  },
  forgotLink: {
    fontFamily: FONTS.sansLight,
    fontSize: 12,
    color: C.outlineText,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.12)",
  },

  // Actions
  actions: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    gap: 14,
    zIndex: 2,
  },

  // Primary button
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

  // Register link
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  registerLabel: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    color: C.outlineText,
  },
  registerLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.2)",
  },
});
