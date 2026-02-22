/* eslint-disable react-hooks/exhaustive-deps */
// app/request/NewRequestStepper.tsx
// Flow Intervention — 4 étapes premium

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { toIoniconName } from '../../lib/iconMapper';

const { width } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const CARD_W = (width - 48 - 12) / 2;
const TOTAL_STEPS = 4;

const DEFAULT_REGION = {
  latitude: 50.8503,
  longitude: 4.3517,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

// Config des étapes
const STEPS = [
  { label: 'Lieu',      sublabel: "Adresse d'intervention", icon: 'location-outline'   as const },
  { label: 'Service',   sublabel: "Type d'intervention",    icon: 'construct-outline'   as const },
  { label: 'Planning',  sublabel: 'Disponibilité',          icon: 'time-outline'        as const },
  { label: 'Validation',sublabel: 'Paiement & récapitulatif', icon: 'checkmark-circle-outline' as const },
];

function extractArrayPayload(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
}

// ─── Progress Bar animée ───────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  const progress = useRef(new Animated.Value((step - 1) / TOTAL_STEPS)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step / TOTAL_STEPS,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const animWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width: animWidth }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 24,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 2,
  },
});

// ─── Résumé contextuel — 1 ligne fine, style Uber ────────────────────────────
function LiveSummary({
  location,
  serviceName,
  scheduledLabel,
}: {
  location: { address: string } | null;
  serviceName: string | null;
  scheduledLabel: string | null;
}) {
  // Construire une seule ligne de contexte concise
  const parts: string[] = [];
  if (location) parts.push(location.address.split(',')[0]); // Juste la rue
  if (serviceName) parts.push(serviceName);
  if (scheduledLabel) parts.push(scheduledLabel);

  if (parts.length === 0) return null;

  return (
    <View style={ls.wrap}>
      <Ionicons name="checkmark-circle" size={13} color="#34C759" />
      <Text style={ls.text} numberOfLines={1}>{parts.join(' · ')}</Text>
    </View>
  );
}

const ls = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 2,
  },
  text: { fontSize: 12, fontWeight: '500', color: '#888', flex: 1 },
});

// ─── Category Card — pill horizontale compacte ────────────────────────────────
function CategoryCard({ cat, selected, onPress }: { cat: any; selected: boolean; onPress: () => void }) {
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
        style={[cc.card, selected && cc.cardSelected]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={[cc.iconWrap, selected && cc.iconWrapSelected]}>
          <Ionicons
            name={toIoniconName(cat.icon, 'construct-outline') as any}
            size={20}
            color={selected ? '#FFF' : '#1A1A1A'}
          />
        </View>
        <View style={cc.textBlock}>
          <Text style={[cc.name, selected && cc.nameSelected]} numberOfLines={1}>
            {cat.name}
          </Text>
          {cat.price ? (
            <Text style={[cc.price, selected && cc.priceSelected]}>dès {cat.price}€</Text>
          ) : null}
        </View>
        {selected && <Ionicons name="checkmark-circle" size={18} color="#1A1A1A" style={cc.checkIcon} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const cc = StyleSheet.create({
  // Chaque card prend toute la largeur — layout colonne
  wrap: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: { backgroundColor: '#FFF', borderColor: '#1A1A1A' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapSelected: { backgroundColor: '#1A1A1A' },
  textBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  nameSelected: { color: '#1A1A1A' },
  price: { fontSize: 12, fontWeight: '500', color: '#999', marginTop: 1 },
  priceSelected: { color: '#666' },
  checkIcon: { flexShrink: 0 },
});

// ─── Sub Chip ─────────────────────────────────────────────────────────────────
function SubChip({ label, price, selected, onPress }: {
  label: string;
  price?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[sc.chip, selected && sc.chipSelected]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={[sc.radio, selected && sc.radioSelected]}>
          {selected && <View style={sc.radioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sc.text, selected && sc.textSelected]}>{label}</Text>
          {price !== undefined && (
            <Text style={[sc.subPrice, selected && sc.subPriceSelected]}>dès {price}€</Text>
          )}
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
    width: '100%',
  },
  chipSelected: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#FFF' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  text: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  textSelected: { color: '#FFF' },
  subPrice: { fontSize: 12, fontWeight: '500', color: '#888', marginTop: 2 },
  subPriceSelected: { color: 'rgba(255,255,255,0.65)' },
});

// ─── Time Slot — aéré avec micro-animation ───────────────────────────────────
function TimeSlot({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
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
        style={[ts.chip, selected && ts.chipSelected]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {selected && <View style={ts.dot} />}
        <Text style={[ts.text, selected && ts.textSelected]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 88,
  },
  chipSelected: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  text: { fontSize: 15, fontWeight: '600', color: '#555' },
  textSelected: { color: '#FFF' },
});

// ─── Day Chip — style Uber (underline indicator) ─────────────────────────────
function DayChip({
  day,
  date,
  month,
  selected,
  onPress,
}: {
  day: string;
  date: string;
  month: string;
  selected: boolean;
  onPress: () => void;
}) {
  const underlineWidth = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(underlineWidth, {
      toValue: selected ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selected]);

  return (
    <TouchableOpacity
      style={dc.wrap}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Text style={[dc.day, selected && dc.daySelected]}>{day}</Text>
      <Text style={[dc.date, selected && dc.dateSelected]}>{date}</Text>
      <Text style={[dc.month, selected && dc.monthSelected]}>{month}</Text>
      {/* Indicateur underline animé */}
      <Animated.View style={[dc.underline, {
        width: underlineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '80%'] })
      }]} />
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 52,
    gap: 2,
  },
  day: { fontSize: 11, fontWeight: '600', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.3 },
  daySelected: { color: '#1A1A1A' },
  date: { fontSize: 20, fontWeight: '800', color: '#ADADAD', letterSpacing: -0.3 },
  dateSelected: { color: '#1A1A1A' },
  month: { fontSize: 10, fontWeight: '500', color: 'transparent' },
  monthSelected: { color: '#888' },
  underline: {
    height: 2.5,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    marginTop: 4,
    alignSelf: 'center',
  },
});

