// app/request/NewRequestStepper.tsx
// Flow Intervention — 4 étapes premium + dark mode system-adaptive

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Animated,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthContext';
import { toIoniconName } from '../../lib/iconMapper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { computePrice } from '@/lib/services/priceService';
import { formatEUR, formatEURCents } from '@/lib/format';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const TOTAL_STEPS = 4;

const DEFAULT_REGION = {
  latitude:      50.8503,
  longitude:     4.3517,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

// ─── Carte Grayscale (light) ───────────────────────────────────────────────────
const MAP_STYLE_SILVER = [
  { elementType: 'geometry',                                  stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon',                               stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',                          stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke',                        stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi',                        elementType: 'geometry',         stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi',                        elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park',                   elementType: 'geometry',         stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'poi.park',                   elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road',                       elementType: 'geometry',         stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial',              elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway',               elementType: 'geometry',         stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway',               elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local',                 elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line',               elementType: 'geometry',         stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station',            elementType: 'geometry',         stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water',                      elementType: 'geometry',         stylers: [{ color: '#d9d9d9' }] },
  { featureType: 'water',                      elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

// ─── Carte Dark (monochrome branded — no blue) ──────────────────────────────────
const MAP_STYLE_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'landscape',     elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'poi',           stylers: [{ visibility: 'off' }] },
  { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway',  elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road.local',    elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'transit.line',  elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
];

// Local Ionicons→Feather icon name bridge. Used to translate legacy category
// icon names returned by toIoniconName() into Feather glyphs without touching
// the shared mapper. Keys here are Ionicons names; values are Feather names.
const IONICON_TO_FEATHER: Record<string, string> = {
  'construct-outline':       'tool',
  'hammer-outline':          'tool',
  'settings-outline':        'settings',
  'build-outline':           'tool',
  'sparkles-outline':        'star',
  'basket-outline':          'shopping-basket',
  'water-outline':           'droplet',
  'flask-outline':           'droplet',
  'alert-circle-outline':    'alert-circle',
  'warning-outline':         'alert-triangle',
  'help-circle-outline':     'help-circle',
  'radio-button-on-outline': 'radio',
  'home-outline':            'home',
  'enter-outline':           'log-in',
  'apps-outline':            'grid',
  'bed-outline':             'home',
  'bulb-outline':            'zap',
  'flash-outline':           'zap',
  'hardware-chip-outline':   'cpu',
  'leaf-outline':            'feather',
  'cut-outline':             'scissors',
  'cube-outline':            'package',
  'car-outline':             'truck',
  'barbell-outline':         'activity',
  'color-palette-outline':   'edit-2',
  'brush-outline':           'edit-2',
  'laptop-outline':          'monitor',
  'phone-portrait-outline':  'smartphone',
  'desktop-outline':         'monitor',
  'camera-outline':          'camera',
  'paw-outline':             'github',
  'restaurant-outline':      'coffee',
  'people-outline':          'users',
  'medkit-outline':          'plus-square',
  'key-outline':             'key',
  'thermometer-outline':     'thermometer',
  'time-outline':             'clock',
  'checkmark-circle-outline': 'check-circle',
  'location-outline':         'map-pin',
  'checkmark':                'check',
};

const toFeatherName = (name: string | undefined | null, fallback = 'tool'): string => {
  if (!name) return fallback;
  return IONICON_TO_FEATHER[name] || fallback;
};

// Config des étapes
const getStepConfig = (t: any) => [
  { label: t('stepper.step1_label'), sublabel: t('stepper.step1_sub'), icon: 'map-pin'     as const },
  { label: t('stepper.step2_label'), sublabel: t('stepper.step2_sub'), icon: 'tool'        as const },
  { label: t('stepper.step3_label'), sublabel: t('stepper.step3_sub'), icon: 'clock'       as const },
  { label: t('stepper.step4_label'), sublabel: t('stepper.step4_sub'), icon: 'check-circle' as const },
];

function extractArrayPayload(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
}

// ============================================================================
// THEME BRIDGE — maps useAppTheme() tokens to local aliases for sub-components
// ============================================================================

function useTheme() {
  const t = useAppTheme();
  return {
    isDark:          t.isDark,
    bg:              t.bg,
    surface:         t.surface,
    surfaceAlt:      t.surfaceAlt,
    surfaceBorder:   t.border,
    card:            t.cardBg,
    cardBorder:      t.border,
    sep:             t.borderLight,
    text:            t.text,
    textSub:         t.textSub,
    textMuted:       t.textMuted,
    textPlaceholder: t.textMuted,
    iconBtnBg:       t.surface,
    progressTrack:   t.isDark ? t.border : t.surface,
    ctaBg:           t.bg,
    ctaBorder:       t.borderLight,
    modeCardBg:      t.surface,
    nowConfirmBg:    t.surface,
    noteInputBg:     t.surface,
    noteInputBorder: t.border,
    searchBoxBg:     t.isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
    addrConfirmBg:   t.cardBg,
    addrClearBg:     t.isDark ? t.border : t.surface,
    dropdownBg:      t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownRow:     t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownSep:     t.borderLight,
    chipBg:          t.surface,
    v4CardBg:        t.isDark ? t.surface : t.cardBg,
    v4Sep:           t.border,
    gradientBg:      t.isDark ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.9)',
    // Expose full theme for direct access
    accent:          t.accent,
    accentText:      t.accentText,
    statusBar:       t.statusBar,
    shadowOpacity:   t.shadowOpacity,
  };
}

// ─── Step Indicator animé ──────────────────────────────────────────────────────
const STEP_ICONS: ('map-pin' | 'tool' | 'clock' | 'check')[] = [
  'map-pin', 'tool', 'clock', 'check',
];

function StepIndicator({ step }: { step: number }) {
  const t = useTheme();

  const segmentAnims = useRef(
    Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => new Animated.Value(i < step - 1 ? 1 : 0))
  ).current;

  useEffect(() => {
    segmentAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i < step - 1 ? 1 : 0,
        duration: 350,
        useNativeDriver: false,
      }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <View style={si.container}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive    = i === step - 1;
        const isCompleted = i < step - 1;
        const dotBg       = isActive ? t.accent : isCompleted ? t.accent : t.progressTrack;
        const iconColor   = isActive || isCompleted ? t.accentText as string : t.textMuted as string;

        return (
          <React.Fragment key={i}>
            <View style={[si.dot, { backgroundColor: dotBg }]}>
              {isCompleted
                ? <Feather name="check" size={14} color={iconColor} />
                : <Feather name={STEP_ICONS[i]} size={isActive ? 16 : 14} color={iconColor} />
              }
            </View>
            {i < TOTAL_STEPS - 1 && (
              <View style={[si.segment, { backgroundColor: t.progressTrack }]}>
                <Animated.View style={[si.segmentFill, { backgroundColor: t.accent as string }, {
                  width: segmentAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }]} />
              </View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  container:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 6 },
  dot:         { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segment:     { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden', marginHorizontal: 4 },
  segmentFill: { height: '100%', borderRadius: 1 },
});

// ─── Résumé contextuel ─────────────────────────────────────────────────────────
function LiveSummary({ location, serviceName, scheduledLabel }: {
  location:       { address: string } | null;
  serviceName:    string | null;
  scheduledLabel: string | null;
}) {
  const t = useTheme();
  const parts: string[] = [];
  if (location)      parts.push(location.address.split(',')[0]);
  if (serviceName)   parts.push(serviceName);
  if (scheduledLabel) parts.push(scheduledLabel);

  if (parts.length === 0) return null;

  return (
    <View style={ls.wrap}>
      {parts.map((p, i) => (
        <View key={i} style={ls.row}>
          <Feather name="check-circle" size={12} color={t.textMuted as string} />
          <Text style={[ls.text, { color: t.textMuted }]} numberOfLines={1}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

const ls = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginTop: 8, marginBottom: 2, gap: 3 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 11, flex: 1, fontFamily: FONTS.sans },
});

// ─── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, selected, dimmed, onPress }: { cat: any; selected: boolean; dimmed?: boolean; onPress: () => void }) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: dimmed ? 0.25 : 1, duration: 250, useNativeDriver: true }).start();
  }, [dimmed]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[cc.wrap, { transform: [{ scale }], opacity }]}>
      <TouchableOpacity
        style={[
          cc.card,
          { borderBottomColor: t.surfaceBorder },
          selected && [cc.cardSelected, { backgroundColor: t.surfaceAlt, borderBottomColor: 'transparent' }],
        ]}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={cat.name}
        accessibilityRole="button"
      >
        <View style={[cc.iconWrap, { backgroundColor: t.surface }, selected && [cc.iconWrapSelected, { backgroundColor: t.accent }]]}>
          <Feather
            name={toFeatherName(toIoniconName(cat.icon, 'construct-outline'), 'tool') as any}
            size={18}
            color={selected ? t.accentText as string : t.textSub as string}
          />
        </View>
        <Text style={[cc.name, { color: t.text }, selected && cc.nameSelected]} numberOfLines={1}>
          {cat.name}
        </Text>
        {selected
          ? <View style={[cc.selectedDot, { backgroundColor: t.text }]} />
          : <Feather name="chevron-right" size={14} color={t.textMuted} />
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

const cc = StyleSheet.create({
  wrap:             { width: '100%' },
  card:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderRadius: 14, backgroundColor: 'transparent', borderBottomWidth: 1 },
  cardSelected:     { borderRadius: 14 },
  iconWrap:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconWrapSelected: {},
  name:             { flex: 1, fontSize: 15, fontFamily: FONTS.sansMedium },
  nameSelected:     {},
  selectedDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});

// ─── Sub Row ───────────────────────────────────────────────────────────────────
function SubChip({ label, basePrice, priceMin, priceMax, selected, dimmed, onPress, pricingMode, calloutFee }: {
  label:        string;
  basePrice?:   number;
  priceMin?:    number;
  priceMax?:    number;
  selected:     boolean;
  dimmed?:      boolean;
  onPress:      () => void;
  pricingMode?: string;
  calloutFee?:  number;
}) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isQuote = pricingMode === 'estimate' || pricingMode === 'diagnostic';

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: dimmed ? 0.3 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [dimmed]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.98, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity
        style={[sc.row, { borderBottomColor: t.surfaceBorder }]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <View style={[sc.dot, { backgroundColor: isQuote ? COLORS.amber : COLORS.greenBrand }, selected && { backgroundColor: t.text }]} />
        <Text style={[sc.text, { color: t.textSub }, selected && { fontFamily: FONTS.sansMedium, color: t.text }]}>{label}</Text>
        <View style={sc.right}>
          <View style={[sc.pill, { backgroundColor: isQuote ? 'rgba(200,130,10,0.15)' : 'rgba(61,139,61,0.15)' }]}>
            <Text style={[sc.pillText, { color: isQuote ? COLORS.amber : COLORS.greenBrand }]}>{isQuote ? 'Sur devis' : 'Prix fixe'}</Text>
          </View>
          {selected && <Feather name="check" size={16} color={t.text as string} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 4, gap: 10, borderBottomWidth: 1 },
  dot:   { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  text:  { flex: 1, fontSize: 15, fontFamily: FONTS.sans },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 70, alignItems: 'center' as const },
  pillText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  priceSmall: { fontSize: 12, fontFamily: FONTS.bebas },
});

// ─── Time Slot ─────────────────────────────────────────────────────────────────
function TimeSlot({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          tslot.chip,
          { backgroundColor: t.chipBg, borderColor: 'transparent' },
          selected && [tslot.chipSelected, { backgroundColor: t.accent, borderColor: t.accent }],
        ]}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {selected && <View style={[tslot.dot, { backgroundColor: t.accentText }]} />}
        <Text style={[tslot.text, { color: t.textSub }, selected && [tslot.textSelected, { color: t.accentText }]]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const tslot = StyleSheet.create({
  chip:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, minWidth: 70 },
  chipSelected: {},
  dot:          { width: 6, height: 6, borderRadius: 3 },
  text:         { fontSize: 13, fontFamily: FONTS.sansMedium },
  textSelected: {},
});

// ─── Day Chip ──────────────────────────────────────────────────────────────────
function DayChip({ day, date, month, selected, onPress }: {
  day: string; date: string; month: string; selected: boolean; onPress: () => void;
}) {
  const t              = useTheme();
  const underlineWidth = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(underlineWidth, { toValue: selected ? 1 : 0, duration: 200, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <TouchableOpacity
      style={dc.wrap}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
      accessibilityLabel={`${day} ${date} ${month}`}
      accessibilityRole="button"
    >
      <Text style={[dc.day,  { color: t.textMuted }, selected && { color: t.text }]}>{day}</Text>
      <Text style={[dc.date, { color: t.textMuted }, selected && { color: t.text }]}>{date}</Text>
      <Text style={[dc.month, { color: 'transparent' }, selected && { color: t.textSub }]}>{month}</Text>
      <Animated.View style={[dc.underline, { backgroundColor: t.text as string, width: underlineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '80%'] }) }]} />
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, minWidth: 52, gap: 2 },
  day:       { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: FONTS.sansMedium },
  date:      { fontSize: 20, letterSpacing: -0.3, fontFamily: FONTS.bebas },
  month:     { fontSize: 10, fontFamily: FONTS.sans },
  underline: { height: 2.5, borderRadius: 2, marginTop: 4, alignSelf: 'center' },
});

