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
  StatusBar,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../../lib/auth/AuthContext";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { FONTS } from "@/hooks/use-app-theme";
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type ToastType = "success" | "error" | "info";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const pwdRef = useRef<TextInput>(null);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    feedback.toast(message, type);
  }, []);

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
    if (__DEV__ && googleRequest) {
      console.log("[Google Auth] redirectUri:", googleRequest.redirectUri);
    }
  }, [googleRequest]);

  useEffect(() => {
    if (!googleResponse) return;
    if (__DEV__) console.log("[Google Auth] response type:", googleResponse.type);
    if (googleResponse.type === "success") {
      const idToken = googleResponse.authentication?.idToken ?? googleResponse.params?.id_token;
      const accessToken = googleResponse.authentication?.accessToken ?? googleResponse.params?.access_token;
      if (idToken || accessToken) handleGoogleSignIn({ idToken, accessToken });
    } else if (googleResponse.type === "error") {
      // Échec OAuth Google — sans feedback l'utilisateur ne voit rien
      showToast(t("auth.login_google_failed"));
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async (tokens: { idToken?: string; accessToken?: string }) => {
    setSocialLoading("google");
    try {
      const res = await api.auth.google(tokens);
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
      if (e?.status === 409) showToast(e.data?.error || e.message);
      else showToast(t("auth.su_err_social"));
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
      } else if (e?.status === 409) {
        showToast(e.data?.error || e.message);
      } else {
        showToast(t("auth.su_err_social"));
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
    if (!EMAIL_RE.test(email.trim())) {
      showToast(t("auth.invalid_email"));
      return;
    }
    feedback.haptic('medium');
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
        return;
      }
      // Reproduit la logique de app/index.tsx : un provider non-ACTIF doit
      // passer par l'écran pending, pas directement le dashboard.
      let roles: string[] | undefined = res.roles;
      let providerStatus: string | undefined = res.providerStatus;
      if (!Array.isArray(roles)) {
        try {
          const me: any = await api.user.me();
          roles = me?.user?.roles;
          providerStatus = me?.user?.providerStatus;
        } catch {}
      }
      const isProvider = Array.isArray(roles) && roles.includes("PROVIDER");
      if (isProvider) {
        router.replace(providerStatus === "ACTIVE" ? "/(tabs)/provider-dashboard" : "/onboarding/provider/pending");
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (e: any) {
      if (e?.status === 401) {
        showToast(t("auth.invalid_credentials"));
      } else {
        // Panne réseau / serveur : ne pas suggérer que le mot de passe est faux
        showToast(t("auth.login_network_error"));
      }
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
    feedback.haptic('light');
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="inverted" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          <AuthBackButton onPress={handleBack} />
        </View>

        <AuthHeadline title={t("auth.login")} align="left" />

        <View style={s.body}>
          {/* Social buttons */}
          <View style={s.socialRow}>
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={s.socialBtn}
                onPress={handleAppleSignIn}
                disabled={isBusy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("auth.login_apple_a11y")}
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
            )}

            <TouchableOpacity
              style={s.socialBtn}
              onPress={() => googlePromptAsync()}
              disabled={isBusy || !googleRequest}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("auth.login_google_a11y")}
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
            <Text style={s.dividerLabel}>{t("auth.su_or")}</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Form */}
          <View style={s.form}>
            <AuthInput
              label={t("auth.email_label")}
              icon="mail"
              placeholder={t("auth.email_placeholder_value")}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => pwdRef.current?.focus()}
            />

            <AuthInput
              inputRef={pwdRef}
              label={t("auth.password_label")}
              icon="lock"
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              autoComplete="password"
              textContentType="password"
              autoCorrect={false}
              trailingIcon={showPwd ? "eye-off" : "eye"}
              onTrailingPress={() => setShowPwd((p) => !p)}
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
            />

            <View style={s.forgotRow}>
              <TouchableOpacity
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t("auth.forgot_password")}
                onPress={() => router.push("/(auth)/forgot-password")}
              >
                <Text style={s.forgotLink}>{t("auth.forgot_password")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label={t("auth.login_cta")}
          onPress={onSubmit}
          loading={loading}
          disabled={isBusy}
        />

        <AuthLink
          prefix={t("auth.no_account")}
          action={t("auth.signup")}
          onPress={() => {
            feedback.haptic('light');
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
