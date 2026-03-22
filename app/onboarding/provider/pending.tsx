// app/onboarding/provider/pending.tsx — FIXED Premium Pending (dark design)
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, Animated, Easing, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth/AuthContext";
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

interface DocStatus {
  id: string;
  docKey: string;
  status: string;
  rejectionReason?: string | null;
}

export default function PendingValidation() {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "suspended">("pending");
  const [stripeConnected, setStripeConnected] = useState(false);
  const [documents, setDocuments] = useState<DocStatus[]>([]);
  const stripeConnectedRef = useRef(false);

  async function checkStatus() {
    try {
      const [validationRes, stripeRes, docsRes]: any[] = await Promise.all([
        api.providers.validationStatus(),
        !stripeConnectedRef.current ? api.connect.status() : null,
        api.providerDocs.list(),
      ]);

      if (docsRes?.documents) setDocuments(docsRes.documents);

      if (stripeRes) {
        const connected = !!stripeRes.isStripeReady;
        stripeConnectedRef.current = connected;
        setStripeConnected(connected);
      }

      if (validationRes.providerStatus === "ACTIVE") {
        setStatus("approved");
        setTimeout(() => router.replace("/(tabs)/provider-dashboard"), 1500);
        return true;
      } else if (validationRes.providerStatus === "REJECTED") {
        setStatus("rejected");
        return true;
      } else if (validationRes.providerStatus === "SUSPENDED") {
        setStatus("suspended");
        return true;
      }
    } catch {}
    return false;
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(async () => {
      const done = await checkStatus();
      if (done) clearInterval(interval);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Animations
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;
  const pulseOp = useRef(new Animated.Value(1)).current;

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

    if (status === "pending") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOp, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [status]);

  const iconName = status === "approved" ? "checkmark" : status === "rejected" ? "close" : status === "suspended" ? "ban-outline" : "time-outline";
  const iconColor = status === "approved" ? C.green : status === "rejected" ? C.red : C.white;

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
        <View style={[s.iconCircle, status === "approved" && { backgroundColor: "rgba(61,139,61,0.15)", borderColor: "rgba(61,139,61,0.3)" }]}>
          <Ionicons name={iconName as any} size={40} color={iconColor} />
        </View>

        {/* Title */}
        {status === "pending" && (
          <>
            <Text style={s.title}>
              DOSSIER EN{"\n"}
              <Text style={s.titleOutline}>VÉRIFICATION.</Text>
            </Text>
            <Text style={s.subtitle}>
              Notre équipe vérifie vos documents et qualifications.{"\n"}
              Vous recevrez un email dès que votre compte sera activé.
            </Text>

            {/* Steps card */}
            <View style={s.stepsCard}>
              {[
                { label: "Dossier reçu", done: true },
                { label: "Stripe configuré", done: stripeConnected },
                { label: "Vérification en cours", done: false },
              ].map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepDot, step.done && s.stepDotDone]}>
                    {step.done && <Ionicons name="checkmark" size={10} color={C.bg} />}
                  </View>
                  <Text style={[s.stepLabel, step.done && s.stepLabelDone]}>{step.label}</Text>
                </View>
              ))}
            </View>

            {/* Documents */}
            {documents.length > 0 && (
              <View style={s.docsCard}>
                <Text style={s.docsTitle}>Vos documents</Text>
                {documents.map(doc => (
                  <View key={doc.id} style={s.docRow}>
                    <Ionicons
                      name={doc.status === "APPROVED" ? "checkmark-circle" : doc.status === "REJECTED" ? "close-circle" : "time-outline"}
                      size={16}
                      color={doc.status === "APPROVED" ? C.green : doc.status === "REJECTED" ? C.red : C.grey}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docLabel}>{doc.docKey.replace(/_/g, " ")}</Text>
                      {doc.status === "REJECTED" && doc.rejectionReason && (
                        <Text style={s.docReason}>{doc.rejectionReason}</Text>
                      )}
                    </View>
                    <Text style={[s.docStatus, doc.status === "APPROVED" && { color: C.green }, doc.status === "REJECTED" && { color: C.red }]}>
                      {doc.status === "APPROVED" ? "Validé" : doc.status === "REJECTED" ? "Refusé" : "En attente"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Animated.View style={{ opacity: pulseOp, alignItems: "center", marginTop: 12 }}>
              <View style={s.pulseDotRow}>
                <View style={s.pulseDot} />
                <Text style={s.eta}>Confirmation sous 24-48h</Text>
              </View>
            </Animated.View>
          </>
        )}

        {status === "approved" && (
          <>
            <Text style={s.title}>
              COMPTE{"\n"}
              <Text style={s.titleOutline}>ACTIVÉ !</Text>
            </Text>
            <Text style={s.subtitle}>
              Bienvenue sur FIXED. Vous pouvez maintenant recevoir des missions.
            </Text>
          </>
        )}

        {status === "rejected" && (
          <>
            <Text style={s.title}>
              DOSSIER NON{"\n"}
              <Text style={s.titleOutline}>VALIDÉ.</Text>
            </Text>
            <Text style={s.subtitle}>
              Votre dossier n'a pas pu être validé. Vérifiez vos documents et réessayez.
            </Text>
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.replace("/onboarding/documents");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>CORRIGER MON DOSSIER</Text>
              <View style={s.arrowPill}>
                <Ionicons name="arrow-forward" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {status === "suspended" && (
          <>
            <Text style={s.title}>
              COMPTE{"\n"}
              <Text style={s.titleOutline}>SUSPENDU.</Text>
            </Text>
            <Text style={s.subtitle}>
              Votre compte prestataire a été temporairement suspendu.{"\n"}
              Contactez le support pour plus d'informations.
            </Text>
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/settings/support");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>CONTACTER LE SUPPORT</Text>
              <View style={s.arrowPill}>
                <Ionicons name="arrow-forward" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        {status === "pending" && !stripeConnected && (
          <TouchableOpacity
            style={s.stripeCta}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/onboarding/provider/stripe-connect");
            }}
            activeOpacity={0.9}
          >
            <Text style={s.stripeCtaText}>CONFIGURER STRIPE</Text>
            <View style={s.arrowPill}>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            signOut();
          }}
          activeOpacity={0.6}
        >
          <Ionicons name="log-out-outline" size={16} color={C.grey} />
          <Text style={s.logoutText}>Se déconnecter</Text>
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

  // Steps
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
  stepDotDone: {
    backgroundColor: C.white, borderColor: C.white,
  },
  stepLabel: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.grey,
  },
  stepLabelDone: {
    fontFamily: FONTS.sansMedium, color: C.white,
  },

  // Docs
  docsCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 20, width: "100%", gap: 10, marginTop: 4,
  },
  docsTitle: {
    fontFamily: FONTS.sansMedium, fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 4,
  },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  docLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white, textTransform: "capitalize",
  },
  docReason: { fontFamily: FONTS.sans, fontSize: 12, color: C.red, marginTop: 2 },
  docStatus: { fontFamily: FONTS.sansMedium, fontSize: 12, color: C.grey },

  // CTA
  stripeCta: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    marginTop: 8,
  },
  stripeCtaText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },

  // Pulse
  pulseDotRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
  },
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
    paddingHorizontal: 28, gap: 12, zIndex: 2,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingBottom: Platform.OS === "ios" ? 48 : 32, paddingTop: 16,
  },
  logoutText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.grey,
    textDecorationLine: "underline", textDecorationColor: "rgba(255,255,255,0.12)",
  },
});
