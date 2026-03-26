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
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Animated,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { toIoniconName } from '../../lib/iconMapper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { computePrice } from '@/lib/services/priceService';

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

// Config des étapes
const getStepConfig = (t: any) => [
  { label: t('stepper.step1_label'), sublabel: t('stepper.step1_sub'), icon: 'location-outline'          as const },
  { label: t('stepper.step2_label'), sublabel: t('stepper.step2_sub'), icon: 'construct-outline'         as const },
  { label: t('stepper.step3_label'), sublabel: t('stepper.step3_sub'), icon: 'time-outline'              as const },
  { label: t('stepper.step4_label'), sublabel: t('stepper.step4_sub'), icon: 'checkmark-circle-outline'  as const },
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
    surfaceBorder:   t.isDark ? '#2C2C2C' : '#F2F2F2',
    card:            t.cardBg,
    cardBorder:      t.border,
    sep:             t.borderLight,
    text:            t.text,
    textSub:         t.textSub,
    textMuted:       t.textMuted,
    textPlaceholder: t.textMuted,
    iconBtnBg:       t.surface,
    progressTrack:   t.isDark ? '#2A2A2A' : '#E8E8E8',
    ctaBg:           t.bg,
    ctaBorder:       t.borderLight,
    modeCardBg:      t.surface,
    nowConfirmBg:    t.surface,
    noteInputBg:     t.surface,
    noteInputBorder: t.border,
    searchBoxBg:     t.isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
    addrConfirmBg:   t.cardBg,
    addrClearBg:     t.isDark ? '#2A2A2A' : '#E9E7E1',
    dropdownBg:      t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownRow:     t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownSep:     t.borderLight,
    chipBg:          t.surface,
    v4CardBg:        t.isDark ? '#1A1A1A' : '#FFFFFF',
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
const STEP_ICONS: ('location-outline' | 'construct-outline' | 'time-outline' | 'checkmark')[] = [
  'location-outline', 'construct-outline', 'time-outline', 'checkmark',
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
                ? <Ionicons name="checkmark" size={14} color={iconColor} />
                : <Ionicons name={STEP_ICONS[i]} size={isActive ? 16 : 14} color={iconColor} />
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
          <Ionicons name="checkmark-circle" size={12} color={t.textMuted as string} />
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
          <Ionicons
            name={toIoniconName(cat.icon, 'construct-outline') as any}
            size={18}
            color={selected ? t.accentText as string : t.textSub as string}
          />
        </View>
        <Text style={[cc.name, { color: t.text }, selected && cc.nameSelected]} numberOfLines={1}>
          {cat.name}
        </Text>
        {selected
          ? <View style={[cc.selectedDot, { backgroundColor: t.text }]} />
          : <Ionicons name="chevron-forward" size={14} color={t.textMuted} />
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
        <View style={[sc.dot, { backgroundColor: isQuote ? '#C8820A' : '#3D8B3D' }, selected && { backgroundColor: t.text }]} />
        <Text style={[sc.text, { color: t.textSub }, selected && { fontWeight: '700', color: t.text }]}>{label}</Text>
        <View style={sc.right}>
          <Text style={[sc.priceSmall, { color: t.textMuted }]}>
            {isQuote
              ? (priceMin && priceMax ? `${priceMin}–${priceMax} €` : '')
              : (basePrice ? `${basePrice} €` : '')}
          </Text>
          <View style={[sc.pill, { backgroundColor: isQuote ? 'rgba(200,130,10,0.15)' : 'rgba(61,139,61,0.15)' }]}>
            <Text style={[sc.pillText, { color: isQuote ? '#C8820A' : '#3D8B3D' }]}>{isQuote ? 'Sur devis' : 'Prix fixe'}</Text>
          </View>
          {selected && <Ionicons name="checkmark" size={16} color={t.text as string} />}
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
  pill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  priceSmall: { fontSize: 10, fontFamily: FONTS.mono },
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
                <Ionicons name="arrow-forward" size={20} color={disabled ? t.textMuted as string : t.accentText as string} />
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const cta = StyleSheet.create({
  wrap:          { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 0 : 16, paddingTop: 12, borderTopWidth: 1 },
  btn:           { borderRadius: 55, height: 55, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:   {},
  inner:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%' },
  label:         { fontSize: 17, fontFamily: FONTS.sansMedium, textAlign: 'center', flex: 1 },
  labelDisabled: {},
  priceBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  priceText:     { fontSize: 15, fontFamily: FONTS.mono },
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={[dim.sheet, { backgroundColor: theme.cardBg }]}>
            <View style={[dim.handle, { backgroundColor: theme.borderLight }]} />

            {/* Header */}
            <View style={dim.header}>
              <View style={dim.titleRow}>
                <View style={dim.iconWrap}>
                  <Ionicons name={pricingMode === 'diagnostic' ? 'search-outline' : 'document-text-outline'} size={20} color="#C8820A" />
                </View>
                <Text style={[dim.title, { color: theme.text }]}>
                  {pricingMode === 'diagnostic' ? 'Diagnostic sur place' : 'Estimation sur place'}
                </Text>
              </View>
              <Text style={[dim.subtitle, { color: theme.textSub }]}>
                Le prestataire se déplace, évalue les travaux et vous envoie un devis détaillé.
              </Text>
            </View>

            <View style={[dim.divider, { backgroundColor: theme.borderLight }]} />

            {/* Steps */}
            <View style={dim.steps}>
              {steps.map((item, i) => (
                <View key={i} style={dim.stepRow}>
                  {/* Colonne gauche : numéro + connecteur */}
                  <View style={dim.stepLeft}>
                    <View style={[dim.numCircle, {
                      backgroundColor: i === 0 ? 'rgba(200,130,10,0.2)' : theme.surface,
                      borderColor:     i === 0 ? 'rgba(200,130,10,0.5)' : theme.borderLight,
                    }]}>
                      <Text style={[dim.numText, { color: i === 0 ? '#C8820A' : theme.textSub }]}>{item.num}</Text>
                    </View>
                    {i < steps.length - 1 && <View style={[dim.connector, { backgroundColor: theme.borderLight }]} />}
                  </View>
                  {/* Contenu */}
                  <View style={[dim.stepContent, i < steps.length - 1 && { paddingBottom: 24 }]}>
                    <Text style={[dim.stepTitle, { color: i === 0 ? '#F0A830' : theme.text }]}>{item.title}</Text>
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
  const { selectedCategory: preselectedCategory } = useLocalSearchParams<{ selectedCategory?: string }>();
  const mapRef    = useRef<MapView | null>(null);
  const step2ScrollRef = useRef<ScrollView>(null);
  const catLayoutsRef  = useRef<Record<number, number>>({});
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // Étape 1
  const [location, setLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [locationAllowed, setLocationAllowed] = useState<boolean>(true);

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

  // Étape 2
  const [categories,    setCategories]    = useState<any[]>([]);
  const [categoryId,    setCategoryId]    = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description,   setDescription]  = useState('');
  const [noteOpen,      setNoteOpen]      = useState(false);

  // Étape 3
  const days = useMemo(() => buildNextDays(t, 10), [t]);
  const [scheduleMode,   setScheduleMode]   = useState<'now' | 'later' | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedTime,   setSelectedTime]   = useState<string | null>(null);
  const [isUrgent,       setIsUrgent]       = useState(false);

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

  const goNext = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); animateStep(() => setStep((p) => Math.min(p + 1, TOTAL_STEPS))); };
  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) router.back();
    else animateStep(() => setStep((p) => p - 1));
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
        };
        const reqRes = await api.post('/requests', payload);
        const rId    = reqRes.id || reqRes.data?.id;
        if (!rId) throw new Error('Request ID manquant');
        if (cancelled) return;
        setRequestId(rId);

        // Initialiser le payment sheet — prix fixe uniquement
        const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(rId);
        const { error } = await initPaymentSheet({
          merchantDisplayName:      'Fixed',
          paymentIntentClientSecret: paymentIntent,
          customerEphemeralKeySecret: ephemeralKey,
          customerId:                customer,
          applePay:  { merchantCountryCode: 'BE' },
          googlePay: { merchantCountryCode: 'BE', testEnv: false },
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
      router.replace({
        pathname: '/request/[id]/scheduled',
        params: {
          id:             String(requestId),
          serviceName:    serviceName    || '',
          address:        location?.address  || '',
          price:          String(estimatedPrice),
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({
          pathname: '/request/[id]/quote-pending',
          params: {
            id:          String(requestId),
            serviceName: serviceName || '',
            address:     location?.address || '',
            calloutFee:  String(calloutFee),
            pricingMode,
          },
        });
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
            <Ionicons name="arrow-back" size={22} color={theme.text as string} />
          </TouchableOpacity>
        </View>

        <View style={s.headerCenter}>
          <Text style={[s.stepName, { color: theme.text }]}>{currentStep.label}</Text>
        </View>

        <View style={s.headerSide} />
      </View>

      {/* ── Step Indicator ── */}
      <StepIndicator step={step} />

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
                  <View style={s.markerWrap}>
                    <View style={s.markerHalo} />
                    <View style={[s.markerDot, { backgroundColor: theme.accent, borderColor: theme.accentText }]}>
                      <Ionicons name="location" size={20} color={theme.accentText as string} />
                    </View>
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Barre de recherche flottante */}
            <View style={s.searchFloat}>
              <View style={[s.searchBox, { backgroundColor: theme.searchBoxBg }]}>
                <Ionicons name="search" size={18} color={theme.textSub as string} />
                <GooglePlacesAutocomplete
                  placeholder={t('stepper.enter_address')}
                  fetchDetails
                  onPress={(data, details = null) => {
                    if (details) {
                      const { lat, lng } = details.geometry.location;
                      const allowed = checkLocation(data.description, details.address_components);
                      setLocation({ address: data.description, lat, lng });
                      setLocationAllowed(allowed);
                      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                      Haptics.notificationAsync(allowed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                    }
                  }}
                  query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:be' }}
                  styles={{
                    container:          { flex: 1, marginLeft: 8 },
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
                      elevation:     12,
                      zIndex:        50,
                      maxHeight:     260,
                    },
                    row:         { backgroundColor: theme.dropdownRow as string, paddingVertical: 14, paddingHorizontal: 18 },
                    description: { fontSize: 14, color: theme.text as string, fontFamily: FONTS.sans },
                    separator:   { backgroundColor: theme.dropdownSep as string, height: 1 },
                  }}
                  textInputProps={{ placeholderTextColor: theme.textPlaceholder as string }}
                  enablePoweredByContainer={false}
                  listViewDisplayed="auto"
                  keyboardShouldPersistTaps="handled"
                />
              </View>

              {location && (
                <View style={[s.addrConfirm, { backgroundColor: theme.addrConfirmBg }]}>
                  <View style={[s.addrDot, { backgroundColor: theme.text as string }]} />
                  <Text style={[s.addrText, { color: theme.text }]} numberOfLines={1}>{location.address}</Text>
                  <TouchableOpacity onPress={() => { setLocation(null); setLocationAllowed(true); }} style={[s.addrClear, { backgroundColor: theme.addrClearBg }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('common.clear')} accessibilityRole="button">
                    <Ionicons name="close" size={18} color={theme.textSub as string} />
                  </TouchableOpacity>
                </View>
              )}
              {location && !locationAllowed && (
                <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
                  <Ionicons name="warning-outline" size={16} color="#E8783A" />
                  <Text style={[s.addrText, { color: '#E8783A', flex: 1 }]} numberOfLines={2}>
                    {'Zone test : Ixelles, Saint-Gilles et Uccle uniquement'}
                  </Text>
                </View>
              )}
            </View>

            <View style={s.ctaFloating}>
              <BottomCTA
                label={location ? t('stepper.confirm_address') : t('stepper.select_address')}
                onPress={goNext}
                disabled={!location || !locationAllowed}
              />
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
                <Ionicons name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
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

            {/* Brouillard bas uniquement */}
            <LinearGradient colors={['transparent', theme.bg as string]} style={s.fogBottom} pointerEvents="none" />
            </View>

            <BottomCTA
              label={isQuoteFlow ? 'Demander un devis' : t('stepper.continue')}
              onPress={goNext}
              disabled={!categoryId}
              price={isQuoteFlow ? undefined : (estimatedPrice > 0 ? estimatedPrice : undefined)}
            />
          </KeyboardAvoidingView>
        )}

        {/* ══ ÉTAPE 3 — Planning ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <ScrollView style={s.flex} contentContainerStyle={s.step3Pad} showsVerticalScrollIndicator={false}>

              <View style={[s.urgencyRow, { opacity: isUrgent ? 1 : 0.4 }]}>
                <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                <Text style={[s.urgencyLabel, { color: isUrgent ? theme.text : theme.textSub, marginLeft: 6, flex: 1 }]}>{t('stepper.urgency_desc')}</Text>
                <Switch
                  value={isUrgent}
                  onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsUrgent(v); }}
                  trackColor={{ false: theme.sep as string, true: COLORS.red }}
                  thumbColor={isUrgent ? '#FFF' : theme.surface as string}
                  style={{ transform: [{ scaleX: 0.55 }, { scaleY: 0.55 }], marginRight: -10 }}
                />
              </View>

              <View style={s.modeGrid}>
                {/* Maintenant */}
                <TouchableOpacity
                  style={[s.modeCard, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'now' && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Ionicons name="flash-outline" size={28} color={scheduleMode === 'now' ? theme.accentText as string : theme.text as string} />
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
                  <Ionicons name="calendar-outline" size={28} color={scheduleMode === 'later' ? theme.accentText as string : theme.text as string} />
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


              <View style={{ height: 120 }} />
            </ScrollView>

            <View style={s.floatingCTA}>
              <LinearGradient colors={['transparent', theme.bg as string]} style={s.floatingGradient} pointerEvents="none" />
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
                ? ['#0A0A0A', '#161616', '#1A1A1A']
                : ['#F4F4F2', '#EAEAE8', '#E2E2E0']}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
            />
            {/* Formes décoratives */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Grand cercle flou top-right */}
              <View style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)' }} />
              {/* Cercle moyen bottom-left */}
              <View style={{ position: 'absolute', bottom: 40, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.012)' }} />
              {/* Petit losange centre-droit */}
              <View style={{ position: 'absolute', top: '45%', right: 20, width: 50, height: 50, borderRadius: 8, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.018)', transform: [{ rotate: '45deg' }] }} />
            </View>
            <View style={s.v4Body}>

              {/* Carte récap */}
              <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginHorizontal: 16, marginBottom: 10 }}>RÉCAPITULATIF</Text>
              <View style={[s.v4Card, { backgroundColor: theme.v4CardBg }]}>

                <View style={s.v4Row}>
                  <Ionicons name="location-outline" size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]} numberOfLines={1}>{location?.address?.split(',')[0]}</Text>
                  <Text style={[s.v4Sub, { color: theme.textSub }]} numberOfLines={1}>{location?.address?.split(',').slice(1).join(',').trim()}</Text>
                </View>
                <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />

                <View style={s.v4Row}>
                  <Ionicons name={toIoniconName(selectedCategory?.icon, 'construct-outline') as any} size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]}>{serviceName}</Text>
                </View>
                <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />

                <View style={s.v4Row}>
                  <Ionicons name="time-outline" size={16} color={theme.textSub as string} />
                  <Text style={[s.v4Val, { color: theme.text }]}>{scheduledLabel}</Text>
                </View>
                <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                <View style={s.v4Row}>
                  <Ionicons name="card-outline" size={16} color={theme.textSub as string} />
                  <Text style={[{ fontSize: 13, fontFamily: FONTS.sans, color: theme.textMuted as string }]}>Carte · Apple Pay · Google Pay</Text>
                </View>

              </View>

              {/* Prix / Callout fee section — prix fixe et gratuit seulement (devis = footer) */}
              {isFreeService ? (
                <View style={[s.v4PriceBreakdown, { backgroundColor: theme.v4CardBg }]}>
                  <View style={[s.v4QuoteInfo, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="gift-outline" size={18} color={theme.text as string} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[s.v4QuoteInfoTitle, { color: theme.text }]}>Service gratuit</Text>
                      <Text style={[s.v4QuoteInfoDesc, { color: theme.textSub }]}>
                        Aucun paiement requis. Confirmez pour lancer la recherche d'un prestataire.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : !isQuoteFlow ? (
                <View style={[s.v4PriceBreakdown, { backgroundColor: theme.v4CardBg }]}>
                  {priceDetailOpen && (
                    <View style={{ marginBottom: 6, gap: 2 }}>
                      <View style={s.v4PriceLine}>
                        <Text style={[s.v4PriceLabel, { color: theme.textSub }]}>Base HTVA</Text>
                        <Text style={[s.v4PriceVal, { color: theme.text }]}>{displayPrice.baseHTVA} €</Text>
                      </View>
                      <View style={[s.v4PriceSep, { backgroundColor: theme.sep }]} />
                      {displayPrice.multiplier > 1 && (
                        <>
                          <View style={s.v4PriceLine}>
                            <Text style={[s.v4PriceLabel, { color: theme.textSub }]}>Majoration horaire (x{displayPrice.multiplier.toFixed(1)})</Text>
                            <Text style={[s.v4PriceVal, { color: theme.text }]}>{displayPrice.adjustedBase} €</Text>
                          </View>
                          <View style={[s.v4PriceSep, { backgroundColor: theme.sep }]} />
                        </>
                      )}
                      {isUrgent && (
                        <>
                          <View style={s.v4PriceLine}>
                            <Text style={[s.v4PriceLabel, { color: COLORS.red }]}>Urgence (+50%)</Text>
                            <Text style={[s.v4PriceVal, { color: COLORS.red }]}>{displayPrice.urgentFee} €</Text>
                          </View>
                          <View style={[s.v4PriceSep, { backgroundColor: theme.sep }]} />
                        </>
                      )}
                      <View style={s.v4PriceLine}>
                        <Text style={[s.v4PriceLabel, { color: theme.textSub }]}>Déplacement</Text>
                        <Text style={[s.v4PriceVal, { color: theme.text }]}>{displayPrice.travelFee} €</Text>
                      </View>
                      <View style={[s.v4PriceSep, { backgroundColor: theme.sep }]} />
                      <View style={s.v4PriceLine}>
                        <Text style={[s.v4PriceLabel, { color: theme.textSub }]}>Frais plateforme</Text>
                        <Text style={[s.v4PriceVal, { color: theme.text }]}>{displayPrice.platformFee} €</Text>
                      </View>
                      <View style={[s.v4PriceSep, { backgroundColor: theme.sep }]} />
                      <View style={s.v4PriceLine}>
                        <Text style={[s.v4PriceLabel, { color: theme.textSub }]}>TVA (21%)</Text>
                        <Text style={[s.v4PriceVal, { color: theme.text }]}>{(parseFloat(displayPrice.totalTVAC) - parseFloat(displayPrice.totalHTVA)).toFixed(2)} €</Text>
                      </View>
                      <View style={[s.v4Sep, { backgroundColor: theme.v4Sep, marginVertical: 6 }]} />
                    </View>
                  )}

                  <TouchableOpacity style={s.v4PriceLine} onPress={() => setPriceDetailOpen(p => !p)} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[s.v4TotalLabel, { color: theme.text }]}>TTC</Text>
                      <Ionicons name={priceDetailOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
                    </View>
                    <Text style={[s.v4TotalValue, { color: theme.text }]}>{displayPrice.totalTVAC} €</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

            </View>

            {/* Footer */}
            <View style={s.v4Footer}>
              {isQuoteFlow && (
                <View style={{ gap: 12, marginBottom: 8 }}>
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginHorizontal: 16 }}>MONTANT</Text>
                  <View style={{ marginHorizontal: 16, backgroundColor: theme.v4CardBg as string, borderRadius: 16, borderWidth: 1, borderColor: theme.surfaceBorder as string, padding: 16, gap: 12 }}>
                    {selectedSubcategory?.priceMin && selectedSubcategory?.priceMax ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontFamily: FONTS.sans, color: theme.textMuted as string }}>Estimation travaux</Text>
                        <Text style={{ fontSize: 13, fontFamily: FONTS.mono, color: theme.textSub as string }}>{selectedSubcategory.priceMin} – {selectedSubcategory.priceMax} €</Text>
                      </View>
                    ) : null}
                    <View style={{ height: 1, backgroundColor: theme.surfaceBorder as string }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontFamily: FONTS.sans, color: theme.textMuted as string }}>À régler maintenant</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="checkmark" size={8} color="#3D8B3D" />
                        <Text style={{ fontSize: 10, fontFamily: FONTS.sans, color: '#3D8B3D' }}>Déduit si devis accepté</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: FONTS.bebas, fontSize: 44, letterSpacing: 1, lineHeight: 44, color: theme.text as string }}>
                        {Math.floor(calloutFee)}<Text style={{ fontSize: 22, color: theme.textSub as string }}>,{String(Math.round((calloutFee % 1) * 100)).padStart(2, '0')} €</Text>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.surfaceBorder as string, backgroundColor: theme.v4CardBg as string }}
                    onPress={() => setDevisModalVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Ionicons name="document-text-outline" size={14} color="#C8820A" />
                    <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text as string }}>Comment fonctionne le devis ?</Text>
                    <Ionicons name="chevron-forward" size={13} color={theme.textMuted as string} />
                  </TouchableOpacity>
                </View>
              )}
              {!isFreeService && !isQuoteFlow && (
                <View style={s.v4SecureRow}>
                  <Ionicons name="lock-closed-outline" size={13} color={theme.textMuted as string} />
                  <Text style={[s.v4Secure, { color: theme.textMuted }]}>
                    {t('stepper.charge_after_validation')}
                  </Text>
                </View>
              )}
              <BottomCTA
                label={isFreeService
                  ? 'Confirmer (gratuit)'
                  : isQuoteFlow
                    ? `Réserver · ${confirmedCalloutCents != null ? (confirmedCalloutCents / 100).toFixed(2) : calloutFee > 0 ? calloutFee.toFixed(2) : '...'} €`
                    : t('stepper.confirm_mission')}
                onPress={handlePay}
                disabled={loading || !paymentReady || !!pricingError}
                loading={loading}
                price={undefined}
                wrapStyle={{ paddingHorizontal: 16 }}
                labelStyle={{ fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 2 }}
                glow
              />
            </View>
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
  iconBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerSide:   { width: 60, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepCount:    { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: FONTS.mono },
  stepName:     { fontSize: 15, marginTop: 1, fontFamily: FONTS.sansMedium },
  stepSublabel: { fontSize: 11, marginTop: 1, fontFamily: FONTS.sans },
  cancelBtn:    { paddingHorizontal: 8, paddingVertical: 6 },
  cancelText:   { fontSize: 14, fontFamily: FONTS.sans },

  scrollPad: { paddingHorizontal: 24, paddingTop: 28 },

  title:    { fontSize: 30, lineHeight: 38, marginBottom: 6, letterSpacing: 1, fontFamily: FONTS.bebas },
  subtitle: { fontSize: 15, marginBottom: 28, fontFamily: FONTS.sans },

  loadWrap: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadText: { fontSize: 14, fontFamily: FONTS.sans },

  // Step 2
  step2Pad:   { paddingHorizontal: 12, paddingTop: 16 },
  step2Title: { fontSize: 22, letterSpacing: 1, marginBottom: 22, fontFamily: FONTS.bebas },
  catList:    { marginBottom: 4 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  inlineSubs: { paddingLeft: 4, paddingRight: 4, paddingBottom: 4 },
  subSection: { marginTop: 20 },
  subHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subTitle:   { fontSize: 14, fontFamily: FONTS.sansMedium },
  priceInline:{ fontSize: 13, fontFamily: FONTS.mono },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subList:    { gap: 8 },

  priceRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  priceRowLabel:  { fontSize: 13, fontFamily: FONTS.sansMedium },
  priceRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRowValue:  { fontSize: 20, letterSpacing: -0.3, fontFamily: FONTS.mono },
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
  searchFloat: { position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, gap: 8 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, minHeight: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  addrConfirm: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addrDot:     { width: 10, height: 10, borderRadius: 5 },
  addrText:    { flex: 1, fontSize: 13, fontFamily: FONTS.sansMedium },
  addrClear:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ctaFloating: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5 },

  markerWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  markerHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)' },
  markerDot:  { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center' as const, justifyContent: 'center' as const, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }) },

  pin:      { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pinInner: { width: 8, height: 8, borderRadius: 4 },

  // Step 4
  v4Body:       { flex: 1, paddingTop: 12 },
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
  v4Footer:     { paddingHorizontal: 0, paddingBottom: 0 },
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