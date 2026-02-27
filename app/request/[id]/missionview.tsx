/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/request/[id]/MissionView.tsx
// ─── Page unifiée : SEARCHING → TRACKING (même écran, transition de phase) ───

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Animated, Easing, Platform, Dimensions, StatusBar,
  TextInput, KeyboardAvoidingView, Modal, Pressable,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
        const bg = t.type === 'success' ? '#059669' : t.type === 'error' ? '#1A1A1A' : '#1A1A1A';
        const icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '●';
        return (
          <Animated.View
            key={t.id}
            style={[toast.pill, { backgroundColor: bg },
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

function ConfirmModal({ visible, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', destructive = false, onConfirm, onCancel }: ConfirmModalProps) {
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
  }, [visible]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={cm.overlay} onPress={onCancel}>
        <Animated.View style={{ opacity: fadeAnim, ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </Pressable>
      <Animated.View style={[cm.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={cm.handle} />
        <Text style={cm.title}>{title}</Text>
        {message ? <Text style={cm.message}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={cm.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={cm.cancelLabel}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cm.confirmBtn, destructive && cm.confirmBtnDestructive]} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={[cm.confirmLabel, destructive && cm.confirmLabelDestructive]}>{confirmLabel}</Text>
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
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 16 } }),
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  message: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  cancelLabel: { fontSize: 15, fontWeight: '700', color: '#888' },
  confirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#1A1A1A', alignItems: 'center' },
  confirmBtnDestructive: { backgroundColor: '#FF3B30' },
  confirmLabel: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  confirmLabelDestructive: { color: '#FFF' },
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

// ─── Grayscale map style ──────────────────────────────────────────────────────
const MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR WAVES (phase SEARCHING)
// ═══════════════════════════════════════════════════════════════════════════════
const WAVE_COUNT = 4;
const WAVE_SIZE = width * 0.85;

function RadarWaves() {
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
          style={[rw.wave, {
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
  wave: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, borderRadius: WAVE_SIZE / 2, borderWidth: 1.5, borderColor: '#1A1A1A' },
});

// ─── Ghost Markers (prestataires fantômes sur carte) ─────────────────────────
const GHOST_OFFSETS = [
  { lat: 0.008, lng: 0.006 },
  { lat: -0.005, lng: 0.012 },
  { lat: 0.003, lng: -0.010 },
];

function GhostMarkers({ center }: { center: { latitude: number; longitude: number } }) {
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
            <Animated.View style={[gm.outer, {
              opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }),
              transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
            }]}>
              <Ionicons name="person" size={12} color="#FFF" />
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
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
});

// ─── Logo central pulsant ─────────────────────────────────────────────────────
function CenterLogo() {
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
    <Animated.View style={[cl.outer, { transform: [{ scale: pulse }] }]}>
      <Ionicons name="search" size={28} color="#FFF" />
    </Animated.View>
  );
}

const cl = StyleSheet.create({
  outer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 16 },
    }),
  },
});

// ─── Messages dynamiques (SEARCHING) ─────────────────────────────────────────
const STEPS = [
  { at: 0,   title: 'Analyse de votre demande',   sub: 'Vérification des détails de la mission' },
  { at: 4,   title: 'Recherche de prestataires',  sub: 'Scan des intervenants disponibles à proximité' },
  { at: 10,  title: 'Mise en relation en cours',  sub: 'Sélection du meilleur profil pour vous' },
  { at: 25,  title: 'Finalisation',               sub: 'Cela prend généralement moins de 2 minutes' },
  { at: 70,  title: 'Élargissement de la zone',   sub: 'Nous cherchons plus loin autour de vous' },
  { at: 140, title: 'Toujours en recherche',      sub: 'Un prestataire sera disponible sous peu' },
];

function DynamicMessage({ elapsed }: { elapsed: number }) {
  const current = [...STEPS].reverse().find(s => elapsed >= s.at) || STEPS[0];
  const opacity = useRef(new Animated.Value(1)).current;
  const prev = useRef(current.title);

  useEffect(() => {
    if (prev.current === current.title) return;
    prev.current = current.title;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [current.title]);

  return (
    <Animated.View style={[dm.wrap, { opacity }]}>
      <Text style={dm.title}>{current.title}</Text>
      <Text style={dm.sub}>{current.sub}</Text>
    </Animated.View>
  );
}

const dm = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 7 },
  sub:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
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
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[pm.outer, { transform: [{ scale: pulse }] }]}>
      <Ionicons name="car" size={20} color="#FFF" />
    </Animated.View>
  );
}

