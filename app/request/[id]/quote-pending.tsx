// app/request/[id]/quote-pending.tsx — En attente de devis (adaptive dark/light)
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, Dimensions,
  Animated, Easing, Platform, TouchableOpacity, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { PulseDot } from '@/components/ui/PulseDot';
import { useAuth } from "@/lib/auth/AuthContext";
import { useSocket } from "@/lib/SocketContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

function GridLines({ isDark }: { isDark: boolean }) {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.04)";
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
    </View>
  );
}

export default function QuotePending() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, serviceName, address, calloutFee, pricingMode } = useLocalSearchParams<{
    id: string;
    serviceName?: string;
    address?: string;
    calloutFee?: string;
    pricingMode?: string;
  }>();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [quoteReceived, setQuoteReceived] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Guard: verify ownership + status on mount
  useEffect(() => {
    if (!id || !user?.id) return;
    (async () => {
      try {
        const res: any = await api.requests.get(String(id));
        const request = res?.data || res;
        if (!request || request.clientId !== user.id) {
          Alert.alert("Accès refusé", "Vous n'êtes pas autorisé à accéder à cette page.");
          router.replace("/(tabs)/dashboard");
          return;
        }
        const st = request.status?.toUpperCase();
        if (st === "QUOTE_SENT") {
          router.replace({ pathname: "/request/[id]/quote-review", params: { id: String(id) } });
        } else if (st !== "QUOTE_PENDING" && st !== "PENDING_PAYMENT" && st !== "PUBLISHED") {
          router.replace("/(tabs)/dashboard");
        }
      } catch {}
    })();
  }, [id, user?.id]);

  // Socket listener: real-time status update
  useEffect(() => {
    if (!socket || !id) return;
    const handler = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      const st = data.status?.toUpperCase();
      if (st === "QUOTE_SENT") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/request/[id]/quote-review", params: { id: String(id) } });
      }
    };
    socket.on("request:statusUpdated", handler);
    return () => { socket.off("request:statusUpdated", handler); };
  }, [socket, id]);

  // Poll pour vérifier si un devis a été envoyé (fallback)
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
    }, 10_000);
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

  // Theme-adaptive colors
  const cardBg = theme.cardBg;
  const cardBorder = theme.border;
  const glowColor = theme.isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)";

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <GridLines isDark={theme.isDark} />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={[glowColor, "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          {/* Icon */}
          <View style={[s.iconCircle, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Feather
              name={isDiagnostic ? "search" : "file-text"}
              size={40}
              color={theme.text}
            />
          </View>

          {/* Title */}
          <Text style={[s.title, { color: theme.text }]}>
            EN ATTENTE DE{"\n"}
            <Text style={{ color: theme.textMuted }}>
              {isDiagnostic ? "DIAGNOSTIC." : "DEVIS."}
            </Text>
          </Text>

          <Text style={[s.subtitle, { color: theme.textSub }]}>
            {isDiagnostic
              ? "Le prestataire va se déplacer pour diagnostiquer le problème et vous enverra un devis détaillé."
              : "Le prestataire va évaluer votre demande sur place et vous enverra un devis détaillé."}
          </Text>

          {/* Steps card */}
          <View style={[s.stepsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {[
              { label: "Demande envoyée", done: true },
              { label: `${isDiagnostic ? "Diagnostic" : "Visite"} ${calloutFee ? calloutFee + "€" : ""} payé`, done: true },
              { label: "Devis en cours", done: false },
            ].map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[
                  s.stepDot,
                  { borderColor: theme.borderLight, backgroundColor: theme.surface },
                  step.done && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                  {step.done && <Feather name="check" size={10} color={theme.accentText} />}
                </View>
                <Text style={[
                  s.stepLabel,
                  { color: theme.textSub },
                  step.done && { color: theme.text, fontFamily: FONTS.sansMedium },
                ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Info card */}
          <View style={[s.infoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Feather name="info" size={16} color={theme.textMuted} style={{ marginTop: 1 }} />
            <Text style={[s.infoText, { color: theme.textMuted }]}>
              Vous recevrez une notification dès que le devis sera prêt. Vous pourrez l'accepter ou le refuser.
              {calloutFee ? ` Les ${calloutFee}€ seront déduits du total si vous acceptez.` : ""}
            </Text>
          </View>

          {/* Recap */}
          {(serviceName || address) ? (
            <View style={[s.recapCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {serviceName ? (
                <View style={s.recapRow}>
                  <Feather name="tool" size={14} color={theme.textMuted} />
                  <Text style={[s.recapText, { color: theme.textSub }]}>{serviceName}</Text>
                </View>
              ) : null}
              {address ? (
                <View style={s.recapRow}>
                  <Feather name="map-pin" size={14} color={theme.textMuted} />
                  <Text style={[s.recapText, { color: theme.textSub }]} numberOfLines={1}>{address}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Pulse indicator */}
          <Animated.View style={{ opacity: pulseOp, alignItems: "center", marginTop: 16 }}>
            <View style={s.pulseDotRow}>
              <PulseDot size={5} />
              <Text style={[s.eta, { color: theme.textVeryMuted }]}>Devis sous 72h maximum</Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: theme.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace("/(tabs)/dashboard");
            }}
            activeOpacity={0.88}
          >
            <Text style={[s.btnPrimaryText, { color: theme.accentText }]}>RETOUR À L'ACCUEIL</Text>
            <View style={[s.arrowPill, { backgroundColor: theme.bg }]}>
              <Feather name="arrow-right" size={14} color={theme.text} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => {
              Alert.alert(
                "Annuler la demande",
                "Votre acompte sera remboursé. Voulez-vous continuer ?",
                [
                  { text: "Non", style: "cancel" },
                  {
                    text: "Oui, annuler",
                    style: "destructive",
                    onPress: async () => {
                      setCancelling(true);
                      try {
                        await api.post(`/requests/${id}/cancel`);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        router.replace("/(tabs)/dashboard");
                      } catch {
                        Alert.alert("Erreur", "Impossible d'annuler la demande.");
                        setCancelling(false);
                      }
                    },
                  },
                ],
              );
            }}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            <Text style={[s.cancelText, { color: COLORS.red }]}>
              {cancelling ? "Annulation..." : "Annuler la demande de devis"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, zIndex: 2 },

  glowWrap: {
    position: "absolute", top: -80,
    left: (SCREEN_W - 420) / 2, width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

  content: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28, gap: 16,
  },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },

  title: {
    fontFamily: FONTS.bebas, fontSize: 36,
    letterSpacing: 1, lineHeight: 40, textAlign: "center",
  },

  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15,
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },

  stepsCard: {
    borderWidth: 1,
    borderRadius: 16, padding: 20, width: "100%", gap: 14, marginTop: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  stepLabel: { fontFamily: FONTS.sans, fontSize: 14 },

  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderWidth: 1,
    borderRadius: 16, padding: 16, width: "100%",
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 13, lineHeight: 20,
  },

  recapCard: {
    borderWidth: 1,
    borderRadius: 16, padding: 16, width: "100%", gap: 10,
  },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  recapText: { fontFamily: FONTS.sans, fontSize: 13, flex: 1 },

  pulseDotRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eta: {
    fontFamily: FONTS.sansLight, fontSize: 12, letterSpacing: 1,
  },

  footer: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    gap: 12,
  },
  btnPrimary: {
    width: "100%", height: 60, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cancelBtn: {
    alignItems: "center", paddingVertical: 10,
  },
  cancelText: {
    fontFamily: FONTS.sansMedium, fontSize: 14,
  },
});
