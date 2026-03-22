// app/request/[id]/quote-pending.tsx — En attente de devis (dark premium design)
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, Dimensions,
  Animated, Easing, Platform, TouchableOpacity,
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

export default function QuotePending() {
  const router = useRouter();
  const { id, serviceName, address, calloutFee, pricingMode } = useLocalSearchParams<{
    id: string;
    serviceName?: string;
    address?: string;
    calloutFee?: string;
    pricingMode?: string;
  }>();

  const [quoteReceived, setQuoteReceived] = useState(false);

  // Poll pour vérifier si un devis a été envoyé
  useEffect(() => {
    if (!id || quoteReceived) return;
    const interval = setInterval(async () => {
      try {
        const res: any = await api.get(`/quotes/request/${id}`);
        if (res?.quotes?.length > 0) {
          setQuoteReceived(true);
          clearInterval(interval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: "/request/[id]/quote-review",
            params: { id },
          });
        }
      } catch {}
    }, 10_000); // Poll toutes les 10s
    return () => clearInterval(interval);
  }, [id, quoteReceived]);

  // Animations
  const pulseOp = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOp, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

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

  const isDiagnostic = pricingMode === "diagnostic";

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

      <View style={s.content}>
        {/* Icon */}
        <View style={s.iconCircle}>
          <Ionicons name={isDiagnostic ? "search-outline" : "document-text-outline"} size={40} color={C.white} />
        </View>

        {/* Title */}
        <Text style={s.title}>
          EN ATTENTE DE{"\n"}
          <Text style={s.titleOutline}>
            {isDiagnostic ? "DIAGNOSTIC." : "DEVIS."}
          </Text>
        </Text>

        <Text style={s.subtitle}>
          {isDiagnostic
            ? "Le prestataire va se déplacer pour diagnostiquer le problème et vous enverra un devis détaillé."
            : "Le prestataire va évaluer votre demande sur place et vous enverra un devis détaillé."}
        </Text>

        {/* Steps card */}
        <View style={s.stepsCard}>
          {[
            { label: "Demande envoyée", done: true },
            { label: `${isDiagnostic ? "Diagnostic" : "Visite"} ${calloutFee ? calloutFee + "€" : ""} payé`, done: true },
            { label: "Devis en cours", done: false },
          ].map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={[s.stepDot, step.done && s.stepDotDone]}>
                {step.done && <Ionicons name="checkmark" size={10} color={C.bg} />}
              </View>
              <Text style={[s.stepLabel, step.done && s.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
        </View>

        {/* Info card */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={C.grey} style={{ marginTop: 1 }} />
          <Text style={s.infoText}>
            Vous recevrez une notification dès que le devis sera prêt. Vous pourrez l'accepter ou le refuser.
            {calloutFee ? ` Les ${calloutFee}€ seront déduits du total si vous acceptez.` : ""}
          </Text>
        </View>

        {/* Recap */}
        {(serviceName || address) && (
          <View style={s.recapCard}>
            {serviceName && (
              <View style={s.recapRow}>
                <Ionicons name="construct-outline" size={14} color={C.grey} />
                <Text style={s.recapText}>{serviceName}</Text>
              </View>
            )}
            {address && (
              <View style={s.recapRow}>
                <Ionicons name="location-outline" size={14} color={C.grey} />
                <Text style={s.recapText} numberOfLines={1}>{address}</Text>
              </View>
            )}
          </View>
        )}

        {/* Pulse indicator */}
        <Animated.View style={{ opacity: pulseOp, alignItems: "center", marginTop: 16 }}>
          <View style={s.pulseDotRow}>
            <View style={s.pulseDot} />
            <Text style={s.eta}>Devis sous 72h maximum</Text>
          </View>
        </Animated.View>
      </View>

      {/* Back to dashboard */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/(tabs)/dashboard");
          }}
          activeOpacity={0.9}
        >
          <Text style={s.btnPrimaryText}>RETOUR À L'ACCUEIL</Text>
          <View style={s.arrowPill}>
            <Ionicons name="arrow-forward" size={14} color={C.white} />
          </View>
        </TouchableOpacity>
      </View>
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

  content: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28, gap: 16, zIndex: 2,
  },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },

  title: {
    fontFamily: FONTS.bebas, fontSize: 36, color: C.white,
    letterSpacing: 1, lineHeight: 40, textAlign: "center",
  },
  titleOutline: { color: C.outlineText },

  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15, color: C.grey,
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },

  stepsCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 20, width: "100%", gap: 14, marginTop: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotDone: { backgroundColor: C.white, borderColor: C.white },
  stepLabel: { fontFamily: FONTS.sans, fontSize: 14, color: C.grey },
  stepLabelDone: { fontFamily: FONTS.sansMedium, color: C.white },

  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, width: "100%",
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 13,
    lineHeight: 20, color: "rgba(255,255,255,0.5)",
  },

  recapCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, width: "100%", gap: 10,
  },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  recapText: { fontFamily: FONTS.sans, fontSize: 13, color: C.grey, flex: 1 },

  pulseDotRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  pulseDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green,
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  eta: {
    fontFamily: FONTS.sansLight, fontSize: 12, color: "rgba(255,255,255,0.25)",
    letterSpacing: 1,
  },

  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    zIndex: 2,
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
