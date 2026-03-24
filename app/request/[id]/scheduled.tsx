// app/request/[id]/scheduled.tsx
// Page de confirmation apres reservation d'une intervention planifiee.
// Design : dark premium avec grid lines, map preview grayscale, animations stagger.

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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAppTheme, FONTS } from "@/hooks/use-app-theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// ── Grayscale map styles ──────────────────────────────────────────────────
const MAP_STYLE_LIGHT = [
  { elementType: "geometry", stylers: [{ color: "#f0f0f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e8e8e8" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#d6d6d6" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d0d0d0" }],
  },
];

const MAP_STYLE_DARK = [
  { elementType: "geometry", stylers: [{ color: "#1A1A1A" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#888888" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1A1A1A" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2C2C2C" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#333333" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#888888" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#111111" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#555555" }],
  },
];

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

// ── Main component ────────────────────────────────────────────────────────
export default function ScheduledConfirmation() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, serviceName, address, price, scheduledLabel, lat, lng } =
    useLocalSearchParams<{
      id: string;
      serviceName?: string;
      address?: string;
      price?: string;
      scheduledLabel?: string;
      lat?: string;
      lng?: string;
    }>();

  const hasCoords =
    lat != null &&
    lng != null &&
    !isNaN(parseFloat(lat)) &&
    !isNaN(parseFloat(lng));
  const latitude = hasCoords ? parseFloat(lat!) : 0;
  const longitude = hasCoords ? parseFloat(lng!) : 0;

  // ── Stagger entrance animations ──
  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const recapAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;
  const infoAnim = useRef(new Animated.Value(0)).current;
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
      stagger(mapAnim, 320),
      stagger(infoAnim, 400),
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
            <Ionicons name="calendar-outline" size={40} color={theme.text} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={makeAnimStyle(titleAnim)}>
          <Text style={[s.title, { color: theme.text }]}>
            INTERVENTION PLANIFIEE
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={makeAnimStyle(subtitleAnim)}>
          <Text style={[s.subtitle, { color: theme.textSub }]}>
            Votre demande a ete enregistree. Nous recherchons le meilleur
            prestataire pour votre creneau.
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

            {scheduledLabel ? (
              <>
                <View
                  style={[s.recapSep, { backgroundColor: theme.border }]}
                />
                <View style={s.recapRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.textSub}
                  />
                  <Text
                    style={[
                      s.recapLabel,
                      { color: theme.textMuted, fontFamily: FONTS.sans },
                    ]}
                  >
                    Creneau
                  </Text>
                  <Text
                    style={[
                      s.recapValue,
                      { color: theme.text, fontFamily: FONTS.sansMedium },
                    ]}
                  >
                    {scheduledLabel}
                  </Text>
                </View>
              </>
            ) : null}

            {price ? (
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
                    Prix
                  </Text>
                  <Text
                    style={[
                      s.recapValue,
                      { color: theme.text, fontFamily: FONTS.mono },
                    ]}
                  >
                    {price} EUR
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {/* Map preview */}
        {hasCoords && (
          <Animated.View
            style={[{ width: "100%" }, makeAnimStyle(mapAnim)]}
          >
            <View
              style={[
                s.mapContainer,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.cardBg,
                },
              ]}
            >
              <MapView
                style={s.map}
                provider={
                  Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                }
                customMapStyle={
                  theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
                }
                initialRegion={{
                  latitude,
                  longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                pointerEvents="none"
              >
                <Marker
                  coordinate={{ latitude, longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={s.markerOuter}>
                    <View
                      style={[
                        s.markerInner,
                        {
                          backgroundColor: theme.accent,
                        },
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={14}
                        color={theme.accentText}
                      />
                    </View>
                  </View>
                </Marker>
              </MapView>

              {/* Gradient overlay on map edges */}
              <LinearGradient
                colors={[theme.cardBg, "transparent"]}
                style={s.mapGradientTop}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["transparent", theme.cardBg]}
                style={s.mapGradientBottom}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
              />
            </View>
          </Animated.View>
        )}

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
              name="notifications-outline"
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
              Vous recevrez une notification des qu'un prestataire sera assigne
              a votre demande.
            </Text>
          </View>
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
    width: 70,
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

  mapContainer: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapGradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  mapGradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  markerOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 6 },
    }),
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
