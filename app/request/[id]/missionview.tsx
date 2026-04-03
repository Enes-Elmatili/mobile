// app/request/[id]/MissionView.tsx
// ─── Page unifiée : SEARCHING → TRACKING (même écran, transition de phase) ───

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Platform, Dimensions, StatusBar,
  TextInput, KeyboardAvoidingView, Modal, Pressable, Linking, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { devLog, devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/?$/, '');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** Avatar component — real photo or initials fallback */
function Avatar({ url, name, size = 46, style }: { url?: string | null; name?: string | null; size?: number; style?: any }) {
  const theme = useAppTheme();
  const r = size / 2;
  const base = { width: size, height: size, borderRadius: r, overflow: 'hidden' as const };
  if (url) {
    const uri = url.startsWith('http') ? url : `${SERVER_BASE}${url}`;
    return <Image source={{ uri }} style={[base, { borderWidth: 1.5, borderColor: theme.borderLight }, style]} />;
  }
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[base, { backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.borderLight }, style]}>
      <Text style={{ fontSize: size * 0.38, fontFamily: FONTS.sansMedium, color: theme.text }}>{initials}</Text>
    </View>
  );
}

// ─── Phase de la page ────────────────────────────────────────────────────────
type Phase = 'SEARCHING' | 'TRACKING';

// ─── Params ──────────────────────────────────────────────────────────────────
interface MissionParams {
  id: string;
  serviceName?: string;
  address?: string;
  price?: string;
  scheduledLabel?: string;
  expiresAt?: string;
  lat?: string;
  lng?: string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────
// ─── Toast System ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastData { id: number; message: string; type: ToastType }

const toastEmitter = { listeners: [] as ((t: ToastData) => void)[] };
let toastId = 0;

function showToast(message: string, type: ToastType = 'info') {
  const t: ToastData = { id: toastId++, message, type };
  toastEmitter.listeners.forEach(fn => fn(t));
}

function ToastProvider() {
  const theme = useAppTheme();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const anim = useRef<Record<number, Animated.Value>>({});

  useEffect(() => {
    const handler = (t: ToastData) => {
      anim.current[t.id] = new Animated.Value(0);
      setToasts(prev => [t, ...prev]);
      Animated.sequence([
        Animated.timing(anim.current[t.id], { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(anim.current[t.id], { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
        delete anim.current[t.id];
      });
    };
    toastEmitter.listeners.push(handler);
    return () => { toastEmitter.listeners = toastEmitter.listeners.filter(l => l !== handler); };
  }, []);

  if (!toasts.length) return null;
  return (
    <View style={toast.stack} pointerEvents="none">
      {toasts.map(t => {
        const av = anim.current[t.id] || new Animated.Value(1);
        const bg = t.type === 'success' ? '#059669' : theme.cardBg;
        const icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '●';
        return (
          <Animated.View
            key={t.id}
            style={[toast.pill, { backgroundColor: bg, borderWidth: 1, borderColor: theme.borderLight },
              {
                opacity: av,
                transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <Text style={toast.icon}>{icon}</Text>
            <Text style={toast.text}>{t.message}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const toast = StyleSheet.create({
  stack:  { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, left: 20, right: 20, zIndex: 9999, gap: 8, pointerEvents: 'none' },
  pill:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 12 } }) },
  icon:   { fontSize: 13, color: '#FFF', fontWeight: '800' },
  text:   { fontSize: 14, color: '#FFF', fontWeight: '600', flex: 1 },
});

// ─── ConfirmModal (remplace Alert.alert) ─────────────────────────────────────
interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation();
  const th = useAppTheme();
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  const resolvedCancelLabel = cancelLabel || t('common.cancel');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={cm.overlay} onPress={onCancel}>
        <Animated.View style={{ opacity: fadeAnim, ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </Pressable>
      <Animated.View style={[cm.sheet, { backgroundColor: th.cardBg, transform: [{ translateY: slideAnim }] }]}>
        <View style={[cm.handle, { backgroundColor: th.borderLight }]} />
        <Text style={[cm.title, { color: th.text, fontFamily: FONTS.bebas }]}>{title}</Text>
        {message ? <Text style={[cm.message, { color: th.textSub, fontFamily: FONTS.sans }]}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={[cm.cancelBtn, { borderColor: th.border }]} onPress={onCancel} activeOpacity={0.75}>
            <Text style={[cm.cancelLabel, { color: th.textSub, fontFamily: FONTS.sansMedium }]}>{resolvedCancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: th.accent }, destructive && { backgroundColor: COLORS.red }]} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={[cm.confirmLabel, { fontFamily: FONTS.sansMedium }]}>{resolvedConfirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 16 } }),
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 24, textAlign: 'center', letterSpacing: 1, marginBottom: 10 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  cancelLabel: { fontSize: 15 },
  confirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  confirmLabel: { fontSize: 15, color: '#FFF' },
});




const formatEuros = (amount: number) =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fallbackETA = (oLat: number, oLng: number, dLat: number, dLng: number) => {
  const min = Math.ceil((calculateDistance(oLat, oLng, dLat, dLng) * 1.4 / 30) * 60);
  return min <= 1 ? '1 min' : `${min} min`;
};

// ─── Decode Google encoded polyline ──────────────────────────────────────────
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// ─── Grayscale map style (light) ──────────────────────────────────────────────
const MAP_STYLE_LIGHT = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ─── Dark map style (monochrome branded — no blue) ───────────────────────────
const MAP_STYLE_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi',           stylers: [{ visibility: 'off' }] },
  { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway',  elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road.local',    elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR WAVES (phase SEARCHING)
// ═══════════════════════════════════════════════════════════════════════════════
const WAVE_COUNT = 4;
const WAVE_SIZE = width * 0.85;

function RadarWaves() {
  const theme = useAppTheme();
  const anims = useRef(
    Array.from({ length: WAVE_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 650),
          Animated.timing(anim, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={rw.wrap} pointerEvents="none">
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[rw.wave, { borderColor: theme.textMuted },  {
            opacity:   anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.2, 0.07, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
          }]}
        />
      ))}
    </View>
  );
}

const rw = StyleSheet.create({
  wrap: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, borderRadius: WAVE_SIZE / 2, borderWidth: 1.5 },
});

// ─── Ghost Markers (prestataires fantômes sur carte) ─────────────────────────
const GHOST_OFFSETS = [
  { lat: 0.008, lng: 0.006 },
  { lat: -0.005, lng: 0.012 },
  { lat: 0.003, lng: -0.010 },
];

function GhostMarkers({ center }: { center: { latitude: number; longitude: number } }) {
  const theme = useAppTheme();
  const anims = useRef(GHOST_OFFSETS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 1100),
          Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <>
      {GHOST_OFFSETS.map((offset, i) => {
        const coord = {
          latitude: center.latitude + offset.lat,
          longitude: center.longitude + offset.lng,
        };
        return (
          <Marker key={i} coordinate={coord} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.View style={[gm.outer, { backgroundColor: theme.accent }, {
              opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }),
              transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
            }]}>
              <Ionicons name="person" size={12} color={theme.accentText} />
            </Animated.View>
          </Marker>
        );
      })}
    </>
  );
}

const gm = StyleSheet.create({
  outer: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
});

// ─── Logo central pulsant ─────────────────────────────────────────────────────
function CenterLogo() {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[cl.outer, { backgroundColor: theme.accent }, { transform: [{ scale: pulse }] }]}>
      <Ionicons name="search" size={28} color={theme.accentText as string} />
    </Animated.View>
  );
}

