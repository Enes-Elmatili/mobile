// app/(auth)/forgot-password.tsx — FIXED Premium Forgot Password (dark design)
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, ScrollView, Platform,
  Easing, StatusBar, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAppTheme, FONTS } from "@/hooks/use-app-theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  inputBg: "#111111",
  green: "#3D8B3D",
  outlineText: "rgba(255,255,255,0.3)",
};

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

export default function ForgotPassword() {
  const router = useRouter();
  const theme = useAppTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Animations
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerTy = useRef(new Animated.Value(-12)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyTy = useRef(new Animated.Value(14)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  const actionsTy = useRef(new Animated.Value(14)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;

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

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Entrez votre adresse email");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(trimmed);
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.025)", "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
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
              style={[s.backBtn, { borderColor: theme.borderLight }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={s.iconRow}>
              <View style={[s.iconWrap, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }, sent && s.iconWrapSent]}>
                <Ionicons
                  name={sent ? "checkmark-circle" : "lock-open-outline"}
                  size={34}
                  color={sent ? C.green : theme.text}
                />
              </View>
            </View>

            <Text style={[s.logoWordmark, { color: theme.text }]}>
              {sent ? "EMAIL\n" : "MOT DE PASSE\n"}
              <Text style={[s.logoWordmarkOutline, { color: theme.textMuted }]}>
                {sent ? "ENVOYÉ." : "OUBLIÉ ?"}
              </Text>
            </Text>
          </Animated.View>

          {/* Body */}
          <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
            {sent ? (
              <>
                <Text style={[s.subtitle, { color: theme.textSub }]}>
                  Un email de réinitialisation a été envoyé à{"\n"}
                  <Text style={[s.emailText, { color: theme.text }]}>{email.trim().toLowerCase()}</Text>
                </Text>

                <View style={[s.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} style={{ marginTop: 1 }} />
                  <Text style={[s.infoText, { color: theme.textSub }]}>
                    Cliquez sur le lien dans l'email pour créer un nouveau mot de passe. Le lien expire dans 48 heures.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[s.subtitle, { color: theme.textSub }]}>
                  Entrez l'email associé à votre compte. Nous vous enverrons un lien de réinitialisation.
                </Text>

                <View style={s.form}>
                  <View style={s.field}>
                    <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Email</Text>
                    <View style={[s.inputWrap, { backgroundColor: theme.surface, borderColor: theme.borderLight }, focused && { borderColor: theme.textMuted, backgroundColor: theme.surfaceAlt }]}>
                      <View style={s.inputIcon}>
                        <Ionicons name="mail-outline" size={15} color={focused ? theme.textSub : theme.textMuted} />
                      </View>
                      <TextInput
                        style={[s.input, { color: theme.text }]}
                        placeholder="votre@email.com"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        returnKeyType="done"
                        autoFocus
                        value={email}
                        onChangeText={(t) => { setEmail(t); setError(null); }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onSubmitEditing={handleSubmit}
                      />
                    </View>
                  </View>

                  {error && (
                    <View style={s.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#E53935" />
                      <Text style={s.errorText}>{error}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Animated.View>

          {/* Actions */}
          <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
            {sent ? (
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: theme.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.back();
                }}
                activeOpacity={0.9}
              >
                <Text style={[s.btnPrimaryText, { color: theme.accentText }]}>RETOUR À LA CONNEXION</Text>
                <View style={[s.arrowPill, { backgroundColor: theme.bg }]}>
                  <Ionicons name="arrow-back" size={14} color={theme.text} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: theme.accent }, (loading || !email.trim()) && { opacity: 0.55 }]}
                onPress={handleSubmit}
                disabled={loading || !email.trim()}
                activeOpacity={0.9}
              >
                {loading
                  ? <ActivityIndicator size="small" color={theme.accentText} />
                  : <>
                      <Text style={[s.btnPrimaryText, { color: theme.accentText }]}>ENVOYER LE LIEN</Text>
                      <View style={[s.arrowPill, { backgroundColor: theme.bg }]}>
                        <Ionicons name="arrow-forward" size={14} color={theme.text} />
                      </View>
                    </>
                }
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={s.secondaryLink}
            >
              <Text style={[s.secondaryLinkText, { color: theme.textMuted }]}>Retour à la connexion</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  glowWrap: {
    position: "absolute", top: -80,
    left: (SCREEN_W - 420) / 2, width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

  header: {
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingHorizontal: 28,
    zIndex: 2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
    marginBottom: 28,
  },
  iconRow: { marginBottom: 20 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.cardBg,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start",
  },
  iconWrapSent: {
    backgroundColor: "rgba(61,139,61,0.1)",
    borderColor: "rgba(61,139,61,0.3)",
  },
  logoWordmark: {
    fontFamily: FONTS.bebas, fontSize: 42, color: C.white,
    letterSpacing: 2, lineHeight: 46,
  },
  logoWordmarkOutline: { color: C.outlineText },

  body: {
    flex: 1, paddingHorizontal: 28, paddingTop: 24,
    gap: 20, zIndex: 2,
  },
  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15, lineHeight: 22,
    color: C.grey,
  },
  emailText: {
    fontFamily: FONTS.mono, fontSize: 14, color: C.white,
  },
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16,
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 13,
    lineHeight: 20, color: "rgba(255,255,255,0.5)",
  },

  form: { gap: 14 },
  field: { gap: 7 },
  fieldLabel: {
    fontFamily: FONTS.sans, fontSize: 10, letterSpacing: 3,
    textTransform: "uppercase", color: C.outlineText, paddingLeft: 2,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center", height: 54,
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16,
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "#161616",
  },
  inputIcon: { position: "absolute", left: 16, zIndex: 1 },
  input: {
    flex: 1, height: "100%", paddingLeft: 48, paddingRight: 16,
    fontFamily: FONTS.sansLight, fontSize: 14, color: C.white,
  },
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingLeft: 2,
  },
  errorText: {
    fontFamily: FONTS.sans, fontSize: 12, color: "#E53935",
  },

  actions: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    gap: 14, zIndex: 2,
  },
  btnPrimary: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },
  secondaryLink: {
    alignItems: "center", paddingVertical: 4,
  },
  secondaryLinkText: {
    fontFamily: FONTS.sansLight, fontSize: 13, color: C.outlineText,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.12)",
  },
});