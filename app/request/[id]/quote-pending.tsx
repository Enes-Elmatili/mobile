// app/request/[id]/quote-pending.tsx
// Page affichee apres paiement du callout fee pour un service diagnostic/devis.
// Design : dark premium avec grid lines, animations stagger, timeline 4 etapes.

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAppTheme, FONTS } from "@/hooks/use-app-theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// ── Grid background (theme-adaptive) ──────────────────────────────────────
function GridLines({ bg, isDark }: { bg: string; isDark: boolean }) {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.035)";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line
            key={`v${i}`}
            x1={i * GRID_SIZE}
            y1={0}
            x2={i * GRID_SIZE}
            y2={SCREEN_H}
            stroke={stroke}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={i * GRID_SIZE}
            x2={SCREEN_W}
            y2={i * GRID_SIZE}
            stroke={stroke}
            strokeWidth={1}
          />
        ))}
      </Svg>
      <LinearGradient
        colors={["transparent", "transparent", bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ── Timeline steps ────────────────────────────────────────────────────────
interface TimelineStep {
  label: string;
  status: "done" | "active" | "pending";
}

function Timeline({
  steps,
  isDark,
  cardBg,
  border,
  text,
  textSub,
  accent,
  accentText,
}: {
  steps: TimelineStep[];
  isDark: boolean;
  cardBg: string;
  border: string;
  text: string;
  textSub: string;
  accent: string;
  accentText: string;
}) {
  return (
    <View
      style={[
        tl.card,
        {
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: border,
        },
      ]}
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dotBg =
          step.status === "done"
            ? accent
            : step.status === "active"
              ? isDark
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,0,0,0.08)"
              : isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)";
        const dotBorder =
          step.status === "done"
            ? accent
            : step.status === "active"
              ? isDark
                ? "rgba(255,255,255,0.3)"
                : "rgba(0,0,0,0.15)"
              : isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.08)";
        const labelColor =
          step.status === "done"
            ? text
            : step.status === "active"
              ? text
              : textSub;
        const labelFont =
          step.status === "done" || step.status === "active"
            ? FONTS.sansMedium
            : FONTS.sans;
        const lineBg =
          step.status === "done"
            ? accent
            : isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)";

        return (
          <View key={i} style={tl.stepWrap}>
            <View style={tl.dotCol}>
              <View
                style={[
                  tl.dot,
                  {
                    backgroundColor: dotBg,
                    borderColor: dotBorder,
                  },
                ]}
              >
                {step.status === "done" && (
                  <Ionicons name="checkmark" size={10} color={accentText} />
                )}
                {step.status === "active" && (
                  <View
                    style={[
                      tl.activePulse,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.5)"
                          : "rgba(0,0,0,0.3)",
                      },
                    ]}
                  />
                )}
              </View>
              {!isLast && (
                <View style={[tl.line, { backgroundColor: lineBg }]} />
              )}
            </View>
            <Text
              style={[
                tl.label,
                { color: labelColor, fontFamily: labelFont },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  stepWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dotCol: {
    alignItems: "center",
    width: 24,
    marginRight: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  activePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  line: {
    width: 2,
    height: 24,
    borderRadius: 1,
    marginVertical: 2,
  },
  label: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    paddingTop: 1,
  },
});