const cl = StyleSheet.create({
  outer: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 16 },
    }),
  },
});

// ─── Messages dynamiques (SEARCHING) ─────────────────────────────────────────
const getSteps = (t: any) => [
  { at: 0,   title: t('mission_view.search_step1_title'), sub: t('mission_view.search_step1_sub') },
  { at: 4,   title: t('mission_view.search_step2_title'), sub: t('mission_view.search_step2_sub') },
  { at: 10,  title: t('mission_view.search_step3_title'), sub: t('mission_view.search_step3_sub') },
  { at: 25,  title: t('mission_view.search_step4_title'), sub: t('mission_view.search_step4_sub') },
  { at: 70,  title: t('mission_view.search_step5_title'), sub: t('mission_view.search_step5_sub') },
  { at: 140, title: t('mission_view.search_step6_title'), sub: t('mission_view.search_step6_sub') },
];

function DynamicMessage({ elapsed }: { elapsed: number }) {
  const { t } = useTranslation();
  const th = useAppTheme();
  const steps = getSteps(t);
  const current = [...steps].reverse().find(s => elapsed >= s.at) || steps[0];
  const opacity = useRef(new Animated.Value(1)).current;
  const prev = useRef(current.title);

  useEffect(() => {
    if (prev.current === current.title) return;
    prev.current = current.title;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.title]);

  return (
    <Animated.View style={[dm.wrap, { opacity }]}>
      <Text style={[dm.title, { color: th.text }]}>{current.title}</Text>
      <Text style={[dm.sub, { color: th.textSub }]}>{current.sub}</Text>
    </Animated.View>
  );
}

