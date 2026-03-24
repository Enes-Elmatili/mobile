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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { tokenStorage } from '@/lib/storage';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/?$/, '');

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
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Utils ───────────────────────────────────────────────────────────────────

const formatEuros = (amount: number): string =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'ngrok-skip-browser-warning': 'true' },
    body: formData,
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('Réponse invalide du serveur'); }
  if (!response.ok) throw Object.assign(new Error(data?.message || `HTTP ${response.status}`), { status: response.status, data });
  return data.photoUrl;
}

// ─── Step indicator component ────────────────────────────────────────────────

type MissionStep = 1 | 2 | 3;

const STEP_LABELS: Record<number, { title: string; icon: string }> = {
  1: { title: 'Photo avant', icon: 'camera-outline' },
  2: { title: 'Code PIN', icon: 'key-outline' },
  3: { title: 'Photo après & Terminer', icon: 'checkmark-circle-outline' },
};

function StepIndicator({ current, total, theme }: { current: number; total: number; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;
        return (
          <React.Fragment key={step}>
            {i > 0 && <View style={[si.line, { backgroundColor: theme.borderLight }, isDone && { backgroundColor: COLORS.green }]} />}
            <View style={[
              si.dot,
              { backgroundColor: theme.surface },
              isDone && { backgroundColor: COLORS.green },
              isActive && {
                backgroundColor: theme.accent,
                ...Platform.select({
                  ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
                  android: { elevation: 3 },
                }),
              },
            ]}>
              {isDone ? (
                <Ionicons name="checkmark" size={10} color="#FFF" />
              ) : (
                <Text style={[si.dotText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }, isActive && { color: theme.accentText }]}>{step}</Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dotText: { fontSize: 12 },
  line: { width: 28, height: 2, marginHorizontal: 4 },
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
          <Ionicons name={icon as any} size={22} color={theme.text} />
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
  card: { borderRadius: 16, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, marginBottom: 2 },
  subtitle: { fontSize: 13 },
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function MissionOngoing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useSocket();
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

  // Photo + PIN state
  const [beforePhotoUploaded, setBeforePhotoUploaded] = useState(false);
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [afterPhotoUploaded, setAfterPhotoUploaded] = useState(false);
  const pinInputRef = useRef<TextInput>(null);

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

      if (['PUBLISHED', 'PENDING'].includes(st)) {
        if (attempt < RETRY_MAX) { setLoading(true); await sleep(RETRY_DELAY); return loadRequest(attempt + 1); }
        Alert.alert('Mission non disponible', "La mission n'a pas pu être confirmée.", [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]);
        return;
      }

      if (!['ACCEPTED', 'ONGOING'].includes(st)) {
        if (st === 'DONE') router.replace(`/request/${id}/earnings`);
        else router.replace('/(tabs)/dashboard');
        return;
      }

      if (data.beforePhotoUrl) setBeforePhotoUploaded(true);
      if (data.pinVerified) setPinVerified(true);
      if (data.afterPhotoUrl) setAfterPhotoUploaded(true);
      setRequest(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la mission', [{ text: 'Retour', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { BackHandler.addEventListener('hardwareBackPress', () => true); }, []);
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
    socket.on('request:cancelled', onCancelled);
    return () => { leaveRoom('request', id); socket.off('request:cancelled', onCancelled); };
  }, [socket, id, router, joinRoom, leaveRoom]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleCall = () => {
    if (request?.client?.phone) Linking.openURL(`tel:${request.client.phone}`);
    else Alert.alert('Indisponible', "Le numéro du client n'est pas disponible.");
  };

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
          try {
            const response = await api.post(`/requests/${id}/complete`);
            if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            const earnings = response.earnings ?? (request?.price * 0.85);
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

  // Current step — 3 étapes : photo avant → PIN (= auto-start) → photo après + terminer
  let currentStep: MissionStep = 1;
  if (!beforePhotoUploaded) currentStep = 1;
  else if (!pinVerified || status === 'ACCEPTED') currentStep = 2;
  else currentStep = 3;

  const stepInfo = STEP_LABELS[currentStep];

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
            <Ionicons name="location" size={18} color={theme.accentText} />
          </View>
        </Marker>
        {routeCoords.length > 0 ? (
          <Polyline coordinates={routeCoords} strokeColor={theme.accent} strokeWidth={4} />
        ) : myLocation ? (
          <Polyline coordinates={[myLocation, clientLoc]} strokeColor={theme.textMuted} strokeWidth={3} lineDashPattern={[8, 6]} />
        ) : null}
      </MapView>

      {/* ── Top bar flottant ── */}
      <SafeAreaView style={s.topBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={[s.backBtn, {
          backgroundColor: theme.cardBg,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
          }),
        }]} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        {/* ETA pills */}
        <View style={s.etaPills}>
          <View style={[s.etaPill, {
            backgroundColor: theme.cardBg,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 3 },
            }),
          }]}>
            <Ionicons name="car-outline" size={14} color={theme.text} />
            <Text style={[s.etaPillText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{duration || '...'}</Text>
          </View>
          <View style={[s.etaPill, {
            backgroundColor: theme.cardBg,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 3 },
            }),
          }]}>
            <Ionicons name="navigate-outline" size={14} color={theme.text} />
            <Text style={[s.etaPillText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{distance || '...'}</Text>
          </View>
        </View>
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

          {/* Client row + quick actions */}
          <View style={s.clientRow}>
            <Avatar url={request.client?.avatarUrl} name={request.client?.name} size={46} style={{ marginRight: 12 }} />
            <View style={s.clientInfo}>
              <Text style={[s.clientName, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{request.client?.name || 'Client'}</Text>
              <Text style={[s.address, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>{request.address}</Text>
            </View>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={handleCall} activeOpacity={0.75}>
              <Ionicons name="call" size={18} color={theme.accentText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnOutline, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              onPress={() => {
                const clientId = request?.client?.id || request?.clientId;
                if (clientId) router.push({ pathname: '/messages/[userId]', params: { userId: clientId, name: request?.client?.name || '' } });
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-outline" size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtnOutline, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={handleNavigate} activeOpacity={0.75}>
              <Ionicons name="navigate" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Mission + price */}
          <View style={[s.missionRow, { borderBottomColor: theme.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.missionName, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{request.serviceType}</Text>
              <Text style={[s.stepLabel, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                Étape {currentStep}/3 · {stepInfo.title}
              </Text>
            </View>
            <Text style={[s.price, { color: theme.text, fontFamily: FONTS.mono }]}>{formatEuros(request.price || 0)}</Text>
          </View>

          {/* Step indicator — 3 étapes */}
          <StepIndicator current={currentStep} total={3} theme={theme} />

          {/* ── Step content ───────────────────────────────────────────────── */}

          {/* STEP 1: Before photo */}
          {currentStep === 1 && (
            <ActionCard icon="camera-outline" title="Photo avant intervention" subtitle="Prenez une photo de l'état actuel avant de commencer" theme={theme}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.accent }, actionLoading && s.btnDisabled]}
                onPress={handleBeforePhoto}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                {actionLoading ? <ActivityIndicator color={theme.accentText} /> : (
                  <>
                    <Ionicons name="camera" size={20} color={theme.accentText} />
                    <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Ouvrir la caméra</Text>
                  </>
                )}
              </TouchableOpacity>
            </ActionCard>
          )}

          {/* STEP 2: PIN */}
          {currentStep === 2 && (
            <Pressable onPress={() => pinInputRef.current?.focus()}>
              <ActionCard icon="key-outline" title="Code PIN du client" subtitle="Demandez le code à 4 chiffres au client" theme={theme}>
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
                    <View key={i} style={[s.pinBox, { backgroundColor: theme.surface, borderColor: theme.border }, pin.length === i && { borderColor: theme.accent }]}>
                      {pin.length > i ? (
                        <Text style={[s.pinDigit, { color: theme.text, fontFamily: FONTS.monoMedium }]}>{pin[i]}</Text>
                      ) : (
                        <View style={[s.pinEmpty, { backgroundColor: theme.borderLight }]} />
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
              </ActionCard>
            </Pressable>
          )}

          {/* STEP 3: After photo + Complete (combined) */}
          {currentStep === 3 && (
            <ActionCard
              icon={afterPhotoUploaded ? 'checkmark-circle-outline' : 'camera-outline'}
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
                      <Ionicons name="camera" size={20} color={theme.accentText} />
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
                      <Ionicons name="checkmark-circle" size={20} color={theme.bg} />
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

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, gap: 10, zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  etaPills: { flexDirection: 'row', gap: 8 },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  etaPillText: { fontSize: 13 },

  // ── Bottom sheet ──
  sheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  sheetHandle: {
    width: 32, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 10,
  },

  // ── Client row ──
  clientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, marginBottom: 2 },
  address: { fontSize: 12 },
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

  // ── Mission row ──
  missionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 8, marginBottom: 2,
    borderBottomWidth: 1,
  },
  missionName: { fontSize: 15, marginBottom: 3 },
  stepLabel: { fontSize: 12 },
  price: { fontSize: 22, letterSpacing: -0.5 },

  // ── Buttons ──
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, minHeight: 48,
  },
  primaryBtnText: { fontSize: 15 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.green, paddingVertical: 13, borderRadius: 55, minHeight: 55,
  },
  successBtnText: { fontSize: 16 },
  btnDisabled: { opacity: 0.5 },

  // ── PIN ──
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 },
  pinBox: {
    width: 52, height: 60, borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDigit: { fontSize: 28 },
  pinEmpty: { width: 12, height: 12, borderRadius: 6 },

  // ── Ongoing badge ──
  ongoingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  ongoingBadgeText: { fontSize: 13 },
});
