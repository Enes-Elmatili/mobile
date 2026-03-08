/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
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
  Dimensions,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { toIoniconName } from '../../lib/iconMapper';

const { width } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const CARD_W     = (width - 48 - 12) / 2;
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
// THEME HOOK
// ============================================================================

function useTheme() {
  const scheme = useColorScheme();
  const isDark  = scheme === 'dark';
  return {
    isDark,
    // Global
    bg:             isDark ? '#0A0A0A' : '#FFFFFF',
    surface:        isDark ? '#1A1A1A' : '#F5F5F5',
    surfaceAlt:     isDark ? '#222222' : '#F8F8F8',
    surfaceBorder:  isDark ? '#2C2C2C' : '#F2F2F2',
    card:           isDark ? '#1C1C1C' : '#F7F7F7',
    cardBorder:     isDark ? '#2A2A2A' : '#EBEBEB',
    sep:            isDark ? '#222222' : '#F0F0F0',
    // Text
    text:           isDark ? '#F2F2F2' : '#1A1A1A',
    textSub:        isDark ? '#888888' : '#888888',
    textMuted:      isDark ? '#555555' : '#ADADAD',
    textPlaceholder:isDark ? '#555555' : '#ADADAD',
    // Header
    iconBtnBg:      isDark ? '#1C1C1C' : '#F5F5F5',
    // Progress bar
    progressTrack:  isDark ? '#2A2A2A' : '#E8E8E8',
    // Bottom CTA
    ctaBg:          isDark ? '#111111' : '#FFFFFF',
    ctaBorder:      isDark ? '#222222' : '#F0F0F0',
    // Mode cards (step 3)
    modeCardBg:     isDark ? '#1A1A1A' : '#F5F5F5',
    // Now confirm box
    nowConfirmBg:   isDark ? '#1A1A1A' : '#F5F5F5',
    // Note input
    noteInputBg:    isDark ? '#1A1A1A' : '#F7F7F7',
    noteInputBorder:isDark ? '#2A2A2A' : '#EBEBEB',
    // Search box sur carte
    searchBoxBg:    isDark ? '#1A1A1A' : '#FFFFFF',
    addrConfirmBg:  isDark ? '#1A1A1A' : '#FFFFFF',
    addrClearBg:    isDark ? '#2A2A2A' : '#EBEBEB',
    // Autocomplete dropdown
    dropdownBg:     isDark ? '#1C1C1C' : '#FFFFFF',
    dropdownRow:    isDark ? '#1C1C1C' : '#FFFFFF',
    dropdownSep:    isDark ? '#2A2A2A' : '#F5F5F5',
    // TimeSlot chip
    chipBg:         isDark ? '#1A1A1A' : '#F5F5F5',
    // Validation card
    v4CardBg:       isDark ? '#1A1A1A' : '#F7F7F7',
    v4Sep:          isDark ? '#2A2A2A' : '#EBEBEB',
    // Floating gradient (step 3)
    gradientBg:     isDark ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.9)',
  };
}

// ─── Step Indicator animé ──────────────────────────────────────────────────────
const STEP_ICONS: Array<'location-outline' | 'construct-outline' | 'time-outline' | 'checkmark-circle-outline'> = [
  'location-outline', 'construct-outline', 'time-outline', 'checkmark-circle-outline',
];