const dm = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, textAlign: 'center', letterSpacing: 1, marginBottom: 7, fontFamily: FONTS.bebas },
  sub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.sans },
});

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(expiresAt?: string) {
  const [sec, setSec] = useState(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 15 * 60
  );
  useEffect(() => {
    const iv = setInterval(() => setSec(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, []);
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return { display: `${m}:${ss}`, isExpiring: sec < 120, isExpired: sec === 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER MARKER (TRACKING)
// ═══════════════════════════════════════════════════════════════════════════════
function ProviderMarker() {
  const theme = useAppTheme();
  return (
    <View style={pm.wrap}>
      <View style={[pm.pin, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <Ionicons name="navigate" size={14} color={theme.text} />
      </View>
      <View style={[pm.stem, { backgroundColor: theme.cardBg }]} />
    </View>
  );
}

const pm = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pin: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  stem: {
    width: 2, height: 6, borderRadius: 1, marginTop: -1,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MissionView() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const id = params.id;
  const serviceName = params.serviceName;
  const address = params.address;
  const price = params.price;
  const scheduledLabel = params.scheduledLabel;
  const expiresAt = params.expiresAt;
  const lat = params.lat;
  const lng = params.lng;
  const { socket, joinRoom, leaveRoom } = useSocket();

  // Guard: id is required
  if (!id || !/^\d+$/.test(id)) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Mission introuvable</Text>
      </SafeAreaView>
    );
  }
  const { t } = useTranslation();
  const theme = useAppTheme();
  const mapStyle = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const mapRef = useRef<MapView>(null);

  // ─── Phase state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('SEARCHING');
  const phaseAnim = useRef(new Animated.Value(0)).current; // 0 = searching, 1 = tracking
  const hasTransitionedRef = useRef(false); // guard anti-double-transition

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [cancelSearchModal, setCancelSearchModal] = useState(false);
  const [cancelTrackModal, setCancelTrackModal] = useState(false);

  // ─── Searching state ──────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const { display, isExpiring, isExpired } = useCountdown(expiresAt);

  // ─── Tracking state ───────────────────────────────────────────────────────
  const [request, setRequest] = useState<any>(null);
  const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState('');
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [message, setMessage] = useState('');
  // Ref : vrai dès qu'on a reçu une position GPS réelle via socket
  const hasRealLocationRef = useRef(false);
  const hasNavigatedToPinRef = useRef(false);

  // ─── PIN state ──────────────────────────────────────────────────────────
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [providerArrived, setProviderArrived] = useState(false);

  // ─── Shared ───────────────────────────────────────────────────────────────
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  const clientLocation = {
    latitude: lat ? parseFloat(lat) : request?.lat || 50.8503,
    longitude: lng ? parseFloat(lng) : request?.lng || 4.3517,
  };

  // ─── Entrée page ──────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Elapsed (searching) ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'SEARCHING') return;
    const iv = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ─── Drift carte (SEARCHING) — mouvement lent autour de la position client ─
  useEffect(() => {
    if (phase !== 'SEARCHING' || !mapRef.current) return;
    const radius = 0.004;
    let angle = 0;
    const iv = setInterval(() => {
      angle += 0.15;
      mapRef.current?.animateToRegion({
        latitude:  clientLocation.latitude  + Math.sin(angle) * radius,
        longitude: clientLocation.longitude + Math.cos(angle) * radius,
        latitudeDelta:  0.025,
        longitudeDelta: 0.025,
      }, 3000);
    }, 3000);
    return () => clearInterval(iv);
  }, [phase, clientLocation.latitude, clientLocation.longitude]);

  // ─── Fetch PIN (silencieux — le 404 NO_PIN est un état normal) ───────────
  const fetchPin = useCallback(async (requestId: string) => {
    try {
      const token = await (await import('@/lib/storage')).tokenStorage.getToken();
      const baseUrl = (await import('@/lib/config')).default.apiUrl;
      const res = await fetch(`${baseUrl}/requests/${requestId}/pin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      if (!res.ok) return; // 404 NO_PIN = normal, pas encore généré
      const data = await res.json();
      if (data?.pinCode) setPinCode(data.pinCode);
      if (data?.pinVerified) setPinVerified(true);
    } catch { /* network error — ignore silently */ }
  }, []);

  // ─── Transition vers TRACKING ─────────────────────────────────────────────
  const transitionToTracking = useCallback((requestData: any) => {
    // Guard : évite la double-transition si le polling et le socket arrivent en même temps
    if (hasTransitionedRef.current) return;
    hasTransitionedRef.current = true;

    setRequest(requestData);
    if (requestData.beforePhotoUrl) setProviderArrived(true);
    if (requestData.pinVerified) setPinVerified(true);

    // Fix : set provider location depuis la réponse polling
    if (requestData.provider?.lat && requestData.provider?.lng) {
      setProviderLocation({
        latitude: requestData.provider.lat,
        longitude: requestData.provider.lng,
      });
    }

    // Fix PIN : set directement depuis la réponse REST (évite race condition socket)
    const resolvedPin = requestData.pinCode || null;
    devLog('[MissionView] transitionToTracking — pinCode:', resolvedPin, 'pinVerified:', requestData.pinVerified);
    if (resolvedPin) {
      setPinCode(resolvedPin);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fetchPin(String(requestData.id)); // fallback si pinCode absent de la réponse

    // Fix : setPhase AVANT l'animation pour que la PIN card s'affiche immédiatement
    setPhase('TRACKING');
    devLog('[MissionView] phase → TRACKING, pinCode:', resolvedPin);
    Animated.timing(phaseAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPin]);

  // ─── ETA Google ──────────────────────────────────────────────────────────
  const fetchETA = useCallback(async (oLat: number, oLng: number, dLat: number, dLng: number) => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No key');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes?.length > 0) {
        setEta(data.routes[0].legs[0].duration.text);
        // Decode route polyline
        const encoded = data.routes[0].overview_polyline?.points;
        if (encoded) setRouteCoords(decodePolyline(encoded));
      } else throw new Error(data.status);
    } catch {
      setEta(fallbackETA(oLat, oLng, dLat, dLng));
    }
  }, []);

  // ─── Polling SEARCHING (5s) — s'arrête dès que phase passe en TRACKING ──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pinPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!id || phase !== 'SEARCHING') return;
    const poll = async () => {
      try {
        const res = await api.get(`/requests/${id}`);
        const data = res?.data || res;
        devLog('[MissionView] poll data keys:', Object.keys(data || {}), 'pinCode:', data?.pinCode, 'status:', data?.status);
        const status = (data?.status || '').toUpperCase();
        if (status === 'ACCEPTED' || status === 'ONGOING') {
          // Stop polling before transitioning
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          transitionToTracking(data);
        } else if (status === 'QUOTE_SENT') {
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace({ pathname: '/request/[id]/quote-review', params: { id: String(id) } });
        } else if (status === 'QUOTE_REFUSED' || status === 'QUOTE_EXPIRED') {
          // Quote refused/expired — stop polling, redirect to dashboard
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          router.replace('/(tabs)/dashboard');
        } else if (['CANCELLED', 'EXPIRED', 'COMPLETED', 'DONE'].includes(status)) {
          // Stop polling on terminal statuses
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          router.replace('/(tabs)/dashboard');
        }
      } catch (e) { devError('[MissionView] poll:', e); }
    };
    poll();
    pollingRef.current = setInterval(poll, 5000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, phase]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isExpired) router.replace('/(tabs)/dashboard'); }, [isExpired]);

  // ─── Polling PIN de sécurité (fallback si socket raté) ────────────────────
  useEffect(() => {
    if (phase !== 'TRACKING' || pinCode || pinVerified) return;

    fetchPin(id);
    pinPollRef.current = setInterval(() => fetchPin(id), 5000);

    return () => {
      if (pinPollRef.current) { clearInterval(pinPollRef.current); pinPollRef.current = null; }
    };
  }, [phase, pinCode, pinVerified, id, fetchPin]);

  useEffect(() => {
    if (pinCode && pinPollRef.current) {
      clearInterval(pinPollRef.current);
      pinPollRef.current = null;
    }
  }, [pinCode]);

  // ─── Navigation automatique vers page PIN ─────────────────────────────────
  // S'affiche seulement quand le prestataire est arrivé (before_photo) ET que le PIN est dispo
  useEffect(() => {
    // Guard FIRST — ref check before any log to avoid noise
    if (hasNavigatedToPinRef.current) return;
    if (phase !== 'TRACKING' || !pinCode || pinVerified || !providerArrived) return;

    // Set ref synchronously BEFORE the async push to prevent concurrent effect runs
    hasNavigatedToPinRef.current = true;
    devLog('[MissionView] → Navigating to PIN page');
    router.push({
      pathname: '/request/[id]/pin',
      params: {
        id: String(id),
        pinCode,
        providerName: request?.provider?.name || '',
        serviceName: request?.serviceType || serviceName || '',
      },
    });
  }, [phase, pinCode, pinVerified, providerArrived, id, request, serviceName, router]);

  // ─── Socket (TRACKING) ────────────────────────────────────────────────────
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (request?.lat && request?.lng) destRef.current = { lat: request.lat, lng: request.lng };
  }, [request]);

  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);

    let lastEtaFetch = 0;
    const onLocation = async (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      hasRealLocationRef.current = true;
      const loc = { latitude: data.lat, longitude: data.lng };
      setProviderLocation(loc);
      // Throttle ETA fetch to max 1 per 30 seconds
      const now = Date.now();
      if (destRef.current && now - lastEtaFetch >= 30_000) {
        lastEtaFetch = now;
        await fetchETA(data.lat, data.lng, destRef.current.lat, destRef.current.lng);
      } else if (data.eta) {
        setEta(data.eta);
      }
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    };

    const onStarted = (data: any) => {
      if (String(data.id || data.requestId) === String(id))
        setRequest((p: any) => p ? { ...p, status: 'ONGOING' } : p);
    };

    const onStatusUpdated = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      const st = data.status?.toUpperCase();
      if (st === 'QUOTE_SENT') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace({ pathname: '/request/[id]/quote-review', params: { id: String(id) } });
      } else if (st === 'QUOTE_REFUSED' || st === 'QUOTE_EXPIRED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        router.replace('/(tabs)/dashboard');
      } else if (st === 'ONGOING') {
        // Quote accepted and paid — reload request data for tracking
        api.get(`/requests/${id}`).then((res: any) => {
          const d = res?.data || res;
          if (d) transitionToTracking(d);
        }).catch(() => {});
      }
    };

    const onCompleted = (data: any) => {
      if (String(data.requestId) === String(id)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(t('mission_view.mission_completed'), 'success');
        setTimeout(() => router.replace({
          pathname: '/request/[id]/rating',
          params: { id: String(id) },
        }), 2000);
      }
    };

    const onCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        showToast(t('mission_view.mission_cancelled'), 'error');
        setTimeout(() => router.replace('/(tabs)/dashboard'), 1800);
      }
    };

    // ── PIN / photo events ──────────────────────────────────────────────────
    const onPinReady = (data: any) => {
      if (String(data.requestId) === String(id) && data.pinCode) {
        setPinCode(data.pinCode);
      }
    };

    const onBeforePhoto = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setProviderArrived(true);
        // La navigation vers /pin est gérée par le useEffect dédié
      }
    };

    const onPinVerified = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setPinVerified(true);
        showToast('Code PIN vérifié — mission en cours', 'success');
      }
    };

    socket.on('provider:location_update', onLocation);
    socket.on('request:started', onStarted);
    socket.on('request:completed', onCompleted);
    socket.on('request:cancelled', onCancelled);
    socket.on('mission:pin_ready', onPinReady);
    socket.on('mission:before_photo', onBeforePhoto);
    socket.on('mission:pin_verified', onPinVerified);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', id);
      socket.off('provider:location_update', onLocation);
      socket.off('request:started', onStarted);
      socket.off('request:completed', onCompleted);
      socket.off('request:cancelled', onCancelled);
      socket.off('mission:pin_ready', onPinReady);
      socket.off('mission:before_photo', onBeforePhoto);
      socket.off('mission:pin_verified', onPinVerified);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
  }, [socket, id, fetchETA, joinRoom, leaveRoom]);

  // ─── Set provider location depuis request initial ─────────────────────────
  // N'écrase JAMAIS l'ETA si on a déjà reçu une position réelle via socket
  // (évite le bug : request:started → setRequest → useEffect → reset ETA)
  useEffect(() => {
    if (!request) return;
    if (request.provider?.lat && request.provider?.lng) {
      const loc = { latitude: request.provider.lat, longitude: request.provider.lng };
      setProviderLocation(loc);
      if (!hasRealLocationRef.current && request.lat && request.lng) {
        fetchETA(request.provider.lat, request.provider.lng, request.lat, request.lng);
      }
    } else if (!hasRealLocationRef.current) {
      // Seulement si aucun GPS réel reçu — ne pas écraser l'ETA du socket
      setEta(t('mission_view.waiting_location'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // ─── Annuler (SEARCHING) ──────────────────────────────────────────────────
  const handleCancelSearching = useCallback(() => {
    setCancelSearchModal(true);
  }, []);

  const doConfirmCancelSearching = useCallback(async () => {
    setCancelSearchModal(false);
    setCancelling(true);
    try {
      await api.post(`/requests/${id}/cancel`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      router.replace('/(tabs)/dashboard');
    } catch {
      showToast(t('mission_view.cancel_failed'), 'error');
      setCancelling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // ─── Annuler (TRACKING) ───────────────────────────────────────────────────
  const handleCancelTracking = () => {
    const status = (request?.status || '').toUpperCase();
    if (status === 'ONGOING') {
      showToast(t('mission_view.mission_ongoing_contact'), 'error');
      return;
    }
    setCancelTrackModal(true);
  };

  const doConfirmCancelTracking = async () => {
    setCancelTrackModal(false);
    try {
      await api.post(`/requests/${id}/cancel`);
      showToast(t('mission_view.mission_was_cancelled'), 'info');
      setTimeout(() => router.replace('/(tabs)/dashboard'), 1600);
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        const res = await api.get(`/requests/${id}`);
        setRequest(res.data || res);
        showToast(t('mission_view.state_updated'), 'info');
      } else {
        showToast(t('mission_view.cancel_mission_failed'), 'error');
      }
    }
  };

  // ─── Actions communication ───────────────────────────────────────────────
  const handleCall = useCallback(() => {
    const phone = request?.provider?.phone;
    if (!phone) {
      showToast(t('mission_view.phone_unavailable'), 'error');
      return;
    }
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        showToast(t('mission_view.call_failed'), 'error');
      }
    }).catch(() => showToast(t('mission_view.call_failed'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const recipientId = request?.provider?.userId || request?.provider?.id;
    if (!recipientId) {
      showToast(t('mission_view.provider_not_found'), 'error');
      return;
    }
    const text = message.trim();
    setMessage('');
    try {
      await api.messages.send(recipientId, text);
      showToast(t('mission_view.message_sent'), 'success');
    } catch {
      showToast(t('mission_view.message_failed'), 'error');
      setMessage(text);
    }
  };

  // ─── Map region ──────────────────────────────────────────────────────────
  const mapRegion = {
    latitude:  clientLocation.latitude,
    longitude: clientLocation.longitude,
    latitudeDelta:  phase === 'SEARCHING' ? 0.025 : 0.015,
    longitudeDelta: phase === 'SEARCHING' ? 0.025 : 0.015,
  };

  const status = (request?.status || '').toUpperCase();

  // ─── Slide animation pour bottom sheets ──────────────────────────────────
  const searchingSheetY = phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });
  const trackingSheetY  = phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle={theme.statusBar} translucent backgroundColor="transparent" />

      {/* ── CARTE ── toujours présente en fond ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={mapRegion}
        scrollEnabled={phase === 'TRACKING'}
        zoomEnabled={phase === 'TRACKING'}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
      >
        {/* Marker client — toujours */}
        <Marker coordinate={clientLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={s.clientMarker}>
            <View style={[s.clientMarkerInner, { backgroundColor: theme.accent, borderColor: theme.cardBg }]} />
          </View>
        </Marker>

        {/* Itinéraire prestataire → client */}
        {phase === 'TRACKING' && routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={theme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,26,0.4)'}
            strokeWidth={3}
            lineDashPattern={[0]}
          />
        )}

        {/* Marker prestataire — seulement en TRACKING */}
        {phase === 'TRACKING' && providerLocation && (
          <Marker coordinate={providerLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <ProviderMarker />
          </Marker>
        )}

        {/* Ghost Markers — seulement en SEARCHING */}
        {phase === 'SEARCHING' && (
          <GhostMarkers center={clientLocation} />
        )}
      </MapView>

      {/* ── PHASE SEARCHING : blur + voile + radar ── */}
      {phase === 'SEARCHING' && (
        <>
          <BlurView intensity={25} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <View style={[s.veil, theme.isDark && { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

          <SafeAreaView style={s.safe} pointerEvents="box-none">
            <Animated.View style={[s.searchingContent, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

              {/* Radar */}
              <View style={s.radarZone}>
                <RadarWaves />
                <CenterLogo />
              </View>

              {/* Messages */}
              <DynamicMessage elapsed={elapsed} />

              <View style={{ flex: 1 }} />

              {/* Card mission */}
              <Animated.View style={[s.searchingSheet, { backgroundColor: theme.isDark ? 'rgba(20,20,20,0.97)' : 'rgba(255,255,255,0.97)', transform: [{ translateY: searchingSheetY }] }]}>
                <View style={[s.sheetHandle, { backgroundColor: theme.borderLight }]} />

                {/* Infos mission */}
                <View style={s.missionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.missionName, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{serviceName || t('missions.mission')}</Text>
                    <View style={s.metaRow}>
                      {address ? (
                        <>
                          <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                          <Text style={[s.metaText, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>{address.split(',')[0]}</Text>
                        </>
                      ) : null}
                    </View>
                    <View style={s.metaRow}>
                      <Ionicons name="time-outline" size={12} color={theme.textMuted} />
                      <Text style={[s.metaText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{scheduledLabel || 'Dès maintenant'}</Text>
                    </View>
                  </View>
                  <View style={s.missionRight}>
                    <View style={[s.timerPill, { backgroundColor: theme.surface }, isExpiring && { backgroundColor: theme.accent }]}>
                      <Ionicons name="timer-outline" size={10} color={isExpiring ? theme.accentText : theme.textSub} />
                      <Text style={[s.timerText, { color: theme.textSub, fontFamily: FONTS.monoMedium }, isExpiring && { color: theme.accentText }]}>{display}</Text>
                    </View>
                  </View>
                </View>

                {/* Bouton annuler / contacter support */}
                {status === 'ACCEPTED' || status === 'ONGOING' ? (
                  <TouchableOpacity
                    style={[s.cancelSearchBtn, { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => Linking.openURL('mailto:support@fixed.app')}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.textSub as string} style={{ marginRight: 8 }} />
                    <Text style={[s.cancelSearchText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
                      {t('mission_view.contact_support')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.cancelSearchBtn, { borderColor: COLORS.red, backgroundColor: theme.isDark ? 'rgba(239,68,68,0.1)' : 'rgba(255,59,48,0.05)' }, cancelling && { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}
                    onPress={handleCancelSearching}
                    disabled={cancelling}
                    activeOpacity={0.75}
                    accessibilityLabel={t('mission_view.cancel_search')}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={cancelling ? theme.textMuted : COLORS.red}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[s.cancelSearchText, { color: COLORS.red, fontFamily: FONTS.sansMedium }, cancelling && { color: theme.textMuted }]}>
                      {cancelling ? t('mission_view.cancelling') : t('mission_view.cancel_search')}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </Animated.View>
          </SafeAreaView>
        </>
      )}

      {/* ── PHASE TRACKING ── */}
      {phase === 'TRACKING' && (
        <>
          {/* Bouton retour flottant */}
          <SafeAreaView style={s.floatingTopBar} pointerEvents="box-none">
            <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity, position: 'absolute', left: 0, bottom: -2 }]} onPress={() => router.back()} activeOpacity={0.8} accessibilityLabel={t('common.back')} accessibilityRole="button">
              <Ionicons name="arrow-back" size={20} color={theme.text} />
            </TouchableOpacity>

            {/* Badge statut */}
            <View style={[s.statusBadge, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }, status === 'ONGOING' && { backgroundColor: theme.surface }]} accessibilityLabel={status === 'ONGOING' ? t('mission_view.mission_ongoing') : t('mission_view.provider_on_way')} accessibilityRole="text">
              <PulseDot size={8} />
              <Text style={[s.statusText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                {status === 'ONGOING' ? t('mission_view.mission_ongoing') : t('mission_view.provider_on_way')}
              </Text>
            </View>
          </SafeAreaView>

          {/* Bouton recentrer */}
          <TouchableOpacity
            style={[s.recenterBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
            onPress={() => mapRef.current?.animateToRegion({ ...clientLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600)}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={18} color={theme.text} />
          </TouchableOpacity>

          {/* Bottom sheet tracking */}
          <Animated.View style={[s.trackingSheet, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity + 0.04, transform: [{ translateY: trackingSheetY }] }]}>
            <View style={[s.sheetHandle, { backgroundColor: theme.borderLight }]} />

            {/* ETA */}
            <View style={s.etaRow}>
              <View>
                <Text style={[s.etaLabel, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                  {status === 'ONGOING' ? t('mission_view.on_site') : t('mission_view.estimated_arrival')}
                </Text>
                <Text style={[s.etaTime, { color: theme.text, fontFamily: FONTS.bebas }]}>
                  {status === 'ONGOING' ? t('mission_view.on_site') : (eta || t('mission_view.calculating'))}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

            {/* Provider card */}
            {request?.provider && (
              <View style={s.providerRow}>
                {/* Avatar */}
                <Avatar url={request.provider.avatarUrl} name={request.provider.name} size={46} style={{ marginRight: 12 }} />

                {/* Infos */}
                <View style={s.providerInfo}>
                  <Text style={[s.providerName, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{request.provider.name || t('mission_view.provider')}</Text>
                  <View style={s.ratingRow}>
                    <Ionicons name="star" size={12} color={COLORS.amber} />
                    <Text style={[s.ratingText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                      {request.provider.avgRating?.toFixed(1) || '5.0'}
                    </Text>
                    <Text style={[s.ratingMuted, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                      · {request.provider.jobsCompleted || 0} missions
                    </Text>
                  </View>
                  {request.provider.vatNumber ? (
                    <Text style={[s.serviceText, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>
                      TVA {request.provider.vatNumber}
                    </Text>
                  ) : null}
                </View>

                {/* Actions communication */}
                <View style={s.comActions}>
                  {/* Appel */}
                  <TouchableOpacity style={[s.comBtn, { backgroundColor: theme.accent }]} onPress={handleCall} activeOpacity={0.75} accessibilityLabel={t('common.call')} accessibilityRole="button">
                    <Ionicons name="call" size={18} color={theme.accentText} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />


            {/* Bouton conversation */}
            <TouchableOpacity
              style={[s.messageBtn, { backgroundColor: theme.accent }]}
              onPress={() => {
                const recipientId = request?.provider?.userId || request?.provider?.id;
                if (recipientId) {
                  router.push({ pathname: '/messages/[userId]', params: { userId: recipientId, name: request?.provider?.name || '' } });
                } else {
                  showToast(t('mission_view.provider_not_found'), 'error');
                }
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <View style={s.btnIconWrap}><Ionicons name="chatbubble-outline" size={16} color={theme.accentText as string} /></View>
              <Text style={[s.messageBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('mission_view.message_provider')}</Text>
            </TouchableOpacity>

            {/* Contacter le support — ACCEPTED ou ONGOING */}
            {(status === 'ACCEPTED' || status === 'ONGOING') && (
              <TouchableOpacity style={[s.cancelTrackBtn, { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} onPress={() => Linking.openURL('mailto:support@fixed.app')} activeOpacity={0.75} accessibilityRole="button">
                <View style={[s.btnIconWrap, { marginRight: 16 }]}><Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.textSub as string} /></View>
                <Text style={[s.cancelTrackText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{t('mission_view.contact_support')}</Text>
              </TouchableOpacity>
            )}

          </Animated.View>
        </>
      )}

      {/* ── MODALS ── */}
      <ConfirmModal
        visible={cancelSearchModal}
        title={`${t('mission_view.cancel_search')} ?`}
        message="Le remboursement sera traité sous 48h."
        confirmLabel={t('common.cancel')}
        cancelLabel={t('common.continue')}
        destructive
        onConfirm={doConfirmCancelSearching}
        onCancel={() => setCancelSearchModal(false)}
      />
      <ConfirmModal
        visible={cancelTrackModal}
        title={`${t('mission_view.cancel_mission')} ?`}
        message="Êtes-vous sûr de vouloir annuler ?"
        confirmLabel={t('missions.yes_cancel')}
        cancelLabel="Non"
        destructive
        onConfirm={doConfirmCancelTracking}
        onCancel={() => setCancelTrackModal(false)}
      />

      {/* ── TOASTS ── */}
      <ToastProvider />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.45)' },

  // ─── SEARCHING ────────────────────────────────────────────────────────────
  searchingContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  radarZone: {
    width: '100%',
    height: height * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchingSheet: {
    width: '100%',
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 6 },
    }),
  },

  sheetHandle: {
    width: 32, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },

  missionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  missionName: { fontSize: 14, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 12, flex: 1 },
  missionRight: { alignItems: 'flex-end', gap: 8, marginLeft: 12 },
  missionPrice: { fontSize: 22, letterSpacing: -0.5 },

  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  timerText: { fontSize: 12 },

  cancelSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5,
  },
  cancelSearchText: { fontSize: 15, letterSpacing: -0.2 },

  // ─── TRACKING ─────────────────────────────────────────────────────────────
  floatingTopBar: {
    position: 'absolute',
    top: 0, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  recenterBtn: {
    position: 'absolute', right: 28, bottom: 355,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  statusText: { fontSize: 13 },

  trackingSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
  },

  etaRow: { alignItems: 'center', marginBottom: 12 },
  etaLabel: { fontSize: 12, marginBottom: 2, textAlign: 'center' },
  etaTime: { fontSize: 32, letterSpacing: 1, textAlign: 'center' },
  etaBadge: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, marginBottom: 12 },

  providerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 17, marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  ratingText: { fontSize: 13 },
  ratingMuted: { fontSize: 13 },
  serviceText: { fontSize: 12 },

  comActions: { flexDirection: 'row', gap: 10 },
  comBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 5 },
    }),
  },

  messageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, marginBottom: 10,
  },
  messageBtnText: { fontSize: 14 },
  btnIconWrap: { marginRight: 8 },

  cancelTrackBtn: {
    flexDirection: 'row', paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelTrackText: { fontSize: 13 },

  ongoingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  ongoingText: { fontSize: 13, flex: 1 },

  // ─── PIN ────────────────────────────────────────────────────────────────
  pinVerifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10, borderWidth: 1,
  },
  pinVerifiedText: { fontSize: 13, flex: 1 },

  // ─── Markers ──────────────────────────────────────────────────────────────
  clientMarker: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(26,26,26,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientMarkerInner: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2,
  },
});