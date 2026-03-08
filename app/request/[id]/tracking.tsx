// app/request/[id]/tracking.tsx
// Client view - Track provider arriving (like Uber)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Animated,
  useColorScheme,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Grayscale map style (light) ─────────────────────────────────────────────
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

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (amount: number): string =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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

const fallbackETA = (originLat: number, originLng: number, destLat: number, destLng: number): string => {
  const dist = calculateDistance(originLat, originLng, destLat, destLng);
  const minutes = Math.ceil((dist * 1.4 / 30) * 60);
  return minutes <= 1 ? '1 min' : `${minutes} mins`;
};

// ============================================================================
// VALID STATES — statuts trackables depuis la vue client
// ============================================================================

const TRACKABLE_STATUSES = ['ACCEPTED', 'ONGOING'];

// ============================================================================
// COMPONENT
// ============================================================================

export default function RequestTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const colorScheme = useColorScheme();
  const mapStyle = colorScheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const mapRef = useRef<MapView>(null);

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState('Calcul en cours...');

  // ── PIN state ──────────────────────────────────────────────────────────────
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [providerArrived, setProviderArrived] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ============================================================================
  // ETA
  // ============================================================================

  const fetchETAFromGoogle = useCallback(async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<void> => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No API key');

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const etaText = data.routes[0].legs[0].duration.text;
        console.log('✅ [TRACKING] Google ETA:', etaText);
        setEta(etaText);
      } else {
        throw new Error(`Google API: ${data.status}`);
      }
    } catch (error) {
      console.warn('⚠️ [TRACKING] Google ETA fallback:', error);
      setEta(fallbackETA(originLat, originLng, destLat, destLng));
    }
  }, []);

  // ============================================================================
  // LOAD REQUEST — avec guard de statut
  // ============================================================================

  const loadRequestDetails = useCallback(async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      const requestData = response.data || response;
      const status = (requestData?.status || '').toUpperCase();

      console.log('📍 [TRACKING] Request loaded:', requestData?.id, 'status:', status);

      // ── GUARD : si la mission n'est plus trackable, on redirige proprement ──
      if (!TRACKABLE_STATUSES.includes(status)) {
        console.warn(`⚠️ [TRACKING] Mission ${id} est en statut "${status}" — non trackable, redirection`);

        if (status === 'DONE' || status === 'PENDING_PAYMENT') {
          Alert.alert(
            'Mission terminée',
            'Cette mission a été complétée avec succès.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          Alert.alert(
            'Mission annulée',
            'Cette mission a été annulée ou a expiré.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        } else if (status === 'PUBLISHED') {
          // Encore en recherche — revenir au dashboard pour voir le badge
          Alert.alert(
            'Recherche en cours',
            'Aucun prestataire n\'a encore accepté cette mission.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        } else {
          Alert.alert(
            'Mission non disponible',
            `Statut: ${status}`,
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        }
        return;
      }

      setRequest(requestData);

      // Restore photo/PIN state from server data
      if (requestData.beforePhotoUrl) setProviderArrived(true);
      if (requestData.pinVerified) setPinVerified(true);

      // Fetch PIN code for this request
      if (status === 'ACCEPTED' || status === 'ONGOING') {
        try {
          const pinResponse = await api.get(`/requests/${id}/pin`);
          const pinData = pinResponse.data || pinResponse;
          if (pinData?.pinCode) setPinCode(pinData.pinCode);
          if (pinData?.pinVerified) setPinVerified(true);
        } catch { /* PIN not yet generated or not authorized */ }
      }

      if (requestData.provider?.lat && requestData.provider?.lng) {
        setProviderLocation({
          latitude: requestData.provider.lat,
          longitude: requestData.provider.lng,
        });

        if (requestData.lat && requestData.lng) {
          await fetchETAFromGoogle(
            requestData.provider.lat,
            requestData.provider.lng,
            requestData.lat,
            requestData.lng
          );
        }
      } else {
        setEta('< 30 min');
      }
    } catch (error) {
      console.error('❌ [TRACKING] Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la mission', [
        { text: 'Retour', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, fetchETAFromGoogle, router]);

  useEffect(() => {
    loadRequestDetails();
  }, [loadRequestDetails]);

  // ============================================================================
  // SOCKET — join room + écoute location update
  // ============================================================================

  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (request?.lat && request?.lng) {
      destRef.current = { lat: request.lat, lng: request.lng };
    }
  }, [request]);

  useEffect(() => {
    if (!socket || !id) return;

    joinRoom('request', id);

    const handleLocationUpdate = async (data: any) => {
      if (String(data.requestId) !== String(id)) return;

      console.log('📍 [TRACKING] Provider location update:', data);

      const newLocation = { latitude: data.lat, longitude: data.lng };
      setProviderLocation(newLocation);

      if (destRef.current) {
        await fetchETAFromGoogle(
          data.lat,
          data.lng,
          destRef.current.lat,
          destRef.current.lng
        );
      } else if (data.eta) {
        setEta(data.eta);
      }

      mapRef.current?.animateToRegion({
        latitude: data.lat,
        longitude: data.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    };

    const handleRequestStarted = (data: any) => {
      if (String(data.id || data.requestId) === String(id)) {
        console.log('🚀 [TRACKING] Mission démarrée !');
        // Mettre à jour le statut local sans recharger
        setRequest((prev: any) => prev ? { ...prev, status: 'ONGOING' } : prev);
        Alert.alert('Mission démarrée', 'Le prestataire est arrivé et a démarré la mission !');
      }
    };

    const handleRequestCompleted = (data: any) => {
      if (String(data.requestId) === String(id)) {
        console.log('✅ [TRACKING] Mission terminée');
        Alert.alert(
          'Mission terminée',
          'La mission a été complétée avec succès.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
      }
    };

    const handleRequestCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        console.warn('🚫 [TRACKING] Mission annulée');
        Alert.alert(
          'Mission annulée',
          'Cette mission a été annulée.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
      }
    };

    // ── Mission verification events ──────────────────────────────────────────
    const handlePinReady = (data: any) => {
      if (String(data.requestId) === String(id) && data.pinCode) {
        setPinCode(data.pinCode);
      }
    };

    const handleBeforePhoto = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setProviderArrived(true);
        Alert.alert('Prestataire arrive', 'Votre prestataire est sur place. Communiquez-lui le code PIN affiche ci-dessous.');
      }
    };

    const handlePinVerified = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setPinVerified(true);
      }
    };

    socket.on('provider:location_update', handleLocationUpdate);
    socket.on('request:started', handleRequestStarted);
    socket.on('request:completed', handleRequestCompleted);
    socket.on('request:cancelled', handleRequestCancelled);
    socket.on('mission:pin_ready', handlePinReady);
    socket.on('mission:before_photo', handleBeforePhoto);
    socket.on('mission:pin_verified', handlePinVerified);

    return () => {
      leaveRoom('request', id);
      socket.off('provider:location_update', handleLocationUpdate);
      socket.off('request:started', handleRequestStarted);
      socket.off('request:completed', handleRequestCompleted);
      socket.off('request:cancelled', handleRequestCancelled);
      socket.off('mission:pin_ready', handlePinReady);
      socket.off('mission:before_photo', handleBeforePhoto);
      socket.off('mission:pin_verified', handlePinVerified);
    };
  }, [socket, id, fetchETAFromGoogle, router, joinRoom, leaveRoom]);

  // ============================================================================
  // ANIMATIONS
  // ============================================================================

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCallProvider = () => {
    if (request?.provider?.phone) {
      Linking.openURL(`tel:${request.provider.phone}`);
    } else {
      Alert.alert('Numéro indisponible', "Le numéro du prestataire n'est pas disponible.");
    }
  };

  const handleCancelRequest = () => {
    const status = (request?.status || '').toUpperCase();

    // Impossible d'annuler une mission déjà ONGOING
    if (status === 'ONGOING') {
      Alert.alert(
        'Annulation impossible',
        'La mission est déjà en cours. Contactez le prestataire directement.'
      );
      return;
    }

    Alert.alert(
      'Annuler la mission',
      'Êtes-vous sûr de vouloir annuler cette mission ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/requests/${id}/cancel`);
              Alert.alert('Annulé', 'La mission a été annulée', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') },
              ]);
            } catch (error: any) {
              // Si INVALID_STATE, la mission a déjà changé d'état — on rafraîchit
              if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
                await loadRequestDetails();
              } else {
                Alert.alert('Erreur', "Impossible d'annuler la mission");
              }
            }
          },
        },
      ]
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // Si request est null après chargement, c'est qu'on a redirigé (guard)
  if (!request) return null;

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  const status = (request?.status || '').toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={mapStyle}
        initialRegion={{
          ...clientLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
      >
        {/* Client location */}
        <Marker coordinate={clientLocation} title="Votre position" pinColor="#1A1A1A" />

        {/* Provider location */}
        {providerLocation && (
          <Marker coordinate={providerLocation} title={request?.provider?.name || 'Prestataire'}>
            <Animated.View style={[styles.providerMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="car" size={24} color="#FFF" />
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      {/* Info card */}
      <View style={styles.infoCard}>
        {/* ETA */}
        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>
            {status === 'ONGOING' ? 'Mission en cours' : 'Arrivée estimée'}
          </Text>
          <Text style={styles.etaTime}>{eta}</Text>
          {!providerLocation && (
            <Text style={styles.etaSubLabel}>Temps estimé : {'< 30 min'}</Text>
          )}
        </View>

        {/* Provider details */}
        {request?.provider && (
          <View style={styles.providerDetails}>
            <View style={styles.providerAvatar}>
              <Ionicons name="person" size={28} color="#666" />
            </View>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{request.provider.name}</Text>
              <Text style={styles.providerRating}>
                ⭐ {request.provider.avgRating?.toFixed(1) || '5.0'} • {request.provider.jobsCompleted || 0} missions
              </Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallProvider}>
              <Ionicons name="call" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Mission details */}
        <View style={styles.missionDetails}>
          <Text style={styles.missionTitle}>{request?.serviceType}</Text>
          <Text style={styles.missionAddress}>{request?.address}</Text>
          <Text style={styles.missionPrice}>{formatEuros(request?.price || 0)}</Text>
        </View>

        {/* ── PIN Card — shown when provider has arrived ───────────────── */}
        {status === 'ACCEPTED' && pinCode && providerArrived && !pinVerified && (
          <View style={styles.pinCard}>
            <View style={styles.pinCardHeader}>
              <Ionicons name="key" size={20} color="#111" />
              <Text style={styles.pinCardTitle}>Code PIN de verification</Text>
            </View>
            <Text style={styles.pinCardSubtitle}>Communiquez ce code a votre prestataire</Text>
            <View style={styles.pinDigitsRow}>
              {pinCode.split('').map((digit, i) => (
                <View key={i} style={styles.pinDigitBox}>
                  <Text style={styles.pinDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PIN verified banner */}
        {status === 'ACCEPTED' && pinVerified && (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text style={styles.verifiedBannerText}>Code PIN verifie — la mission va demarrer</Text>
          </View>
        )}

        {/* PIN card for non-arrived provider */}
        {status === 'ACCEPTED' && pinCode && !providerArrived && !pinVerified && (
          <View style={styles.pinCardPending}>
            <Ionicons name="time-outline" size={18} color="#888" />
            <Text style={styles.pinCardPendingText}>Le prestataire est en route. Le code PIN s'affichera a son arrivee.</Text>
          </View>
        )}

        {/* Actions — annulation seulement si ACCEPTED (pas ONGOING) */}
        {status === 'ACCEPTED' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRequest}>
            <Text style={styles.cancelButtonText}>Annuler la mission</Text>
          </TouchableOpacity>
        )}

        {status === 'ONGOING' && (
          <View style={styles.ongoingBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#1A1A1A" />
            <Text style={styles.ongoingBannerText}>Mission en cours — le prestataire est sur place</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: '#666', fontWeight: '500' },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  providerMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  etaContainer: { alignItems: 'center', marginBottom: 24 },
  etaLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  etaTime: { fontSize: 32, fontWeight: '900', color: '#000' },
  etaSubLabel: { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  providerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  providerAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  providerRating: { fontSize: 14, color: '#666' },
  callButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center', alignItems: 'center',
  },
  missionDetails: { marginBottom: 20 },
  missionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  missionAddress: { fontSize: 14, color: '#666', marginBottom: 8 },
  missionPrice: { fontSize: 20, fontWeight: '900', color: '#000' },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  ongoingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F4F4F4', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  ongoingBannerText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', flex: 1 },

  // ── PIN card ──
  pinCard: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0',
  },
  pinCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  pinCardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  pinCardSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  pinDigitsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  pinDigitBox: {
    width: 56, height: 64, borderRadius: 14,
    backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1A1A1A',
    justifyContent: 'center', alignItems: 'center',
  },
  pinDigitText: { fontSize: 28, fontWeight: '900', color: '#000' },
  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  verifiedBannerText: { fontSize: 13, fontWeight: '600', color: '#15803D', flex: 1 },
  pinCardPending: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  pinCardPendingText: { fontSize: 13, color: '#888', flex: 1 },
});