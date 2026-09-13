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
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Modal,
  UIManager,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import { translateCategory, translateSubcategory } from '@/lib/categoryLabel';
import i18nInstance from '@/lib/i18n';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthContext';
import { toIoniconName } from '../../lib/iconMapper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION, useBreathe, useCountingValue, usePresence, usePressScale } from '@/lib/motion';
import { ReText } from '@/components/ui/ReText';
import { StepCTA } from '@/components/request/StepCTA';
import { StepHeader } from '@/components/request/StepHeader';
import { StepPager, type PagerDirection } from '@/components/request/StepPager';
import { deriveCrumbs } from '@/lib/request/crumbs';
import { computePrice } from '@/lib/services/priceService';
import { resolveServiceSelection } from '@/lib/services/serviceSelection';
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
// ─── Cartes Google Maps (source unique light + dark) ────────────────────────────
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/constants/mapStyles';

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
    greenText:       t.greenText,
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
    // Premium dark surface (carte noire Direction B — reste sombre dans les 2 thèmes)
    heroBg:          t.heroBg,
    heroText:        t.heroText,
    heroSub:         t.heroSub,
    heroSubFaint:    t.heroSubFaint,
  };
}

// ─── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, selected, dimmed, onPress }: { cat: any; selected: boolean; dimmed?: boolean; onPress: () => void }) {
  const t     = useTheme();
  const { t: tr } = useTranslation();
  // Retour à l'appui (règle 4) ; les cartes non choisies s'estompent.
  const press = usePressScale(0.96);
  const dim = useSharedValue(1);
  const label = translateCategory(tr, cat);

  useEffect(() => {
    dim.value = withTiming(dimmed ? 0.25 : 1, { duration: 250 });
  }, [dimmed, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const handlePress = () => {
    feedback.haptic('light');
    onPress();
  };

  return (
    <Reanimated.View style={[cc.wrap, press.style, dimStyle]}>
      <TouchableOpacity
        style={[
          cc.card,
          { borderBottomColor: t.surfaceBorder },
          selected && [cc.cardSelected, { backgroundColor: t.surfaceAlt, borderBottomColor: 'transparent' }],
        ]}
        onPress={handlePress}
        {...press.handlers}
        activeOpacity={1}
        accessibilityLabel={label}
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
          {label}
        </Text>
        {selected
          ? <View style={[cc.selectedDot, { backgroundColor: t.text }]} />
          : <Feather name="chevron-right" size={14} color={t.textMuted} />
        }
      </TouchableOpacity>
    </Reanimated.View>
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
  const { t: tr } = useTranslation();
  const press = usePressScale(0.98);
  const dim = useSharedValue(1);
  const isQuote = pricingMode === 'estimate' || pricingMode === 'diagnostic';

  useEffect(() => {
    dim.value = withTiming(dimmed ? 0.3 : 1, { duration: 200 });
  }, [dimmed, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const handlePress = () => {
    feedback.haptic('light');
    onPress();
  };

  return (
    <Reanimated.View style={[press.style, dimStyle]}>
      <TouchableOpacity
        style={[sc.row, { borderBottomColor: t.surfaceBorder }]}
        onPress={handlePress}
        {...press.handlers}
        activeOpacity={0.7}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <View style={[sc.dot, { backgroundColor: isQuote ? COLORS.amber : COLORS.greenBrand }, selected && { backgroundColor: t.text }]} />
        <Text style={[sc.text, { color: t.textSub }, selected && { fontFamily: FONTS.sansMedium, color: t.text }]}>{label}</Text>
        <View style={sc.right}>
          <View style={[sc.pill, { backgroundColor: isQuote ? 'rgba(200,130,10,0.15)' : 'rgba(21,193,110,0.15)' }]}>
            <Text style={[sc.pillText, { color: isQuote ? COLORS.amber : t.greenText }]}>{isQuote ? tr('stepper.pricing_quote') : tr('stepper.pricing_fixed')}</Text>
          </View>
          {selected && <Feather name="check" size={16} color={t.text as string} />}
        </View>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

const sc = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 4, gap: 10, borderBottomWidth: 1 },
  dot:   { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  text:  { flex: 1, fontSize: 15, fontFamily: FONTS.sans },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 70, alignItems: 'center' as const },
  pillText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  priceSmall: { fontSize: 12, fontFamily: FONTS.bebas, includeFontPadding: false },
});

// ─── Time Slot ─────────────────────────────────────────────────────────────────
function TimeSlot({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t     = useTheme();
  const press = usePressScale(0.92);

  const handlePress = () => {
    feedback.haptic('light');
    onPress();
  };

  return (
    <Reanimated.View style={press.style}>
      <TouchableOpacity
        style={[
          tslot.chip,
          { backgroundColor: t.chipBg, borderColor: 'transparent' },
          selected && [tslot.chipSelected, { backgroundColor: t.accent, borderColor: t.accent }],
        ]}
        onPress={handlePress}
        {...press.handlers}
        activeOpacity={1}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {selected && <View style={[tslot.dot, { backgroundColor: t.accentText }]} />}
        <Text style={[tslot.text, { color: t.textSub }, selected && [tslot.textSelected, { color: t.accentText }]]}>{label}</Text>
      </TouchableOpacity>
    </Reanimated.View>
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
  // Le soulignement s'étend sous le jour choisi (MOTION.tab).
  const underline = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    underline.value = withSpring(selected ? 1 : 0, MOTION.tab);
  }, [selected, underline]);
  const underlineStyle = useAnimatedStyle(() => ({ width: `${underline.value * 80}%` }));

  return (
    <TouchableOpacity
      style={dc.wrap}
      onPress={() => { feedback.haptic('light'); onPress(); }}
      activeOpacity={0.7}
      accessibilityLabel={`${day} ${date} ${month}`}
      accessibilityRole="button"
    >
      <Text style={[dc.day,  { color: t.textMuted }, selected && { color: t.text }]}>{day}</Text>
      <Text style={[dc.date, { color: t.textMuted }, selected && { color: t.text }]}>{date}</Text>
      <Text style={[dc.month, { color: 'transparent' }, selected && { color: t.textSub }]}>{month}</Text>
      <Reanimated.View style={[dc.underline, { backgroundColor: t.text as string }, underlineStyle]} />
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, minWidth: 52, gap: 2 },
  day:       { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: FONTS.sansMedium },
  date:      { fontSize: 20, letterSpacing: -0.3, fontFamily: FONTS.bebas, includeFontPadding: false },
  month:     { fontSize: 10, fontFamily: FONTS.sans },
  underline: { height: 2.5, borderRadius: 2, marginTop: 4, alignSelf: 'center' },
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
  const { t } = useTranslation();
  const steps = [
    { num: '1', title: t('ext.stepper_quote_step1_title'), sub: t('ext.stepper_quote_step1_sub') },
    { num: '2', title: t('ext.stepper_quote_step2_title'), sub: t('ext.stepper_quote_step2_sub') },
    { num: '3', title: t('ext.stepper_quote_step3_title'), sub: t('ext.stepper_quote_step3_sub') },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
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
                  {pricingMode === 'diagnostic' ? t('stepper.onsite_diagnostic') : t('stepper.onsite_estimate')}
                </Text>
              </View>
              <Text style={[dim.subtitle, { color: theme.textSub }]}>
                {t('stepper.onsite_desc')}
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
              <Text style={[dim.closeBtnText, { color: theme.accentText, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 }]}>{t('stepper.understood')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Bottom sheet de saisie d'un code promo (offre de lancement). */
function PromoSheet({
  visible, onClose, onApply, applying, theme,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
  applying: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  // Reset le champ à chaque ouverture.
  useEffect(() => { if (visible) setCode(''); }, [visible]);

  const canApply = code.trim().length >= 3 && !applying;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding">
        <Pressable onPress={() => {}}>
          <View style={[dim.sheet, { backgroundColor: theme.card, borderRadius: 24, paddingHorizontal: 24 }]}>
            <View style={dim.titleRow}>
              <View style={[dim.iconWrap, { backgroundColor: 'rgba(21,193,110,0.15)', borderColor: 'rgba(21,193,110,0.3)' }]}>
                <Feather name="tag" size={20} color={theme.greenText} />
              </View>
              <Text style={[dim.title, { color: theme.text }]}>{t('stepper.promo_title') || 'Code promo'}</Text>
            </View>
            <Text style={[dim.subtitle, { color: theme.textSub, marginTop: 8 }]}>
              {t('stepper.promo_subtitle') || 'Saisissez votre code pour bénéficier de l’offre.'}
            </Text>

            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!applying}
              placeholder="LAUNCH25"
              placeholderTextColor={theme.textMuted as string}
              onSubmitEditing={() => canApply && onApply(code)}
              returnKeyType="done"
              style={{
                marginTop: 20, height: 56, borderRadius: 16, paddingHorizontal: 18,
                backgroundColor: theme.surface as string, borderWidth: 1, borderColor: theme.surfaceBorder as string,
                fontFamily: FONTS.mono, fontSize: 18, letterSpacing: 2, color: theme.text as string,
              }}
            />

            <TouchableOpacity
              style={[dim.closeBtn, { backgroundColor: canApply ? theme.accent : (theme.surface as string), marginHorizontal: 0, marginTop: 18, opacity: canApply ? 1 : 0.6 }]}
              onPress={() => canApply && onApply(code)}
              activeOpacity={0.85}
              disabled={!canApply}
              accessibilityRole="button"
            >
              {applying ? (
                <ActivityIndicator color={theme.accentText as string} />
              ) : (
                <Text style={{ color: (canApply ? theme.accentText : theme.textMuted) as string, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 }}>
                  {t('stepper.promo_apply') || 'APPLIQUER'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const dim = StyleSheet.create({
  header:       { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, paddingTop: 14 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
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

// ─── DIRECTION B · helpers + composants paiement ────────────────────────────────
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const stripEuro = (s: string) => String(s ?? '').replace(/\s*€\s*$/, '').trim();

/** HT affiché = TTC − TVA (le mockup : 182,70 − 8,70 = 174,00). */
function htEuros(dp: any): string {
  const c = dp?.cents;
  if (c && Number.isFinite(c.totalTVAC) && Number.isFinite(c.vat)) {
    return formatEURCents(c.totalTVAC - c.vat);
  }
  const num = (x: any) => parseFloat(String(x ?? '0').replace(/\s/g, '').replace(',', '.')) || 0;
  return formatEUR(Math.max(0, num(dp?.totalTVAC) - num(dp?.vat)));
}


/** Carte noire premium : montant héros, filigrane FIXED, pied TVA/HT.
 *  `original` (montant barré) + `savings` (pill verte) → état remise promo. */
function AmountCardB({
  theme, label, euros, footerLeft, footerRight, original, savings, loading,
}: {
  theme: any; label: string; euros: string;
  footerLeft: React.ReactNode; footerRight?: React.ReactNode;
  original?: string; savings?: string; loading?: boolean;
}) {
  // Moment 10 : le montant COMPTE vers sa nouvelle valeur, le bloc respire
  // une fois, et le delta apparaît puis s'efface seul. Aucun toast : le prix
  // qui bouge est le feedback.
  const amount = useMemo(() => {
    const n = parseFloat(String(euros).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [euros]);
  const counter = useCountingValue(amount, { decimals: 2, preset: MOTION.count });
  const breathe = useBreathe();
  const prevRef = useRef(amount);
  const [delta, setDelta] = useState<number | null>(null);
  const deltaPresence = usePresence(delta !== null, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => {
    if (prevRef.current === amount) return;
    const d = amount - prevRef.current;
    prevRef.current = amount;
    breathe.pulse();
    setDelta(d);
    const id = setTimeout(() => setDelta(null), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- breathe est stable
  }, [amount]);
  return (
    <View
      style={{
        position: 'relative', borderRadius: 26, overflow: 'hidden',
        backgroundColor: theme.heroBg, padding: 22,
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 10,
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'transparent', 'rgba(0,0,0,0.22)']}
        locations={[0, 0.5, 1]}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: theme.heroSub }}>{label}</Text>
        {savings ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(21,193,110,0.16)', borderWidth: 1, borderColor: 'rgba(21,193,110,0.4)' }}>
            <Feather name="tag" size={11} color={COLORS.green} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, color: COLORS.green }}>{savings}</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 3, color: theme.heroSubFaint }}>FIXED</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'baseline' }, breathe.style]}>
          <ReText
            animatedProps={counter.animatedProps}
            style={{ fontFamily: FONTS.bebas, fontSize: 54, letterSpacing: 0.5, lineHeight: 56, color: theme.heroText }}
            accessibilityLabel={`${euros} €`}
          />
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroSub }}> €</Text>
        </Reanimated.View>
        <Reanimated.View style={[{ position: 'absolute', right: 0, top: -18 }, deltaPresence.style]} pointerEvents="none">
          {delta !== null && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5, color: delta > 0 ? COLORS.amber : COLORS.green }}>
              {delta > 0 ? '+' : '−'} {Math.abs(delta).toFixed(2).replace('.', ',')} €
            </Text>
          )}
        </Reanimated.View>
        {original ? (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 17, color: theme.heroSubFaint, textDecorationLine: 'line-through' }}>
            {original} €
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>{footerLeft}</View>
        {footerRight != null ? <View style={{ flexShrink: 0 }}>{footerRight}</View> : null}
      </View>

      {/* Loader pendant l'init du paiement (lock prix + création demande + PaymentSheet) */}
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>Préparation du paiement…</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Ligne récap en tuile-icône (Direction B). */
function RecapTile({
  theme, icon, title, sub, right, onPress,
}: {
  theme: any; icon: any; title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void;
}) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap {...(onPress ? { onPress, activeOpacity: 0.7 } : {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={17} color={theme.text as string} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontFamily: FONTS.sansMedium, color: theme.text as string }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12.5, fontFamily: FONTS.sans, color: theme.textSub as string, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right != null ? right : null}
    </Wrap>
  );
}

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
  // Sens de la prochaine transition d'étape (StepPager) : 1 en avant, -1 en arrière.
  const dirRef = useRef<PagerDirection>(1);

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Préférence prestataire (CTA "Demander X" depuis fiche provider) ──
  // Stockée localement pour permettre au client de retirer la préférence en
  // cours de stepper s'il change d'avis (banner avec X).
  const [preferred, setPreferred] = useState<{ id: string; name: string } | null>(
    preferredProviderId ? { id: preferredProviderId, name: preferredProviderName || t('stepper.this_provider') } : null,
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

  // ── Zone de service : Région de Bruxelles-Capitale (19 communes) ─────────
  // Les codes postaux de la RBC vont de 1000 (Bruxelles) à 1210 (Saint-Josse),
  // codes institutionnels 1005-1049 inclus. Le code suivant est 1300 (Wavre,
  // Brabant wallon) : la plage 1000-1212 est donc sûre et exhaustive.
  const BRUSSELS_POSTAL_MIN = 1000;
  const BRUSSELS_POSTAL_MAX = 1212;
  // Fallback quand aucun code postal n'est disponible (adresse enregistrée :
  // on ne dispose que de la chaîne). Noms des 19 communes en FR et NL, plus
  // les anciennes communes de Bruxelles-Ville. 'molenbeek' couvre les deux
  // formes, 'woluwe' couvre les quatre.
  const BRUSSELS_COMMUNES = [
    'anderlecht',
    'auderghem', 'oudergem',
    'berchem-sainte-agathe', 'sint-agatha-berchem',
    'bruxelles', 'brussel',
    'laeken', 'laken', 'neder-over-heembeek', 'haren',
    'etterbeek',
    'evere',
    'forest', 'vorst',
    'ganshoren',
    'ixelles', 'elsene',
    'jette',
    'koekelberg',
    'molenbeek',
    'saint-gilles', 'sint-gillis',
    'saint-josse', 'sint-joost',
    'schaerbeek', 'schaarbeek',
    'uccle', 'ukkel',
    'watermael-boitsfort', 'watermaal-bosvoorde',
    'woluwe',
  ];
  function checkLocation(description: string, addressComponents?: any[]): boolean {
    // 1. Le code postal Google fait autorité dès qu'il est présent.
    const postalComp = addressComponents?.find((c: any) => c.types.includes('postal_code'));
    const postal = parseInt(postalComp?.short_name || postalComp?.long_name || '', 10);
    if (Number.isFinite(postal)) {
      return postal >= BRUSSELS_POSTAL_MIN && postal <= BRUSSELS_POSTAL_MAX;
    }
    // 2. Sinon, match sur le nom de commune — mais en ignorant le premier
    //    segment (la rue), sans quoi « Chaussée de Bruxelles » à Waterloo
    //    passerait pour une adresse bruxelloise.
    const parts = description.split(',');
    const locality = (parts.length > 1 ? parts.slice(1).join(',') : description).toLowerCase();
    return BRUSSELS_COMMUNES.some(c => locality.includes(c));
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
      feedback.haptic('success');
    } catch {
      feedback.error(t('addresses.max_reached'));
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
  // TVA : logement de +10 ans (cas du taux réduit 6%). Défaut true (bâti ancien majoritaire).
  const [buildingOver10y, setBuildingOver10y] = useState<boolean>(true);
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
  // Flow de paiement + réservabilité du service choisi. Logique extraite dans
  // lib/services/serviceSelection.ts : elle doit rester alignée sur le serveur
  // (un prix inconnu n'est PAS gratuit), sinon l'étape 4 annonce « Service
  // gratuit » et /requests répond 400 PRICING_TOKEN_REQUIRED — le CTA meurt.
  // C'est exactement le rejet Apple 2.1(a) du 18/08/2026.
  const selection = useMemo(
    () => resolveServiceSelection(selectedCategory, selectedSubcategory),
    [selectedCategory, selectedSubcategory],
  );
  const {
    basePrice, pricingMode, calloutFee, isFreeService, isQuoteFlow,
    serviceChosen, categoryUnavailable,
  } = selection;

  // ── TVA service : 6% rénovation (logement >=10 ans + usage privé) sinon 21% ──
  // privateUse dérivé du type de bâtiment (bureau = usage pro → 21%).
  // vatEligible : la serrurerie / le dépannage non immobilier reste à 21%.
  const vatEligible = String(selectedCategory?.slug || '').toLowerCase() !== 'serrurerie'
    && (selectedSubcategory?.isImmovableWork !== false);
  const privateUse  = buildingType !== 'office';
  const vatRate     = (vatEligible && buildingOver10y && privateUse) ? 0.06 : 0.21;
  // serviceName est passé en param URL aux écrans suivants (missionview, tracking).
  // On le génère dans la langue active i18n via translateSubcategory + translateCategory
  // pour que le titre s'affiche traduit (ex: "Druk bijvullen" en NL au lieu de
  // "Regonflage pression chaudière" en FR).
  const serviceName     = (selectedSubcategory ? translateSubcategory(i18nInstance.language, selectedSubcategory) : null)
                        || (selectedCategory ? translateCategory(t, selectedCategory) : null)
                        || null;
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
    vatRate,
  }), [basePrice, isUrgent, requestDateIso, vatRate]);
  const estimatedPrice  = parseFloat(priceDetails.totalTVAC);
  const urgencySurcharge = parseFloat(priceDetails.urgentFee);
  const step3Ready = scheduleMode === 'now' || (scheduleMode === 'later' && !!selectedDayIso && !!selectedTime);

  // Chargement catégories
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/categories');
        const all = extractArrayPayload(response);
        // Catalogue actuel — seulement Plomberie et Serrurerie
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

  const goNext = () => {
    feedback.haptic('medium');
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
    dirRef.current = 1;
    setStep((p) => Math.min(p + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    feedback.haptic('light');
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    } else {
      dirRef.current = -1;
      setStep((p) => p - 1);
    }
  };
  /** Puce de l'en-tête : revenir à une étape déjà franchie. */
  const goTo = (target: number) => {
    if (target >= step) return;
    dirRef.current = -1;
    setStep(target);
  };

  // Android : le retour physique revient à l'étape précédente au lieu de
  // quitter le stepper (perte de saisie). À l'étape 1 → confirmation.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) {
        goBack();
        return true;
      }
      feedback.confirm({
        title:       t('stepper.quit_title'),
        message:     t('stepper.quit_msg'),
        confirm:     t('stepper.quit_confirm'),
        cancel:      t('common.continue'),
        destructive: true,
      }).then((ok) => {
        if (!ok || !mountedRef.current) return;
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/dashboard');
      });
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Étape 4 — paiement
  const [devisModalVisible, setDevisModalVisible] = useState(false);
  const [requestId,          setRequestId]         = useState<string | null>(null);
  const [paymentReady,       setPaymentReady]       = useState(false);
  // Store-review : le backend (comptes REVIEW_DEMO_EMAILS) renvoie { demo:true } →
  // on saute la PaymentSheet. Inerte pour un vrai utilisateur (demo jamais renvoyé).
  const [bypassPayment,      setBypassPayment]      = useState(false);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);
  const [priceDetailOpen,    setPriceDetailOpen]    = useState(false);
  const [pricingToken,       setPricingToken]       = useState<string | null>(null);
  const [serverPrice,        setServerPrice]        = useState<ReturnType<typeof computePrice> | null>(null);
  const [pricingError,       setPricingError]       = useState<string | null>(null);
  const [confirmedCalloutCents, setConfirmedCalloutCents] = useState<number | null>(null);
  // Incrémenté par le bouton "Réessayer" de la bannière d'erreur → relance l'init paiement.
  const [initAttempt,        setInitAttempt]        = useState(0);
  // Paiement Stripe débité mais /payments/success en échec après 3 tentatives →
  // on affiche un CTA "Réessayer" manuel (jamais de retry récursif infini).
  const [confirmRetryNeeded, setConfirmRetryNeeded] = useState(false);

  // ── Code promo / offre de lancement (mode prix fixe) ──
  // appliedPromo = remise validée 100% serveur (jamais le montant saisi côté app).
  // Le backend supporte aussi CALLOUT_COVERED (mode estimate), mais l'UI promo n'est
  // exposée que sur le flow fixe ; estimate suivra au go-live devis.
  const [promoSheetVisible, setPromoSheetVisible] = useState(false);
  const [promoApplying,     setPromoApplying]     = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountCents: number; nominalCents: number } | null>(null);

  // Reset prix/paiement dès que l'utilisateur change de service, d'adresse,
  // de créneau, d'urgence ou de TVA : le PaymentIntent doit TOUJOURS refléter
  // les valeurs courantes (jamais un ancien prix/RDV/adresse verrouillé).
  // Le retour au step 4 relancera l'init (effet [step, initAttempt] ci-dessous).
  useEffect(() => {
    // Annule la demande PENDING_PAYMENT devenue obsolète pour éviter les
    // demandes orphelines côté client ("reprendre paiement", documents…).
    if (requestId) {
      api.requests.cancel(String(requestId)).catch(() => {});
    }
    setServerPrice(null);
    setPaymentReady(false);
    setPricingToken(null);
    setRequestId(null);
    setConfirmedCalloutCents(null);
    setAppliedPromo(null);
    setPricingError(null);
    setConfirmRetryNeeded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcategoryId, categoryId, location, scheduleMode, selectedDayIso, selectedTime, isUrgent, buildingOver10y, buildingType]);

  // Prix affiché = prix serveur (si disponible) ou estimation client
  const displayPrice = serverPrice || priceDetails;
  const displayTotal = parseFloat(displayPrice.totalTVAC);

  // ── Montants remisés (offre de lancement, mode fixe) ──
  // Source de vérité = appliedPromo (validé serveur). Fallbacks défensifs.
  const nominalCentsFixed = appliedPromo?.nominalCents ?? Math.round(displayTotal * 100);
  const discountedCentsFixed = appliedPromo
    ? Math.max(0, nominalCentsFixed - appliedPromo.discountCents)
    : nominalCentsFixed;

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
        // Demande partiellement créée lors d'une tentative précédente (init en
        // échec) → annulée avant d'en recréer une (évite les orphelines).
        if (requestId) {
          api.requests.cancel(String(requestId)).catch(() => {});
          setRequestId(null);
        }
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
          // Store-review : { demo:true } → le backend a déjà fait QUOTE_PENDING + broadcast
          // (aucune charge). On saute la PaymentSheet ; handlePay navigue directement.
          if (calloutRes.demo) {
            if (!cancelled) { setBypassPayment(true); setPaymentReady(true); }
            return;
          }
          const { error } = await initPaymentSheet({
            merchantDisplayName:      'Fixed',
            paymentIntentClientSecret: calloutRes.clientSecret,
            applePay:  { merchantCountryCode: 'BE' },
            googlePay: { merchantCountryCode: 'BE', testEnv: false },
            paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
          });
          if (error) throw new Error(error.message);
          if (!cancelled) setPaymentReady(true);
          return;
        }

        // ── Flow prix fixe : verrouiller le prix côté serveur ──
        const lockRes = await api.post('/pricing/lock', {
          categoryId:   selectedCategory.id,
          ...(subcategoryId && { subcategoryId }),
          isUrgent,
          scheduledFor: scheduledFor || new Date().toISOString(),
          pricingMode,
          ...(vatEligible ? { buildingOver10y, privateUse } : {}),
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
        // Store-review : { demo:true } → pas de charge, on saute la sheet ; /success
        // (branche démo) fera la transition PUBLISHED + broadcast au tap du CTA.
        if (res.demo) {
          if (!cancelled) { setBypassPayment(true); setPaymentReady(true); }
          return;
        }
        const clientSecret = res.paymentIntentClientSecret || res.setupIntentClientSecret;
        const { error } = await initPaymentSheet({
          merchantDisplayName:        'Fixed',
          paymentIntentClientSecret:  clientSecret,
          customerEphemeralKeySecret: res.ephemeralKey,
          customerId:                 res.customer,
          applePay:  { merchantCountryCode: 'BE' },
          googlePay: { merchantCountryCode: 'BE', testEnv: false },
          paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
        });
        if (error) throw new Error(error.message);
        if (!cancelled) setPaymentReady(true);
      } catch (e: any) {
        if (!cancelled) {
          devError('Payment init error:', e);
          setPricingError(e?.message || t('stepper.pricing_error'));
        }
      } finally {
        if (!cancelled) setPaymentInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, initAttempt]);

  // Confirme le paiement côté backend avec retry (max 3 tentatives, backoff 1s/2s).
  // Un seul cycle : après 3 échecs on throw — l'appelant affiche un CTA
  // "Réessayer" manuel (pas de récursion infinie, pas de navigation différée).
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
    throw lastErr;
  };

  // CTA manuel après échec de confirmation (le débit Stripe a déjà eu lieu :
  // on ne re-présente JAMAIS la PaymentSheet, on rejoue seulement /success).
  const retryConfirmPayment = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      await confirmPaymentSuccess(requestId);
      if (!mountedRef.current) return;
      setConfirmRetryNeeded(false);
      feedback.haptic('success');
      goToMissionView();
    } catch (e: any) {
      devError('retryConfirmPayment error:', e);
      if (mountedRef.current) feedback.error(t('stepper.confirm_retry_failed'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const goToMissionView = () => {
    // Montant réellement débité : prix serveur verrouillé, remise promo déduite
    // (jamais l'estimation client — sinon l'écran suivant affiche un faux prix).
    const chargedPrice = isQuoteFlow ? '' : (discountedCentsFixed / 100).toFixed(2);
    const calloutParam = isQuoteFlow && confirmedCalloutCents != null
      ? (confirmedCalloutCents / 100).toFixed(2)
      : '';
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
          price:          chargedPrice,
          calloutFee:     calloutParam,
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
          price:          chargedPrice,
          calloutFee:     calloutParam,
          isQuote:        isQuoteFlow ? '1' : '',
          scheduledLabel: scheduledLabel || t('stepper.now'),
          lat:            String(location?.lat  ?? ''),
          lng:            String(location?.lng  ?? ''),
        },
      });
    }
  };

  // (Ré)initialise la feuille de paiement prix-fixe avec/sans code promo.
  // code=null → plein tarif. Ne consomme JAMAIS le code (brûlé au paiement réussi
  // seulement). Validation + remise 100% serveur. /setup est idempotent/rejouable.
  const refreshFixedSheet = async (code: string | null) => {
    if (!requestId) return;
    setPromoApplying(true);
    try {
      const res: any = await api.payments.setup(requestId, code || undefined);
      const clientSecret = res.paymentIntentClientSecret || res.setupIntentClientSecret;
      const { error } = await initPaymentSheet({
        merchantDisplayName:        'Fixed',
        paymentIntentClientSecret:  clientSecret,
        customerEphemeralKeySecret: res.ephemeralKey,
        customerId:                 res.customer,
        applePay:  { merchantCountryCode: 'BE' },
        googlePay: { merchantCountryCode: 'BE', testEnv: false },
        paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
      });
      if (error) throw new Error(error.message);
      setAppliedPromo(
        res.promo
          ? { code: res.promo.code, discountCents: res.promo.discountCents, nominalCents: res.promo.nominalCents }
          : null
      );
      setPaymentReady(true);
    } finally {
      setPromoApplying(false);
    }
  };

  const applyPromo = async (raw: string) => {
    const code = raw.trim();
    if (!code || !requestId) return;
    try {
      await refreshFixedSheet(code);
      feedback.haptic('success');
      setPromoSheetVisible(false);
    } catch (e: any) {
      // e.message = message FR renvoyé par le backend (PROMO_INVALID, _TOO_SMALL, _ALREADY_USED…)
      feedback.error(e?.message || t('stepper.promo_invalid') || 'Code promo invalide.');
    }
  };

  const removePromo = async () => {
    feedback.haptic('light');
    try {
      await refreshFixedSheet(null);
    } catch (e: any) {
      devError('removePromo error:', e);
    }
  };

  const handlePay = async () => {
    if (!paymentReady || !requestId || confirmRetryNeeded) return;
    setLoading(true);
    try {
      // Service gratuit → pas de payment sheet, publication directe.
      // On ne navigue vers missionview QUE si la publication a réussi.
      if (isFreeService) {
        try {
          await api.payments.success(String(requestId));
        } catch (e: any) {
          devError('free publish error:', e);
          feedback.error(t('stepper.publish_failed'));
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
        return;
      }

      // Store-review DEMO (prix-fixe uniquement) : pas de PaymentSheet.
      // /success (branche démo) publie la mission + broadcast aux prestataires.
      if (bypassPayment) {
        // Flow devis démo : le backend (callout-payment démo) a déjà fait QUOTE_PENDING
        // + broadcast aux prestas — rien à confirmer, on navigue directement.
        if (isQuoteFlow) {
          if (!mountedRef.current) return;
          feedback.haptic('success');
          goToMissionView();
          return;
        }
        // Flow prix-fixe démo : /success publie la mission + broadcast aux prestataires.
        try {
          await confirmPaymentSuccess(requestId);
        } catch (e: any) {
          devError('demo confirm error:', e);
          if (mountedRef.current) {
            setConfirmRetryNeeded(true);
            feedback.error(t('stepper.confirm_failed_retry'));
          }
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          devError('Payment sheet error:', presentError.message);
          feedback.error(t('stepper.payment_failed'));
        }
        return;
      }

      if (isQuoteFlow) {
        // Confirmer le callout et lancer le broadcast aux providers
        try {
          await api.post('/quotes/confirm-callout', { requestId });
        } catch (e: any) {
          devError('confirm-callout error:', e);
          feedback.error(t('stepper.callout_confirm_failed'));
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
      } else {
        try {
          await confirmPaymentSuccess(requestId);
        } catch (e: any) {
          // Le client a déjà été débité par Stripe → surtout ne pas re-présenter
          // la PaymentSheet : on propose une relance manuelle de la confirmation.
          devError('confirmPaymentSuccess error:', e);
          if (mountedRef.current) {
            setConfirmRetryNeeded(true);
            feedback.error(t('stepper.payment_ok_confirm_failed'));
          }
          return;
        }
        if (!mountedRef.current) return;
        goToMissionView();
      }
    } catch (error: any) {
      devError('handlePay error:', error);
      feedback.error(t('stepper.payment_generic_error'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const STEPS = getStepConfig(t);
  const TIME_GROUPS = getTimeGroups(t);
  const currentStep = STEPS[step - 1] || STEPS[STEPS.length - 1];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* ── En-tête : retour, titre, ligne de progression, puces (planche 1A) ── */}
      <StepHeader
        step={step}
        total={TOTAL_STEPS}
        title={currentStep.label}
        onBack={goBack}
        backLabel={t('common.back')}
        crumbs={deriveCrumbs({ step, address: location?.address ?? null, serviceName })}
        onJump={goTo}
      />

      {/* ── Préférence prestataire (CTA "Demander X" depuis fiche) ── */}
      {preferred && (
        <View style={[s.preferredBanner, { backgroundColor: theme.surface, borderColor: theme.sep }]}>
          <Feather name="user-check" size={14} color={theme.text as string} />
          <Text style={[s.preferredBannerText, { color: theme.text, fontFamily: FONTS.sans }]}>
            {t('stepper.request_priority_prefix')}<Text style={{ fontFamily: FONTS.sansMedium }}>{preferred.name}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setPreferred(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('stepper.remove_preference_a11y')}
          >
            <Feather name="x" size={16} color={theme.textMuted as string} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Contenu de l'étape, poussé latéralement à chaque changement ── */}
      <StepPager page={step} direction={dirRef.current} style={s.flex}>

        {/* ══ ÉTAPE 1 — Lieu ══ */}
        {step === 1 && (
          <View style={s.flex}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFillObject}
              initialRegion={DEFAULT_REGION}
              customMapStyle={theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
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
                      feedback.haptic(allowed && hasStreetNumber ? 'success' : 'error');
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
                      accessibilityRole="button"
                      accessibilityLabel={t('stepper.saved_addresses_a11y')}
                      accessibilityState={{ expanded: showAddrDropdown }}
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
                      accessibilityRole="button"
                      accessibilityLabel={t('common.save')}
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
                          feedback.haptic('light');
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
                    {t('stepper.zone_notice')}
                  </Text>
                </View>
              )}
              {location && addressMissingNumber && (
                <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
                  <Feather name="alert-circle" size={16} color={COLORS.orangeBrand} />
                  <Text style={[s.addrText, { color: COLORS.orangeBrand, flex: 1 }]} numberOfLines={2}>
                    {t('ext.stepper_addr_missing_number')}
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
              <StepCTA
                floating
                label={t('stepper.confirm_address')}
                onPress={goNext}
                disabled={!location || !locationAllowed || addressMissingNumber}
                hint={!location ? t('stepper.select_address') : undefined}
                style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
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
            <KeyboardAvoidingView behavior="padding">
            <View style={{
              backgroundColor: theme.card as string, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
              borderTopWidth: 1, borderTopColor: theme.cardBorder as string,
            }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: theme.sep as string, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

              {/* Title */}
              <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, color: theme.text as string, letterSpacing: 1, marginBottom: 6 }}>
                {t('stepper.name_this_address')}
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
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Domicile' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_home')}</Text>
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
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Bureau' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_work')}</Text>
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
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Autre' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_other')}</Text>
                </TouchableOpacity>
              </View>

              {/* Custom input */}
              <TextInput
                value={saveLabel}
                onChangeText={setSaveLabel}
                placeholder={t('stepper.custom_name_placeholder')}
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
            </KeyboardAvoidingView>
          </View>
        )}

        {/* ══ ÉTAPE 2 — Service ══ */}
        {step === 2 && (
          <KeyboardAvoidingView style={s.flex} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
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
                              {/* Le choix d'une sous-catégorie est obligatoire (c'est elle qui
                                  porte le prix) — on le dit explicitement tant que rien n'est
                                  sélectionné, pour que le CTA grisé ne soit jamais un mystère. */}
                              {!subcategoryId ? (
                                <Text style={[s.priceInline, { color: theme.textSub }]}>{t('stepper.select_service_type')}</Text>
                              ) : estimatedPrice > 0 ? (
                                <Text style={[s.priceInline, { color: theme.textSub }]}>{t('stepper.from_price', { price: estimatedPrice })}</Text>
                              ) : null}
                            </View>
                            <View style={s.subList}>
                              {subs.map((sub: any) => (
                                <SubChip
                                  key={sub.id}
                                  label={translateSubcategory(i18nInstance.language, sub)}
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
                        {/* Catégorie sans sous-catégorie ET sans prix : non réservable
                            (aucun prix à verrouiller). On l'annonce au lieu de laisser
                            le parcours mener à une erreur de paiement à l'étape 4. */}
                        {isSelected && categoryUnavailable && (
                          <View style={s.inlineSubs}>
                            <Text style={[s.priceInline, { color: theme.textSub }]}>
                              {t('stepper.service_unavailable')}
                            </Text>
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

            <StepCTA
              label={isQuoteFlow ? t('stepper.request_quote_cta') : t('stepper.continue')}
              onPress={goNext}
              disabled={!serviceChosen}
              hint={t('stepper.select_service_type')}
            />
          </KeyboardAvoidingView>
        )}

        {/* ══ ÉTAPE 3 — Planning ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <ScrollView style={s.flex} contentContainerStyle={s.step3Pad} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>

              <View style={s.modeGrid}>
                {/* Maintenant */}
                <TouchableOpacity
                  style={[s.modeCard, { backgroundColor: theme.modeCardBg, borderColor: 'transparent' }, scheduleMode === 'now' && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => { feedback.haptic('medium'); setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }}
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
                  onPress={() => { feedback.haptic('medium'); setScheduleMode('later'); setIsUrgent(false); }}
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

              {/* ── Urgence (mode maintenant) — câblé sur isUrgent : majoration
                     et callout urgent calculés côté serveur ── */}
              {scheduleMode === 'now' && (
                <View style={{ marginTop: 24 }}>
                  <View style={[ai.sep, { backgroundColor: theme.sep }]} />
                  <TouchableOpacity
                    style={ai.header}
                    onPress={() => { feedback.haptic('medium'); setIsUrgent(prev => !prev); }}
                    activeOpacity={0.7}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isUrgent }}
                    accessibilityLabel={t('stepper.urgency_label')}
                  >
                    <View style={[ai.headerIcon, { backgroundColor: isUrgent ? theme.accent : theme.surface }]}>
                      <Feather name="zap" size={16} color={isUrgent ? theme.accentText as string : theme.textSub as string} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ai.headerTitle, { color: theme.text }]}>{t('stepper.urgency_label')}</Text>
                      <Text style={[ai.headerSub, { color: theme.textMuted }]}>
                        {isQuoteFlow
                          ? t('stepper.urgency_desc_callout')
                          : t('stepper.urgency_desc_surcharge')}
                      </Text>
                    </View>
                    <View style={{
                      width: 46, height: 28, borderRadius: 14, padding: 3,
                      backgroundColor: isUrgent ? (theme.accent as string) : (theme.surface as string),
                      borderWidth: 1.5,
                      borderColor: isUrgent ? (theme.accent as string) : (theme.surfaceBorder as string),
                      alignItems: isUrgent ? 'flex-end' : 'flex-start',
                      justifyContent: 'center',
                    }}>
                      <View style={{
                        width: 19, height: 19, borderRadius: 10,
                        backgroundColor: isUrgent ? (theme.accentText as string) : (theme.textMuted as string),
                      }} />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── TVA : âge du logement (détermine 6% vs 21%) ── */}
              {vatEligible && (
                <View style={{ marginTop: 24 }}>
                  <View style={[ai.sep, { backgroundColor: theme.sep }]} />
                  <View style={{ marginTop: 16 }}>
                    <Text style={[ai.headerTitle, { color: theme.text }]}>{t('stepper.vat_dwelling_title')}</Text>
                    <Text style={[ai.headerSub, { color: theme.textMuted, marginBottom: 12 }]}>
                      {vatRate === 0.06 ? t('stepper.vat_reduced_hint') : t('stepper.vat_standard_hint')}
                    </Text>
                    <View style={ai.chipRow}>
                      {([
                        { val: true,  label: t('stepper.vat_over10') },
                        { val: false, label: t('stepper.vat_under10') },
                      ] as const).map(opt => (
                        <TouchableOpacity
                          key={String(opt.val)}
                          style={[
                            ai.chip,
                            { borderColor: buildingOver10y === opt.val ? theme.accent : theme.surfaceBorder },
                            buildingOver10y === opt.val && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => { feedback.haptic('light'); setBuildingOver10y(opt.val); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[ai.chipText, { color: buildingOver10y === opt.val ? theme.accentText : theme.textSub }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
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
                    <Text style={[ai.headerTitle, { color: theme.text }]}>{t('stepper.access_info_title')}</Text>
                    <Text style={[ai.headerSub, { color: theme.textMuted }]}>{t('stepper.access_info_sub')}</Text>
                  </View>
                  <Feather name={accessExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted as string} />
                </TouchableOpacity>

                {accessExpanded && (
                  <View style={ai.body}>
                    {/* Type de bâtiment */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.building_type')}</Text>
                    <View style={ai.chipRow}>
                      {([
                        { key: 'apartment', label: 'stepper.building_apartment', icon: 'layers' },
                        { key: 'house',     label: 'stepper.building_house',     icon: 'home' },
                        { key: 'office',    label: 'stepper.building_office',    icon: 'briefcase' },
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
                          <Text style={[ai.chipText, { color: buildingType === bt.key ? theme.accentText : theme.textSub }]}>{t(bt.label)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Étage + Ascenseur */}
                    <View style={ai.inlineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.floor')}</Text>
                        <View style={[ai.inputWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                          <Feather name="arrow-up" size={14} color={theme.textMuted as string} />
                          <TextInput
                            style={[ai.input, { color: theme.text }]}
                            value={floorNum}
                            onChangeText={setFloorNum}
                            placeholder={t('stepper.floor_placeholder')}
                            placeholderTextColor={theme.textMuted as string}
                            keyboardType="number-pad"
                            maxLength={3}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.elevator')}</Text>
                        <View style={ai.chipRow}>
                          <TouchableOpacity
                            style={[ai.chip, { borderColor: hasElevator === true ? theme.accent : theme.surfaceBorder }, hasElevator === true && { backgroundColor: theme.accent }]}
                            onPress={() => setHasElevator(prev => prev === true ? null : true)}
                            activeOpacity={0.7}
                          >
                            <Feather name="check" size={14} color={hasElevator === true ? theme.accentText as string : theme.textSub as string} />
                            <Text style={[ai.chipText, { color: hasElevator === true ? theme.accentText : theme.textSub }]}>{t('common.yes')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[ai.chip, { borderColor: hasElevator === false ? theme.accent : theme.surfaceBorder }, hasElevator === false && { backgroundColor: theme.accent }]}
                            onPress={() => setHasElevator(prev => prev === false ? null : false)}
                            activeOpacity={0.7}
                          >
                            <Feather name="x" size={14} color={hasElevator === false ? theme.accentText as string : theme.textSub as string} />
                            <Text style={[ai.chipText, { color: hasElevator === false ? theme.accentText : theme.textSub }]}>{t('common.no')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Notes d'accès */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.access_instructions')}</Text>
                    <View style={[ai.textareaWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                      <TextInput
                        style={[ai.textarea, { color: theme.text }]}
                        value={accessNotes}
                        onChangeText={setAccessNotes}
                        placeholder={t('stepper.access_placeholder')}
                        placeholderTextColor={theme.textMuted as string}
                        multiline
                        maxLength={500}
                        textAlignVertical="top"
                      />
                    </View>

                    {/* Langue */}
                    <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.preferred_language')}</Text>
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
              <StepCTA
                label={
                  scheduleMode === 'now'
                    ? t('stepper.confirm_now')
                    : (selectedDayIso && selectedTime
                      ? t('stepper.confirm_at', { day: days.find(d => d.iso === selectedDayIso)?.day, date: days.find(d => d.iso === selectedDayIso)?.date, time: selectedTime })
                      : t('stepper.confirm_slot'))
                }
                onPress={goNext}
                disabled={!step3Ready}
                hint={
                  scheduleMode === null
                    ? t('stepper.hint_choose_mode')
                    : !selectedDayIso ? t('stepper.hint_choose_day') : t('stepper.hint_choose_slot')
                }
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

            <ScrollView
              style={s.flex}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >

              {/* ── Erreur pricing / init paiement → bannière + Réessayer ── */}
              {pricingError && !paymentInitLoading && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 14, borderRadius: 14, borderWidth: 1,
                  backgroundColor: 'rgba(232,120,58,0.12)', borderColor: 'rgba(232,120,58,0.35)',
                }}>
                  <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
                  <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: COLORS.orangeBrand }}>
                    {t('stepper.payment_prepare_error')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { feedback.haptic('light'); setPricingError(null); setInitAttempt(a => a + 1); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.accent as string }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, color: theme.accentText as string }}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Paiement débité mais confirmation en échec → relance manuelle ── */}
              {confirmRetryNeeded && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 14, borderRadius: 14, borderWidth: 1,
                  backgroundColor: 'rgba(232,120,58,0.12)', borderColor: 'rgba(232,120,58,0.35)',
                }}>
                  <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
                  <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: COLORS.orangeBrand }}>
                    {t('stepper.payment_confirm_failed_banner')}
                  </Text>
                  <TouchableOpacity
                    onPress={retryConfirmPayment}
                    disabled={loading}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.accent as string, opacity: loading ? 0.6 : 1 }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={theme.accentText as string} />
                      : <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, color: theme.accentText as string }}>{t('common.retry')}</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* ── MONTANT (carte noire premium · Direction B) ── */}
              {isFreeService ? (
                <View style={[s.v4QuoteInfo, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Feather name="gift" size={18} color={theme.text as string} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[s.v4QuoteInfoTitle, { color: theme.text }]}>{t('stepper.free_service')}</Text>
                    <Text style={[s.v4QuoteInfoDesc, { color: theme.textSub }]}>{t('stepper.no_payment_required')}</Text>
                  </View>
                </View>
              ) : isQuoteFlow ? (
                <View style={{ gap: 12 }}>
                  <AmountCardB
                    theme={theme}
                    loading={paymentInitLoading}
                    label={t('stepper.pay_now')}
                    euros={stripEuro(confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : formatEUR(calloutFee))}
                    footerLeft={(
                      <>
                        <Feather name="check" size={13} color={COLORS.green} />
                        <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub as string }} numberOfLines={1}>
                          {t('stepper.deducted_if_accepted')}
                        </Text>
                      </>
                    )}
                    footerRight={selectedSubcategory?.priceMin && selectedSubcategory?.priceMax ? (
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: theme.heroSubFaint as string }}>
                        {selectedSubcategory.priceMin}–{selectedSubcategory.priceMax} €
                      </Text>
                    ) : null}
                  />
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.surfaceBorder as string, backgroundColor: theme.v4CardBg as string }}
                    onPress={() => setDevisModalVisible(true)} activeOpacity={0.7}
                  >
                    <Feather name="file-text" size={14} color={COLORS.amber} />
                    <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text as string }}>{t('stepper.how_quote_works')}</Text>
                    <Feather name="chevron-right" size={13} color={theme.textMuted as string} />
                  </TouchableOpacity>
                </View>
              ) : (
                <AmountCardB
                  theme={theme}
                  loading={paymentInitLoading}
                  label={t('stepper.total_to_pay')}
                  euros={appliedPromo ? stripEuro(formatEURCents(discountedCentsFixed)) : (displayPrice as any).totalTVAC}
                  original={appliedPromo ? stripEuro(formatEURCents(nominalCentsFixed)) : undefined}
                  savings={appliedPromo ? `−${stripEuro(formatEURCents(appliedPromo.discountCents))} €` : undefined}
                  footerLeft={(
                    <>
                      <Feather name="shield" size={13} color={theme.heroSubFaint as string} />
                      <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub as string }} numberOfLines={1}>
                        {(displayPrice as any).vatRate
                          ? t('stepper.incl_vat', { pct: Math.round(Number((displayPrice as any).vatRate) * 100), amount: (displayPrice as any).vat })
                          : t('stepper.total_ttc')}
                      </Text>
                    </>
                  )}
                  footerRight={(displayPrice as any).vatRate ? (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 12.5, color: theme.heroSubFaint as string }}>
                      {t('stepper.excl_vat_label')} {htEuros(displayPrice)}
                    </Text>
                  ) : null}
                />
              )}

              {/* ── RÉCAPITULATIF (tuiles-icônes · Direction B) ── */}
              <View>
                <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginBottom: 10 }}>{t('stepper.recap_title')}</Text>
                <View style={[s.v4Card, { backgroundColor: theme.v4CardBg, marginHorizontal: 0 }]}>
                  <RecapTile
                    theme={theme}
                    icon="map-pin"
                    title={location?.address?.split(',')[0] || '—'}
                    sub={location?.address?.split(',').slice(1).join(',').trim()}
                  />
                  <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                  <RecapTile
                    theme={theme}
                    icon={toFeatherName(toIoniconName(selectedCategory?.icon, 'construct-outline'), 'tool') as any}
                    title={serviceName || '—'}
                  />
                  <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                  <RecapTile
                    theme={theme}
                    icon="clock"
                    title={scheduledLabel || t('stepper.now')}
                    right={isUrgent ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.accent }}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, color: theme.accentText as string }}>{t('provider.urgent')}</Text>
                      </View>
                    ) : undefined}
                  />
                  {/* ── Code promo (mode fixe) ── */}
                  {!isFreeService && !isQuoteFlow && (
                    <>
                      <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
                      {appliedPromo ? (
                        <RecapTile
                          theme={theme}
                          icon="tag"
                          title={appliedPromo.code}
                          sub={`${t('stepper.promo_applied') || 'Offre appliquée'} · −${stripEuro(formatEURCents(appliedPromo.discountCents))} €`}
                          right={(
                            <TouchableOpacity
                              onPress={removePromo}
                              disabled={promoApplying}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                            >
                              {promoApplying
                                ? <ActivityIndicator size="small" color={theme.textMuted as string} />
                                : <Feather name="x" size={18} color={theme.textMuted as string} />}
                            </TouchableOpacity>
                          )}
                        />
                      ) : (
                        <RecapTile
                          theme={theme}
                          icon="tag"
                          title={t('stepper.promo_add') || 'Ajouter un code promo'}
                          onPress={() => { feedback.haptic('light'); setPromoSheetVisible(true); }}
                          right={<Feather name="chevron-right" size={16} color={theme.textMuted as string} />}
                        />
                      )}
                    </>
                  )}
                </View>
              </View>

              {/* ── Réassurance ── */}
              {!isFreeService && (
                <View style={s.v4SecureRow}>
                  <Feather name="lock" size={13} color={theme.textMuted as string} />
                  <Text style={[s.v4Secure, { color: theme.textMuted }]}>{t('stepper.charge_after_validation')}</Text>
                </View>
              )}

            </ScrollView>

            {/* Footer CTA — libellé à gauche, montant à droite (planche 4A) */}
            <StepCTA
              emphasis
              label={isFreeService ? t('stepper.confirm_free') : isQuoteFlow ? t('stepper.reserve') : t('stepper.confirm_mission')}
              amount={
                isFreeService
                  ? undefined
                  : isQuoteFlow
                    ? (confirmedCalloutCents != null ? formatEURCents(confirmedCalloutCents) : calloutFee > 0 ? formatEUR(calloutFee) : undefined)
                    : formatEURCents(discountedCentsFixed)
              }
              onPress={handlePay}
              disabled={loading || !paymentReady || !!pricingError || confirmRetryNeeded}
              loading={loading}
            />
          </View>
        )}

      </StepPager>
      <DevisInfoModal
        visible={devisModalVisible}
        onClose={() => setDevisModalVisible(false)}
        pricingMode={pricingMode}
        theme={theme}
      />
      <PromoSheet
        visible={promoSheetVisible}
        onClose={() => { if (!promoApplying) setPromoSheetVisible(false); }}
        onApply={applyPromo}
        applying={promoApplying}
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

  // Préférence prestataire (CTA "Demander X")
  preferredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  preferredBannerText: { flex: 1, fontSize: 12 },

  scrollPad: { paddingHorizontal: 24, paddingTop: 28 },

  title:    { fontSize: 28, marginBottom: 6, letterSpacing: 0.5, fontFamily: FONTS.bebas, includeFontPadding: false },
  subtitle: { fontSize: 15, marginBottom: 28, fontFamily: FONTS.sans },

  loadWrap: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadText: { fontSize: 14, fontFamily: FONTS.sans },

  // Step 2
  step2Pad:   { paddingHorizontal: 12, paddingTop: 16 },
  step2Title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 22, fontFamily: FONTS.bebas, includeFontPadding: false },
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
  priceRowValue:  { fontSize: 22, letterSpacing: 0.3, fontFamily: FONTS.bebas, includeFontPadding: false },
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
  v4TotalLabel: { fontSize: 30, letterSpacing: 1, fontFamily: FONTS.bebas, includeFontPadding: false },
  v4TotalValue: { fontSize: 30, letterSpacing: 1, fontFamily: FONTS.bebas, includeFontPadding: false },
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