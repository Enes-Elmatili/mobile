// app/request/[id]/ongoing.tsx
// v5 — Step-by-step guided mission flow for providers + Design System dark mode

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
  StatusBar,
  BackHandler,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useConversationUnread } from '@/lib/useConversationUnread';
import { markCompletionHandled } from '@/lib/navDedup';
import { resolveAvatarUrl } from '@/lib/avatarUrl';
import { api } from '@/lib/api';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { tokenStorage } from '@/lib/storage';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEUR as formatEuros } from '@/lib/format';
import { PulseDot } from '@/components/ui/PulseDot';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/?$/, '');

/** Avatar component — real photo or initials fallback */
function Avatar({ url, name, size = 46, style }: { url?: string | null; name?: string | null; size?: number; style?: any }) {
  const theme = useAppTheme();
  const r = size / 2;
  const base = { width: size, height: size, borderRadius: r, overflow: 'hidden' as const };
  const resolved = resolveAvatarUrl(url);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={[base, { borderWidth: 1.5, borderColor: theme.borderLight }, style]} />;
  }
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[base, { backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.borderLight }, style]}>
      <Text style={{ fontSize: size * 0.38, fontFamily: FONTS.sansMedium, color: theme.text }}>{initials}</Text>
    </View>
  );
}
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Utils ───────────────────────────────────────────────────────────────────