function StepIndicator({ step }: { step: number }) {
  const t = useTheme();

  // One animated value per segment (3 segments for 4 steps)
  const segmentAnims = useRef(
    Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => new Animated.Value(i < step - 1 ? 1 : 0))
  ).current;

  // Scale animation for the active dot
  const dotScales = useRef(
    Array.from({ length: TOTAL_STEPS }, (_, i) => new Animated.Value(i === step - 1 ? 1.25 : 1))
  ).current;

  useEffect(() => {
    // Animate segments: fill segments up to (step - 1)
    segmentAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i < step - 1 ? 1 : 0,
        duration: 350,
        useNativeDriver: false,
      }).start();
    });

    // Animate dot scales: active = pop, others = normal
    dotScales.forEach((anim, i) => {
      if (i === step - 1) {
        Animated.sequence([
          Animated.timing(anim, { toValue: 1.35, duration: 180, useNativeDriver: true }),
          Animated.spring(anim, { toValue: 1.15, useNativeDriver: true, tension: 200, friction: 10 }),
        ]).start();
      } else {
        Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    });
  }, [step]);

  return (
    <View style={si.container}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive    = i === step - 1;
        const isCompleted = i < step - 1;
        const dotBg       = isActive ? '#1A1A1A' : isCompleted ? '#1A1A1A' : t.progressTrack;
        const iconColor   = isActive || isCompleted ? '#FFF' : t.textMuted as string;

        return (
          <React.Fragment key={i}>
            {/* Dot */}
            <Animated.View style={[
              si.dot,
              { backgroundColor: dotBg, transform: [{ scale: dotScales[i] }] },
              isActive && si.dotActive,
            ]}>
              {isCompleted
                ? <Ionicons name="checkmark" size={14} color={iconColor} />
                : <Ionicons name={STEP_ICONS[i]} size={isActive ? 16 : 14} color={iconColor} />
              }
            </Animated.View>

            {/* Segment line between dots */}
            {i < TOTAL_STEPS - 1 && (
              <View style={[si.segment, { backgroundColor: t.progressTrack }]}>
                <Animated.View style={[si.segmentFill, {
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
  dotActive:   { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  segment:     { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden', marginHorizontal: 4 },
  segmentFill: { height: '100%', backgroundColor: '#1A1A1A', borderRadius: 1 },
});

// ─── Résumé contextuel ─────────────────────────────────────────────────────────
function LiveSummary({ location, serviceName, scheduledLabel }: {
  location:       { address: string } | null;
  serviceName:    string | null;
  scheduledLabel: string | null;
}) {
  const parts: string[] = [];
  if (location)      parts.push(location.address.split(',')[0]);
  if (serviceName)   parts.push(serviceName);
  if (scheduledLabel) parts.push(scheduledLabel);

  if (parts.length === 0) return null;

  return (
    <View style={ls.wrap}>
      {parts.map((p, i) => (
        <View key={i} style={ls.row}>
          <Ionicons name="checkmark-circle" size={12} color="#aaa" />
          <Text style={ls.text} numberOfLines={1}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

const ls = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginTop: 8, marginBottom: 2, gap: 3 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 11, fontWeight: '500', color: '#999', flex: 1 },
});

// ─── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, selected, onPress }: { cat: any; selected: boolean; onPress: () => void }) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[cc.wrap, { transform: [{ scale }] }]}>
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
        <View style={[cc.iconWrap, { backgroundColor: t.surface }, selected && cc.iconWrapSelected]}>
          <Ionicons
            name={toIoniconName(cat.icon, 'construct-outline') as any}
            size={18}
            color={selected ? '#FFF' : t.textSub}
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
  iconWrapSelected: { backgroundColor: '#1A1A1A' },
  name:             { flex: 1, fontSize: 15, fontWeight: '600' },
  nameSelected:     { fontWeight: '700' },
  selectedDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});

// ─── Sub Row ───────────────────────────────────────────────────────────────────
function SubChip({ label, price, selected, onPress, icon }: {
  label:    string;
  price?:   number;
  selected: boolean;
  onPress:  () => void;
  icon?:    string;
}) {
  const t     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.98, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[sc.row, { borderBottomColor: t.surfaceBorder }]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <View style={[sc.dot, { backgroundColor: t.surfaceBorder }, selected && { backgroundColor: t.text }]} />
        <Text style={[sc.text, { color: t.textSub }, selected && { fontWeight: '700', color: t.text }]}>{label}</Text>
        <View style={sc.right}>
          {price !== undefined && (
            <Text style={[sc.price, { color: t.textMuted }, selected && { color: t.textSub }]}>{price} €</Text>
          )}
          {selected && <Ionicons name="checkmark" size={16} color={t.text as string} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 12, borderBottomWidth: 1 },
  dot:   { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  text:  { flex: 1, fontSize: 15, fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 14, fontWeight: '600' },
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
          selected && tslot.chipSelected,
        ]}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {selected && <View style={tslot.dot} />}
        <Text style={[tslot.text, { color: t.textSub }, selected && tslot.textSelected]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const tslot = StyleSheet.create({
  chip:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, minWidth: 88 },
  chipSelected: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  text:         { fontSize: 15, fontWeight: '600' },
  textSelected: { color: '#FFF' },
});

// ─── Day Chip ──────────────────────────────────────────────────────────────────
function DayChip({ day, date, month, selected, onPress }: {
  day: string; date: string; month: string; selected: boolean; onPress: () => void;
}) {
  const t              = useTheme();
  const underlineWidth = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(underlineWidth, { toValue: selected ? 1 : 0, duration: 200, useNativeDriver: false }).start();
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
  day:       { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  date:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  month:     { fontSize: 10, fontWeight: '500' },
  underline: { height: 2.5, borderRadius: 2, marginTop: 4, alignSelf: 'center' },
});

// ─── Bottom CTA ────────────────────────────────────────────────────────────────
function BottomCTA({ label, onPress, disabled, loading, price }: {
  label:     string;
  onPress:   () => void;
  disabled?: boolean;
  loading?:  boolean;
  price?:    number;
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
    <View style={[cta.wrap, { backgroundColor: t.ctaBg, borderTopColor: t.ctaBorder }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={springIn}
          onPressOut={springOut}
          onPress={handlePress}
          disabled={disabled || loading}
          style={[cta.btn, disabled && cta.btnDisabled]}
          accessibilityLabel={label}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={cta.inner}>
              <Text style={[cta.label, disabled && cta.labelDisabled]}>{label}</Text>
              {price !== undefined && price > 0 ? (
                <View style={cta.priceBadge}>
                  <Text style={cta.priceText}>{price} €</Text>
                </View>
              ) : (
                <Ionicons name="arrow-forward" size={20} color={disabled ? '#AAA' : '#FFF'} />
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
  btn:           { backgroundColor: '#000', borderRadius: 16, height: 60, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:   { backgroundColor: '#D8D8D8' },
  inner:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%' },
  label:         { fontSize: 17, fontWeight: '700', color: '#FFF', flex: 1, textAlign: 'center' },
  labelDisabled: { color: '#AAA' },
  priceBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  priceText:     { color: '#FFF', fontWeight: '800', fontSize: 15 },
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

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function NewRequestStepper() {
  const router = useRouter();
  const theme  = useTheme();
  const { t }  = useTranslation();
  const { selectedCategory: preselectedCategory } = useLocalSearchParams<{ selectedCategory?: string }>();
  const mapRef    = useRef<MapView | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // Étape 1
  const [location, setLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);

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

  // Dérivés
  const selectedCategory    = useMemo(() => categories.find((c) => c.id === categoryId) || null, [categories, categoryId]);
  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories?.find((s: any) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId]
  );
  const estimatedPrice  = selectedSubcategory?.price || selectedCategory?.price || 0;
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
  const step3Ready = scheduleMode === 'now' || (scheduleMode === 'later' && !!selectedDayIso && !!selectedTime);

  // Chargement catégories
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/categories');
        setCategories(extractArrayPayload(response));
      } catch (e) {
        console.error('Categories load error:', e);
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
  }, [categories, preselectedCategory]);

  // Transition animée
  const animateStep = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(cb, 100);
  };

  const goNext = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); animateStep(() => setStep((p) => p + 1)); };
  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) router.back();
    else animateStep(() => setStep((p) => p - 1));
  };

  // Étape 4 — paiement
  const [requestId,          setRequestId]         = useState<string | null>(null);
  const [paymentReady,       setPaymentReady]       = useState(false);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);

  useEffect(() => {
    if (step !== 4 || !selectedCategory || !location || paymentReady) return;
    (async () => {
      setPaymentInitLoading(true);
      try {
        const serviceType = selectedSubcategory?.name || selectedCategory.name;
        const payload = {
          title:        serviceType,
          description:  description || `Service de ${serviceType}`,
          serviceType,
          categoryId:   selectedCategory.id,
          ...(subcategoryId && { subcategoryId }),
          price:        estimatedPrice,
          address:      location.address,
          lat:          location.lat,
          lng:          location.lng,
          urgent:       false,
          scheduledFor: scheduledFor || new Date().toISOString(),
          status:       'PENDING_PAYMENT',
        };
        const reqRes = await api.post('/requests', payload);
        const rId    = reqRes.id || reqRes.data?.id;
        if (!rId) throw new Error('Request ID manquant');
        setRequestId(rId);

        const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(rId);
        const { error } = await initPaymentSheet({
          merchantDisplayName:      'Fixed',
          paymentIntentClientSecret: paymentIntent,
          customerEphemeralKeySecret: ephemeralKey,
          customerId:                customer,
          applePay:  { merchantCountryCode: 'BE' },
          googlePay: { merchantCountryCode: 'BE', testEnv: true },
        });
        if (!error) setPaymentReady(true);
      } catch (e: any) {
        console.error('Payment init error:', e);
      } finally {
        setPaymentInitLoading(false);
      }
    })();
  }, [step]);

  // Confirme le paiement côté backend avec retry (max 3 tentatives, backoff 1s/2s)
  const confirmPaymentSuccess = async (rId: string | number): Promise<void> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!mountedRef.current) return;
      try {
        await api.payments.success(rId);
        return;
      } catch (e) {
        lastErr = e;
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
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') console.error('Payment sheet error:', presentError.message);
        return;
      }
      await confirmPaymentSuccess(requestId);
      goToMissionView();
    } catch (error: any) {
      console.error('handlePay error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePayment = async () => {
    if (!paymentReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await presentPaymentSheet();
  };

  const canProceed = useMemo(() => {
    if (step === 1) return !!location;
    if (step === 2) return !!categoryId;
    if (step === 3) return step3Ready;
    return true;
  }, [step, location, categoryId, step3Ready]);

  const STEPS = getStepConfig(t);
  const TIME_GROUPS = getTimeGroups(t);
  const currentStep = STEPS[step - 1];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={[s.iconBtn, { backgroundColor: theme.iconBtnBg }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('common.back')} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={theme.text as string} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={[s.stepCount, { color: theme.textMuted }]}>{t('stepper.step_of', { step, total: TOTAL_STEPS })}</Text>
          <Text style={[s.stepName, { color: theme.text }]}>{currentStep.label}</Text>
          <Text style={[s.stepSublabel, { color: theme.textMuted }]}>{currentStep.sublabel}</Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={s.cancelBtn} accessibilityRole="button">
          <Text style={[s.cancelText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step Indicator ── */}
      <StepIndicator step={step} />

      {/* ── Live Summary ── */}
      {step >= 2 && (
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
                    <View style={s.markerDot}>
                      <Ionicons name="location" size={20} color="#FFF" />
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
                      setLocation({ address: data.description, lat, lng });
                      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                  query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:be' }}
                  styles={{
                    container:          { flex: 1, marginLeft: 8 },
                    textInputContainer: { backgroundColor: 'transparent' },
                    textInput: {
                      height:          36,
                      fontSize:        15,
                      fontWeight:      '600',
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
                    description: { fontSize: 14, color: theme.text as string, fontWeight: '500' },
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
                  <TouchableOpacity onPress={() => setLocation(null)} style={[s.addrClear, { backgroundColor: theme.addrClearBg }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('common.clear')} accessibilityRole="button">
                    <Ionicons name="close" size={18} color={theme.textSub as string} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={s.ctaFloating}>
              <BottomCTA
                label={location ? t('stepper.confirm_address') : t('stepper.select_address')}
                onPress={goNext}
                disabled={!location}
              />
            </View>
          </View>
        )}

        {/* ══ ÉTAPE 2 — Service ══ */}
        {step === 2 && (
          <View style={s.flex}>
            <ScrollView style={s.flex} contentContainerStyle={s.step2Pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[s.step2Title, { color: theme.text }]}>{t('stepper.what_do_you_need')}</Text>

              {categories.length === 0 ? (
                <View style={s.loadWrap}>
                  <ActivityIndicator size="large" color={theme.text as string} />
                  <Text style={[s.loadText, { color: theme.textSub }]}>{t('stepper.loading_services')}</Text>
                </View>
              ) : (
                <View style={s.catList}>
                  {categories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      selected={categoryId === cat.id}
                      onPress={() => { setCategoryId(cat.id); setSubcategoryId(null); }}
                    />
                  ))}
                </View>
              )}

              {selectedCategory?.subcategories?.length > 0 && (
                <View style={s.subSection}>
                  <View style={s.subHeader}>
                    <Text style={[s.subTitle, { color: theme.text }]}>{t('stepper.specify')}</Text>
                    {estimatedPrice > 0 && !subcategoryId && (
                      <Text style={[s.priceInline, { color: theme.textSub }]}>{t('stepper.from_price', { price: estimatedPrice })}</Text>
                    )}
                  </View>
                  <View style={s.subList}>
                    {selectedCategory.subcategories.map((sub: any) => (
                      <SubChip
                        key={sub.id}
                        label={sub.name}
                        price={sub.price}
                        selected={subcategoryId === sub.id}
                        onPress={() => setSubcategoryId(sub.id)}
                      />
                    ))}
                  </View>
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

            <BottomCTA label={t('stepper.continue')} onPress={goNext} disabled={!categoryId} price={estimatedPrice > 0 ? estimatedPrice : undefined} />
          </View>
        )}

        {/* ══ ÉTAPE 3 — Planning ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <ScrollView style={s.flex} contentContainerStyle={s.step3Pad} showsVerticalScrollIndicator={false}>

              <View style={s.modeList}>
                {/* Maintenant */}
                <TouchableOpacity
                  style={[s.modeRow2, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'now' && s.modeRow2Selected]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <View style={[s.modeIconSmall, scheduleMode === 'now' && s.modeIconSmallSelected]}>
                    <Ionicons name="flash-outline" size={18} color={scheduleMode === 'now' ? '#FFF' : theme.text as string} />
                  </View>
                  <View style={s.modeTextCol}>
                    <Text style={[s.modeLabel2, { color: theme.text }, scheduleMode === 'now' && s.modeLabelSelected]}>{t('stepper.now')}</Text>
                    <Text style={[s.modeSub2, { color: theme.textSub }, scheduleMode === 'now' && s.modeSubSelected]}>{t('stepper.quick_intervention')}</Text>
                  </View>
                  {scheduleMode === 'now' && <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
                </TouchableOpacity>

                {/* Planifier */}
                <TouchableOpacity
                  style={[s.modeRow2, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'later' && s.modeRow2Selected]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScheduleMode('later'); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <View style={[s.modeIconSmall, scheduleMode === 'later' && s.modeIconSmallSelected]}>
                    <Ionicons name="calendar-outline" size={18} color={scheduleMode === 'later' ? '#FFF' : theme.text as string} />
                  </View>
                  <View style={s.modeTextCol}>
                    <Text style={[s.modeLabel2, { color: theme.text }, scheduleMode === 'later' && s.modeLabelSelected]}>{t('stepper.schedule')}</Text>
                    <Text style={[s.modeSub2, { color: theme.textSub }, scheduleMode === 'later' && s.modeSubSelected]}>{t('stepper.choose_slot')}</Text>
                  </View>
                  {scheduleMode === 'later' && <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
                </TouchableOpacity>
              </View>

              {/* Mode Maintenant */}
              {scheduleMode === 'now' && (
                <View style={[s.nowConfirm, { backgroundColor: theme.nowConfirmBg }]}>
                  <Ionicons name="flash" size={22} color={theme.text as string} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nowTitle, { color: theme.text }]}>{t('stepper.quick_intervention')}</Text>
                    <Text style={[s.nowSub, { color: theme.textSub }]}>{t('stepper.provider_notified')}</Text>
                  </View>
                </View>
              )}

              {/* Mode Plus tard */}
              {scheduleMode === 'later' && (
                <>
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
                  <View style={[s.step3Sep, { backgroundColor: theme.sep }]} />

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
              <View style={[s.floatingGradient, { backgroundColor: theme.gradientBg }]} pointerEvents="none" />
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
            <View style={s.v4Body}>

              {/* Carte récap */}
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

                <TouchableOpacity style={s.v4Row} onPress={handleChangePayment} activeOpacity={0.7} disabled={!paymentReady} accessibilityRole="button">
                  <Ionicons name="card-outline" size={16} color={theme.textSub as string} />
                  {paymentInitLoading ? (
                    <ActivityIndicator size="small" color={theme.textSub as string} style={{ marginLeft: 4 }} />
                  ) : (
                    <Text style={[s.v4Val, { color: theme.text }]}>{t('stepper.card_saved')}</Text>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={theme.textMuted as string} style={s.v4Chevron} />
                </TouchableOpacity>

              </View>

              {/* Total */}
              <View style={s.v4Total}>
                <Text style={[s.v4TotalLabel, { color: theme.textSub }]}>{t('stepper.total_estimated')}</Text>
                <Text style={[s.v4TotalValue, { color: theme.text }]}>{estimatedPrice} €</Text>
              </View>

            </View>

            {/* Footer */}
            <View style={s.v4Footer}>
              <View style={s.v4SecureRow}>
                <Ionicons name="lock-closed-outline" size={13} color={theme.textMuted as string} />
                <Text style={[s.v4Secure, { color: theme.textMuted }]}>{t('stepper.charge_after_validation')}</Text>
              </View>
              <BottomCTA
                label={t('stepper.confirm_mission')}
                onPress={handlePay}
                disabled={loading || !paymentReady}
                loading={loading}
                price={estimatedPrice}
              />
            </View>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles globaux — valeurs structurelles seulement ─────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepCount:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  stepName:     { fontSize: 15, fontWeight: '800', marginTop: 1 },
  stepSublabel: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  cancelBtn:    { paddingHorizontal: 8, paddingVertical: 6 },
  cancelText:   { fontSize: 14, fontWeight: '500' },

  scrollPad: { paddingHorizontal: 24, paddingTop: 28 },

  title:    { fontSize: 30, fontWeight: '800', lineHeight: 38, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '500', marginBottom: 28 },

  loadWrap: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadText: { fontSize: 14, fontWeight: '500' },

  // Step 2
  step2Pad:   { paddingHorizontal: 20, paddingTop: 24 },
  step2Title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 22 },
  catList:    { marginBottom: 4 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  subSection: { marginTop: 20 },
  subHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subTitle:   { fontSize: 14, fontWeight: '700' },
  priceInline:{ fontSize: 13, fontWeight: '600' },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subList:    { gap: 8 },

  priceRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  priceRowLabel:  { fontSize: 13, fontWeight: '600' },
  priceRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRowValue:  { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  priceRowBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRowSub:    { fontSize: 11, fontWeight: '500' },

  noteToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 4 },
  noteToggleText: { fontSize: 13, fontWeight: '500' },
  noteInput:      { borderRadius: 16, padding: 16, fontSize: 15, minHeight: 90, borderWidth: 1.5, fontWeight: '500' },

  // Step 3
  step3Pad:       { paddingHorizontal: 24, paddingTop: 28 },
  step3Sep:       { height: 1, marginVertical: 20 },
  step3Hint:      { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 12 },
  modeList:       { gap: 8, marginBottom: 8 },
  modeRow2:       { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderWidth: 1.5 },
  modeRow2Selected: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  modeIconSmall:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  modeIconSmallSelected: { backgroundColor: 'rgba(255,255,255,0.15)' },
  modeTextCol:    { flex: 1 },
  modeLabel2:     { fontSize: 15, fontWeight: '700' },
  modeLabelSelected: { color: '#FFF' },
  modeSub2:       { fontSize: 12, fontWeight: '500', marginTop: 1 },
  modeSubSelected:{ color: 'rgba(255,255,255,0.6)' },

  nowConfirm: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginTop: 4 },
  nowTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  nowSub:     { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  dayScroll:      { gap: 4, paddingBottom: 16, paddingHorizontal: 4 },
  slotGroup:      { marginBottom: 20 },
  slotGroupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  slotsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  floatingCTA:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  floatingGradient: { height: 32 },

  slotsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  planSummary:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  planSummaryText: { fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },

  // Step 1 — carte
  searchFloat: { position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, gap: 8 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, minHeight: 56, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  addrConfirm: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addrDot:     { width: 10, height: 10, borderRadius: 5 },
  addrText:    { flex: 1, fontSize: 13, fontWeight: '600' },
  addrClear:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ctaFloating: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5 },

  markerWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  markerHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)' },
  markerDot:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', borderWidth: 3, borderColor: '#FFF', alignItems: 'center' as const, justifyContent: 'center' as const, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }) },

  pin:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pinInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },

  // Step 4
  v4Body:       { flex: 1, paddingHorizontal: 20, paddingTop: 20, justifyContent: 'center' },
  v4Card:       { borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  v4Row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 10 },
  v4Val:        { flex: 1, fontSize: 15, fontWeight: '600' },
  v4Sub:        { fontSize: 13, fontWeight: '400', maxWidth: 120 },
  v4Sep:        { height: 1, marginHorizontal: 16 },
  v4Chevron:    { marginLeft: 'auto' as any },
  v4Total:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  v4TotalLabel: { fontSize: 14, fontWeight: '600' },
  v4TotalValue: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  v4Footer:     { paddingHorizontal: 0, paddingBottom: 0 },
  v4SecureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 8 },
  v4Secure:     { textAlign: 'center', fontSize: 12, fontWeight: '500' },

  // Legacy
  recapCard:  { borderRadius: 22, padding: 4, marginBottom: 24 },
  recapRow:   { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  recapIcon:  { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recapInfo:  { flex: 1 },
  recapMeta:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  recapVal:   { fontSize: 15, fontWeight: '700' },
  recapPrice: { fontSize: 24, fontWeight: '800' },
  recapSep:   { height: 1, marginHorizontal: 16 },
  noteOpt:    { fontWeight: '400' },
});