// app/request/[id]/tracking.tsx
// Client view — Track provider arriving (like Uber)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Animated,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { devLog, devWarn, devError } from '@/lib/logger';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Grayscale map styles ────────────────────────────────────────────────────
const MAP_STYLE_LIGHT = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

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

// ── Utils ────────────────────────────────────────────────────────────────────

const formatEuros = (amount: number): string =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fallbackETA = (oLat: number, oLng: number, dLat: number, dLng: number): string => {
  const minutes = Math.ceil((calculateDistance(oLat, oLng, dLat, dLng) * 1.4 / 30) * 60);
  return minutes <= 1 ? '1 min' : `${minutes} mins`;
};

const TRACKABLE_STATUSES = ['ACCEPTED', 'ONGOING'];

// ── Component ────────────────────────────────────────────────────────────────

export default function RequestTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const t = useAppTheme();
  const mapStyle = t.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const mapRef = useRef<MapView>(null);

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState('Calcul en cours...');

  // PIN state
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [providerArrived, setProviderArrived] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── ETA ──────────────────────────────────────────────────────────────────────

  const fetchETAFromGoogle = useCallback(async (
    originLat: number, originLng: number, destLat: number, destLng: number,
  ): Promise<void> => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No API key');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.routes?.length > 0) {
        setEta(data.routes[0].legs[0].duration.text);
      } else {
        throw new Error(`Google API: ${data.status}`);
      }
    } catch {
      setEta(fallbackETA(originLat, originLng, destLat, destLng));
    }
  }, []);

  // ── Load request ─────────────────────────────────────────────────────────────

  const loadRequestDetails = useCallback(async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      const requestData = response.data || response;
      const status = (requestData?.status || '').toUpperCase();

      devLog('[TRACKING] Request loaded:', requestData?.id, 'status:', status);

      if (!TRACKABLE_STATUSES.includes(status)) {
        devWarn(`[TRACKING] Mission ${id} "${status}" — non trackable`);
        const messages: Record<string, { title: string; body: string }> = {
          DONE:            { title: 'Mission terminée',        body: 'Cette mission a été complétée avec succès.' },
          PENDING_PAYMENT: { title: 'Mission terminée',        body: 'Cette mission a été complétée avec succès.' },
          CANCELLED:       { title: 'Mission annulée',         body: 'Cette mission a été annulée ou a expiré.' },
          EXPIRED:         { title: 'Mission annulée',         body: 'Cette mission a été annulée ou a expiré.' },
          PUBLISHED:       { title: 'Recherche en cours',      body: "Aucun prestataire n'a encore accepté cette mission." },
        };
        const msg = messages[status] || { title: 'Mission non disponible', body: `Statut: ${status}` };
        Alert.alert(msg.title, msg.body, [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]);
        return;
      }

      setRequest(requestData);
      if (requestData.beforePhotoUrl) setProviderArrived(true);
      if (requestData.pinVerified) setPinVerified(true);

      // Fetch PIN
      if (status === 'ACCEPTED' || status === 'ONGOING') {
        try {
          const pinRes = await api.get(`/requests/${id}/pin`);
          const pinData = pinRes.data || pinRes;
          if (pinData?.pinCode) setPinCode(pinData.pinCode);
          if (pinData?.pinVerified) setPinVerified(true);
        } catch { /* 404 NO_PIN or network error */ }
      }

      if (requestData.provider?.lat && requestData.provider?.lng) {
        setProviderLocation({ latitude: requestData.provider.lat, longitude: requestData.provider.lng });
        if (requestData.lat && requestData.lng) {
          await fetchETAFromGoogle(requestData.provider.lat, requestData.provider.lng, requestData.lat, requestData.lng);
        }
      } else {
        setEta('< 30 min');
      }
    } catch (error) {
      devError('[TRACKING] Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la mission', [
        { text: 'Retour', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, fetchETAFromGoogle, router]);

  useEffect(() => { loadRequestDetails(); }, [loadRequestDetails]);

  // Re-fetch les données quand l'écran regagne le focus (retour d'app switch)
  useFocusEffect(
    useCallback(() => {
      if (!loading && request) loadRequestDetails();
    }, [loading, request, loadRequestDetails])
  );

  // ── Socket ───────────────────────────────────────────────────────────────────

  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (request?.lat && request?.lng) destRef.current = { lat: request.lat, lng: request.lng };
  }, [request]);

  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);

    const handleLocationUpdate = async (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      const newLoc = { latitude: data.lat, longitude: data.lng };
      setProviderLocation(newLoc);
      if (destRef.current) {
        await fetchETAFromGoogle(data.lat, data.lng, destRef.current.lat, destRef.current.lng);
      } else if (data.eta) {
        setEta(data.eta);
      }
      mapRef.current?.animateToRegion({ ...newLoc, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    };

    const handleStarted = (data: any) => {
      if (String(data.id || data.requestId) === String(id)) {
        setRequest((prev: any) => prev ? { ...prev, status: 'ONGOING' } : prev);
        Alert.alert('Mission démarrée', 'Le prestataire est arrivé et a démarré la mission !');
      }
    };

    const handleCompleted = (data: any) => {
      if (String(data.requestId) === String(id)) {
        Alert.alert('Mission terminée', 'La mission a été complétée avec succès.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') },
        ]);
      }
    };

    const handleCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        Alert.alert('Mission annulée', 'Cette mission a été annulée.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') },
        ]);
      }
    };

    const handlePinReady = (data: any) => {
      if (String(data.requestId) === String(id) && data.pinCode) setPinCode(data.pinCode);
    };

    const handleBeforePhoto = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setProviderArrived(true);
        devLog('[TRACKING] Provider arrived — PIN card visible');
      }
    };

    const handlePinVerified = (data: any) => {
      if (String(data.requestId) === String(id)) setPinVerified(true);
    };

    socket.on('provider:location_update', handleLocationUpdate);
    socket.on('request:started', handleStarted);
    socket.on('request:completed', handleCompleted);
    socket.on('request:cancelled', handleCancelled);
    socket.on('mission:pin_ready', handlePinReady);
    socket.on('mission:before_photo', handleBeforePhoto);
    socket.on('mission:pin_verified', handlePinVerified);

    return () => {
      leaveRoom('request', id);
      socket.off('provider:location_update', handleLocationUpdate);
      socket.off('request:started', handleStarted);
      socket.off('request:completed', handleCompleted);
      socket.off('request:cancelled', handleCancelled);
      socket.off('mission:pin_ready', handlePinReady);
      socket.off('mission:before_photo', handleBeforePhoto);
      socket.off('mission:pin_verified', handlePinVerified);
    };
  }, [socket, id, fetchETAFromGoogle, router, joinRoom, leaveRoom]);

  // ── Animations ───────────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleCallProvider = () => {
    if (request?.provider?.phone) {
      Linking.openURL(`tel:${request.provider.phone}`);
    } else {
      Alert.alert('Numero indisponible', "Le numero du prestataire n'est pas disponible.");
    }
  };

  const handleCancelRequest = () => {
    const st = (request?.status || '').toUpperCase();
    if (st === 'ONGOING') {
      Alert.alert('Annulation impossible', 'La mission est déjà en cours. Contactez le prestataire directement.');
      return;
    }
    Alert.alert('Annuler la mission', 'Êtes-vous sûr de vouloir annuler cette mission ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler', style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/requests/${id}/cancel`);
            Alert.alert('Annulé', 'La mission a été annulée', [
              { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') },
            ]);
          } catch (error: any) {
            if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
              await loadRequestDetails();
            } else {
              Alert.alert('Erreur', "Impossible d'annuler la mission");
            }
          }
        },
      },
    ]);
  };

  // ── Dynamic styles ───────────────────────────────────────────────────────────

  const s = useMemo(() => ({
    container:       { flex: 1, backgroundColor: t.bg } as const,
    loadingContainer:{ flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.bg, gap: 12 },
    loadingText:     { fontSize: 16, color: t.textSub, fontFamily: FONTS.sans },
    map:             { flex: 1 },

    backButton: {
      position: 'absolute' as const, top: 60, left: 20,
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.cardBg,
      justifyContent: 'center' as const, alignItems: 'center' as const,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: t.shadowOpacity, shadowRadius: 8, elevation: 4,
    },

    providerMarker: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: t.accent,
      justifyContent: 'center' as const, alignItems: 'center' as const,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8,
    },

    infoCard: {
      position: 'absolute' as const, bottom: 0, left: 0, right: 0,
      backgroundColor: t.cardBg,
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      padding: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: t.shadowOpacity + 0.04, shadowRadius: 16, elevation: 8,
    },

    // ETA
    etaContainer:  { alignItems: 'center' as const, marginBottom: 24 },
    etaLabel:      { fontSize: 14, color: t.textSub, marginBottom: 4, fontFamily: FONTS.sans },
    etaTime:       { fontSize: 32, fontWeight: '900' as const, color: t.text, fontFamily: FONTS.bebas, letterSpacing: 1 },
    etaSubLabel:   { fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: 'italic' as const, fontFamily: FONTS.sans },

    // Provider
    providerDetails: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      marginBottom: 20, paddingBottom: 20,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    providerAvatar: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: t.surface,
      justifyContent: 'center' as const, alignItems: 'center' as const, marginRight: 16,
    },
    providerInfo:   { flex: 1 },
    providerName:   { fontSize: 18, fontWeight: '700' as const, color: t.text, marginBottom: 4, fontFamily: FONTS.sansMedium },
    providerRating: { fontSize: 14, color: t.textSub, fontFamily: FONTS.sans },
    callButton: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.accent,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },

    // Mission
    missionDetails: { marginBottom: 20 },
    missionTitle:   { fontSize: 16, fontWeight: '700' as const, color: t.text, marginBottom: 8, fontFamily: FONTS.sansMedium },
    missionAddress: { fontSize: 14, color: t.textSub, marginBottom: 8, fontFamily: FONTS.sans },
    missionPrice:   { fontSize: 20, fontWeight: '900' as const, color: t.text, fontFamily: FONTS.mono },

    // Cancel
    cancelButton: {
      backgroundColor: t.isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
      paddingVertical: 16, borderRadius: 16, alignItems: 'center' as const,
    },
    cancelButtonText: { fontSize: 16, fontWeight: '700' as const, color: t.danger, fontFamily: FONTS.sansMedium },

    // Ongoing
    ongoingBanner: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: t.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 12,
    },
    ongoingBannerText: { fontSize: 13, fontWeight: '600' as const, color: t.text, flex: 1, fontFamily: FONTS.sansMedium },

    // PIN card (provider arrived)
    pinCard: {
      backgroundColor: t.surface, borderRadius: 16, padding: 20,
      marginBottom: 16, borderWidth: 1, borderColor: t.border,
    },
    pinCardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 4 },
    pinCardTitle:  { fontSize: 16, fontWeight: '700' as const, color: t.text, fontFamily: FONTS.sansMedium },
    pinCardSubtitle: { fontSize: 13, color: t.textSub, marginBottom: 16, fontFamily: FONTS.sans },
    pinDigitsRow:  { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 12 },
    pinDigitBox: {
      width: 56, height: 64, borderRadius: 14,
      backgroundColor: t.cardBg, borderWidth: 2, borderColor: t.accent,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    pinDigitText: { fontSize: 28, fontWeight: '900' as const, color: t.text, fontFamily: FONTS.monoMedium },

    // Verified banner
    verifiedBanner: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: t.isDark ? 'rgba(34,197,94,0.12)' : '#F0FDF4',
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
    },
    verifiedBannerText: { fontSize: 13, fontWeight: '600' as const, color: COLORS.green, flex: 1, fontFamily: FONTS.sansMedium },

    // PIN pending (provider en route)
    pinCardPending: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: t.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
    },
    pinCardPendingText: { fontSize: 13, color: t.textSub, flex: 1, fontFamily: FONTS.sans },
  }), [t]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <StatusBar barStyle={t.statusBar as any} />
        <ActivityIndicator size="large" color={t.accent} />
        <Text style={s.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!request) return null;

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  const status = (request?.status || '').toUpperCase();

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={t.statusBar as any} />

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={s.map}
        customMapStyle={mapStyle}
        initialRegion={{ ...clientLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation
      >
        <Marker coordinate={clientLocation} title="Votre position" pinColor={t.accent} />

        {providerLocation && (
          <Marker coordinate={providerLocation} title={request?.provider?.name || 'Prestataire'}>
            <Animated.View style={[s.providerMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="car" size={24} color={t.accentText} />
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={s.backButton} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={24} color={t.text} />
      </TouchableOpacity>

      {/* Info card */}
      <View style={s.infoCard}>
        {/* ETA */}
        <View style={s.etaContainer}>
          <Text style={s.etaLabel}>
            {status === 'ONGOING' ? 'Mission en cours' : 'Arrivée estimée'}
          </Text>
          <Text style={s.etaTime}>{eta}</Text>
          {!providerLocation && (
            <Text style={s.etaSubLabel}>Temps estimé : {'< 30 min'}</Text>
          )}
        </View>

        {/* Provider details */}
        {request?.provider && (
          <View style={s.providerDetails}>
            <View style={s.providerAvatar}>
              <Ionicons name="person" size={28} color={t.textSub} />
            </View>
            <View style={s.providerInfo}>
              <Text style={s.providerName}>{request.provider.name}</Text>
              <Text style={s.providerRating}>
                {request.provider.avgRating?.toFixed(1) || '5.0'} · {request.provider.jobsCompleted || 0} missions
              </Text>
            </View>
            <TouchableOpacity style={s.callButton} onPress={handleCallProvider} activeOpacity={0.7}>
              <Ionicons name="call" size={24} color={t.accentText} />
            </TouchableOpacity>
          </View>
        )}

        {/* Mission details */}
        <View style={s.missionDetails}>
          <Text style={s.missionTitle}>{request?.serviceType}</Text>
          <Text style={s.missionAddress}>{request?.address}</Text>
          <Text style={s.missionPrice}>{formatEuros(request?.price || 0)}</Text>
        </View>

        {/* PIN Card — visible dès que le provider accepte */}
        {(status === 'ACCEPTED' || status === 'ONGOING') && pinCode && !pinVerified && (
          <View style={s.pinCard}>
            <View style={s.pinCardHeader}>
              <Ionicons name="key" size={20} color={t.text} />
              <Text style={s.pinCardTitle}>Code PIN de vérification</Text>
            </View>
            <Text style={s.pinCardSubtitle}>Communiquez ce code à votre prestataire</Text>
            <View style={s.pinDigitsRow}>
              {pinCode.split('').map((digit, i) => (
                <View key={i} style={s.pinDigitBox}>
                  <Text style={s.pinDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PIN verified */}
        {(status === 'ACCEPTED' || status === 'ONGOING') && pinVerified && (
          <View style={s.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
            <Text style={s.verifiedBannerText}>Code PIN vérifié — la mission va démarrer</Text>
          </View>
        )}

        {/* Cancel (ACCEPTED only) */}
        {status === 'ACCEPTED' && (
          <TouchableOpacity style={s.cancelButton} onPress={handleCancelRequest} activeOpacity={0.7}>
            <Text style={s.cancelButtonText}>Annuler la mission</Text>
          </TouchableOpacity>
        )}

        {/* Ongoing banner */}
        {status === 'ONGOING' && (
          <View style={s.ongoingBanner}>
            <Ionicons name="checkmark-circle" size={16} color={t.text} />
            <Text style={s.ongoingBannerText}>Mission en cours — le prestataire est sur place</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