// ─── Bottom CTA — avec effet Squish spring + haptic ─────────────────────────
function BottomCTA({
  label,
  onPress,
  disabled,
  loading,
  price,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  price?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const springIn = () => {
    if (disabled || loading) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const springOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <View style={cta.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={springIn}
          onPressOut={springOut}
          onPress={handlePress}
          disabled={disabled || loading}
          style={[cta.btn, disabled && cta.btnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={cta.inner}>
              <Text style={[cta.label, disabled && cta.labelDisabled]}>{label}</Text>
              {price !== undefined ? (
                <View style={cta.priceBadge}>
                  <Text style={cta.priceText}>{price}€</Text>
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
  wrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
    paddingTop: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  btn: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#D8D8D8' },
  inner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%' },
  label: { fontSize: 17, fontWeight: '700', color: '#FFF', flex: 1, textAlign: 'center' },
  labelDisabled: { color: '#AAA' },
  priceBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priceText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});

// ─── Helpers date ─────────────────────────────────────────────────────────────
function buildNextDays(count = 10) {
  const days: { day: string; date: string; month: string; iso: string }[] = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      day: i === 0 ? 'Auj.' : dayNames[d.getDay()],
      date: String(d.getDate()),
      month: monthNames[d.getMonth()],
      iso: d.toISOString().split('T')[0],
    });
  }
  return days;
}

const TIME_GROUPS = [
  { label: 'Matin',      slots: ['08:00', '09:00', '10:00', '11:00'] },
  { label: 'Après-midi', slots: ['14:00', '15:00', '16:00', '17:00'] },
  { label: 'Soir',       slots: ['18:00', '19:00'] },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function NewRequestStepper() {
  const router = useRouter();
  // ── Smart-Routing : catégorie pré-selectionnée depuis le dashboard ──
  const { selectedCategory: preselectedCategory } = useLocalSearchParams<{ selectedCategory?: string }>();
  const mapRef = useRef<MapView | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Navigation
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Étape 1 — Lieu
  const [location, setLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);

  // Étape 2 — Service
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  // Étape 2 — note collapsée
  const [noteOpen, setNoteOpen] = useState(false);

  // Étape 3 — Planning
  const days = useMemo(() => buildNextDays(10), []);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later' | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Dérivés
  const selectedCategory = useMemo(() => categories.find((c) => c.id === categoryId) || null, [categories, categoryId]);
  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories?.find((s: any) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId]
  );
  const estimatedPrice = selectedSubcategory?.price || selectedCategory?.price || 0;
  const serviceName = selectedSubcategory?.name || selectedCategory?.name || null;
  const scheduledLabel = scheduleMode === 'now'
    ? 'Dès maintenant'
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
        const response = await api.request('/categories');
        setCategories(extractArrayPayload(response));
      } catch (e) {
        console.error('Categories load error:', e);
      }
    })();
  }, []);

  // ── Auto-sélection si une catégorie est passée en param (Smart-Routing) ──
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

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateStep(() => setStep((p) => p + 1));
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) router.back();
    else animateStep(() => setStep((p) => p - 1));
  };

  // Étape 4 — état pré-chargement paiement
  const [requestId, setRequestId] = useState<string | null>(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);

  // Pré-charge la PaymentSheet dès qu'on arrive à l'étape 4
  useEffect(() => {
    if (step !== 4 || !selectedCategory || !location || paymentReady) return;
    (async () => {
      setPaymentInitLoading(true);
      try {
        const serviceType = selectedSubcategory?.name || selectedCategory.name;
        const payload = {
          title: serviceType,
          description: description || `Service de ${serviceType}`,
          serviceType,
          categoryId: selectedCategory.id,
          ...(subcategoryId && { subcategoryId }),
          price: estimatedPrice,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
          urgent: false,
          scheduledFor: scheduledFor || new Date().toISOString(),
          status: 'PENDING_PAYMENT',
        };
        const reqRes = await api.request('/requests', { method: 'POST', body: payload });
        const rId = reqRes.id || reqRes.data?.id;
        if (!rId) throw new Error('Request ID manquant');
        setRequestId(rId);

        const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(rId);
        const { error } = await initPaymentSheet({
          merchantDisplayName: 'Fixed',
          paymentIntentClientSecret: paymentIntent,
          customerEphemeralKeySecret: ephemeralKey,
          customerId: customer,
          applePay: { merchantCountryCode: 'BE' },
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

  const handlePay = async () => {
    if (!paymentReady || !requestId) return;
    setLoading(true);
    try {
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) { Alert.alert('Paiement annulé', presentError.message); return; }
      await api.payments.success(requestId);
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // Ouvre la sheet de sélection de paiement
  const handleChangePayment = async () => {
    if (!paymentReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await presentPaymentSheet();
  };

  // Cancan avancement par étape
  const canProceed = useMemo(() => {
    if (step === 1) return !!location;
    if (step === 2) return !!categoryId;
    if (step === 3) return step3Ready;
    return true;
  }, [step, location, categoryId, step3Ready]);

  const currentStep = STEPS[step - 1];

  return (
    <SafeAreaView style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        {/* Retour — visible et clair */}
        <TouchableOpacity
          onPress={goBack}
          style={s.iconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.stepCount}>Étape {step} sur {TOTAL_STEPS}</Text>
          <Text style={s.stepName}>{currentStep.label}</Text>
          <Text style={s.stepSublabel}>{currentStep.sublabel}</Text>
        </View>

        {/* Annuler — discret */}
        <TouchableOpacity onPress={() => router.back()} style={s.cancelBtn}>
          <Text style={s.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Barre de progression ── */}
      <ProgressBar step={step} />

      {/* ── Résumé temps réel (affiché dès étape 2) ── */}
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
            {/* Carte plein écran */}
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFillObject}
              initialRegion={DEFAULT_REGION}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {location && (
                <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
                  <View style={s.pin}><View style={s.pinInner} /></View>
                </Marker>
              )}
            </MapView>

            {/* Barre de recherche flottante en haut */}
            <View style={s.searchFloat}>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color="#888" />
                <GooglePlacesAutocomplete
                  placeholder="Entrez votre adresse..."
                  fetchDetails
                  onPress={(data, details = null) => {
                    if (details) {
                      const { lat, lng } = details.geometry.location;
                      setLocation({ address: data.description, lat, lng });
                      mapRef.current?.animateToRegion({
                        latitude: lat,
                        longitude: lng,
                        latitudeDelta: 0.006,
                        longitudeDelta: 0.006,
                      });
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                  query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:be' }}
                  styles={{
                    container: { flex: 1, marginLeft: 8 },
                    textInputContainer: { backgroundColor: 'transparent' },
                    textInput: {
                      height: 36,
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#1A1A1A',
                      backgroundColor: 'transparent',
                      padding: 0,
                      margin: 0,
                    },
                    listView: {
                      position: 'absolute',
                      top: 54,
                      left: -42,
                      right: -16,
                      backgroundColor: '#FFF',
                      borderRadius: 20,
                      shadowColor: '#000',
                      shadowOpacity: 0.15,
                      shadowRadius: 24,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 12,
                      zIndex: 50,
                      maxHeight: 260,
                    },
                    row: { backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 18 },
                    description: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
                    separator: { backgroundColor: '#F5F5F5', height: 1 },
                  }}
                  textInputProps={{ placeholderTextColor: '#ADADAD' }}
                  enablePoweredByContainer={false}
                  listViewDisplayed="auto"
                  keyboardShouldPersistTaps="handled"
                />
              </View>

              {/* Badge adresse confirmée — sous la searchbox */}
              {location && (
                <View style={s.addrConfirm}>
                  <View style={s.addrDot} />
                  <Text style={s.addrText} numberOfLines={1}>{location.address}</Text>
                  <TouchableOpacity onPress={() => setLocation(null)} style={s.addrClear}>
                    <Ionicons name="close" size={15} color="#888" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* CTA ancré en bas — zIndex bas pour ne pas bloquer la dropdown */}
            <View style={s.ctaFloating}>
              <BottomCTA
                label={location ? 'Confirmer cette adresse' : 'Sélectionnez une adresse'}
                onPress={goNext}
                disabled={!location}
              />
            </View>
          </View>
        )}

        {/* ══ ÉTAPE 2 — Service ══ */}
        {step === 2 && (
          <View style={s.flex}>
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.step2Pad}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.step2Title}>De quoi avez-vous besoin ?</Text>

              {/* Catégories — liste compacte pleine largeur */}
              {categories.length === 0 ? (
                <View style={s.loadWrap}>
                  <ActivityIndicator size="large" color="#000" />
                  <Text style={s.loadText}>Chargement des services...</Text>
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

              {/* Sous-catégories : apparaissent uniquement si catégorie choisie */}
              {selectedCategory?.subcategories?.length > 0 && (
                <View style={s.subSection}>
                  <View style={s.subHeader}>
                    <Text style={s.subTitle}>Précisez</Text>
                    {/* Prix inline discret — visible dès la catégorie choisie */}
                    {estimatedPrice > 0 && !subcategoryId && (
                      <Text style={s.priceInline}>dès {estimatedPrice}€</Text>
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

              {/* Prix — uniquement si sous-catégorie sélectionnée (sinon trop tôt) */}
              {subcategoryId && estimatedPrice > 0 && (
                <View style={s.priceRow}>
                  <Text style={s.priceRowLabel}>Prix estimé</Text>
                  <View style={s.priceRowRight}>
                    <Text style={s.priceRowValue}>{estimatedPrice} €</Text>
                    <View style={s.priceRowBadge}>
                      <Ionicons name="shield-checkmark-outline" size={12} color="#888" />
                      <Text style={s.priceRowSub}>après service</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Note — collapsée, expandable */}
              <TouchableOpacity
                style={s.noteToggle}
                onPress={() => setNoteOpen(p => !p)}
                activeOpacity={0.7}
              >
                <Ionicons name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#888" />
                <Text style={s.noteToggleText}>Ajouter une note pour le prestataire</Text>
              </TouchableOpacity>
              {noteOpen && (
                <TextInput
                  style={s.noteInput}
                  placeholder="Ex : Sonnez à l'interphone, code portail 1234..."
                  placeholderTextColor="#ADADAD"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />
              )}

              <View style={{ height: 100 }} />
            </ScrollView>

            <BottomCTA label="Continuer" onPress={goNext} disabled={!categoryId} />
          </View>
        )}

        {/* ══ ÉTAPE 3 — Planning ══ */}
        {step === 3 && (
          <View style={s.flex}>
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.step3Pad}
              showsVerticalScrollIndicator={false}
            >

              {/* ── Choix principal : Maintenant vs Plus tard ── */}
              <View style={s.modeRow}>
                <TouchableOpacity
                  style={[s.modeCard, scheduleMode === 'now' && s.modeCardSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setScheduleMode('now');
                    setSelectedDayIso(null);
                    setSelectedTime(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.modeEmoji}>⚡</Text>
                  <Text style={[s.modeLabel, scheduleMode === 'now' && s.modeLabelSelected]}>
                    Maintenant
                  </Text>
                  <Text style={[s.modeSub, scheduleMode === 'now' && s.modeSubSelected]}>
                    Intervention rapide
                  </Text>
                  {scheduleMode === 'now' && (
                    <View style={s.modeCheck}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.modeCard, scheduleMode === 'later' && s.modeCardSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setScheduleMode('later');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.modeEmoji}>🗓️</Text>
                  <Text style={[s.modeLabel, scheduleMode === 'later' && s.modeLabelSelected]}>
                    Planifier
                  </Text>
                  <Text style={[s.modeSub, scheduleMode === 'later' && s.modeSubSelected]}>
                    Choisir un créneau
                  </Text>
                  {scheduleMode === 'later' && (
                    <View style={s.modeCheck}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Mode "Maintenant" : message de confirmation ── */}
              {scheduleMode === 'now' && (
                <View style={s.nowConfirm}>
                  <Ionicons name="flash" size={22} color="#1A1A1A" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.nowTitle}>Intervention rapide</Text>
                    <Text style={s.nowSub}>
                      Un prestataire disponible sera notifié immédiatement
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Mode "Plus tard" : carrousel jours + créneaux ── */}
              {scheduleMode === 'later' && (
                <>
                  {/* Carrousel de jours — aéré, underline style */}
                  <View style={s.step3Sep} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.dayScroll}
                  >
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
                  <View style={s.step3Sep} />

                  {/* Créneaux — apparaissent après choix du jour */}
                  {!selectedDayIso ? (
                    <Text style={s.step3Hint}>Choisissez un jour ci-dessus</Text>
                  ) : (
                    TIME_GROUPS.map((group) => (
                      <View key={group.label} style={s.slotGroup}>
                        <Text style={s.slotGroupLabel}>{group.label}</Text>
                        <View style={s.slotsRow}>
                          {group.slots.map((slot) => (
                            <TimeSlot
                              key={slot}
                              label={slot}
                              selected={selectedTime === slot}
                              onPress={() => setSelectedTime(slot)}
                            />
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* CTA flottant */}
            <View style={s.floatingCTA}>
              <View style={s.floatingGradient} pointerEvents="none" />
              <BottomCTA
                label={
                  scheduleMode === 'now'
                    ? 'Confirmer · Maintenant'
                    : (selectedDayIso && selectedTime
                      ? `Confirmer · ${days.find(d => d.iso === selectedDayIso)?.day} ${days.find(d => d.iso === selectedDayIso)?.date} à ${selectedTime}`
                      : 'Confirmer le créneau')
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
            {/* Contenu centré — pas de scroll nécessaire */}
            <View style={s.v4Body}>

              {/* Carte récap compacte — toutes les infos sur une seule carte */}
              <View style={s.v4Card}>

                {/* Adresse */}
                <View style={s.v4Row}>
                  <Ionicons name="location-outline" size={16} color="#888" />
                  <Text style={s.v4Val} numberOfLines={1}>{location?.address?.split(',')[0]}</Text>
                  <Text style={s.v4Sub} numberOfLines={1}>{location?.address?.split(',').slice(1).join(',').trim()}</Text>
                </View>
                <View style={s.v4Sep} />

                {/* Service */}
                <View style={s.v4Row}>
                  <Ionicons
                    name={toIoniconName(selectedCategory?.icon, 'construct-outline') as any}
                    size={16}
                    color="#888"
                  />
                  <Text style={s.v4Val}>{serviceName}</Text>
                </View>
                <View style={s.v4Sep} />

                {/* Créneau */}
                <View style={s.v4Row}>
                  <Ionicons name="time-outline" size={16} color="#888" />
                  <Text style={s.v4Val}>{scheduledLabel}</Text>
                </View>
                <View style={s.v4Sep} />

                {/* Paiement — ligne tappable qui ouvre la sheet */}
                <TouchableOpacity
                  style={s.v4Row}
                  onPress={handleChangePayment}
                  activeOpacity={0.7}
                  disabled={!paymentReady}
                >
                  <Ionicons name="card-outline" size={16} color="#888" />
                  {paymentInitLoading ? (
                    <ActivityIndicator size="small" color="#888" style={{ marginLeft: 4 }} />
                  ) : (
                    <Text style={s.v4Val}>Carte enregistrée</Text>
                  )}
                  <Ionicons name="chevron-forward" size={14} color="#CCC" style={s.v4Chevron} />
                </TouchableOpacity>
              </View>

              {/* Total — clair, gros, centré */}
              <View style={s.v4Total}>
                <Text style={s.v4TotalLabel}>Total estimé</Text>
                <Text style={s.v4TotalValue}>{estimatedPrice} €</Text>
              </View>

            </View>

            {/* Zone fixe en bas — bouton + micro-assurance */}
            <View style={s.v4Footer}>
              <Text style={s.v4Secure}>
                🔒 Débité uniquement après validation du service
              </Text>
              <BottomCTA
                label="Confirmer la mission"
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

// ─── Styles globaux ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stepName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 1,
  },
  stepSublabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ADADAD',
    marginTop: 1,
  },

  // Annuler — discret
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ADADAD',
  },

  // Scroll
  scrollPad: { paddingHorizontal: 24, paddingTop: 28 },

  // Titres
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A1A1A',
    lineHeight: 38,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
    marginBottom: 28,
  },

  // Loading
  loadWrap: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadText: { color: '#888', fontSize: 14, fontWeight: '500' },

  // Step 2 layout
  step2Pad: { paddingHorizontal: 20, paddingTop: 16 },
  step2Title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  // Catégories : liste verticale
  catList: { gap: 8, marginBottom: 4 },
  // Legacy grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  // Subcategories
  subSection: { marginTop: 20 },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  priceInline: { fontSize: 13, fontWeight: '600', color: '#888' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subList: { gap: 8 },

  // Prix — ligne discrète (uniquement si sous-cat choisie)
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  priceRowLabel: { fontSize: 13, fontWeight: '600', color: '#888' },
  priceRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRowValue: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.3 },
  priceRowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRowSub: { fontSize: 11, fontWeight: '500', color: '#888' },

  // Note collapsée
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 4,
  },
  noteToggleText: { fontSize: 13, fontWeight: '500', color: '#888' },

  // Planning step 3
  step3Pad: { paddingHorizontal: 24, paddingTop: 28 },
  step3Sep: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 20 },
  step3Hint: { fontSize: 14, color: '#ADADAD', fontWeight: '500', textAlign: 'center', paddingVertical: 12 },

  // Deux cards Maintenant / Planifier
  modeRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  modeCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  modeCardSelected: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  modeEmoji: { fontSize: 28, marginBottom: 4 },
  modeLabel: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  modeLabelSelected: { color: '#FFF' },
  modeSub: { fontSize: 12, fontWeight: '500', color: '#999' },
  modeSubSelected: { color: 'rgba(255,255,255,0.6)' },
  modeCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Confirmation "Maintenant"
  nowConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },
  nowTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  nowSub: { fontSize: 13, fontWeight: '500', color: '#888', lineHeight: 18 },
  dayScroll: {
    gap: 4,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  slotGroup: { marginBottom: 20 },
  slotGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ADADAD',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // CTA flottant avec dégradé
  floatingCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  floatingGradient: {
    height: 32,
    // Simulé avec backgroundColor semi-transparent (pas de LinearGradient dep.)
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // Legacy (garde pour compat)
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  planSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F0F0', borderRadius: 14, padding: 14 },
  planSummaryText: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1, lineHeight: 20 },

  // Map — recherche flottante
  searchFloat: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  addrConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  addrDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  addrText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  addrClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA ancré en bas sur la carte (step 1)
  ctaFloating: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },

  // Pin
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pinInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },

  // Legacy recap (garde pour compat)
  recapCard: { backgroundColor: '#F7F7F7', borderRadius: 22, padding: 4, marginBottom: 24 },
  recapRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  recapIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EBEBEB', alignItems: 'center', justifyContent: 'center' },
  recapInfo: { flex: 1 },
  recapMeta: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  recapVal: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  recapPrice: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  recapSep: { height: 1, backgroundColor: '#EBEBEB', marginHorizontal: 16 },

  // Note
  noteOpt: { color: '#999', fontWeight: '400' },
  noteInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    fontWeight: '500',
  },

  // ── Step 4 — Validation ────────────────────────────────────────────
  v4Body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'center',
  },
  // Carte récap compacte
  v4Card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  v4Row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 10,
  },
  v4Val: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  v4Sub: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999',
    maxWidth: 120,
  },
  v4Sep: { height: 1, backgroundColor: '#EBEBEB', marginHorizontal: 16 },
  v4Chevron: { marginLeft: 'auto' as any },
  // Total
  v4Total: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  v4TotalLabel: { fontSize: 14, fontWeight: '600', color: '#888' },
  v4TotalValue: { fontSize: 36, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1 },
  // Footer fixe
  v4Footer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  v4Secure: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#ADADAD',
    paddingBottom: 8,
  },
});