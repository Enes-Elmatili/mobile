import React, { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

// ─────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────
type ToastType = "error" | "success" | "info";
interface ToastMessage { id: number; type: ToastType; message: string }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 3s
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 220, useNativeDriver: true }),
      ]).start(() => onRemove());
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const accentColor = toast.type === "error" ? "#FF3B3B" : toast.type === "success" ? "#00E676" : "#FFFFFF";
  const label       = toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "i";

  return (
    <Animated.View style={[toast_s.pill, { opacity, transform: [{ translateY }] }]}>
      <View style={[toast_s.dot, { backgroundColor: accentColor }]}>
        <Text style={toast_s.dotLabel}>{label}</Text>
      </View>
      <Text style={toast_s.text} numberOfLines={2}>{toast.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={toast_s.container} pointerEvents="none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const toast_s = StyleSheet.create({
  container: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    zIndex: 999,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dotLabel: { color: "#000", fontSize: 11, fontWeight: "800" },
  text:     { color: "#FFFFFF", fontSize: 13, fontWeight: "500", flex: 1, lineHeight: 18 },
});

// ─────────────────────────────────────────────
// X SHAPE
// ─────────────────────────────────────────────
function XShape({ size = 60, color = "#FFFFFF" }: { size?: number; color?: string }) {
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

// ─────────────────────────────────────────────
// SPLASH SCREEN
// Bug fix: use Animated.timing (not spring) for the final zoom so
// the .start() callback is ALWAYS called, even on slow devices.
// ─────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const fixedOpacity = useRef(new Animated.Value(0)).current;
  const fixedScale   = useRef(new Animated.Value(0.75)).current;
  const xOpacity     = useRef(new Animated.Value(0)).current;
  const xRotation    = useRef(new Animated.Value(0)).current;
  const xScale       = useRef(new Animated.Value(1)).current;
  const didFinish    = useRef(false);

  const safeDone = useCallback(() => {
    if (!didFinish.current) {
      didFinish.current = true;
      onDone();
    }
  }, [onDone]);

  const oneSpin = useCallback(
    (toValue: number) =>
      Animated.timing(xRotation, {
        toValue,
        duration: 520,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    []
  );

  const pulse = Animated.sequence([
    Animated.timing(xScale, { toValue: 1.28, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.timing(xScale, { toValue: 1,    duration: 180, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    Animated.timing(xScale, { toValue: 1.15, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.timing(xScale, { toValue: 1,    duration: 140, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
  ]);

  useEffect(() => {
    // Safety net: if animation never completes (edge case), force onDone after 6s
    const safetyTimer = setTimeout(safeDone, 6000);

    Animated.sequence([
      // 1. FIXED in
      Animated.parallel([
        Animated.timing(fixedOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(fixedScale,   { toValue: 1, tension: 90, friction: 9, useNativeDriver: true }),
      ]),
      // 2. pause
      Animated.delay(700),
      // 3. crossfade FIXED -> X
      Animated.parallel([
        Animated.timing(fixedOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(xOpacity,     { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
      // 4. pulse
      pulse,
      // 5. 3 rotations
      oneSpin(1),
      oneSpin(2),
      oneSpin(3),
      // 6. FIXED: use timing instead of spring so callback is guaranteed
      Animated.timing(xScale, {
        toValue: 45,
        duration: 520,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      clearTimeout(safetyTimer);
      safeDone();
    });

    return () => clearTimeout(safetyTimer);
  }, []);

  const rotate = xRotation.interpolate({
    inputRange: [0, 3],
    outputRange: ["0deg", "1080deg"],
  });

  return (
    <View style={splash.container}>
      <StatusBar barStyle="light-content" />
      <Animated.Text
        style={[splash.fixedText, { opacity: fixedOpacity, transform: [{ scale: fixedScale }] }]}
      >
        FIXED
      </Animated.Text>
      <Animated.View
        style={{
          position: "absolute",
          opacity: xOpacity,
          transform: [{ rotate }, { scale: xScale }],
        }}
      >
        <XShape size={64} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const splash = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  fixedText: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 14,
    fontFamily: "Georgia",
  },
});

// ─────────────────────────────────────────────
// WELCOME CONTENT
// ─────────────────────────────────────────────
function WelcomeContent() {
  const router = useRouter();

  const fadeIn    = useRef(new Animated.Value(0)).current;
  const logoY     = useRef(new Animated.Value(-20)).current;
  const headlineY = useRef(new Animated.Value(30)).current;
  const buttonsY  = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoY,  { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]),
      Animated.spring(headlineY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      Animated.spring(buttonsY,  { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={"c" + i} style={[styles.gridCol, { left: (width / 6) * i }]} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={"r" + i} style={[styles.gridRow, { top: (height / 10) * i }]} />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Logo */}
        <Animated.View
          style={[styles.logoZone, { opacity: fadeIn, transform: [{ translateY: logoY }] }]}
        >
          <View style={styles.logoRow}>
            <XShape size={24} color="#FFFFFF" />
            <Text style={styles.wordmark}>FIXED</Text>
          </View>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>PRO PLATFORM</Text>
          </View>
        </Animated.View>

        {/* Headline */}
        <Animated.View
          style={[styles.heroSection, { opacity: fadeIn, transform: [{ translateY: headlineY }] }]}
        >
          <Text style={styles.headline}>{"Un\nprobleme ?"}</Text>
          <Text style={styles.slogan}>{"It's Fixed."}</Text>
          <View style={styles.sloganUnderline} />
          <Text style={styles.subline}>
            {"La plateforme qui connecte\nclients et prestataires."}
          </Text>
        </Animated.View>

        {/* Boutons */}
        <Animated.View
          style={[styles.actions, { opacity: fadeIn, transform: [{ translateY: buttonsY }] }]}
        >
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(auth)/signup")}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryBtnText}>{"Creer un compte"}</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            {"En continuant, vous acceptez nos "}
            <Text style={styles.legalLink}>{"Conditions d'utilisation"}</Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────
// ROOT EXPORT — with auto-login check
// ─────────────────────────────────────────────
type Phase = "splash" | "welcome" | "redirecting";

export default function Welcome() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("splash");

  // Run auto-login check concurrently while splash plays
  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      return !!token;
    } catch {
      return false;
    }
  }, []);

  const handleSplashDone = useCallback(async () => {
    const isLoggedIn = await checkAuth();
    if (isLoggedIn) {
      // Token found → skip Welcome, go straight to app
      router.replace("/(app)/dashboard");
    } else {
      setPhase("welcome");
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      {phase === "splash" && <SplashScreen onDone={handleSplashDone} />}
      {phase === "welcome" && <WelcomeContent />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },

  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridCol: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.03)" },
  gridRow: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.03)" },

  safeArea: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 20,
  },

  logoZone: { paddingTop: 12, gap: 10 },
  logoRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  wordmark: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    fontFamily: "Georgia",
  },
  tagBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 3, fontWeight: "600" },

  heroSection: { flex: 1, justifyContent: "center", paddingVertical: 32 },

  headline: {
    fontSize: 62,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 66,
    letterSpacing: -2.5,
    fontFamily: "Georgia",
    marginBottom: 12,
  },
  slogan: {
    fontSize: 62,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 66,
    letterSpacing: -1,
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  sloganUnderline: {
    width: 56,
    height: 3,
    backgroundColor: "#FFFFFF",
    marginTop: 22,
    marginBottom: 22,
  },
  subline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.38)",
    lineHeight: 23,
    letterSpacing: 0.2,
  },

  actions: { gap: 12, paddingBottom: 4 },

  primaryBtn: {
    backgroundColor: "#FFFFFF",
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  secondaryBtn: {
    backgroundColor: "transparent",
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", letterSpacing: 0.3 },

  legalText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  legalLink: { color: "rgba(255,255,255,0.4)", textDecorationLine: "underline" },
});