const decodePolyline = (encoded: string) => {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Map styles ──────────────────────────────────────────────────────────────

const MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#333333' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const RETRY_MAX = 6;
const RETRY_DELAY = 800;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Upload helper ───────────────────────────────────────────────────────────

async function uploadMissionPhoto(
  requestId: string,
  type: 'before' | 'after',
  imageUri: string,
  coords?: { latitude: number; longitude: number } | null,
): Promise<string> {
  const token = await tokenStorage.getToken();
  const endpoint = type === 'before' ? 'before-photo' : 'after-photo';
  const url = `${API_BASE_URL}/requests/${requestId}/${endpoint}`;
  const formData = new FormData();
  const filename = imageUri.split('/').pop() || `mission_${type}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  formData.append('photo', { uri: imageUri, name: filename, type: mimeType } as any);
  // GPS anti-fraud metadata
  if (coords) {
    formData.append('latitude', String(coords.latitude));
    formData.append('longitude', String(coords.longitude));
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}) },
    body: formData,
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    const snippet = (text || '').slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(`Réponse invalide du serveur (HTTP ${response.status}${snippet ? `: ${snippet}` : ''})`);
  }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.message || `HTTP ${response.status}`), { status: response.status, data });
  return data.photoUrl;
}

// ─── Step indicator component ────────────────────────────────────────────────

type MissionStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<number, { title: string; icon: string }> = {
  1: { title: 'Photo avant', icon: 'camera' },
  2: { title: 'Code PIN', icon: 'key' },
  3: { title: 'Envoyer le devis', icon: 'file-text' },
  4: { title: 'Photo après & Terminer', icon: 'check-circle' },
};

function StepIndicator({ current, total, theme }: { current: number; total: number; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isFilled = step <= current;
        return (
          <View
            key={step}
            style={[
              si.bar,
              { backgroundColor: theme.borderLight },
              isFilled && { backgroundColor: theme.accent },
            ]}
          />
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
});

// ─── Action card component ───────────────────────────────────────────────────

function ActionCard({ icon, title, subtitle, children, theme }: {
  icon: string; title: string; subtitle: string; children: React.ReactNode; theme: ReturnType<typeof useAppTheme>;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[ac.card, {
      backgroundColor: theme.cardBg,
      opacity: fadeIn,
      transform: [{ translateY: slideUp }],
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
        android: { elevation: 3 },
      }),
    }]}>
      <View style={ac.header}>
        <View style={[ac.iconCircle, { backgroundColor: theme.surface }]}>
          <Feather name={icon as any} size={22} color={theme.text} />
        </View>
        <View style={ac.headerText}>
          <Text style={[ac.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{title}</Text>
          <Text style={[ac.subtitle, { color: theme.textSub, fontFamily: FONTS.sans }]}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

const ac = StyleSheet.create({
  card: { borderRadius: 14, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  headerText: { flex: 1 },
  title: { fontSize: 15, marginBottom: 1 },
  subtitle: { fontSize: 12 },
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function MissionOngoing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const { user: authUser } = useAuth();
  const theme = useAppTheme();
  const mapStyle = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Photo + PIN + Quote state
  const [beforePhotoUploaded, setBeforePhotoUploaded] = useState(false);
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [afterPhotoUploaded, setAfterPhotoUploaded] = useState(false);
  const [hasQuote, setHasQuote] = useState(false);
  const pinInputRef = useRef<TextInput>(null);

  // ─── Conversation badge (client → provider) ──────────────────────────────
  const clientUserId = request?.client?.id || request?.clientId || null;
  const { count: unreadFromClient, reset: resetUnread } = useConversationUnread(
    clientUserId,
    authUser?.id,
  );

  // ─── Route fetch ──────────────────────────────────────────────────────────

  const fetchRoute = useCallback(async (oLat: number, oLng: number, dLat: number, dLng: number) => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No key');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK') throw new Error(data.status);
      const leg = data.routes[0].legs[0];
      setDistance(leg.distance.text);
      setDuration(leg.duration.text);
      setRouteCoords(decodePolyline(data.routes[0].overview_polyline.points));
      return { distance: leg.distance.text, duration: leg.duration.text };
    } catch {
      const d = calculateDistance(oLat, oLng, dLat, dLng);
      setDistance(`${d.toFixed(1)} km`);
      setDuration(`${Math.ceil(d * 3)} min`);
      return { distance: `${d.toFixed(1)} km`, duration: `${Math.ceil(d * 3)} min` };
    }
  }, []);

  // ─── Load request ─────────────────────────────────────────────────────────

  const loadRequest = useCallback(async (attempt = 0) => {
    try {
      const response = await api.get(`/requests/${id}`);
      const data = response.data || response;
      const st = (data?.status || '').toUpperCase();

      if (['PUBLISHED', 'PENDING', 'QUOTE_PENDING'].includes(st)) {
        if (attempt < RETRY_MAX) { setLoading(true); await sleep(RETRY_DELAY); return loadRequest(attempt + 1); }
        Alert.alert('Mission non disponible', "La mission n'a pas pu être confirmée.", [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]);
        return;
      }

      if (!['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(st)) {
        if (st === 'DONE') router.replace(`/request/${id}/earnings`);
        else router.replace('/(tabs)/dashboard');
        return;
      }

      // ── Gate temporel ──
      // Mission planifiée hors fenêtre d'activation (>30 min avant) → écran dédié
      // /early (countdown, récap mission, itinéraire, refus). On évite l'Alert
      // qui interrompt brutalement le provider sans contexte. Les ONGOING bypassent.
      if (st === 'ACCEPTED' && data?.preferredTimeStart) {
        const startTs = new Date(data.preferredTimeStart).getTime();
        const minutesUntilStart = Math.round((startTs - Date.now()) / 60_000);
        if (minutesUntilStart > 30) {
          router.replace({ pathname: '/request/[id]/early', params: { id: String(id) } });
          return;
        }
      }

      if (data.beforePhotoUrl) setBeforePhotoUploaded(true);
      if (data.pinVerified) setPinVerified(true);
      if (data.afterPhotoUrl) setAfterPhotoUploaded(true);
      setRequest(data);

      // Check if a quote was already sent for this request
      if (data.pricingMode === 'estimate' || data.pricingMode === 'diagnostic') {
        try {
          const qRes = await api.get(`/quotes/request/${id}`);
          if (qRes?.quotes?.length > 0) setHasQuote(true);
        } catch { /* no quote yet */ }
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la mission', [{ text: 'Retour', onPress: () => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); } }]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);
  useEffect(() => { loadRequest(); }, [loadRequest]);

  // Re-fetch les données quand l'écran regagne le focus (retour d'app switch)
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // Skip first mount (loadRequest already called via useEffect)
      if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
      loadRequest();
    }, [loadRequest])
  );

  // ─── Location tracking ────────────────────────────────────────────────────

  const requestRef = useRef<any>(null);
  const trackingStartedRef = useRef(false);
  const lastEmitRef = useRef(0);

  // Keep requestRef in sync without re-triggering effects
  useEffect(() => { requestRef.current = request; }, [request]);

  const startTracking = useCallback(async () => {
    if (trackingStartedRef.current) return; // Prevent duplicate watchers
    trackingStartedRef.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { trackingStartedRef.current = false; return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMyLocation(coords);
      const req = requestRef.current;
      if (req?.lat && req?.lng) await fetchRoute(coords.latitude, coords.longitude, req.lat, req.lng);

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 30 },
        async (newLoc) => {
          const c = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
          setMyLocation(c);
          const curReq = requestRef.current;
          if (curReq?.lat && curReq?.lng) {
            const rd = await fetchRoute(c.latitude, c.longitude, curReq.lat, curReq.lng);
            // Throttle socket emissions to max 1 per 10 seconds
            const now = Date.now();
            if (now - lastEmitRef.current >= 10_000 && socket?.connected) {
              lastEmitRef.current = now;
              socket.emit('provider:location_update', { requestId: Number(id), lat: c.latitude, lng: c.longitude, eta: rd.duration });
            }
          }
        }
      );
    } catch (e) { devError('[ONGOING] Location:', e); trackingStartedRef.current = false; }
  }, [fetchRoute, socket, id]);

  useEffect(() => {
    if (request && !trackingStartedRef.current) startTracking();
    return () => {
      if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
      trackingStartedRef.current = false;
    };
  }, [!!request]); // Only trigger on request existence change (null→object), not on every update

  // ─── Socket ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);
    const onCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
        router.replace('/(tabs)/dashboard');
      }
    };
    const onStatusUpdated = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      // Devis accepté → statut revient à ONGOING, reload pour avancer le step
      loadRequest();
    };
    socket.on('request:cancelled', onCancelled);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', id);
      socket.off('request:cancelled', onCancelled);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
  }, [socket, id, router, joinRoom, leaveRoom]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleCall = () => {
    if (request?.client?.phone) Linking.openURL(`tel:${request.client.phone}`);
    else Alert.alert('Indisponible', "Le numéro du client n'est pas disponible.");
  };

  const openActionsMenu = useCallback(() => {
    const goSupport = () => router.push('/settings/help');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Contacter le support'], cancelButtonIndex: 0 },
        (idx: number) => { if (idx === 1) goSupport(); },
      );
      return;
    }
    Alert.alert('Options', undefined, [
      { text: 'Contacter le support', onPress: goSupport },
      { text: 'Fermer', style: 'cancel' },
    ], { cancelable: true });
  }, [router]);

  const handleNavigate = async () => {
    if (!request?.lat || !request?.lng) return;
    const { lat, lng } = request;
    if (Platform.OS === 'ios') {
      const gUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const aUrl = `maps://?daddr=${lat},${lng}`;
      const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const canG = await Linking.canOpenURL(gUrl);
      if (canG) Linking.openURL(gUrl);
      else { const canA = await Linking.canOpenURL(aUrl); Linking.openURL(canA ? aUrl : web); }
    } else {
      const gNav = `google.navigation:q=${lat},${lng}&mode=d`;
      const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const can = await Linking.canOpenURL(gNav);
      Linking.openURL(can ? gNav : web);
    }
  };

  // Step 1: Before photo (with GPS)
  const handleBeforePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission requise', 'Autorisez la caméra.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setActionLoading(true);
      try {
        await uploadMissionPhoto(id!, 'before', result.assets[0].uri, myLocation);
        setBeforePhotoUploaded(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err: any) {
        devError('[ONGOING] Before photo:', err);
        Alert.alert('Erreur', err.message || "Impossible d'envoyer la photo.");
      } finally { setActionLoading(false); }
    } catch (err) { devError('[ONGOING] Camera:', err); }
  };

  // Step 2: PIN
  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(cleaned);
    requestAnimationFrame(() => pinInputRef.current?.focus());
  };

  // Step 2: PIN → auto-start
  const handleVerifyPin = async () => {
    if (pin.length !== 4) return;
    setActionLoading(true);
    try {
      await api.post(`/requests/${id}/verify-pin`, { pin });
      setPinVerified(true);
      // Backend auto-starts the mission on PIN verify
      setRequest((p: any) => ({ ...p, status: 'ONGOING' }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === 'PIN_INCORRECT') {
        Alert.alert('Code incorrect', error.data?.message || 'Réessayez.');
        setPin('');
        pinInputRef.current?.focus();
      } else if (code === 'PIN_EXPIRED') {
        Alert.alert('Code expiré', 'Le code PIN a expiré.');
      } else if (code === 'PIN_MAX_ATTEMPTS') {
        Alert.alert('Trop de tentatives', 'Contactez le support.');
      } else {
        Alert.alert('Erreur', error.message || 'Impossible de vérifier le code.');
      }
    } finally { setActionLoading(false); }
  };

  // Step 3a: After photo (with GPS)
  const handleAfterPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission requise', 'Autorisez la caméra.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setActionLoading(true);
      try {
        await uploadMissionPhoto(id!, 'after', result.assets[0].uri, myLocation);
        setAfterPhotoUploaded(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err: any) {
        devError('[ONGOING] After photo:', err);
        Alert.alert('Erreur', err.message || "Impossible d'envoyer la photo.");
      } finally { setActionLoading(false); }
    } catch (err) { devError('[ONGOING] Camera:', err); }
  };

  // Step 5: Complete
  const handleComplete = () => {
    Alert.alert('Terminer la mission', 'Confirmer que la mission est terminée ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          setActionLoading(true);
          // Marquer AVANT l'await : le backend émet le socket request:completed
          // avant de répondre HTTP, donc SocketContext reçoit l'event pendant
          // que l'await est en cours. Sans mark préalable, SocketContext
          // schedule sa propre nav 900ms et on se retrouve avec 2 mounts.
          markCompletionHandled(id);
          try {
            const response = await api.post(`/requests/${id}/complete`);
            if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            const earnings = response.earnings ?? (request?.price * 0.80);
            router.replace({ pathname: '/request/[id]/earnings', params: { id: String(id), earnings: String(earnings) } });
          } catch (error: any) {
            if (error?.data?.code === 'INVALID_STATE') { await loadRequest(); }
            else Alert.alert('Erreur', error.data?.message || error.message || 'Une erreur est survenue.');
          } finally { setActionLoading(false); }
        },
      },
    ]);
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[s.loadingText, { color: theme.textSub, fontFamily: FONTS.sans }]}>Chargement de la mission...</Text>
      </View>
    );
  }

  if (!request) return null;

  const clientLoc = { latitude: request?.lat || 50.8503, longitude: request?.lng || 4.3517 };
  const mapRegion = myLocation
    ? { ...myLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { ...clientLoc, latitudeDelta: 0.04, longitudeDelta: 0.04 };
  const status = (request.status || '').toUpperCase();

  // Is this a quote/diagnostic mission?
  const isQuoteMission = request.pricingMode === 'estimate' || request.pricingMode === 'diagnostic';
  const totalSteps = isQuoteMission ? 4 : 3;

  // Current step — prix fixe: 3 étapes / devis: 4 étapes
  let currentStep: MissionStep = 1;
  if (!beforePhotoUploaded) currentStep = 1;
  else if (!pinVerified || status === 'ACCEPTED') currentStep = 2;
  else if (isQuoteMission && !hasQuote) currentStep = 3;           // devis pas encore envoyé
  else if (isQuoteMission && status === 'QUOTE_SENT') currentStep = 3; // devis envoyé, attente client
  else currentStep = isQuoteMission ? 4 : 3;                       // photo après + terminer

  const stepInfo = isQuoteMission ? STEP_LABELS[currentStep] : STEP_LABELS[currentStep === 3 ? 4 : currentStep];

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <View style={s.root}>
      <StatusBar barStyle={theme.statusBar} translucent backgroundColor="transparent" />

      {/* ── Carte ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={s.map}
        customMapStyle={mapStyle}
        initialRegion={mapRegion}
        showsUserLocation
        followsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        <Marker coordinate={clientLoc} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[s.clientPin, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
            <Feather name="map-pin" size={18} color={theme.accentText} />
          </View>
        </Marker>
        {routeCoords.length > 0 ? (
          <Polyline coordinates={routeCoords} strokeColor={theme.accent} strokeWidth={4} />
        ) : myLocation ? (
          <Polyline coordinates={[myLocation, clientLoc]} strokeColor={theme.textMuted} strokeWidth={3} lineDashPattern={[8, 6]} />
        ) : null}
      </MapView>

      {/* ── Top bar flottant — pattern aligné sur missionview tracking ── */}
      <SafeAreaView style={s.floatingTopBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          activeOpacity={0.8}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>

        {/* FIXED · #ID */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={[s.statusBadge, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
            <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 12, letterSpacing: 2, color: theme.text }}>FIXED</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: theme.textMuted }}>·</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 1, color: theme.textSub }}>#{id}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
          onPress={openActionsMenu}
          activeOpacity={0.8}
          accessibilityLabel="Options"
          accessibilityRole="button"
        >
          <Feather name="more-horizontal" size={22} color={theme.text} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Bottom sheet ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
        style={s.sheetWrapper}
      >
        <View style={[s.sheet, {
          backgroundColor: theme.bg,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity + 0.04, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 8 },
          }),
        }]}>
          <View style={[s.sheetHandle, { backgroundColor: theme.borderLight }]} />

          {/* Status pill + LIVE · GPS — aligné sur missionview tracking */}
          {(() => {
            const statusLabel =
              status === 'ONGOING' ? (afterPhotoUploaded ? 'CLÔTURE' : 'INTERVENTION') :
              status === 'QUOTE_SENT' ? 'DEVIS ENVOYÉ' :
              status === 'QUOTE_ACCEPTED' ? 'DEVIS ACCEPTÉ' :
              'EN ROUTE';
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.10)' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.statusOngoing }} />
                  <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: COLORS.statusOngoing }}>
                    {statusLabel}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PulseDot size={6} color={COLORS.greenBrand} />
                  <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted }}>LIVE · GPS</Text>
                </View>
              </View>
            );
          })()}

          {/* Hero — ETA quand en route, sinon titre de l'étape */}
          {(() => {
            const etaMatch = (duration || '').match(/(\d+)/);
            const etaMin = etaMatch ? etaMatch[1] : '';
            const inRoute = status === 'ACCEPTED' && etaMin;
            return (
              <View style={{ marginBottom: 6 }}>
                {inRoute ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
                    <Text style={{ fontFamily: FONTS.bebas, fontSize: 52, color: theme.text, lineHeight: 52, letterSpacing: -1 }}>{etaMin}</Text>
                    <Text style={{ fontFamily: FONTS.bebas, fontSize: 14, color: theme.text, letterSpacing: 0.5, marginBottom: 6 }}>MIN AWAY</Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 30, color: theme.text, marginBottom: 2 }}>
                    {stepInfo.title.toUpperCase()}
                  </Text>
                )}
                <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.textSub }} numberOfLines={1}>
                  {request.client?.name || 'Client'}{distance ? ` · ${distance} de chez vous` : ''}
                </Text>
              </View>
            );
          })()}

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Client row — identité + actions rapides */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar url={request.client?.avatarUrl} name={request.client?.name} size={40} />
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 15, color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                {request.client?.name || 'Client'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="user" size={11} color={theme.textMuted} />
                <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: theme.textMuted, letterSpacing: 0.6 }}>
                  CLIENT FIXED
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.greenBrand, alignItems: 'center', justifyContent: 'center' }}
                onPress={handleCall}
                activeOpacity={0.75}
                accessibilityLabel="Appeler le client"
              >
                <Feather name="phone" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  const clientId = request?.client?.id || request?.clientId;
                  if (clientId) {
                    resetUnread();
                    router.push({ pathname: '/messages/[userId]', params: { userId: clientId, name: request?.client?.name || '' } });
                  }
                }}
                activeOpacity={0.75}
                accessibilityLabel="Envoyer un message"
              >
                <Feather name="message-circle" size={16} color={theme.text} />
                {unreadFromClient > 0 && (
                  <View style={{
                    position: 'absolute', top: -3, right: -3,
                    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
                    backgroundColor: COLORS.greenBrand,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: theme.cardBg,
                  }}>
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 9, color: '#fff', lineHeight: 11 }}>
                      {unreadFromClient > 9 ? '9+' : unreadFromClient}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}
                onPress={handleNavigate}
                activeOpacity={0.75}
                accessibilityLabel="Itinéraire"
              >
                <Feather name="navigation" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Adresse — toujours visible (info critique pour le prestataire qui arrive) */}
          {request.address && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
              <Feather name="map-pin" size={13} color={theme.textMuted} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: theme.text, lineHeight: 17 }}>
                {request.address}
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

          {/* Step header — label étape + indicateur barres */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted }}>
              ÉTAPE {currentStep}/{totalSteps}
            </Text>
            <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textSub }} numberOfLines={1}>
              {stepInfo.title.toUpperCase()}
            </Text>
          </View>
          <StepIndicator current={currentStep} total={totalSteps} theme={theme} />

          {/* ── Step content ───────────────────────────────────────────────── */}

          {/* STEP 1: Before photo */}
          {currentStep === 1 && (
            <ActionCard icon="camera" title="Photo avant intervention" subtitle="Prenez une photo de l'état actuel avant de commencer" theme={theme}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.accent }, actionLoading && s.btnDisabled]}
                onPress={handleBeforePhoto}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                {actionLoading ? <ActivityIndicator color={theme.accentText} /> : (
                  <>
                    <Feather name="camera" size={20} color={theme.accentText} />
                    <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Ouvrir la caméra</Text>
                  </>
                )}
              </TouchableOpacity>
            </ActionCard>
          )}

          {/* STEP 2: PIN */}
          {currentStep === 2 && (
            <Pressable onPress={() => pinInputRef.current?.focus()}>
              <View style={[s.pinCard, { backgroundColor: theme.heroBg }]}>
                <Text style={[s.pinCardLabel, { color: theme.heroSubFaint, fontFamily: FONTS.mono }]}>CLIENT PIN · ASK TO VERIFY</Text>
                <TextInput
                  ref={pinInputRef}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  caretHidden
                  style={s.hiddenInput}
                />
                <View style={s.pinRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[s.pinBox, { backgroundColor: 'rgba(255,255,255,0.08)' }, pin.length === i && { borderColor: theme.heroText, borderWidth: 1 }]}>
                      {pin.length > i ? (
                        <Text style={[s.pinDigit, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{pin[i]}</Text>
                      ) : (
                        <View style={[s.pinEmpty, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: theme.accent }, (actionLoading || pin.length < 4) && s.btnDisabled]}
                  onPress={handleVerifyPin}
                  disabled={actionLoading || pin.length < 4}
                  activeOpacity={0.75}
                >
                  {actionLoading ? <ActivityIndicator color={theme.accentText} /> : (
                    <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Vérifier le code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          )}

          {/* STEP 3 (quote only): Send or wait for quote */}
          {currentStep === 3 && isQuoteMission && !hasQuote && (
            <ActionCard icon="file-text" title="Envoyer le devis" subtitle="Après votre diagnostic, envoyez le devis au client" theme={theme}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push({ pathname: '/request/[id]/send-quote', params: { id: String(id) } })}
                activeOpacity={0.75}
              >
                <Feather name="file-text" size={20} color={theme.accentText} />
                <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Rédiger le devis</Text>
              </TouchableOpacity>
            </ActionCard>
          )}
          {currentStep === 3 && isQuoteMission && hasQuote && status === 'QUOTE_SENT' && (
            <ActionCard icon="clock" title="Devis envoyé" subtitle="En attente de la réponse du client" theme={theme}>
              <View style={[s.primaryBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}>
                <Feather name="check-circle" size={20} color={COLORS.green} />
                <Text style={[s.primaryBtnText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>En attente de réponse</Text>
              </View>
            </ActionCard>
          )}

          {/* STEP 3 (fixed) / STEP 4 (quote): After photo + Complete */}
          {((currentStep === 3 && !isQuoteMission) || currentStep === 4) && (
            <ActionCard
              icon={afterPhotoUploaded ? 'check-circle' : 'camera'}
              title={afterPhotoUploaded ? 'Terminer la mission' : 'Photo après intervention'}
              subtitle={afterPhotoUploaded ? 'Confirmez la fin de la prestation' : 'Prenez une photo du résultat final'}
              theme={theme}
            >
              <View style={[s.ongoingBadge, { backgroundColor: theme.badgeDoneBg }]}>
                <View style={[s.liveDot, { backgroundColor: COLORS.green }]} />
                <Text style={[s.ongoingBadgeText, { color: COLORS.green, fontFamily: FONTS.sansMedium }]}>Mission en cours</Text>
              </View>

              {!afterPhotoUploaded ? (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: theme.accent }, actionLoading && s.btnDisabled]}
                  onPress={handleAfterPhoto}
                  disabled={actionLoading}
                  activeOpacity={0.75}
                >
                  {actionLoading ? <ActivityIndicator color={theme.accentText} /> : (
                    <>
                      <Feather name="camera" size={20} color={theme.accentText} />
                      <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Ouvrir la caméra</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.successBtn, actionLoading && s.btnDisabled]}
                  onPress={handleComplete}
                  disabled={actionLoading}
                  activeOpacity={0.75}
                >
                  {actionLoading ? <ActivityIndicator color={theme.bg} /> : (
                    <>
                      <Feather name="check-circle" size={20} color={theme.bg} />
                      <Text style={[s.successBtnText, { fontFamily: FONTS.sansMedium, color: theme.bg }]}>Terminer la mission</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ActionCard>
          )}

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },

  // ── Client pin on map ──
  clientPin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 6 },
    }),
  },

  // ── Top bar flottant (mirror missionview tracking) ──
  floatingTopBar: {
    position: 'absolute',
    top: 0, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 8 : 44,
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
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

  // ── Bottom sheet (rythme compact) ──
  sheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 14, paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 8,
  },

  // Divider partagé (compact)
  divider: { height: 1, marginVertical: 8 },

  // ── Client row ──
  clientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 13.5, marginBottom: 2 },
  address: { fontSize: 10.5, letterSpacing: 0.5 },
  actionBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  actionBtnOutline: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8, borderWidth: 1.5,
  },

  // ── Access info card ──
  accessCard: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8,
    gap: 8,
  },
  accessHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  accessTitle: { fontSize: 10, letterSpacing: 1.2, flex: 1 },
  langBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1,
  },
  langText: { fontSize: 9, letterSpacing: 1.2 },
  // Grille KV (key-value) pour bâtiment / étage / ascenseur
  accessKvGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    columnGap: 12, rowGap: 8,
  },
  accessKv: {
    flexBasis: '47%',
    gap: 2,
  },
  accessKvHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  accessKvLabel: { fontSize: 9, letterSpacing: 1.2 },
  accessKvValue: { fontSize: 14 },

  accessNotesBlock: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 4,
  },
  accessNotesLabel: { fontSize: 9, letterSpacing: 1.2 },
  accessNotesValue: { fontSize: 14, lineHeight: 18, letterSpacing: 0.5 },

  // ── Mission row ──
  missionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 8, marginBottom: 2,
    borderBottomWidth: 1,
  },
  missionName: { fontSize: 18, fontFamily: FONTS.bebas, letterSpacing: 0.4, marginBottom: 3 },
  stepLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.6 },
  price: { fontSize: 24, fontFamily: FONTS.bebas, letterSpacing: 0.3 },

  // ── Buttons ──
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: 12, minHeight: 44,
  },
  primaryBtnText: { fontSize: 14 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.green, paddingVertical: 11, borderRadius: 12, minHeight: 44,
  },
  successBtnText: { fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

  // ── PIN ──
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  pinCard: {
    borderRadius: 14, padding: 12, marginTop: 2,
  },
  pinCardLabel: {
    fontSize: 10, letterSpacing: 1.2, marginBottom: 10, textAlign: 'center',
  },
  pinBox: {
    flex: 1, height: 46, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDigit: { fontSize: 28, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  pinEmpty: { width: 10, height: 10, borderRadius: 5 },

  // ── Ongoing badge ──
  ongoingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  ongoingBadgeText: { fontSize: 12 },
});
