import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";

const { width, height } = Dimensions.get("window");

// ─── Composants partagés ──────────────────────────────────────────────────────
function XShape({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  const thickness = Math.round(size * 0.15);
  const arm: any = {
    position: "absolute",
    width: size,
    height: thickness,
    backgroundColor: color,
    borderRadius: thickness / 2,
    top: (size - thickness) / 2,
    left: 0,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[arm, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[arm, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

function XSpinner({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <XShape size={size} color={color} />
    </Animated.View>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
export default function Login() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { signIn, isBooting } = useAuth();

  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [loading,         setLoading]         = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);
  const [emailFocused,    setEmailFocused]    = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const cardY  = useRef(new Animated.Value(40)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  const onLogin = async () => {
    if (!email || !password) return Alert.alert("Erreur", "Remplissez tous les champs");
    setLoading(true);
    try {
      const res   = await api.auth.login(email, password);
      const token = res?.token;
      if (!token) throw new Error("Token manquant");
      await signIn(token);
    } catch {
      Alert.alert("Erreur", "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  if (isBooting) {
    return (
      <View style={styles.loadingContainer}>
        <XSpinner size={36} color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header minimal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          <View style={styles.brandMini}>
            <XShape size={16} color="#FFFFFF" />
            <Text style={styles.brandMiniText}>FIXED</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          {/* Conteneur centre — card flottante */}
          <Animated.View
            style={[styles.card, { opacity: fadeIn, transform: [{ translateY: cardY }] }]}
          >
            {/* Titre */}
            <View style={styles.titleBlock}>
              <Text style={styles.eyebrow}>BON RETOUR</Text>
              <Text style={styles.title}>Connexion</Text>
              <View style={styles.titleRule} />
            </View>

            {/* Champs */}
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>EMAIL</Text>
                <View style={[styles.inputRow, emailFocused && styles.inputRowFocused]}>
                  <Ionicons
                    name="mail-outline"
                    size={17}
                    color={emailFocused ? "#FFFFFF" : "rgba(255,255,255,0.45)"}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Mot de passe */}
              <View style={styles.field}>
                <Text style={styles.label}>MOT DE PASSE</Text>
                <View style={[styles.inputRow, passwordFocused && styles.inputRowFocused]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={passwordFocused ? "#FFFFFF" : "rgba(255,255,255,0.45)"}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotRow}>
                <Text style={styles.forgotText}>Mot de passe oublie ?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={onLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <XSpinner size={22} color="#0A0A0A" />
                  : <Text style={styles.submitBtnText}>Se connecter</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerRule} />
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                <Text style={styles.footerText}>
                  {"Pas encore de compte ?  "}
                  <Text style={styles.footerLink}>{"Creer un compte"}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const RADIUS   = 12;   // borderRadius uniforme partout
const BTN_H    = 55;   // hauteur bouton uniforme
const CARD_PAD = 28;

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#0A0A0A" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A0A0A" },
  safeArea:         { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn:       { padding: 8, width: 40 },
  brandMini:     { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMiniText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 5 },

  kav: { flex: 1, justifyContent: "center" },

  // Card centree — ne prend pas toute la largeur, max 420
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: CARD_PAD,
    paddingVertical: 36,
  },

  titleBlock: { marginBottom: 36 },
  eyebrow: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 4,
    fontWeight: "700",
    marginBottom: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    fontFamily: "Georgia",
  },
  titleRule: { width: 32, height: 2, backgroundColor: "#FFFFFF", marginTop: 14 },

  form:  { gap: 0 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",   // contraste ameliore
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 9,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: RADIUS,             // uniforme
    paddingRight: 14,
    height: 52,
  },
  inputRowFocused: {
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  inputIcon: { marginLeft: 16 },
  input: {
    flex: 1,
    paddingHorizontal: 11,
    fontSize: 15,
    color: "#FFFFFF",
  },
  eyeBtn: { padding: 6 },

  forgotRow:  { alignSelf: "flex-end", marginTop: -8, marginBottom: 26 },
  forgotText: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "500" },

  submitBtn: {
    backgroundColor: "#FFFFFF",
    height: BTN_H,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  footer:     { marginTop: 28, alignItems: "center", gap: 16 },
  footerRule: { width: 28, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  footerText: { color: "rgba(255,255,255,0.32)", fontSize: 14 },
  footerLink: { color: "#FFFFFF", fontWeight: "600" },
});