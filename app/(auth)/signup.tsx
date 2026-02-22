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
  ScrollView,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

const { width } = Dimensions.get("window");

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

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const level =
    password.length < 6 ? 0 :
    password.length < 8 ? 1 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3 : 2;
  const labels = ["Trop court", "Faible", "Correct", "Fort"];
  const colors = ["#EF4444", "#F59E0B", "#FFFFFF", "#22C55E"];
  const widths = ["20%", "45%", "70%", "100%"];
  return (
    <View style={pw.container}>
      <View style={pw.track}>
        <View style={[pw.fill, { width: widths[level] as any, backgroundColor: colors[level] }]} />
      </View>
      <Text style={[pw.label, { color: colors[level] }]}>{labels[level]}</Text>
    </View>
  );
}

const pw = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  track:     { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 1, overflow: "hidden" },
  fill:      { height: "100%", borderRadius: 1 },
  label:     { fontSize: 11, fontWeight: "600", width: 68, textAlign: "right" },
});

// ─── Signup ───────────────────────────────────────────────────────────────────
export default function Signup() {
  const router     = useRouter();
  const navigation = useNavigation();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused,      setFocused]      = useState<string | null>(null);

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

  const onSignup = async () => {
    if (!email || !password) return Alert.alert("Erreur", "Remplissez tous les champs");
    setLoading(true);
    try {
      await api.auth.signup(email, password, name);
      Alert.alert("Compte cree !", "It's Fixed. Vous pouvez maintenant vous connecter.", [
        { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Echec de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header avec fleche de retour bien visible */}
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
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[styles.card, { opacity: fadeIn, transform: [{ translateY: cardY }] }]}
            >
              {/* Titre */}
              <View style={styles.titleBlock}>
                <Text style={styles.eyebrow}>NOUVEAU COMPTE</Text>
                <Text style={styles.title}>Inscription</Text>
                <View style={styles.titleRule} />
              </View>

              {/* Indicateur d'etapes */}
              <View style={styles.steps}>
                <View style={[styles.stepDot, styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={styles.stepDot} />
                <View style={styles.stepLine} />
                <View style={styles.stepDot} />
              </View>

              {/* Champs */}
              <View style={styles.form}>
                {/* Nom */}
                <View style={styles.field}>
                  <Text style={styles.label}>NOM COMPLET</Text>
                  <View style={[styles.inputRow, focused === "name" && styles.inputRowFocused]}>
                    <Ionicons
                      name="person-outline"
                      size={17}
                      color={focused === "name" ? "#FFFFFF" : "rgba(255,255,255,0.45)"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Jean Dupont"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      autoCapitalize="words"
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                    />
                    <Text style={styles.optionalTag}>optionnel</Text>
                  </View>
                </View>

                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.label}>EMAIL</Text>
                  <View style={[styles.inputRow, focused === "email" && styles.inputRowFocused]}>
                    <Ionicons
                      name="mail-outline"
                      size={17}
                      color={focused === "email" ? "#FFFFFF" : "rgba(255,255,255,0.45)"}
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
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                {/* Mot de passe */}
                <View style={styles.field}>
                  <Text style={styles.label}>MOT DE PASSE</Text>
                  <View style={[styles.inputRow, focused === "password" && styles.inputRowFocused]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={17}
                      color={focused === "password" ? "#FFFFFF" : "rgba(255,255,255,0.45)"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="8 caracteres minimum"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color="rgba(255,255,255,0.4)"
                      />
                    </TouchableOpacity>
                  </View>
                  <PasswordStrength password={password} />
                </View>

                {/* Bouton */}
                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={onSignup}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <XSpinner size={22} color="#0A0A0A" />
                    : <Text style={styles.submitBtnText}>{"Creer mon compte"}</Text>
                  }
                </TouchableOpacity>

                {/* Legal */}
                <View style={styles.legalRow}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.legalText}>
                    {"En creant un compte, vous acceptez nos "}
                    <Text style={styles.legalLink}>CGU</Text>
                    {" et notre "}
                    <Text style={styles.legalLink}>{"Politique de confidentialite"}</Text>
                  </Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.footerRule} />
                <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.footerText}>
                    {"Deja un compte ?  "}
                    <Text style={styles.footerLink}>Se connecter</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const RADIUS   = 12;
const BTN_H    = 55;
const CARD_PAD = 28;

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: "#0A0A0A" },
  safeArea: { flex: 1 },

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

  scrollContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 20 },

  // Card centree — meme logique que login
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: CARD_PAD,
    paddingVertical: 32,
  },

  titleBlock: { marginBottom: 28 },
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

  steps:         { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)" },
  stepDotActive: { backgroundColor: "#FFFFFF", width: 24, borderRadius: 4 },
  stepLine:      { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 6 },

  form:  { gap: 0 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",  // contraste ameliore
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
    borderRadius: RADIUS,            // uniforme
    paddingRight: 14,
    height: 52,
  },
  inputRowFocused: {
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  inputIcon:   { marginLeft: 16 },
  input: { flex: 1, paddingHorizontal: 11, fontSize: 15, color: "#FFFFFF" },
  eyeBtn:      { padding: 6 },
  optionalTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: 1,
    fontWeight: "600",
    marginRight: 6,
  },

  submitBtn: {
    backgroundColor: "#FFFFFF",
    height: BTN_H,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  legalRow:  { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  legalText: { flex: 1, color: "rgba(255,255,255,0.2)", fontSize: 11, lineHeight: 18 },
  legalLink: { color: "rgba(255,255,255,0.4)", textDecorationLine: "underline" },

  footer:     { marginTop: 28, alignItems: "center", gap: 16 },
  footerRule: { width: 28, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  footerText: { color: "rgba(255,255,255,0.32)", fontSize: 14 },
  footerLink: { color: "#FFFFFF", fontWeight: "600" },
});