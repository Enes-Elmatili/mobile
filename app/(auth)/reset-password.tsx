// app/(auth)/reset-password.tsx — FIXED Premium Reset Password (dark design)
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, ScrollView, Platform,
  Easing, StatusBar, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { FONTS } from "@/hooks/use-app-theme";

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
  red: "#E53935",
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

export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"password" | "confirm" | null>(null);
  const confirmRef = useRef<TextInput>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    (async () => {
      try {
        const res: any = await api.auth.validateResetToken(token);
        setTokenValid(!!res?.valid);
      } catch {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

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
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (!token) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.data?.error || "Une erreur est survenue. Le lien a peut-être expiré.");
    } finally {
      setLoading(false);
    }
  };

  // Title / subtitle / icon based on state
  let title = "NOUVEAU\nMOT DE PASSE.";
  let subtitle = "Choisissez un nouveau mot de passe pour votre compte.";
  let iconName: keyof typeof Ionicons.glyphMap = "key-outline";
  let iconColor = C.white;

  if (validating) {
    title = "VÉRIFICATION\nDU LIEN...";
    subtitle = "Validation en cours, veuillez patienter.";
  } else if (!token || !tokenValid) {
    title = "LIEN\nINVALIDE.";
    subtitle = "Ce lien de réinitialisation est expiré ou invalide. Demandez un nouveau lien.";
    iconName = "close-circle";
    iconColor = C.red;
  } else if (done) {
    title = "MOT DE PASSE\nMODIFIÉ !";
    subtitle = "Votre mot de passe a été réinitialisé avec succès. Connectez-vous avec votre nouveau mot de passe.";
    iconName = "checkmark-circle";
    iconColor = C.green;
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

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
              style={s.backBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace("/(auth)/login");
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <View style={s.iconRow}>
              <View style={[
                s.iconWrap,
                done && { backgroundColor: "rgba(61,139,61,0.1)", borderColor: "rgba(61,139,61,0.3)" },
                (!token || !tokenValid) && !validating && { backgroundColor: "rgba(229,57,53,0.1)", borderColor: "rgba(229,57,53,0.3)" },
              ]}>
                {validating
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <Ionicons name={iconName} size={34} color={iconColor} />
                }
              </View>
            </View>

            <Text style={s.logoWordmark}>
              {title.split("\n").map((line, i) =>
                i === 1
                  ? <Text key={i} style={s.logoWordmarkOutline}>{line}</Text>
                  : <Text key={i}>{line}{"\n"}</Text>
              )}
            </Text>
          </Animated.View>

          {/* Body */}
          <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyTy }] }]}>
            <Text style={s.subtitle}>{subtitle}</Text>

            {tokenValid && !done && !validating && (
              <View style={s.form}>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Nouveau mot de passe</Text>
                  <View style={[s.inputWrap, focused === "password" && s.inputFocused]}>
                    <View style={s.inputIcon}>
                      <Ionicons name="lock-closed-outline" size={14} color={focused === "password" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                    </View>
                    <TextInput
                      style={s.input}
                      placeholder="Min. 8 caractères"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      secureTextEntry={!showPwd}
                      returnKeyType="next"
                      autoFocus
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(null); }}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.inputEnd} activeOpacity={0.6}>
                      <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={17} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.fieldLabel}>Confirmer</Text>
                  <View style={[s.inputWrap, focused === "confirm" && s.inputFocused]}>
                    <View style={s.inputIcon}>
                      <Ionicons name="lock-closed-outline" size={14} color={focused === "confirm" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"} />
                    </View>
                    <TextInput
                      ref={confirmRef}
                      style={s.input}
                      placeholder="Confirmez le mot de passe"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      secureTextEntry={!showPwd}
                      returnKeyType="done"
                      value={confirm}
                      onChangeText={(t) => { setConfirm(t); setError(null); }}
                      onFocus={() => setFocused("confirm")}
                      onBlur={() => setFocused(null)}
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>

                {error && (
                  <View style={s.errorRow}>
                    <Ionicons name="alert-circle" size={14} color={C.red} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* Actions */}
          <Animated.View style={[s.actions, { opacity: actionsOp, transform: [{ translateY: actionsTy }] }]}>
            {validating ? null : done ? (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace("/(auth)/login");
                }}
                activeOpacity={0.9}
              >
                <Text style={s.btnPrimaryText}>SE CONNECTER</Text>
                <View style={s.arrowPill}>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </View>
              </TouchableOpacity>
            ) : !tokenValid ? (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace("/(auth)/forgot-password");
                }}
                activeOpacity={0.9}
              >
                <Text style={s.btnPrimaryText}>DEMANDER UN NOUVEAU LIEN</Text>
                <View style={s.arrowPill}>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btnPrimary, (loading || password.length < 8 || password !== confirm) && { opacity: 0.55 }]}
                onPress={handleSubmit}
                disabled={loading || password.length < 8 || password !== confirm}
                activeOpacity={0.9}
              >
                {loading
                  ? <ActivityIndicator size="small" color={C.bg} />
                  : <>
                      <Text style={s.btnPrimaryText}>RÉINITIALISER</Text>
                      <View style={s.arrowPill}>
                        <Ionicons name="arrow-forward" size={14} color={C.white} />
                      </View>
                    </>
                }
              </TouchableOpacity>
            )}
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
    flex: 1, height: "100%", paddingLeft: 48, paddingRight: 48,
    fontFamily: FONTS.sansLight, fontSize: 14, color: C.white,
  },
  inputEnd: { position: "absolute", right: 16, padding: 4 },
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 2,
  },
  errorText: {
    fontFamily: FONTS.sans, fontSize: 12, color: C.red,
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
});