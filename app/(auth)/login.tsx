// app/(auth)/login.tsx — login (inverted gradient)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  StatusBar,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuthRequest, ResponseType } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthInput,
  AuthLink,
  authT,
  alpha,
} from "@/components/auth";

WebBrowser.maybeCompleteAuthSession();

// ── SVG Logos ───────────────────────────────────────────────────────────────
function AppleLogo({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 15 18" fill="none">
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
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 10 },
    }),
  },
  text: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: authT.textOnDark,
    flex: 1,
  },
});

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

// ── Login screen ────────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter();
  const { signIn, isBooting, refreshMe } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const pwdRef = useRef<TextInput>(null);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counter.current;
    setMsgs((p) => [...p, { id, type, message }]);
  }, []);

  // Google Auth
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
      await refreshMe();
      if (!res.roles || res.roles.length === 0) router.replace("/(auth)/role-select");
      else router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast("Connexion impossible, réessaie");
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
      await signIn(res.token);
      await refreshMe();
      if (!res.roles || res.roles.length === 0) router.replace("/(auth)/role-select");
      else router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED" || e?.code === "1001") {
        // silent cancel
      } else if (e?.status === 409) {
        showToast(e.data?.error || e.message);
      } else {
        showToast("Connexion impossible, réessaie");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  // Entrance
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      showToast(t("auth.fill_all_fields"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await api.auth.login(email.trim().toLowerCase(), password);
      const token = res?.token;
      if (!token) throw new Error();
      await signIn(token, res.missingFields ?? []);
      if (res.profileIncomplete && Array.isArray(res.missingFields) && res.missingFields.length > 0) {
        router.replace({
          pathname: "/(auth)/complete-profile",
          params: { missingFields: res.missingFields.join(",") },
        });
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch {
      showToast(t("auth.invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || !!socialLoading;

  if (isBooting) {
    return (
      <View style={{ flex: 1, backgroundColor: authT.dark, justifyContent: "center", alignItems: "center" }}>
        <StatusBar barStyle="light-content" />
        <Spinner color={authT.textOnDark} />
      </View>
    );
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="inverted" scrollable>
      {/* Toast layer (above gradient, inside safe area) */}
      <View style={[ts.layer, { top: insets.top + 8 }]} pointerEvents="none">
        {msgs.map((m) => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs((p) => p.filter((x) => x.id !== m.id))} />
        ))}
      </View>

      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          <AuthBackButton onPress={handleBack} />
        </View>

        <AuthHeadline title="CONNEXION" align="left" />

        <View style={s.body}>
          {/* Social buttons */}
          <View style={s.socialRow}>
            <TouchableOpacity
              style={s.socialBtn}
              onPress={handleAppleSignIn}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              {socialLoading === "apple" ? (
                <Spinner color={authT.textOnDark} />
              ) : (
                <>
                  <AppleLogo />
                  <Text style={s.socialText}>Apple</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.socialBtn}
              onPress={() => googlePromptAsync()}
              disabled={isBusy || !googleRequest}
              activeOpacity={0.7}
            >
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

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>OU</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Form */}
          <View style={s.form}>
            <AuthInput
              label="Email"
              icon="mail"
              placeholder="votre@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => pwdRef.current?.focus()}
            />

            <AuthInput
              inputRef={pwdRef}
              label="Mot de passe"
              icon="lock"
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              trailingIcon={showPwd ? "eye-off" : "eye"}
              onTrailingPress={() => setShowPwd((p) => !p)}
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
            />

            <View style={s.forgotRow}>
              <TouchableOpacity activeOpacity={0.6} onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={s.forgotLink}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label="SE CONNECTER"
          onPress={onSubmit}
          loading={loading}
          disabled={isBusy}
        />

        <AuthLink
          prefix="Pas encore de compte ?"
          action="Créer un compte"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(auth)/role-select");
          }}
        />
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
  body: {
    paddingTop: 24,
    gap: 18,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    height: 52,
    backgroundColor: alpha(authT.dark, 0.85),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.16),
    borderRadius: 16,
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
    gap: 12,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -2,
  },
  forgotLink: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: alpha(authT.textOnLight, 0.55),
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnLight, 0.18),
  },
  spacer: { flex: 1, minHeight: 24 },
});
