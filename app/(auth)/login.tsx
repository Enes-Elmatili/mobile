// app/(auth)/login.tsx — FIXED Premium Auth
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
  Easing, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = "error" | "success" | "info";
interface ToastMsg { id: number; type: ToastType; message: string }

function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const ty = useRef(new Animated.Value(-72)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: 0,   duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(op, { toValue: 1,   duration: 280, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -72, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(onDone);
    }, 3200);
    return () => clearTimeout(t);
  }, []);
  const icon  = msg.type === "error" ? "✕" : msg.type === "success" ? "✓" : "●";
  const color = msg.type === "error" ? "#FF453A" : msg.type === "success" ? "#34C759" : "#FFF";
  return (
    <Animated.View style={[toast.pill, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Text style={[toast.icon, { color }]}>{icon}</Text>
      <Text style={toast.text}>{msg.message}</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  layer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    left: 20, right: 20, zIndex: 9999, gap: 8,
  },
  pill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 10 },
    }),
  },
  icon: { fontSize: 13, fontWeight: "800" },
  text: { fontSize: 14, color: "#FFF", fontWeight: "600", flex: 1 },
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ color = "#0A0A0A" }: { color?: string }) {
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
      <View style={{
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2.5, borderColor: color, borderTopColor: "transparent",
      }} />
    </Animated.View>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter();
  const { signIn, isBooting } = useAuth();
  const { t } = useTranslation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [focused,  setFocused]  = useState<"email" | "password" | null>(null);
  const [msgs,     setMsgs]     = useState<ToastMsg[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counter.current;
    setMsgs(p => [...p, { id, type, message }]);
  }, []);

  // Entrance animations — same easing as welcome page
  const ease    = Easing.bezier(0.16, 1, 0.3, 1);
  const lineS   = useRef(new Animated.Value(0)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleTy = useRef(new Animated.Value(16)).current;
  const formOp  = useRef(new Animated.Value(0)).current;
  const formTy  = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(lineS,   { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(titleTy, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(formOp, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(formTy, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      showToast(t('auth.fill_all_fields'));
      return;
    }
    setLoading(true);
    try {
      const res   = await api.auth.login(email.trim().toLowerCase(), password);
      const token = res?.token;
      if (!token) throw new Error();
      await signIn(token);
    } catch {
      showToast(t('auth.invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  if (isBooting) return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <StatusBar barStyle="light-content" />
      <Spinner color="#fff" />
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Ambient glow — identique à la welcome page */}
      <LinearGradient
        colors={["rgba(255,255,255,0.04)", "transparent"]}
        style={s.glow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
      />

      {/* Toast layer */}
      <View style={toast.layer} pointerEvents="none">
        {msgs.map(m => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs(p => p.filter(x => x.id !== m.id))} />
        ))}
      </View>

      {/* Header — même structure que welcome topBar */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/welcome')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
        <Text style={s.topLogo}>FIXED</Text>
        <View style={s.backBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={s.body}>

          {/* Bloc titre */}
          <Animated.View style={[s.titleBlock, { opacity: titleOp, transform: [{ translateY: titleTy }] }]}>
            <Animated.View style={[s.line, { transform: [{ scaleX: lineS }] }]} />
            <Text style={s.eyebrow}>{t('auth.welcome_back')}</Text>
            <Text style={s.title}>{t('auth.login')}</Text>
          </Animated.View>

          {/* Formulaire */}
          <Animated.View style={[s.form, { opacity: formOp, transform: [{ translateY: formTy }] }]}>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>{t('auth.email_label')}</Text>
              <View style={[s.row, focused === "email" && s.rowActive]}>
                <Ionicons
                  name="mail-outline" size={16}
                  color={focused === "email" ? "#fff" : "rgba(255,255,255,0.32)"}
                  style={s.rowIcon}
                />
                <TextInput
                  style={s.input}
                  placeholder={t('auth.email_placeholder')}
                  placeholderTextColor="rgba(255,255,255,0.18)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  accessibilityLabel={t('auth.email_label')}
                />
              </View>
            </View>

            {/* Mot de passe */}
            <View style={s.field}>
              <Text style={s.label}>{t('auth.password_label')}</Text>
              <View style={[s.row, focused === "password" && s.rowActive]}>
                <Ionicons
                  name="lock-closed-outline" size={16}
                  color={focused === "password" ? "#fff" : "rgba(255,255,255,0.32)"}
                  style={s.rowIcon}
                />
                <TextInput
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={onSubmit}
                  accessibilityLabel={t('auth.password_label')}
                />
                <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.eye} accessibilityLabel={showPwd ? t('auth.hide_password') : t('auth.show_password')} accessibilityRole="button">
                  <Ionicons
                    name={showPwd ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="rgba(255,255,255,0.32)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={s.forgotRow} activeOpacity={0.6} accessibilityRole="button">
              <Text style={s.forgotText}>{t('auth.forgot_password')}</Text>
            </TouchableOpacity>

            {/* CTA — même style que welcome page */}
            <TouchableOpacity
              style={[s.cta, loading && { opacity: 0.55 }]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityLabel={t('auth.login_btn')}
              accessibilityRole="button"
            >
              {loading
                ? <Spinner color="#0A0A0A" />
                : <Text style={s.ctaText}>{t('auth.login_btn')}</Text>
              }
            </TouchableOpacity>

            {/* Footer */}
            <View style={s.footer}>
              <View style={s.rule} />
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")} activeOpacity={0.7} accessibilityRole="link">
                <Text style={s.footerText}>
                  {t('auth.no_account') + '  '}
                  <Text style={s.footerLink}>{t('auth.signup_btn')}</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  glow: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: SCREEN_H * 0.45, zIndex: 0,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: { width: 40 },
  topLogo: {
    fontSize: 17, fontWeight: "700",
    letterSpacing: 4, color: "#fff",
  },

  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  titleBlock: { marginBottom: 40 },
  line: {
    width: 32, height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 10, letterSpacing: 4, fontWeight: "600",
    color: "rgba(255,255,255,0.38)", marginBottom: 10,
  },
  title: {
    fontSize: 38, fontWeight: "800", color: "#fff",
    letterSpacing: -1, lineHeight: 44,
  },

  form:  {},
  field: { marginBottom: 20 },
  label: {
    fontSize: 10, letterSpacing: 3, fontWeight: "600",
    color: "rgba(255,255,255,0.4)", marginBottom: 8,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14, height: 54,
  },
  rowActive: {
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rowIcon: { marginLeft: 16 },
  input: {
    flex: 1, paddingHorizontal: 12,
    fontSize: 15, color: "#fff",
  },
  eye: { paddingHorizontal: 14 },

  forgotRow: { alignSelf: "flex-end", marginTop: -4, marginBottom: 26 },
  forgotText: { fontSize: 13, color: "rgba(255,255,255,0.38)", fontWeight: "500" },

  cta: {
    height: 56, borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#000", letterSpacing: 0.3 },

  footer:     { marginTop: 28, alignItems: "center", gap: 14 },
  rule:       { width: 28, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  footerText: { color: "rgba(255,255,255,0.3)", fontSize: 14 },
  footerLink: { color: "#fff", fontWeight: "600" },
});