// ── Main component ────────────────────────────────────────────────────────
export default function QuotePending() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, serviceName, address, calloutFee, pricingMode } =
    useLocalSearchParams<{
      id: string;
      serviceName?: string;
      address?: string;
      calloutFee?: string;
      pricingMode?: string;
    }>();

  const isDiagnostic = pricingMode === "diagnostic";

  // ── Stagger entrance animations ──
  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const recapAnim = useRef(new Animated.Value(0)).current;
  const infoAnim = useRef(new Animated.Value(0)).current;
  const timelineAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // ── Glow pulse ──
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const stagger = (anim: Animated.Value, delay: number) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 480,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      });

    Animated.parallel([
      stagger(iconAnim, 0),
      stagger(titleAnim, 80),
      stagger(subtitleAnim, 160),
      stagger(recapAnim, 240),
      stagger(infoAnim, 320),
      stagger(timelineAnim, 400),
      stagger(ctaAnim, 500),
    ]).start();

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOp, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(glowOp, {
            toValue: 0.5,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);

  const makeAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  });

  const timelineSteps: TimelineStep[] = [
    { label: "Frais de deplacement payes", status: "done" },
    { label: "Visite du prestataire", status: "active" },
    { label: "Devis envoye", status: "pending" },
    { label: "Votre decision", status: "pending" },
  ];

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <GridLines bg={theme.bg} isDark={theme.isDark} />

      {/* Glow effect */}
      <Animated.View
        style={[
          s.glowWrap,
          { opacity: glowOp, transform: [{ scale: glowScale }] },
        ]}
      >
        <LinearGradient
          colors={[
            theme.isDark
              ? "rgba(255,255,255,0.025)"
              : "rgba(0,0,0,0.015)",
            "transparent",
          ]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Back button */}
      <View style={s.header}>
        <TouchableOpacity
          style={[
            s.backBtn,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(tabs)/dashboard");
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Icon */}
        <Animated.View style={[s.iconWrap, makeAnimStyle(iconAnim)]}>
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: theme.cardBg,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name={
                isDiagnostic ? "search-outline" : "document-text-outline"
              }
              size={40}
              color={theme.text}
            />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={makeAnimStyle(titleAnim)}>
          <Text style={[s.title, { color: theme.text }]}>
            DEVIS EN ATTENTE
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={makeAnimStyle(subtitleAnim)}>
          <Text style={[s.subtitle, { color: theme.textSub }]}>
            Votre prestataire va se deplacer pour evaluer les travaux et vous
            envoyer un devis detaille.
          </Text>
        </Animated.View>

        {/* Recap card */}
        <Animated.View
          style={[{ width: "100%" }, makeAnimStyle(recapAnim)]}
        >
          <View
            style={[
              s.recapCard,
              {
                backgroundColor: theme.cardBg,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
          >
            {serviceName ? (
              <View style={s.recapRow}>
                <Ionicons
                  name="construct-outline"
                  size={16}
                  color={theme.textSub}
                />
                <Text
                  style={[
                    s.recapLabel,
                    { color: theme.textMuted, fontFamily: FONTS.sans },
                  ]}
                >
                  Service
                </Text>
                <Text
                  style={[
                    s.recapValue,
                    { color: theme.text, fontFamily: FONTS.sansMedium },
                  ]}
                >
                  {serviceName}
                </Text>
              </View>
            ) : null}

            {address ? (
              <>
                <View
                  style={[s.recapSep, { backgroundColor: theme.border }]}
                />
                <View style={s.recapRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={theme.textSub}
                  />
                  <Text
                    style={[
                      s.recapLabel,
                      { color: theme.textMuted, fontFamily: FONTS.sans },
                    ]}
                  >
                    Adresse
                  </Text>
                  <Text
                    style={[
                      s.recapValue,
                      { color: theme.text, fontFamily: FONTS.sansMedium },
                    ]}
                    numberOfLines={1}
                  >
                    {address}
                  </Text>
                </View>
              </>
            ) : null}

            {calloutFee ? (
              <>
                <View
                  style={[s.recapSep, { backgroundColor: theme.border }]}
                />
                <View style={s.recapRow}>
                  <Ionicons
                    name="card-outline"
                    size={16}
                    color={theme.textSub}
                  />
                  <Text
                    style={[
                      s.recapLabel,
                      { color: theme.textMuted, fontFamily: FONTS.sans },
                    ]}
                  >
                    Frais de deplacement
                  </Text>
                  <Text
                    style={[
                      s.recapValue,
                      { color: theme.text, fontFamily: FONTS.mono },
                    ]}
                  >
                    {calloutFee} EUR
                  </Text>
                </View>
              </>
            ) : null}

            {pricingMode ? (
              <>
                <View
                  style={[s.recapSep, { backgroundColor: theme.border }]}
                />
                <View style={s.recapRow}>
                  <Ionicons
                    name={
                      isDiagnostic ? "search-outline" : "document-text-outline"
                    }
                    size={16}
                    color={theme.textSub}
                  />
                  <Text
                    style={[
                      s.recapLabel,
                      { color: theme.textMuted, fontFamily: FONTS.sans },
                    ]}
                  >
                    Mode
                  </Text>
                  <Text
                    style={[
                      s.recapValue,
                      { color: theme.text, fontFamily: FONTS.sansMedium },
                    ]}
                  >
                    {isDiagnostic ? "Diagnostic" : "Devis"}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {/* Info card */}
        <Animated.View
          style={[{ width: "100%" }, makeAnimStyle(infoAnim)]}
        >
          <View
            style={[
              s.infoCard,
              {
                backgroundColor: theme.cardBg,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={theme.textSub}
              style={{ marginTop: 1 }}
            />
            <Text
              style={[
                s.infoText,
                {
                  color: theme.textSub,
                  fontFamily: FONTS.sansLight,
                },
              ]}
            >
              Vous recevrez une notification des que le devis sera disponible.
              Vous pourrez alors l'accepter ou le refuser.
            </Text>
          </View>
        </Animated.View>

        {/* Timeline */}
        <Animated.View
          style={[{ width: "100%" }, makeAnimStyle(timelineAnim)]}
        >
          <Timeline
            steps={timelineSteps}
            isDark={theme.isDark}
            cardBg={theme.cardBg}
            border={theme.border}
            text={theme.text}
            textSub={theme.textSub}
            accent={theme.accent}
            accentText={theme.accentText}
          />
        </Animated.View>
      </ScrollView>

      {/* CTA */}
      <Animated.View style={[s.footer, makeAnimStyle(ctaAnim)]}>
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: theme.accent }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/(tabs)/dashboard");
          }}
          activeOpacity={0.9}
        >
          <Text
            style={[
              s.btnPrimaryText,
              { color: theme.accentText, fontFamily: FONTS.bebas },
            ]}
          >
            RETOUR AU TABLEAU DE BORD
          </Text>
          <View
            style={[
              s.arrowPill,
              { backgroundColor: theme.accentText },
            ]}
          >
            <Ionicons name="arrow-forward" size={14} color={theme.accent} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  glowWrap: {
    position: "absolute",
    top: -80,
    left: (SCREEN_W - 420) / 2,
    width: 420,
    height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    left: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1, zIndex: 2 },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 120 : 100,
    paddingBottom: 24,
    gap: 16,
  },

  iconWrap: { marginBottom: 4 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },

  title: {
    fontFamily: FONTS.bebas,
    fontSize: 34,
    letterSpacing: 1.5,
    textAlign: "center",
    lineHeight: 40,
  },

  subtitle: {
    fontFamily: FONTS.sansLight,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 4,
  },

  recapCard: {
    borderRadius: 16,
    padding: 18,
    width: "100%",
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  recapLabel: {
    fontSize: 13,
    width: 110,
  },
  recapValue: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
  },
  recapSep: {
    height: 1,
    marginVertical: 10,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    padding: 16,
    width: "100%",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    zIndex: 2,
  },
  btnPrimary: {
    width: "100%",
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  btnPrimaryText: {
    fontSize: 20,
    letterSpacing: 3,
  },
  arrowPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