const pm = StyleSheet.create({
  outer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 10 },
    }),
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MissionView() {
  const router = useRouter();
  const { id, serviceName, address, price, scheduledLabel, expiresAt, lat, lng } =
    useLocalSearchParams<MissionParams>();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);

  // ─── Phase state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('SEARCHING');
  const phaseAnim = useRef(new Animated.Value(0)).current; // 0 = searching, 1 = tracking

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
  const [eta, setEta] = useState('Calcul en cours...');
  const [message, setMessage] = useState('');

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
  }, []);

  // ─── Elapsed (searching) ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'SEARCHING') return;
    const iv = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ─── Transition vers TRACKING ─────────────────────────────────────────────
  const transitionToTracking = useCallback((requestData: any) => {
    setRequest(requestData);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Slide down la bottom sheet de searching, puis afficher tracking
    Animated.timing(phaseAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => setPhase('TRACKING'));
  }, []);

  // ─── ETA Google ──────────────────────────────────────────────────────────
  const fetchETA = useCallback(async (oLat: number, oLng: number, dLat: number, dLng: number) => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No key');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes?.length > 0) {
        setEta(data.routes[0].legs[0].duration.text);
      } else throw new Error(data.status);
    } catch {
      setEta(fallbackETA(oLat, oLng, dLat, dLng));
    }
  }, []);

  // ─── Polling SEARCHING (5s) ───────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const poll = async () => {
      try {
        const res = await api.request(`/requests/${id}`);
        const data = res?.data || res;
        const status = (data?.status || '').toUpperCase();
        if (status === 'ACCEPTED' || status === 'ONGOING') {
          transitionToTracking(data);
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          router.replace('/(tabs)/dashboard');
        }
      } catch (e) { console.error('[MissionView] poll:', e); }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [id]);

  useEffect(() => { if (isExpired) router.replace('/(tabs)/dashboard'); }, [isExpired]);

  // ─── Socket (TRACKING) ────────────────────────────────────────────────────
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (request?.lat && request?.lng) destRef.current = { lat: request.lat, lng: request.lng };
  }, [request]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join:request', { requestId: id });

    const onLocation = async (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      const loc = { latitude: data.lat, longitude: data.lng };
      setProviderLocation(loc);
      if (destRef.current) await fetchETA(data.lat, data.lng, destRef.current.lat, destRef.current.lng);
      else if (data.eta) setEta(data.eta);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    };

    const onStarted = (data: any) => {
      if (String(data.id || data.requestId) === String(id))
        setRequest((p: any) => p ? { ...p, status: 'ONGOING' } : p);
    };

    const onCompleted = (data: any) => {
      if (String(data.requestId) === String(id)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast('Mission terminée avec succès.', 'success');
        setTimeout(() => router.replace('/(tabs)/dashboard'), 2000);
      }
    };

    const onCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        showToast('Cette mission a été annulée.', 'error');
        setTimeout(() => router.replace('/(tabs)/dashboard'), 1800);
      }
    };

    socket.on('provider:location_update', onLocation);
    socket.on('request:started', onStarted);
    socket.on('request:completed', onCompleted);
    socket.on('request:cancelled', onCancelled);
    return () => {
      socket.emit('leave:request', { requestId: id });
      socket.off('provider:location_update', onLocation);
      socket.off('request:started', onStarted);
      socket.off('request:completed', onCompleted);
      socket.off('request:cancelled', onCancelled);
    };
  }, [socket, id, fetchETA]);

  // ─── Set provider location depuis request initial ─────────────────────────
  useEffect(() => {
    if (!request) return;
    if (request.provider?.lat && request.provider?.lng) {
      const loc = { latitude: request.provider.lat, longitude: request.provider.lng };
      setProviderLocation(loc);
      if (request.lat && request.lng) fetchETA(request.provider.lat, request.provider.lng, request.lat, request.lng);
    } else {
      setEta('En attente de localisation...');
    }
  }, [request]);

  // ─── Annuler (SEARCHING) ──────────────────────────────────────────────────
  const handleCancelSearching = useCallback(() => {
    setCancelSearchModal(true);
  }, []);

  const doConfirmCancelSearching = useCallback(async () => {
    setCancelSearchModal(false);
    setCancelling(true);
    try {
      await api.request(`/requests/${id}`, { method: 'PATCH', body: { status: 'CANCELLED' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      router.replace('/(tabs)/dashboard');
    } catch {
      showToast("Impossible d'annuler. Réessayez.", 'error');
      setCancelling(false);
    }
  }, [id, router]);

  // ─── Annuler (TRACKING) ───────────────────────────────────────────────────
  const handleCancelTracking = () => {
    const status = (request?.status || '').toUpperCase();
    if (status === 'ONGOING') {
      showToast('La mission est en cours. Contactez le prestataire.', 'error');
      return;
    }
    setCancelTrackModal(true);
  };

  const doConfirmCancelTracking = async () => {
    setCancelTrackModal(false);
    try {
      await api.post(`/requests/${id}/cancel`);
      showToast('La mission a été annulée.', 'info');
      setTimeout(() => router.replace('/(tabs)/dashboard'), 1600);
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        const res = await api.get(`/requests/${id}`);
        setRequest(res.data || res);
        showToast('État de la mission mis à jour.', 'info');
      } else {
        showToast("Impossible d'annuler la mission.", 'error');
      }
    }
  };

  // ─── Actions communication (placeholders) ────────────────────────────────
  const handleCall = () => {
    showToast('Fonctionnalité appel à configurer.', 'info');
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    // TODO: implémenter l'envoi de message
    showToast('Message envoyé au prestataire.', 'success');
    setMessage('');
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
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── CARTE ── toujours présente en fond ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
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
            <View style={s.clientMarkerInner} />
          </View>
        </Marker>

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
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.veil} />

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
              <Animated.View style={[s.searchingSheet, { transform: [{ translateY: searchingSheetY }] }]}>
                <View style={s.sheetHandle} />

                {/* Infos mission */}
                <View style={s.missionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.missionName} numberOfLines={1}>{serviceName || 'Mission'}</Text>
                    <View style={s.metaRow}>
                      {address ? (
                        <>
                          <Ionicons name="location-outline" size={12} color="#ADADAD" />
                          <Text style={s.metaText} numberOfLines={1}>{address.split(',')[0]}</Text>
                        </>
                      ) : null}
                    </View>
                    <View style={s.metaRow}>
                      <Ionicons name="time-outline" size={12} color="#ADADAD" />
                      <Text style={s.metaText}>{scheduledLabel || 'Dès maintenant'}</Text>
                    </View>
                  </View>
                  <View style={s.missionRight}>
                    {price ? <Text style={s.missionPrice}>{price} €</Text> : null}
                    <View style={[s.timerPill, isExpiring && s.timerPillUrgent]}>
                      <Ionicons name="timer-outline" size={10} color={isExpiring ? '#FFF' : '#888'} />
                      <Text style={[s.timerText, isExpiring && s.timerTextUrgent]}>{display}</Text>
                    </View>
                  </View>
                </View>

                {/* Bouton annuler */}
                <TouchableOpacity
                  style={[s.cancelSearchBtn, cancelling && s.cancelSearchBtnOff]}
                  onPress={handleCancelSearching}
                  disabled={cancelling}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={cancelling ? '#ADADAD' : '#FF3B30'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[s.cancelSearchText, cancelling && s.cancelSearchTextOff]}>
                    {cancelling ? 'Annulation…' : 'Annuler la recherche'}
                  </Text>
                </TouchableOpacity>
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
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Badge statut */}
            <View style={[s.statusBadge, status === 'ONGOING' && s.statusBadgeOngoing]}>
              <View style={[s.statusDot, status === 'ONGOING' && s.statusDotOngoing]} />
              <Text style={[s.statusText, status === 'ONGOING' && s.statusTextOngoing]}>
                {status === 'ONGOING' ? 'Mission en cours' : 'Prestataire en route'}
              </Text>
            </View>
          </SafeAreaView>

          {/* Bottom sheet tracking */}
          <Animated.View style={[s.trackingSheet, { transform: [{ translateY: trackingSheetY }] }]}>
            <View style={s.sheetHandle} />

            {/* ETA */}
            <View style={s.etaRow}>
              <View>
                <Text style={s.etaLabel}>
                  {status === 'ONGOING' ? 'Sur place' : 'Arrivée estimée'}
                </Text>
                <Text style={s.etaTime}>
                  {status === 'ONGOING' ? '—' : eta}
                </Text>
              </View>
              <View style={s.etaBadge}>
                <Ionicons name="navigate" size={14} color="#1A1A1A" />
              </View>
            </View>

            {/* Divider */}
            <View style={s.divider} />

            {/* Provider card */}
            {request?.provider && (
              <View style={s.providerRow}>
                {/* Avatar */}
                <View style={s.avatar}>
                  <Ionicons name="person" size={26} color="#1A1A1A" />
                </View>

                {/* Infos */}
                <View style={s.providerInfo}>
                  <Text style={s.providerName}>{request.provider.name || 'Prestataire'}</Text>
                  <View style={s.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={s.ratingText}>
                      {request.provider.avgRating?.toFixed(1) || '5.0'}
                    </Text>
                    <Text style={s.ratingMuted}>
                      · {request.provider.jobsCompleted || 0} missions
                    </Text>
                  </View>
                  <Text style={s.serviceText} numberOfLines={1}>
                    {request.serviceType || serviceName}
                  </Text>
                </View>

                {/* Actions communication */}
                <View style={s.comActions}>
                  {/* Appel */}
                  <TouchableOpacity style={s.comBtn} onPress={handleCall} activeOpacity={0.75}>
                    <Ionicons name="call" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={s.divider} />

            {/* Champ message */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.messageRow}>
                <TextInput
                  style={s.messageInput}
                  placeholder="Envoyer un message au prestataire…"
                  placeholderTextColor="#B0B0B0"
                  value={message}
                  onChangeText={setMessage}
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity
                  style={[s.sendBtn, !message.trim() && s.sendBtnOff]}
                  onPress={handleSendMessage}
                  activeOpacity={0.75}
                  disabled={!message.trim()}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>

            {/* Annuler — seulement si ACCEPTED */}
            {status === 'ACCEPTED' && (
              <TouchableOpacity style={s.cancelTrackBtn} onPress={handleCancelTracking} activeOpacity={0.75}>
                <Text style={s.cancelTrackText}>Annuler la mission</Text>
              </TouchableOpacity>
            )}

            {/* Banner ONGOING */}
            {status === 'ONGOING' && (
              <View style={s.ongoingBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={s.ongoingText}>Le prestataire est sur place</Text>
              </View>
            )}
          </Animated.View>
        </>
      )}

      {/* ── MODALS ── */}
      <ConfirmModal
        visible={cancelSearchModal}
        title="Annuler la recherche ?"
        message="Votre demande sera annulée. Le remboursement sera traité sous 3–5 jours ouvrés."
        confirmLabel="Annuler la recherche"
        cancelLabel="Continuer"
        destructive
        onConfirm={doConfirmCancelSearching}
        onCancel={() => setCancelSearchModal(false)}
      />
      <ConfirmModal
        visible={cancelTrackModal}
        title="Annuler la mission ?"
        message="Êtes-vous sûr de vouloir annuler ?"
        confirmLabel="Oui, annuler"
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
    height: height * 0.40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchingSheet: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 6 },
    }),
  },

  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 18,
  },

  missionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  missionName: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 12, color: '#ADADAD', fontWeight: '500', flex: 1 },
  missionRight: { alignItems: 'flex-end', gap: 8, marginLeft: 12 },
  missionPrice: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },

  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  timerPillUrgent: { backgroundColor: '#1A1A1A' },
  timerText: { fontSize: 12, fontWeight: '800', color: '#555' },
  timerTextUrgent: { color: '#FFF' },

  cancelSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.05)',
  },
  cancelSearchBtnOff: { borderColor: '#E0E0E0', backgroundColor: 'rgba(0,0,0,0.02)' },
  cancelSearchText: { fontSize: 15, fontWeight: '700', color: '#FF3B30', letterSpacing: -0.2 },
  cancelSearchTextOff: { color: '#ADADAD' },

  // ─── TRACKING ─────────────────────────────────────────────────────────────
  floatingTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFF',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  statusBadgeOngoing: { backgroundColor: '#ECFDF5' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1A1A1A' },
  statusDotOngoing: { backgroundColor: '#059669' },
  statusText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  statusTextOngoing: { color: '#059669' },

  trackingSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
  },

  etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  etaLabel: { fontSize: 13, color: '#888', fontWeight: '500', marginBottom: 4 },
  etaTime: { fontSize: 36, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1 },
  etaBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F4F4F4',
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 18 },

  providerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#F4F4F4',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1.5, borderColor: '#EBEBEB',
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  ratingMuted: { fontSize: 13, color: '#ADADAD' },
  serviceText: { fontSize: 12, color: '#ADADAD', fontWeight: '500' },

  comActions: { flexDirection: 'row', gap: 10 },
  comBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 5 },
    }),
  },

  messageRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 16,
  },
  messageInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F6F6F6',
    borderRadius: 24,
    paddingHorizontal: 18,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: '#D0D0D0' },

  cancelTrackBtn: {
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.05)',
    alignItems: 'center', marginBottom: 0,
  },
  cancelTrackText: { fontSize: 15, fontWeight: '700', color: '#FF3B30' },

  ongoingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  ongoingText: { fontSize: 13, fontWeight: '600', color: '#059669', flex: 1 },

  // ─── Markers ──────────────────────────────────────────────────────────────
  clientMarker: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(26,26,26,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientMarkerInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1A1A1A',
    borderWidth: 2, borderColor: '#FFF',
  },
});