// ─── Bottom CTA ────────────────────────────────────────────────────────────────
function BottomCTA({ label, onPress, disabled, loading, price, wrapStyle, labelStyle, glow }: {
  label:       string;
  onPress:     () => void;
  disabled?:   boolean;
  loading?:    boolean;
  price?:      number;
  wrapStyle?:  object;
  labelStyle?: object;
  glow?:       boolean;
}) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const springIn  = () => { if (disabled || loading) return; Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };
  const springOut = () => { Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start(); };
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <View style={[cta.wrap, { backgroundColor: t.ctaBg, borderTopColor: t.ctaBorder }, wrapStyle]}>
      <Animated.View style={[
        { transform: [{ scale }], borderRadius: 55 },
        glow && !disabled && {
          shadowColor: t.accent as string,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          elevation: 10,
        },
      ]}>
        <Pressable
          onPressIn={springIn}
          onPressOut={springOut}
          onPress={handlePress}
          disabled={disabled || loading}
          style={[cta.btn, { backgroundColor: t.accent }, disabled && [cta.btnDisabled, { opacity: 0.4 }]]}
          accessibilityLabel={label}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={t.accentText as string} />
          ) : (
            <View style={cta.inner}>
              <Text style={[cta.label, { color: t.accentText }, disabled && [cta.labelDisabled, { color: t.textMuted }], labelStyle]}>{label}</Text>
              {price !== undefined && price > 0 ? (
                <View style={cta.priceBadge}>
                  <Text style={[cta.priceText, { color: t.accentText }]}>{price} €</Text>
                </View>
              ) : (
                <Feather name="arrow-right" size={20} color={disabled ? t.textMuted as string : t.accentText as string} />
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const cta = StyleSheet.create({
  wrap:          { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, borderTopWidth: 1 },
  btn:           { borderRadius: 55, height: 55, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:   {},
  inner:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%' },
  label:         { fontSize: 17, fontFamily: FONTS.sansMedium, textAlign: 'center', flex: 1 },
  labelDisabled: {},
  priceBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  priceText:     { fontSize: 15, fontFamily: FONTS.bebas },
});

// ─── Helpers date ──────────────────────────────────────────────────────────────
function buildNextDays(t: any, count = 10) {
  const days: { day: string; date: string; month: string; iso: string }[] = [];
  const dayNames   = [t('stepper.day_sun'), t('stepper.day_mon'), t('stepper.day_tue'), t('stepper.day_wed'), t('stepper.day_thu'), t('stepper.day_fri'), t('stepper.day_sat')];
  const monthNames = [t('stepper.month_jan'), t('stepper.month_feb'), t('stepper.month_mar'), t('stepper.month_apr'), t('stepper.month_may'), t('stepper.month_jun'), t('stepper.month_jul'), t('stepper.month_aug'), t('stepper.month_sep'), t('stepper.month_oct'), t('stepper.month_nov'), t('stepper.month_dec')];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      day:   i === 0 ? t('stepper.today') : dayNames[d.getDay()],
      date:  String(d.getDate()),
      month: monthNames[d.getMonth()],
      iso:   d.toISOString().split('T')[0],
    });
  }
  return days;
}

const getTimeGroups = (t: any) => [
  { label: t('stepper.morning'),    slots: ['08:00', '09:00', '10:00', '11:00'] },
  { label: t('stepper.afternoon'),  slots: ['14:00', '15:00', '16:00', '17:00'] },
  { label: t('stepper.evening'),    slots: ['18:00', '19:00'] },
];

// ─── Devis Info Modal ────────────────────────────────────────────────────────
function DevisInfoModal({ visible, onClose, pricingMode, theme }: {
  visible: boolean;
  onClose: () => void;
  pricingMode: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const steps = [
    { num: '1', title: 'Visite de diagnostic', sub: 'Le prestataire arrive et évalue les travaux' },
    { num: '2', title: 'Devis envoyé',         sub: 'Vous recevez une estimation détaillée in-app' },
    { num: '3', title: 'Vous choisissez',      sub: 'Acceptez ou refusez sans obligation' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={[dim.sheet, { backgroundColor: theme.card, borderRadius: 24 }]}>

            {/* Header */}
            <View style={dim.header}>
              <View style={dim.titleRow}>
                <View style={dim.iconWrap}>
                  <Feather name={pricingMode === 'diagnostic' ? 'search' : 'file-text'} size={20} color={COLORS.amber} />
                </View>
                <Text style={[dim.title, { color: theme.text }]}>
                  {pricingMode === 'diagnostic' ? 'Diagnostic sur place' : 'Estimation sur place'}
                </Text>
              </View>
              <Text style={[dim.subtitle, { color: theme.textSub }]}>
                Le prestataire se déplace, évalue les travaux et vous envoie un devis détaillé.
              </Text>
            </View>

            <View style={[dim.divider, { backgroundColor: theme.sep }]} />

            {/* Steps */}
            <View style={dim.steps}>
              {steps.map((item, i) => (
                <View key={i} style={dim.stepRow}>
                  {/* Colonne gauche : numéro + connecteur */}
                  <View style={dim.stepLeft}>
                    <View style={[dim.numCircle, {
                      backgroundColor: i === 0 ? 'rgba(200,130,10,0.2)' : theme.surface,
                      borderColor:     i === 0 ? 'rgba(200,130,10,0.5)' : theme.sep,
                    }]}>
                      <Text style={[dim.numText, { color: i === 0 ? COLORS.amber : theme.textSub }]}>{item.num}</Text>
                    </View>
                    {i < steps.length - 1 && <View style={[dim.connector, { backgroundColor: theme.sep }]} />}
                  </View>
                  {/* Contenu */}
                  <View style={[dim.stepContent, i < steps.length - 1 && { paddingBottom: 24 }]}>
                    <Text style={[dim.stepTitle, { color: i === 0 ? COLORS.amber : theme.text }]}>{item.title}</Text>
                    <Text style={[dim.stepSub, { color: theme.textMuted as string }]}>{item.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity style={[dim.closeBtn, { backgroundColor: theme.accent }]} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
              <Text style={[dim.closeBtnText, { color: theme.accentText, fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 2 }]}>Compris</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const dim = StyleSheet.create({
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, paddingTop: 14 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  header:       { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,130,10,0.15)', borderWidth: 1, borderColor: 'rgba(200,130,10,0.3)' },
  title:        { fontSize: 18, fontFamily: FONTS.sansMedium, letterSpacing: -0.2 },
  subtitle:     { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 19, opacity: 0.7 },
  divider:      { height: 1, marginHorizontal: 24, marginBottom: 24 },
  steps:        { paddingHorizontal: 24, marginBottom: 32 },
  stepRow:      { flexDirection: 'row', gap: 14 },
  stepLeft:     { alignItems: 'center', width: 28 },
  connector:    { flex: 1, width: 1, marginTop: 6 },
  numCircle:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
  numText:      { fontSize: 12, fontFamily: FONTS.mono },
  stepContent:  { flex: 1, gap: 3, paddingTop: 4 },
  stepTitle:    { fontSize: 15, fontFamily: FONTS.sansMedium },
  stepSub:      { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 18 },
  closeBtn:     { marginHorizontal: 24, borderRadius: 55, height: 54, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, fontFamily: FONTS.sansMedium },
  // legacy
  step:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 16, zIndex: 1 },
  line:         { position: 'absolute', left: 34, top: 22, bottom: 0, width: 1 },
  stepText:     { fontSize: 14, fontFamily: FONTS.sans, lineHeight: 20, paddingTop: 2 },
});

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function NewRequestStepper() {
  const router = useRouter();
  const theme  = useTheme();
  const { t }  = useTranslation();
  const { user } = useAuth();
  const {
    selectedCategory: preselectedCategory,
    preferredProviderId,
    preferredProviderName,
    forceScheduled,
  } = useLocalSearchParams<{
    selectedCategory?: string;
    preferredProviderId?: string;
    preferredProviderName?: string;
    forceScheduled?: string;
  }>();
  const mapRef    = useRef<MapView | null>(null);
  const step2ScrollRef = useRef<ScrollView>(null);
  const catLayoutsRef  = useRef<Record<number, number>>({});
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Préférence prestataire (CTA "Demander X" depuis fiche provider) ──
  // Stockée localement pour permettre au client de retirer la préférence en
  // cours de stepper s'il change d'avis (banner avec X).
  const [preferred, setPreferred] = useState<{ id: string; name: string } | null>(
    preferredProviderId ? { id: preferredProviderId, name: preferredProviderName || 'ce prestataire' } : null,
  );

  // Étape 1
  const [location, setLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [locationAllowed, setLocationAllowed] = useState<boolean>(true);
  const [addressMissingNumber, setAddressMissingNumber] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddrDropdown, setShowAddrDropdown] = useState(false);

  // ── Phase test : zones autorisées seulement ──────────────────────────────
  const ALLOWED_POSTAL = ['1050', '1060', '1180'];
  const ALLOWED_COMMUNES = ['ixelles', 'saint-gilles', 'uccle', 'elsene', 'sint-gillis'];
  function checkLocation(description: string, addressComponents?: any[]): boolean {
    const postalComp = addressComponents?.find((c: any) => c.types.includes('postal_code'));
    const postal = postalComp?.short_name || postalComp?.long_name || '';
    if (ALLOWED_POSTAL.includes(postal)) return true;
    const lower = description.toLowerCase();
    return ALLOWED_COMMUNES.some(c => lower.includes(c));
  }

  // ── Saved addresses fetch ──
  useEffect(() => {
    if (step === 1) {
      api.addresses.list().then((res: any) => {
        setSavedAddresses(Array.isArray(res) ? res : res?.data || []);
      }).catch(() => {});
    }
  }, [step]);

  // Save new address from "+" button (with label sheet)
  const handleSaveNewAddress = async () => {
    if (!location || !saveLabel.trim()) return;
    setSaving(true);
    try {
      const created: any = await api.addresses.create({
        label: saveLabel.trim(),
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      });
      setSavedAddresses(prev => [created, ...prev]);
      setShowSaveSheet(false);
      setSaveLabel('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('addresses.max_reached'));
    } finally {
      setSaving(false);
    }
  };

  // Étape 2
  const [categories,    setCategories]    = useState<any[]>([]);
  const [categoryId,    setCategoryId]    = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description,   setDescription]  = useState('');
  const [noteOpen,      setNoteOpen]      = useState(false);

  // Étape 3
  const days = useMemo(() => buildNextDays(t, 10), [t]);
  // Si l'utilisateur a choisi "Planifier avec X" (preferred busy/offline), on
  // pré-positionne le mode "later" pour qu'il sélectionne directement une date.
  const [scheduleMode,   setScheduleMode]   = useState<'now' | 'later' | null>(
    forceScheduled === '1' ? 'later' : null,
  );
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedTime,   setSelectedTime]   = useState<string | null>(null);
  const [isUrgent,       setIsUrgent]       = useState(false);

  // Infos d'accès (profil client enrichi)
  const [accessExpanded,  setAccessExpanded]  = useState(false);
  const [buildingType,    setBuildingType]    = useState<string | null>((user as any)?.buildingType || null);
  const [floorNum,        setFloorNum]        = useState<string>((user as any)?.floor != null ? String((user as any).floor) : '');
  const [hasElevator,     setHasElevator]     = useState<boolean | null>((user as any)?.hasElevator ?? null);
  // accessNotes (digicode/instructions) NE doit PAS être pré-rempli depuis User :
  // c'est une info contextuelle à chaque mission (code change, instructions ponctuelles,
  // « laisser au gardien », etc.). Re-saisie obligatoire à chaque demande pour éviter
  // de propager par erreur les instructions d'une mission précédente.
  const [accessNotes,     setAccessNotes]     = useState<string>('');
  const [clientLanguage,  setClientLanguage]  = useState<string | null>((user as any)?.language || null);

  // Dérivés
  const selectedCategory    = useMemo(() => categories.find((c) => c.id === categoryId) || null, [categories, categoryId]);
  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories?.find((s: any) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId]
  );
  const basePrice       = selectedSubcategory?.basePrice || selectedSubcategory?.price || selectedCategory?.price || 0;
  const pricingMode     = selectedSubcategory?.pricingMode || 'fixed_forfait';
  const calloutFee      = selectedSubcategory?.calloutFee || 0; // EUR
  const isFreeService   = pricingMode === 'free' || (basePrice === 0 && !['estimate', 'diagnostic'].includes(pricingMode));
  const isQuoteFlow     = pricingMode === 'estimate' || pricingMode === 'diagnostic';
  const serviceName     = selectedSubcategory?.name  || selectedCategory?.name  || null;
  const scheduledLabel  = scheduleMode === 'now'
    ? t('stepper.now')
    : (selectedDayIso && selectedTime
      ? `${days.find(d => d.iso === selectedDayIso)?.day} ${days.find(d => d.iso === selectedDayIso)?.date} à ${selectedTime}`
      : null);
  const scheduledFor = scheduleMode === 'now'
    ? new Date().toISOString()
    : (selectedDayIso && selectedTime
      ? new Date(`${selectedDayIso}T${selectedTime}:00`).toISOString()
      : null);
  // Pour "now", on fixe la date au moment du choix (pas à chaque render)
  const requestDateIso  = useMemo(() => {
    if (scheduleMode === 'now') return new Date().toISOString();
    if (selectedDayIso && selectedTime) return new Date(`${selectedDayIso}T${selectedTime}:00`).toISOString();
    return new Date().toISOString();
  }, [scheduleMode, selectedDayIso, selectedTime]);
  const priceDetails    = useMemo(() => computePrice({
    baseRate:    basePrice,
    hours:       1,
    isUrgent,
    distanceKm:  0,
    useFlatTravel: true,
    requestDate: new Date(requestDateIso),
    isFlat:      true,
    flatAmount:  basePrice,
  }), [basePrice, isUrgent, requestDateIso]);
  const estimatedPrice  = parseFloat(priceDetails.totalTVAC);
  const urgencySurcharge = parseFloat(priceDetails.urgentFee);
  const step3Ready = scheduleMode === 'now' || (scheduleMode === 'later' && !!selectedDayIso && !!selectedTime);

  // Chargement catégories
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/categories');
        const all = extractArrayPayload(response);
        // Phase test — seulement Plomberie et Serrurerie
        const LAUNCH_SLUGS = ['plomberie', 'serrurerie'];
        const LAUNCH_NAMES = ['plomberie', 'serrurerie'];
        const filtered = all.filter((c: any) =>
          LAUNCH_SLUGS.includes(c.slug?.toLowerCase()) ||
          LAUNCH_NAMES.some(n => c.name?.toLowerCase().includes(n))
        );
        setCategories(filtered.length > 0 ? filtered : all);
      } catch (e) {
        devError('Categories load error:', e);
      }
    })();
  }, []);

  // Auto-sélection catégorie depuis param
  useEffect(() => {
    if (!preselectedCategory || categories.length === 0 || categoryId) return;
    const match = categories.find(
      (c) => c.name?.toLowerCase().includes(preselectedCategory.toLowerCase()) ||
             c.slug?.toLowerCase() === preselectedCategory.toLowerCase()
    );
    if (match) setCategoryId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, preselectedCategory]);

  // Transition animée
  const animateStep = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(cb, 100);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Save access info to user profile when leaving Step 3.
    // ⚠️ accessNotes EXCLU volontairement : c'est une info per-mission (digicode,
    // instructions ponctuelles) qui n'a pas vocation à devenir un défaut profil.
    // Le snapshot per-mission est géré via accessSnapshot dans le payload de création.
    if (step === 3) {
      const profileUpdate: Record<string, unknown> = {};
      if (buildingType)                         profileUpdate.buildingType = buildingType;
      if (floorNum.trim())                      profileUpdate.floor        = parseInt(floorNum, 10) || null;
      if (hasElevator !== null)                  profileUpdate.hasElevator  = hasElevator;
      if (clientLanguage)                        profileUpdate.language     = clientLanguage;
      if (Object.keys(profileUpdate).length > 0) {
        api.patch('/me', profileUpdate).catch(() => {});
      }
    }
    animateStep(() => setStep((p) => Math.min(p + 1, TOTAL_STEPS)));
  };
  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    } else {
      animateStep(() => setStep((p) => p - 1));
    }
  };

  // Étape 4 — paiement
  const [devisModalVisible, setDevisModalVisible] = useState(false);
  const [requestId,          setRequestId]         = useState<string | null>(null);
  const [paymentReady,       setPaymentReady]       = useState(false);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);
  const [priceDetailOpen,    setPriceDetailOpen]    = useState(false);
  const [pricingToken,       setPricingToken]       = useState<string | null>(null);
  const [serverPrice,        setServerPrice]        = useState<ReturnType<typeof computePrice> | null>(null);
  const [pricingError,       setPricingError]       = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [confirmedCalloutCents, setConfirmedCalloutCents] = useState<number | null>(null);

  // Reset prix/paiement quand l'utilisateur change de service
  useEffect(() => {
    setServerPrice(null);
    setPaymentReady(false);
    setPricingToken(null);
    setRequestId(null);
    setConfirmedCalloutCents(null);
  }, [subcategoryId, categoryId]);

  // Prix affiché = prix serveur (si disponible) ou estimation client
  const displayPrice = serverPrice || priceDetails;
  const displayTotal = parseFloat(displayPrice.totalTVAC);

  // Snapshot des infos d'accès pour cette mission spécifique (évite que les
  // missions partagent toutes les mêmes valeurs via User.* qui sert de défaut).
  const accessSnapshot = useMemo<Record<string, unknown>>(() => {
    const snap: Record<string, unknown> = {};
    if (buildingType) snap.accessBuildingType = buildingType;
    const f = parseInt(floorNum, 10);
    if (Number.isFinite(f)) snap.accessFloor = f;
    if (hasElevator !== null) snap.accessHasElevator = hasElevator;
    if (accessNotes.trim()) snap.accessNotes = accessNotes.trim();
    if (clientLanguage) snap.clientLanguage = clientLanguage;
    return snap;
  }, [buildingType, floorNum, hasElevator, accessNotes, clientLanguage]);

  useEffect(() => {
    if (step !== 4 || !selectedCategory || !location || paymentReady) return;
    let cancelled = false;
    (async () => {
      setPaymentInitLoading(true);
      setPricingError(null);
      try {
        const serviceType = selectedSubcategory?.name || selectedCategory.name;

        // ── Service gratuit → skip pricing lock + skip payment ──
        if (isFreeService) {
          const payload: Record<string, unknown> = {
            title:        serviceType,
            description:  description || `Service de ${serviceType}`,
            serviceType,
            categoryId:   selectedCategory.id,
            ...(subcategoryId && { subcategoryId }),
            price:        0,
            address:      location.address,
            lat:          location.lat,
            lng:          location.lng,
            urgent:       false,
            scheduledFor: scheduledFor || new Date().toISOString(),
            pricingMode:  'free',
            ...(preferred?.id ? { preferredProviderId: preferred.id } : {}),
            ...accessSnapshot,
          };
          const reqRes = await api.post('/requests', payload);
          const rId = reqRes.id || reqRes.data?.id;
          if (!rId) throw new Error('Request ID manquant');
          if (cancelled) return;
          setRequestId(rId);
          setPaymentReady(true);
          return;
        }

        // ── Flow devis : pas de prix à verrouiller — le callout fee vient de la subcategory ──
        if (isQuoteFlow) {
          const payload: Record<string, unknown> = {
            title:        serviceType,
            description:  description || `Service de ${serviceType}`,
            serviceType,
            categoryId:   selectedCategory.id,
            ...(subcategoryId && { subcategoryId }),
            price:        0,
            address:      location.address,
            lat:          location.lat,
            lng:          location.lng,
            urgent:       isUrgent,
            scheduledFor: scheduledFor || new Date().toISOString(),
            status:       'PENDING_PAYMENT', // → QUOTE_PENDING après confirmation webhook Stripe
            pricingMode,
            ...(preferred?.id ? { preferredProviderId: preferred.id } : {}),
            ...accessSnapshot,
          };
          const reqRes = await api.post('/requests', payload);
          const rId    = reqRes.id || reqRes.data?.id;
          if (!rId) throw new Error('Request ID manquant');
          if (cancelled) return;
          setRequestId(rId);
          const calloutRes = await api.post('/quotes/callout-payment', { requestId: rId });
          if (calloutRes.amount) setConfirmedCalloutCents(calloutRes.amount);
          const { error } = await initPaymentSheet({
            merchantDisplayName:      'Fixed',
            paymentIntentClientSecret: calloutRes.clientSecret,
            applePay:  { merchantCountryCode: 'BE' },
            googlePay: { merchantCountryCode: 'BE', testEnv: false },
            paymentMethodOrder: ['apple_pay', 'card', 'klarna', 'revolut_pay'],
          });
          if (!error && !cancelled) setPaymentReady(true);
          return;
        }

        // ── Flow prix fixe : verrouiller le prix côté serveur ──
        const lockRes = await api.post('/pricing/lock', {
          categoryId:   selectedCategory.id,
          ...(subcategoryId && { subcategoryId }),
          isUrgent,
          scheduledFor: scheduledFor || new Date().toISOString(),
          pricingMode,
        });
        if (cancelled) return;
        setPricingToken(lockRes.pricingToken);
        setServerPrice(lockRes.price);

        const payload: Record<string, unknown> = {
          title:        serviceType,
          description:  description || `Service de ${serviceType}`,
          serviceType,
          categoryId:   selectedCategory.id,
          ...(subcategoryId && { subcategoryId }),
          price:        parseFloat(lockRes.price.totalTVAC),
          address:      location.address,
          lat:          location.lat,
          lng:          location.lng,
          urgent:       isUrgent,
          scheduledFor: scheduledFor || new Date().toISOString(),
          status:       'PENDING_PAYMENT',
          pricingMode,
          pricingToken: lockRes.pricingToken,
          ...(preferred?.id ? { preferredProviderId: preferred.id } : {}),
          ...accessSnapshot,
        };
        const reqRes = await api.post('/requests', payload);
        const rId    = reqRes.id || reqRes.data?.id;
        if (!rId) throw new Error('Request ID manquant');
        if (cancelled) return;
        setRequestId(rId);

        // Initialiser le payment sheet — prix fixe (DIRECT_CHARGE flow).
        // Le client est d\u00e9bit\u00e9 imm\u00e9diatement via PaymentIntent; le backend
        // transf\u00e8rera 80% au prestataire \u00e0 l'acceptation, et refund si aucun
        // prestataire n'accepte dans le TTL du cron.
        // automatic_payment_methods c\u00f4t\u00e9 backend => Stripe expose Card, Klarna,
        // Bancontact, Apple Pay, Google Pay selon montant/r\u00e9gion. On ne force plus
        // d'ordre pour laisser Stripe prioriser la m\u00e9thode la plus pertinente.
        const res: any = await api.payments.setup(rId);
        const clientSecret = res.paymentIntentClientSecret || res.setupIntentClientSecret;
        const { error } = await initPaymentSheet({
          merchantDisplayName:        'Fixed',
          paymentIntentClientSecret:  clientSecret,
          customerEphemeralKeySecret: res.ephemeralKey,
          customerId:                 res.customer,
          applePay:  { merchantCountryCode: 'BE' },
          googlePay: { merchantCountryCode: 'BE', testEnv: false },
          paymentMethodOrder: ['apple_pay', 'card', 'klarna', 'revolut_pay'],
        });
        if (!error && !cancelled) setPaymentReady(true);
      } catch (e: any) {
        if (!cancelled) {
          devError('Payment init error:', e);
          setPricingError(e?.message || 'Erreur lors du calcul du prix');
        }
      } finally {
        if (!cancelled) setPaymentInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Confirme le paiement côté backend avec retry (max 3 tentatives, backoff 1s/2s)
  const confirmPaymentSuccess = async (rId: string | number): Promise<void> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!mountedRef.current) return;
      try {
        await api.payments.success(String(rId));
        return;
      } catch (e: any) {
        lastErr = e;
        // Don't retry on auth errors — session is gone, retrying is pointless
        if (e.status === 401 || e.status === 403) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
    if (!mountedRef.current) return;
    // Paiement déjà prélevé côté Stripe → ne pas laisser l'utilisateur bloqué
    Alert.alert(
      t('stepper.payment_received'),
      t('stepper.payment_retry'),
      [{ text: t('common.retry'), onPress: () => { if (mountedRef.current) confirmPaymentSuccess(rId).then(goToMissionView); } }],
    );
    throw lastErr;
  };

  const goToMissionView = () => {
    if (scheduleMode === 'later') {
      // Requête planifiée → page de confirmation (pas de recherche de provider)
      // Pour un devis, le client n'a payé QUE le callout fee — pas le prix total.
      // On passe isQuote + calloutFee pour que l'écran n'affiche pas un faux prix.
      router.replace({
        pathname: '/request/[id]/scheduled',
        params: {
          id:             String(requestId),
          serviceName:    serviceName    || '',
          address:        location?.address  || '',
          price:          isQuoteFlow ? '' : String(estimatedPrice),
          calloutFee:     isQuoteFlow && confirmedCalloutCents != null
            ? (confirmedCalloutCents / 100).toFixed(2)
            : '',
          isQuote:        isQuoteFlow ? '1' : '',
          scheduledLabel: scheduledLabel || '',
          lat:            String(location?.lat  ?? ''),
          lng:            String(location?.lng  ?? ''),
        },
      });
    } else {
      router.replace({
        pathname: '/request/[id]/missionview',
        params: {
          id:             String(requestId),
          serviceName:    serviceName    || '',
          address:        location?.address  || '',
          price:          String(estimatedPrice),
          scheduledLabel: scheduledLabel || t('stepper.now'),
          lat:            String(location?.lat  ?? ''),
          lng:            String(location?.lng  ?? ''),
        },
      });
    }
  };

  const handlePay = async () => {
    if (!paymentReady || !requestId) return;
    setLoading(true);
    try {
      // Service gratuit → pas de payment sheet, publication directe
      if (isFreeService) {
        await api.payments.success(String(requestId)).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        goToMissionView();
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') devError('Payment sheet error:', presentError.message);
        return;
      }

      if (isQuoteFlow) {
        // Confirmer le callout et lancer le broadcast aux providers
        try {
          await api.post('/quotes/confirm-callout', { requestId });
        } catch (e: any) {
          devError('confirm-callout error:', e);
          Alert.alert(
            t('stepper.error_title') || 'Erreur',
            t('stepper.callout_confirm_failed') || 'Impossible de confirmer le paiement. Réessayez.',
          );
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        goToMissionView();
      } else {
        await confirmPaymentSuccess(requestId);
        goToMissionView();
      }
    } catch (error: any) {
      devError('handlePay error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePayment = async () => {
    if (!paymentReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await presentPaymentSheet();
  };

  const STEPS = getStepConfig(t);
  const TIME_GROUPS = getTimeGroups(t);
  const currentStep = STEPS[step - 1] || STEPS[STEPS.length - 1];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerSide}>
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('common.back')} accessibilityRole="button">
            <Feather name="arrow-left" size={22} color={theme.text as string} />
          </TouchableOpacity>
        </View>

        <View style={s.headerCenter}>
          <Text style={[s.stepName, { color: theme.text }]}>{currentStep.label}</Text>
        </View>

        <View style={s.headerSide} />
      </View>

      {/* ── Step Indicator ── */}
      <StepIndicator step={step} />

      {/* ── Préférence prestataire (CTA "Demander X" depuis fiche) ── */}
      {preferred && (
        <View style={[s.preferredBanner, { backgroundColor: theme.surface, borderColor: theme.sep }]}>
          <Feather name="user-check" size={14} color={theme.text as string} />
          <Text style={[s.preferredBannerText, { color: theme.text, fontFamily: FONTS.sans }]}>
            Demander en priorité à <Text style={{ fontFamily: FONTS.sansMedium }}>{preferred.name}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setPreferred(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Retirer la préférence"
          >
            <Feather name="x" size={16} color={theme.textMuted as string} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Live Summary ── */}
      {step >= 2 && step < 4 && (
        <LiveSummary
          location={location}
          serviceName={step >= 3 ? serviceName : null}
          scheduledLabel={step >= 4 ? scheduledLabel : null}
        />
      )}

      {/* ── Contenu animé ── */}
      <Animated.View style={[s.flex, { opacity: fadeAnim }]}>

        {/* ══ ÉTAPE 1 — Lieu ══ */}
        {step === 1 && (
          <View style={s.flex}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFillObject}
              initialRegion={DEFAULT_REGION}
              customMapStyle={theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_SILVER}
              showsUserLocation
              showsMyLocationButton={false}
              showsPointsOfInterest={false}
              showsBuildings={false}
            >
              {location && (
                <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(52,199,89,0.2)' }} />
                    <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green, borderWidth: 2, borderColor: '#FFFFFF' }} />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Barre de recherche flottante */}
            <View style={s.searchFloat}>
              <View style={[s.searchBox, { backgroundColor: theme.searchBoxBg }]}>
                <Feather name="search" size={18} color={theme.textSub as string} />
                <GooglePlacesAutocomplete
                  placeholder={t('stepper.enter_address')}
                  fetchDetails
                  onPress={(data, details = null) => {
                    if (details) {
                      const { lat, lng } = details.geometry.location;
                      const allowed = checkLocation(data.description, details.address_components);
                      const hasStreetNumber = details.address_components?.some((c: any) => c.types.includes('street_number'));
                      setLocation({ address: data.description, lat, lng });
                      setLocationAllowed(allowed);
                      setAddressMissingNumber(!hasStreetNumber);
                      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                      Haptics.notificationAsync(allowed && hasStreetNumber ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                    }
                  }}
                  query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:be', location: '50.8333,4.3333', radius: 15000, strictbounds: true }}
                  styles={{
                    container:          { flex: 1, marginLeft: 8, overflow: 'visible', zIndex: 999 },
                    textInputContainer: { backgroundColor: 'transparent' },
                    textInput: {
                      height:          36,
                      fontSize:        15,
                      fontFamily:      FONTS.sansMedium,
                      color:           theme.text as string,
                      backgroundColor: 'transparent',
                      padding:         0,
                      margin:          0,
                    },
                    listView: {
                      position:      'absolute',
                      top:           54,
                      left:          -42,
                      right:         -16,
                      backgroundColor: theme.dropdownBg as string,
                      borderRadius:  20,
                      shadowColor:   '#000',
                      shadowOpacity: 0.15,
                      shadowRadius:  24,
                      shadowOffset:  { width: 0, height: 8 },
                      elevation:     20,
                      zIndex:        999,
                    },
                    row:         { backgroundColor: theme.dropdownRow as string, paddingVertical: 14, paddingHorizontal: 18 },
                    description: { fontSize: 14, color: theme.text as string, fontFamily: FONTS.sans },
                    separator:   { backgroundColor: theme.dropdownSep as string, height: 1 },
                  }}
                  textInputProps={{
                    placeholderTextColor: theme.textPlaceholder as string,
                    onFocus: () => setShowAddrDropdown(false),
                  }}
                  enablePoweredByContainer={false}
                  listViewDisplayed="auto"
                  keyboardShouldPersistTaps="handled"
                />
                {/* Saved addresses / save actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                  {savedAddresses.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setShowAddrDropdown(prev => !prev)}
                      activeOpacity={0.7}
                      style={{ padding: 8 }}
                    >
                      <Feather name="bookmark" size={18} color={showAddrDropdown ? (theme.text as string) : (theme.textMuted as string)} />
                    </TouchableOpacity>
                  )}
                  {savedAddresses.length > 0 && location && savedAddresses.length < 10 && !savedAddresses.some((a: any) => a.address === location.address) && (
                    <View style={{ width: 1, height: 16, backgroundColor: theme.sep as string, marginHorizontal: 2 }} />
                  )}
                  {location && savedAddresses.length < 10 && !savedAddresses.some((a: any) => a.address === location.address) && (
                    <TouchableOpacity
                      onPress={() => setShowSaveSheet(true)}
                      activeOpacity={0.7}
                      style={{ padding: 8 }}
                    >
                      <Feather name="plus-circle" size={18} color={theme.textMuted as string} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Saved addresses dropdown */}
              {showAddrDropdown && savedAddresses.length > 0 && (
                <View style={{
                  position: 'absolute', top: 62, left: 0, right: 0, zIndex: 60,
                  backgroundColor: theme.dropdownBg as string,
                  borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1, borderColor: theme.surfaceBorder as string,
                  shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
                }}>
                  {savedAddresses.map((addr: any, i: number) => {
                    const lbl = (addr.label || '').toLowerCase();
                    const icon = lbl.includes('domicile') || lbl.includes('home') || lbl.includes('maison')
                      ? 'home' : lbl.includes('bureau') || lbl.includes('office') || lbl.includes('travail')
                      ? 'briefcase' : 'map-pin';
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        onPress={() => {
                          setLocation({ address: addr.address, lat: addr.lat, lng: addr.lng });
                          setLocationAllowed(checkLocation(addr.address));
                          setAddressMissingNumber(false);
                          setShowAddrDropdown(false);
                          mapRef.current?.animateToRegion({ latitude: addr.lat, longitude: addr.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          paddingHorizontal: 16, paddingVertical: 12,
                          borderBottomWidth: i < savedAddresses.length - 1 ? 1 : 0,
                          borderBottomColor: theme.dropdownSep as string,
                        }}
                      >
                        <Feather name={icon as any} size={16} color={theme.textMuted as string} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text as string }}>{addr.label}</Text>
                          <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: theme.textMuted as string, marginTop: 1 }} numberOfLines={1}>{addr.address}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {location && !locationAllowed && (
                <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
                  <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
                  <Text style={[s.addrText, { color: COLORS.orangeBrand, flex: 1 }]} numberOfLines={2}>
                    {'Zone test : Ixelles, Saint-Gilles et Uccle uniquement'}
                  </Text>
                </View>
              )}
              {location && addressMissingNumber && (
                <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
                  <Feather name="alert-circle" size={16} color={COLORS.orangeBrand} />
                  <Text style={[s.addrText, { color: COLORS.orangeBrand, flex: 1 }]} numberOfLines={2}>
                    {'Veuillez préciser le numéro d\'immeuble'}
                  </Text>
                </View>
              )}
            </View>

            <LinearGradient
              colors={[`${theme.bg}00`, theme.bg as string, theme.bg as string]}
              locations={[0, 0.35, 1]}
              style={s.ctaFloating}
              pointerEvents="box-none"
            >
              <BottomCTA
                label={location ? t('stepper.confirm_address') : t('stepper.select_address')}
                onPress={goNext}
                disabled={!location || !locationAllowed || addressMissingNumber}
                wrapStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0 }}
              />
            </LinearGradient>

          </View>
        )}

        {/* Rename / Save address sheet */}
        {showSaveSheet && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100,
          }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSaveSheet(false)} activeOpacity={1} />
            <View style={{
              backgroundColor: theme.card as string, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
              borderTopWidth: 1, borderTopColor: theme.cardBorder as string,
            }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: theme.sep as string, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

              {/* Title */}
              <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, color: theme.text as string, letterSpacing: 1, marginBottom: 6 }}>
                NOMMER CETTE ADRESSE
              </Text>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.textMuted as string, marginBottom: 20 }} numberOfLines={1}>
                {location?.address || ''}
              </Text>

              {/* Quick chips with icons */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setSaveLabel('Domicile')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: saveLabel === 'Domicile' ? (theme.accent as string) : (theme.surface as string),
                    borderWidth: 1, borderColor: saveLabel === 'Domicile' ? (theme.accent as string) : (theme.surfaceBorder as string),
                  }}
                >
                  <Feather name="home" size={14} color={saveLabel === 'Domicile' ? (theme.accentText as string) : (theme.text as string)} />
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Domicile' ? (theme.accentText as string) : (theme.text as string) }}>Domicile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSaveLabel('Bureau')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: saveLabel === 'Bureau' ? (theme.accent as string) : (theme.surface as string),
                    borderWidth: 1, borderColor: saveLabel === 'Bureau' ? (theme.accent as string) : (theme.surfaceBorder as string),
                  }}
                >
                  <Feather name="briefcase" size={14} color={saveLabel === 'Bureau' ? (theme.accentText as string) : (theme.text as string)} />
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Bureau' ? (theme.accentText as string) : (theme.text as string) }}>Bureau</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSaveLabel('Autre')}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: saveLabel === 'Autre' ? (theme.accent as string) : (theme.surface as string),
                    borderWidth: 1, borderColor: saveLabel === 'Autre' ? (theme.accent as string) : (theme.surfaceBorder as string),
                  }}
                >
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Autre' ? (theme.accentText as string) : (theme.text as string) }}>Autre</Text>
                </TouchableOpacity>
              </View>

              {/* Custom input */}
              <TextInput
                value={saveLabel}
                onChangeText={setSaveLabel}
                placeholder={"Ou un nom personnalisé..."}
                placeholderTextColor={theme.textMuted as string}
                style={{
                  fontFamily: FONTS.sans, fontSize: 15, color: theme.text as string,
                  backgroundColor: theme.surface as string, borderRadius: 12,
                  borderWidth: 1, borderColor: theme.surfaceBorder as string,
                  paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
                }}
                maxLength={50}
              />

              {/* Save CTA */}
              <TouchableOpacity
                onPress={handleSaveNewAddress}
                disabled={!saveLabel.trim() || saving}
                activeOpacity={0.85}
                style={{
                  backgroundColor: theme.accent as string, borderRadius: 16, height: 52,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: !saveLabel.trim() || saving ? 0.4 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 16, color: theme.accentText as string }}>
                  {saving ? t('common.saving') : t('addresses.save_address')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══ ÉTAPE 2 — Service ══ */}
        {step === 2 && (
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
            <View style={s.flex}>
            <ScrollView ref={step2ScrollRef} style={s.flex} contentContainerStyle={s.step2Pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[s.step2Title, { color: theme.text }]}>{t('stepper.what_do_you_need')}</Text>

              {categories.length === 0 ? (
                <View style={s.loadWrap}>
                  <ActivityIndicator size="large" color={theme.text as string} />
                  <Text style={[s.loadText, { color: theme.textSub }]}>{t('stepper.loading_services')}</Text>
                </View>
              ) : (
                <View style={s.catList}>
                  {categories.map((cat, catIndex) => {
                    const isSelected = categoryId === cat.id;
                    const isDimmed = categoryId !== null && !isSelected;
                    const subs = isSelected && cat.subcategories?.length > 0 ? cat.subcategories : [];
                    return (
                      <View key={cat.id} onLayout={(e) => { catLayoutsRef.current[catIndex] = e.nativeEvent.layout.y; }}>
                        <CategoryCard
                          cat={cat}
                          selected={isSelected}
                          dimmed={isDimmed}
                          onPress={() => {
                            setCategoryId(cat.id);
                            setSubcategoryId(null);
                            // Scroll to center the selected category
                            setTimeout(() => {
                              const y = catLayoutsRef.current[catIndex] || 0;
                              step2ScrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
                            }, 100);
                          }}
                        />
                        {subs.length > 0 && (
                          <View style={s.inlineSubs}>
                            <View style={s.subHeader}>
                              <Text style={[s.subTitle, { color: theme.text }]}>{t('stepper.specify')}</Text>
                              {estimatedPrice > 0 && !subcategoryId && (
                                <Text style={[s.priceInline, { color: theme.textSub }]}>{t('stepper.from_price', { price: estimatedPrice })}</Text>
                              )}
                            </View>
                            <View style={s.subList}>
                              {subs.map((sub: any) => (
                                <SubChip
                                  key={sub.id}
                                  label={sub.name}
                                  basePrice={sub.basePrice}
                                  priceMin={sub.priceMin}
                                  priceMax={sub.priceMax}
                                  pricingMode={sub.pricingMode}
                                  calloutFee={sub.calloutFee}
                                  selected={subcategoryId === sub.id}
                                  dimmed={subcategoryId !== null && subcategoryId !== sub.id}
                                  onPress={() => setSubcategoryId(sub.id)}
                                />
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={s.noteToggle} onPress={() => setNoteOpen(p => !p)} activeOpacity={0.7} accessibilityRole="button">
                <Feather name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
                <Text style={[s.noteToggleText, { color: theme.textSub }]}>{t('stepper.add_note')}</Text>
              </TouchableOpacity>

              {noteOpen && (
                <TextInput
                  style={[s.noteInput, { backgroundColor: theme.noteInputBg, borderColor: theme.noteInputBorder, color: theme.text as string }]}
                  placeholder={t('stepper.note_placeholder')}
                  placeholderTextColor={theme.textPlaceholder as string}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                  accessibilityLabel={t('stepper.add_note')}
                />
              )}

              <View style={{ height: 100 }} />
            </ScrollView>

            </View>

            <BottomCTA
              label={isQuoteFlow ? 'Demander un devis' : t('stepper.continue')}
              onPress={goNext}
              disabled={!categoryId}
            />
          </KeyboardAvoidingView>
        )}

        {/* ══ ÉTAPE 3 — Planning ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <ScrollView style={s.flex} contentContainerStyle={s.step3Pad} showsVerticalScrollIndicator={false}>

              <View style={s.modeGrid}>
                {/* Maintenant */}
                <TouchableOpacity
                  style={[s.modeCard, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'now' && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Feather name="zap" size={28} color={scheduleMode === 'now' ? theme.accentText as string : theme.text as string} />
                  <Text style={[s.modeCardLabel, { color: theme.text }, scheduleMode === 'now' && { color: theme.accentText }]}>{t('stepper.now')}</Text>
                  <Text style={[s.modeCardSub, { color: theme.textSub }, scheduleMode === 'now' && { color: `${theme.accentText}99` }]}>{t('stepper.quick_intervention')}</Text>
                </TouchableOpacity>

                {/* Planifier */}
                <TouchableOpacity
                  style={[s.modeCard, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'later' && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScheduleMode('later'); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Feather name="calendar" size={28} color={scheduleMode === 'later' ? theme.accentText as string : theme.text as string} />
                  <Text style={[s.modeCardLabel, { color: theme.text }, scheduleMode === 'later' && { color: theme.accentText }]}>{t('stepper.schedule')}</Text>
                  <Text style={[s.modeCardSub, { color: theme.textSub }, scheduleMode === 'later' && { color: `${theme.accentText}99` }]}>{t('stepper.choose_slot')}</Text>
                </TouchableOpacity>
              </View>

              {/* Mode Plus tard */}
              {scheduleMode === 'later' && (
                <>
                  <View style={{ height: 28 }} />
                  <View style={[s.step3Sep, { backgroundColor: theme.sep }]} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
                    {days.map((d) => (
                      <DayChip
                        key={d.iso}
                        day={d.day}
                        date={d.date}
                        month={d.month}
                        selected={selectedDayIso === d.iso}
                        onPress={() => { setSelectedDayIso(d.iso); setSelectedTime(null); }}
                      />
                    ))}
                  </ScrollView>

                  {!selectedDayIso ? (
                    <Text style={[s.step3Hint, { color: theme.textMuted }]}>{t('stepper.choose_day')}</Text>
                  ) : (
                    TIME_GROUPS.map((group) => (
                      <View key={group.label} style={s.slotGroup}>
                        <Text style={[s.slotGroupLabel, { color: theme.textMuted }]}>{group.label}</Text>
                        <View style={s.slotsRow}>
                          {group.slots.map((slot) => (
                            <TimeSlot key={slot} label={slot} selected={selectedTime === slot} onPress={() => setSelectedTime(slot)} />
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}


              {/* ── Infos d'accès (collapsible) ── */}
              <View style={{ marginTop: 24 }}>
                <View style={[ai.sep, { backgroundColor: theme.sep }]} />
                <TouchableOpacity
                  style={ai.header}
                  onPress={() => setAccessExpanded(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={[ai.headerIcon, { backgroundColor: theme.surface }]}>
                    <Feather name="home" size={16} color={theme.textSub as string} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ai.headerTitle, { color: theme.text }]}>Infos d'accès</Text>
                    <Text style={[ai.headerSub, { color: theme.textMuted }]}>Optionnel — facilite l'intervention</Text>
                  </View>
                  <Feather name={accessExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted as string} />
                </TouchableOpacity>

                {accessExpanded && (
                  <View style={ai.body}>
                    {/* Type de bâtiment */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>TYPE DE BÂTIMENT</Text>
                    <View style={ai.chipRow}>
                      {([
                        { key: 'apartment', label: 'Appartement', icon: 'layers' },
                        { key: 'house',     label: 'Maison',      icon: 'home' },
                        { key: 'office',    label: 'Bureau',      icon: 'briefcase' },
                      ] as const).map(bt => (
                        <TouchableOpacity
                          key={bt.key}
                          style={[
                            ai.chip,
                            { borderColor: buildingType === bt.key ? theme.accent : theme.surfaceBorder },
                            buildingType === bt.key && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => setBuildingType(prev => prev === bt.key ? null : bt.key)}
                          activeOpacity={0.7}
                        >
                          <Feather name={bt.icon as any} size={14} color={buildingType === bt.key ? theme.accentText as string : theme.textSub as string} />
                          <Text style={[ai.chipText, { color: buildingType === bt.key ? theme.accentText : theme.textSub }]}>{bt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Étage + Ascenseur */}
                    <View style={ai.inlineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ai.label, { color: theme.textMuted }]}>ÉTAGE</Text>
                        <View style={[ai.inputWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                          <Feather name="arrow-up" size={14} color={theme.textMuted as string} />
                          <TextInput
                            style={[ai.input, { color: theme.text }]}
                            value={floorNum}
                            onChangeText={setFloorNum}
                            placeholder="Ex: 3"
                            placeholderTextColor={theme.textMuted as string}
                            keyboardType="number-pad"
                            maxLength={3}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ai.label, { color: theme.textMuted }]}>ASCENSEUR</Text>
                        <View style={ai.chipRow}>
                          <TouchableOpacity
                            style={[ai.chip, { borderColor: hasElevator === true ? theme.accent : theme.surfaceBorder }, hasElevator === true && { backgroundColor: theme.accent }]}
                            onPress={() => setHasElevator(prev => prev === true ? null : true)}
                            activeOpacity={0.7}
                          >
                            <Feather name="check" size={14} color={hasElevator === true ? theme.accentText as string : theme.textSub as string} />
                            <Text style={[ai.chipText, { color: hasElevator === true ? theme.accentText : theme.textSub }]}>Oui</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[ai.chip, { borderColor: hasElevator === false ? theme.accent : theme.surfaceBorder }, hasElevator === false && { backgroundColor: theme.accent }]}
                            onPress={() => setHasElevator(prev => prev === false ? null : false)}
                            activeOpacity={0.7}
                          >
                            <Feather name="x" size={14} color={hasElevator === false ? theme.accentText as string : theme.textSub as string} />
                            <Text style={[ai.chipText, { color: hasElevator === false ? theme.accentText : theme.textSub }]}>Non</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Notes d'accès */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>INSTRUCTIONS D'ACCÈS</Text>
                    <View style={[ai.textareaWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                      <TextInput
                        style={[ai.textarea, { color: theme.text }]}
                        value={accessNotes}
                        onChangeText={setAccessNotes}
                        placeholder="Code portail, interphone, parking..."
                        placeholderTextColor={theme.textMuted as string}
                        multiline
                        maxLength={500}
                        textAlignVertical="top"
                      />
                    </View>

                    {/* Langue */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>LANGUE PRÉFÉRÉE</Text>
                    <View style={ai.chipRow}>
                      {([
                        { key: 'fr', label: 'Français' },
                        { key: 'nl', label: 'Nederlands' },
                        { key: 'en', label: 'English' },
                      ] as const).map(lang => (
                        <TouchableOpacity
                          key={lang.key}
                          style={[
                            ai.chip,
                            { borderColor: clientLanguage === lang.key ? theme.accent : theme.surfaceBorder },
                            clientLanguage === lang.key && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => setClientLanguage(prev => prev === lang.key ? null : lang.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[ai.chipText, { color: clientLanguage === lang.key ? theme.accentText : theme.textSub }]}>{lang.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            <View style={s.floatingCTA}>
              <BottomCTA
                label={
                  scheduleMode === 'now'
                    ? t('stepper.confirm_now')
                    : (selectedDayIso && selectedTime
                      ? t('stepper.confirm_at', { day: days.find(d => d.iso === selectedDayIso)?.day, date: days.find(d => d.iso === selectedDayIso)?.date, time: selectedTime })
                      : t('stepper.confirm_slot'))
                }
                onPress={goNext}
                disabled={!step3Ready}
              />
            </View>
          </View>
        )}

        {/* ══ ÉTAPE 4 — Validation ══ */}
        {step === 4 && (
          <View style={s.flex}>
            {/* Fond premium */}
            <LinearGradient
              colors={theme.isDark
                ? [theme.bg, theme.card, theme.surface]
                : [theme.bg, theme.surface, theme.surfaceBorder]}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
            />
            {/* Formes décoratives */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)' }} />
              <View style={{ position: 'absolute', bottom: 40, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.012)' }} />
              <View style={{ position: 'absolute', top: '45%', right: 20, width: 50, height: 50, borderRadius: 8, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.018)', transform: [{ rotate: '45deg' }] }} />
            </View>

            <View style={[s.v4Body, { paddingHorizontal: 16 }]}>

              {/* ── RÉCAPITULATIF ── */}
              <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginBottom: 10 }}>RÉCAPITULATIF</Text>
              <View style={[s.v4Card, { backgroundColor: theme.v4CardBg, marginHorizontal: 0 }]}>
                <View style={s.v4Row}>
                  <Feather name="map-pin" size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]} numberOfLines={1}>{location?.address?.split(',')[0]}</Text>
                  <Text style={[s.v4Sub, { color: theme.textSub }]} numberOfLines={1}>{location?.address?.split(',').slice(1).join(',').trim()}</Text>
                </View>
                <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                <View style={s.v4Row}>
                  <Feather name={toFeatherName(toIoniconName(selectedCategory?.icon, 'construct-outline'), 'tool') as any} size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]}>{serviceName}</Text>
                </View>
                <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                <View style={s.v4Row}>
                  <Feather name="clock" size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]}>{scheduledLabel}</Text>
                </View>
                {!isFreeService && (
                  <>
                    <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                    <TouchableOpacity
                      style={s.v4Row}
                      activeOpacity={0.7}
                      onPress={() => {
                        const options = Platform.OS === 'ios'
                          ? ['Carte bancaire', 'Apple Pay', 'Annuler']
                          : ['Carte bancaire', 'Google Pay', 'Annuler'];
                        Alert.alert('Moyen de paiement', 'Choisissez votre moyen de paiement', options.map((label, i) => ({
                          text: label,
                          style: i === options.length - 1 ? 'cancel' as const : 'default' as const,
                          onPress: () => {
                            if (i === 0) setPaymentMethod('card');
                            else if (i === 1) setPaymentMethod(Platform.OS === 'ios' ? 'apple_pay' : 'google_pay');
                          },
                        })));
                      }}
                    >
                      <Feather name="credit-card" size={16} color={theme.textSub as string} />
                      <Text style={[s.v4Val, { color: theme.text }]}>
                        {paymentMethod === 'card' ? 'Carte bancaire' : paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}
                      </Text>
                      <Feather name="chevron-down" size={14} color={theme.textMuted as string} />
                    </TouchableOpacity>
                  </>
                )}
              </View>


              {/* ── MONTANT ── */}
              {isFreeService ? (
                <View style={[s.v4QuoteInfo, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, marginTop: 16 }]}>
                  <Feather name="gift" size={18} color={theme.text as string} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[s.v4QuoteInfoTitle, { color: theme.text }]}>Service gratuit</Text>
                    <Text style={[s.v4QuoteInfoDesc, { color: theme.textSub }]}>Aucun paiement requis.</Text>
                  </View>
                </View>
              ) : isQuoteFlow ? (
                <View style={{ gap: 10, marginTop: 16 }}>
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2, color: theme.text as string }}>MONTANT</Text>
                  <View style={{ backgroundColor: theme.v4CardBg as string, borderRadius: 16, borderWidth: 1, borderColor: theme.surfaceBorder as string, padding: 16, gap: 10 }}>
                    {selectedSubcategory?.priceMin && selectedSubcategory?.priceMax ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontFamily: FONTS.sans, color: theme.textMuted as string }}>Estimation travaux</Text>
                        <Text style={{ fontSize: 13, fontFamily: FONTS.bebas, color: theme.textSub as string }}>{selectedSubcategory.priceMin} – {selectedSubcategory.priceMax} €</Text>
                      </View>
                    ) : null}
                    <View style={{ height: 1, backgroundColor: theme.surfaceBorder as string }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10, fontFamily: FONTS.sans, color: theme.textMuted as string }}>À régler maintenant</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Feather name="check" size={8} color={COLORS.green} />
                        <Text style={{ fontSize: 10, fontFamily: FONTS.sans, color: COLORS.green }}>Déduit si devis accepté</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: FONTS.bebas, fontSize: 36, letterSpacing: 1, lineHeight: 36, color: theme.text as string }}>
                        {Math.floor(calloutFee)}<Text style={{ fontSize: 18, color: theme.textSub as string }}>,{String(Math.round((calloutFee % 1) * 100)).padStart(2, '0')} €</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.surfaceBorder as string, backgroundColor: theme.v4CardBg as string }}
                    onPress={() => setDevisModalVisible(true)} activeOpacity={0.7}
                  >
                    <Feather name="file-text" size={14} color={COLORS.amber} />
                    <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text as string }}>Comment fonctionne le devis ?</Text>
                    <Feather name="chevron-right" size={13} color={theme.textMuted as string} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginBottom: 8 }}>MONTANT</Text>
                  <View style={{ backgroundColor: theme.v4CardBg as string, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: theme.textSub as string }}>Total TTC</Text>
                    <Text style={{ fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 1, color: theme.text as string }}>{displayPrice.totalTVAC} €</Text>
                  </View>
                  <View style={[s.v4SecureRow, { marginTop: 8 }]}>
                    <Feather name="lock" size={13} color={theme.textMuted as string} />
                    <Text style={[s.v4Secure, { color: theme.textMuted }]}>{t('stepper.charge_after_validation')}</Text>
                  </View>
                </View>
              )}

            </View>

            {/* Footer CTA */}
            <BottomCTA
              label={isFreeService
                ? 'Confirmer (gratuit)'
                : isQuoteFlow
                  ? `Réserver · ${confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : calloutFee > 0 ? formatEUR(calloutFee) : '...'}`
                  : t('stepper.confirm_mission')}
              onPress={handlePay}
              disabled={loading || !paymentReady || !!pricingError}
              loading={loading}
              glow
            />
          </View>
        )}

      </Animated.View>
      <DevisInfoModal
        visible={devisModalVisible}
        onClose={() => setDevisModalVisible(false)}
        pricingMode={pricingMode}
        theme={theme}
      />
    </SafeAreaView>
  );
}

// ─── Styles globaux — valeurs structurelles seulement ─────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Fog overlays
  fogTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: 48, zIndex: 5 },
  fogBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, zIndex: 5 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  iconBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerSide:   { width: 60, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },

  // Préférence prestataire (CTA "Demander X")
  preferredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  preferredBannerText: { flex: 1, fontSize: 12 },
  stepCount:    { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: FONTS.mono },
  stepName:     { fontSize: 15, marginTop: 1, fontFamily: FONTS.sansMedium },
  stepSublabel: { fontSize: 11, marginTop: 1, fontFamily: FONTS.sans },
  cancelBtn:    { paddingHorizontal: 8, paddingVertical: 6 },
  cancelText:   { fontSize: 14, fontFamily: FONTS.sans },

  scrollPad: { paddingHorizontal: 24, paddingTop: 28 },

  title:    { fontSize: 28, marginBottom: 6, letterSpacing: 0.5, fontFamily: FONTS.bebas },
  subtitle: { fontSize: 15, marginBottom: 28, fontFamily: FONTS.sans },

  loadWrap: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadText: { fontSize: 14, fontFamily: FONTS.sans },

  // Step 2
  step2Pad:   { paddingHorizontal: 12, paddingTop: 16 },
  step2Title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 22, fontFamily: FONTS.bebas },
  catList:    { marginBottom: 4 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  inlineSubs: { paddingLeft: 4, paddingRight: 4, paddingBottom: 4 },
  subSection: { marginTop: 20 },
  subHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subTitle:   { fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1, textTransform: 'uppercase' },
  priceInline:{ fontSize: 13, fontFamily: FONTS.mono },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subList:    { gap: 8 },

  priceRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  priceRowLabel:  { fontSize: 13, fontFamily: FONTS.sansMedium },
  priceRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRowValue:  { fontSize: 22, letterSpacing: 0.3, fontFamily: FONTS.bebas },
  priceRowBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRowSub:    { fontSize: 11, fontFamily: FONTS.sans },

  noteToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 4 },
  noteToggleText: { fontSize: 13, fontFamily: FONTS.sans },
  noteInput:      { borderRadius: 16, padding: 16, fontSize: 15, minHeight: 90, borderWidth: 1.5, fontFamily: FONTS.sans },

  // Step 3
  step3Pad:       { paddingHorizontal: 24, paddingTop: 28 },
  step3Sep:       { height: 1, marginVertical: 4 },
  step3Hint:      { fontSize: 14, textAlign: 'center', paddingVertical: 12, fontFamily: FONTS.sans },
  modeGrid:       { alignItems: 'center', gap: 20, marginTop: 90 },
  modeCard:       { width: '55%', aspectRatio: 1.2, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 6 },
  modeCardLabel:  { fontSize: 16, fontFamily: FONTS.sansMedium },
  modeCardSub:    { fontSize: 11, fontFamily: FONTS.sans, textAlign: 'center', paddingHorizontal: 8 },

  nowConfirm: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginTop: 4 },
  nowTitle:   { fontSize: 15, marginBottom: 3, fontFamily: FONTS.sansMedium },
  nowSub:     { fontSize: 13, lineHeight: 18, fontFamily: FONTS.sans },

  dayScroll:      { gap: 4, paddingVertical: 2, paddingHorizontal: 4, alignItems: 'center' },
  slotGroup:      { marginBottom: 12 },
  slotGroupLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontFamily: FONTS.sansMedium },
  slotsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  urgencyRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -28 },
  urgencyLeft:      { flexDirection: 'row', alignItems: 'center', flex: 1 },
  urgencyLabel:     { fontSize: 12, fontFamily: FONTS.sans },
  urgencySub:       { fontSize: 12, marginTop: 1, fontFamily: FONTS.sans },
  urgencyBadge:     { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  urgencyBadgeText: { fontSize: 13, fontFamily: FONTS.monoMedium },

  floatingCTA:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  floatingGradient: { height: 32 },

  slotsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  planSummary:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  planSummaryText: { fontSize: 14, flex: 1, lineHeight: 20, fontFamily: FONTS.sans },

  // Step 1 — carte
  searchFloat: { position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, gap: 8, overflow: 'visible' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, minHeight: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: 'visible', zIndex: 999 },
  addrConfirm: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addrDot:     { width: 10, height: 10, borderRadius: 5 },
  addrText:    { flex: 1, fontSize: 13, fontFamily: FONTS.sansMedium },
  addrClear:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ctaFloating: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },

  markerWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  markerHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)' },
  markerDot:  { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center' as const, justifyContent: 'center' as const, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }) },

  pin:      { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pinInner: { width: 8, height: 8, borderRadius: 4 },

  // Step 4
  v4Body:       { flex: 1, justifyContent: 'center' },
  v4Card:       { borderRadius: 18, overflow: 'hidden', marginBottom: 12, marginHorizontal: 16 },
  v4Row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 10 },
  v4Val:        { flex: 1, fontSize: 15, fontFamily: FONTS.sansMedium },
  v4Sub:        { fontSize: 13, maxWidth: 120, fontFamily: FONTS.sans },
  v4Sep:        { height: 1, marginHorizontal: 16 },
  v4Chevron:    { marginLeft: 'auto' as any },
  v4PriceBreakdown: { marginTop: 10, marginHorizontal: 16, padding: 16, borderRadius: 16, gap: 0 },
  v4PriceLine:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  v4PriceLabel: { fontSize: 10, fontFamily: FONTS.sans },
  v4PriceVal:   { fontSize: 10, fontFamily: FONTS.mono },
  v4PriceSep:   { height: StyleSheet.hairlineWidth, marginVertical: 1, opacity: 0.3 },
  v4Total:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  v4TotalLabel: { fontSize: 30, letterSpacing: 1, fontFamily: FONTS.bebas },
  v4TotalValue: { fontSize: 30, letterSpacing: 1, fontFamily: FONTS.bebas },
  v4QuoteInfo:  { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  v4QuoteInfoTitle: { fontSize: 14, fontFamily: FONTS.sansMedium },
  v4QuoteInfoDesc:  { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 19 },
  v4Footer:     { paddingHorizontal: 0, paddingBottom: Platform.OS === 'ios' ? 16 : 12 },
  v4SecureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 8 },
  v4Secure:     { textAlign: 'center', fontSize: 12, fontFamily: FONTS.sans },

  // Legacy
  recapCard:  { borderRadius: 22, padding: 4, marginBottom: 24 },
  recapRow:   { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  recapIcon:  { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recapInfo:  { flex: 1 },
  recapMeta:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontFamily: FONTS.mono },
  recapVal:   { fontSize: 15, fontFamily: FONTS.sansMedium },
  recapPrice: { fontSize: 24, fontFamily: FONTS.mono },
  recapSep:   { height: 1, marginHorizontal: 16 },
  noteOpt:    { fontFamily: FONTS.sans },
});

// ─── AccessInfo styles ──────────────────────────────────────────────────────
const ai = StyleSheet.create({
  sep:         { height: 1, marginBottom: 16 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  headerIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FONTS.sansMedium },
  headerSub:   { fontSize: 11, fontFamily: FONTS.sans, marginTop: 1 },
  body:        { marginTop: 12, gap: 14 },
  label:       { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  chipText:    { fontSize: 13, fontFamily: FONTS.sansMedium },
  inlineRow:   { flexDirection: 'row', gap: 14 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input:       { flex: 1, fontSize: 15, fontFamily: FONTS.sans, paddingVertical: 0 },
  textareaWrap: { borderWidth: 1.5, borderRadius: 12, padding: 12 },
  textarea:    { fontSize: 14, fontFamily: FONTS.sans, minHeight: 60 },
});