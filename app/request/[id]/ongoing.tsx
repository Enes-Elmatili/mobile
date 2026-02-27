// app/request/[id]/ongoing.tsx
// v2 — Palette unifiée Silver/Monochrome (même charte que provider-dashboard)

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
  Platform,
  StatusBar,
  BackHandler,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (amount: number): string =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const decodePolyline = (encoded: string) => {
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Map style Silver — même palette que le provider-dashboard ──────────────
const SILVER_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape',           elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road',                elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road',                elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road.arterial',       elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway',        elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway',        elementType: 'geometry.stroke', stylers: [{ color: '#cfcfcf' }] },
  { featureType: 'road.local',          elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water',               elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water',               elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative',      elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
];

// ============================================================================
// VALID STATES — statuts qui autorisent cette page
// ============================================================================

const ACTIONABLE_STATUSES   = ['ACCEPTED', 'ONGOING'];

// Statuts transitoires — race condition entre socket accept et GET /requests/:id
// Le backend n'a pas encore propagé l'accept. On patiente plutôt que de rediriger.
const TRANSITIONAL_STATUSES = ['PUBLISHED', 'PENDING'];

// Retry : 6 × 800 ms = ~5 s max avant abandon
const RETRY_MAX   = 6;
const RETRY_DELAY = 800; // ms
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ============================================================================
// COMPONENT
// ============================================================================

export default function MissionOngoing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================================================
  // ROUTE FETCH
  // ============================================================================

  const fetchRouteFromGoogle = useCallback(async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<{ distance: string; duration: string }> => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No API key');

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') throw new Error(`Google API: ${data.status}`);

      const leg = data.routes[0].legs[0];
      const distText = leg.distance.text;
      const durText = leg.duration.text;

      setDistance(distText);
      setDuration(durText);
      setRouteCoordinates(decodePolyline(data.routes[0].overview_polyline.points));

      console.log('✅ [ONGOING] Route:', distText, '/', durText);
      return { distance: distText, duration: durText };
    } catch (error) {
      console.warn('⚠️ [ONGOING] Google fallback:', error);
      const dist = calculateDistance(originLat, originLng, destLat, destLng);
      const distText = `${dist.toFixed(1)} km`;
      const durText = `${Math.ceil(dist * 3)} min`;
      setDistance(distText);
      setDuration(durText);
      return { distance: distText, duration: durText };
    }
  }, []);

  // ============================================================================
  // LOAD REQUEST — avec guard de statut
  // ============================================================================

  const loadRequestDetails = useCallback(async (attempt = 0) => {
    try {
      const response = await api.get(`/requests/${id}`);
      const data = response.data || response;
      const status = (data?.status || '').toUpperCase();

      console.log(`✅ [ONGOING] Request loaded (attempt ${attempt + 1}): id=${data?.id} status=${status}`);

      // ── Race condition guard : le backend n'a pas encore propagé l'accept ──
      // Le provider vient d'accepter via socket. Le GET peut encore retourner
      // PUBLISHED pendant quelques centaines de ms. On attend et on réessaie.
      if (TRANSITIONAL_STATUSES.includes(status)) {
        if (attempt < RETRY_MAX) {
          console.warn(
            `⏳ [ONGOING] Statut transitoire "${status}" (tentative ${attempt + 1}/${RETRY_MAX}) — retry dans ${RETRY_DELAY}ms`
          );
          setLoading(true); // Garde le spinner pendant le retry
          await sleep(RETRY_DELAY);
          return loadRequestDetails(attempt + 1);
        }
        // Après RETRY_MAX tentatives, le statut est toujours transitoire — abandon
        console.error(`❌ [ONGOING] Statut toujours "${status}" après ${RETRY_MAX} tentatives — abandon`);
        Alert.alert(
          'Mission non disponible',
          "La mission n'a pas pu être confirmée. Revenez au tableau de bord.",
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
        return;
      }

      // ── Guard final : statuts terminaux non actionnables ──
      if (!ACTIONABLE_STATUSES.includes(status)) {
        console.warn(`⚠️ [ONGOING] Mission ${id} est en statut "${status}" — non actionnable, redirection`);

        if (status === 'DONE') {
          Alert.alert(
            'Mission déjà terminée',
            'Cette mission a déjà été clôturée.',
            [{ text: 'OK', onPress: () => router.replace(`/request/${id}/earnings`) }]
          );
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          Alert.alert(
            'Mission annulée',
            'Cette mission a été annulée ou a expiré.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        } else {
          Alert.alert(
            'Mission non disponible',
            `Cette mission ne peut pas être gérée (statut : ${status}).`,
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        }
        return;
      }

      setRequest(data);
    } catch (error) {
      console.error('❌ [ONGOING] Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la mission', [
        { text: 'Retour', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // ── BackHandler lock — bloque le retour physique Android pendant la mission ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadRequestDetails();
  }, [loadRequestDetails]);

  // ============================================================================
  // LOCATION TRACKING
  // ============================================================================

  const startLocationTracking = useCallback(async (req: any) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation pour utiliser cette fonctionnalité');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMyLocation(coords);
      console.log('📍 [ONGOING] Initial location:', coords);

      if (req?.lat && req?.lng) {
        await fetchRouteFromGoogle(coords.latitude, coords.longitude, req.lat, req.lng);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 30,
        },
        async (newLocation) => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setMyLocation(newCoords);

          if (req?.lat && req?.lng) {
            const routeData = await fetchRouteFromGoogle(
              newCoords.latitude,
              newCoords.longitude,
              req.lat,
              req.lng
            );

            if (socket?.connected) {
              socket.emit('provider:location_update', {
                requestId: Number(id),
                lat: newCoords.latitude,
                lng: newCoords.longitude,
                eta: routeData.duration,
              });
              console.log('📡 [ONGOING] Location emitted to room:', id);
            } else {
              console.warn('⚠️ [ONGOING] Socket not connected, location not sent');
            }
          }
        }
      );
    } catch (error) {
      console.error('❌ [ONGOING] Location error:', error);
    }
  }, [fetchRouteFromGoogle, socket, id]);

  useEffect(() => {
    if (request) {
      startLocationTracking(request);
    }

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
        console.log('🛑 [ONGOING] Location tracking stopped');
      }
    };
  }, [request]);

  // ============================================================================
  // SOCKET — rejoindre la room de la request
  // ============================================================================

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join:request', { requestId: id });
    console.log('🔌 [ONGOING] Provider joined room for request:', id);

    const handleClientJoined = (data: any) => {
      if (String(data.requestId) === String(id)) {
        console.log('👤 [ONGOING] Client joined tracking room');
      }
    };

    // Écouter si la mission est annulée par le client en cours de route
    const handleRequestCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        console.warn('🚫 [ONGOING] Mission annulée par le client');

        // Arrêter le GPS
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }

        // Replace direct — pas d'Alert pour éviter la race avec le layout
        router.replace('/(tabs)/dashboard');
      }
    };

    socket.on('client:joined_tracking', handleClientJoined);
    socket.on('request:cancelled', handleRequestCancelled);

    return () => {
      socket.emit('leave:request', { requestId: id });
      socket.off('client:joined_tracking', handleClientJoined);
      socket.off('request:cancelled', handleRequestCancelled);
    };
  }, [socket, id, router]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCallClient = () => {
    if (request?.client?.phone) {
      Linking.openURL(`tel:${request.client.phone}`);
    } else {
      Alert.alert('Numéro indisponible', "Le numéro du client n'est pas disponible.");
    }
  };

  const handleNavigate = async () => {
    if (!request?.lat || !request?.lng) return;

    const lat = request.lat;
    const lng = request.lng;

    if (Platform.OS === 'ios') {
      // Google Maps natif → Apple Maps → fallback web
      const googleMapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const appleMapsUrl  = `maps://?daddr=${lat},${lng}`;
      const webFallback   = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

      const canGoogle = await Linking.canOpenURL(googleMapsUrl);
      if (canGoogle) {
        Linking.openURL(googleMapsUrl);
      } else {
        const canApple = await Linking.canOpenURL(appleMapsUrl);
        Linking.openURL(canApple ? appleMapsUrl : webFallback);
      }
    } else {
      // Android : Google Maps navigation → fallback web
      const googleNavUrl = `google.navigation:q=${lat},${lng}&mode=d`;
      const webFallback  = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

      const canOpen = await Linking.canOpenURL(googleNavUrl);
      Linking.openURL(canOpen ? googleNavUrl : webFallback);
    }
  };

  const handleStartMission = async () => {
    // Guard double sécurité côté client
    if (!request || request.status?.toUpperCase() !== 'ACCEPTED') {
      Alert.alert('Action impossible', `La mission est déjà en statut "${request?.status}".`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/requests/${id}/start`);
      setRequest((prev: any) => ({ ...prev, status: 'ONGOING' }));
      Alert.alert('✅ Mission démarrée', 'Le client a été notifié');
    } catch (error: any) {
      console.error('❌ [ONGOING] Start error:', error);
      // INVALID_STATE = probablement déjà démarrée, on rafraîchit
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        await loadRequestDetails();
        Alert.alert('Statut mis à jour', 'La mission était déjà dans un état différent.');
      } else {
        Alert.alert('Erreur', error.message || 'Impossible de démarrer la mission');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteMission = () => {
    // Guard double sécurité côté client
    if (!request || request.status?.toUpperCase() !== 'ONGOING') {
      Alert.alert('Action impossible', `La mission est en statut "${request?.status}", elle ne peut pas être terminée ici.`);
      return;
    }

    Alert.alert(
      'Terminer la mission',
      'Confirmer que la mission est terminée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setActionLoading(true);
            try {
              console.log(`🚀 [ONGOING] Clôture de la mission ${id}...`);
              const response = await api.post(`/requests/${id}/complete`);
              console.log('✅ [ONGOING] Mission terminée:', response);

              // Arrêter le tracking GPS
              if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
              }

              const earnings = response.earnings ?? (request?.price * 0.85);

              // ── Navigation Lock anti-race condition ──────────────────────────
              // router.replace empêche tout retour arrière.
              // On redirige IMMÉDIATEMENT vers earnings avant que le layout/socket
              // parent puisse voir activeMission = null et rediriger vers /dashboard.
              router.replace({
                pathname: '/request/[id]/earnings',
                params: { id: String(id), earnings: String(earnings) },
              });
            } catch (error: any) {
              console.error('❌ [ONGOING] Complete error:', error);

              // INVALID_STATE : rafraîchir pour voir le vrai statut actuel
              if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
                await loadRequestDetails();
                Alert.alert(
                  'Statut inattendu',
                  'La mission a été mise à jour. Vérifiez son statut actuel.'
                );
              } else {
                const msg = error.data?.message || error.message || 'Une erreur est survenue';
                Alert.alert('Erreur', msg);
              }
            } finally {
              setActionLoading(false);
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

  // Si request est null après le chargement, c'est qu'on a redirigé (guard) — ne rien afficher
  if (!request) return null;

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  const mapInitialRegion = myLocation
    ? { ...myLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { ...clientLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const status = (request.status || '').toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={SILVER_MAP_STYLE}
        initialRegion={mapInitialRegion}
        showsUserLocation
        followsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Marker client */}
        <Marker coordinate={clientLocation} title="Client" pinColor="#111111" />

        {/* Tracé de l'itinéraire */}
        {routeCoordinates.length > 0 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#111111" strokeWidth={4} />
        ) : myLocation ? (
          <Polyline
            coordinates={[myLocation, clientLocation]}
            strokeColor="#ADADAD"
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ) : null}
      </MapView>

      {/* Bouton retour */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      {/* Info card */}
      <View style={styles.infoCard}>
        {/* ETA */}
        <View style={styles.etaContainer}>
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Distance</Text>
            <Text style={styles.etaValue}>{distance || 'Calcul...'}</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Temps</Text>
            <Text style={styles.etaValue}>{duration || 'Calcul...'}</Text>
          </View>
        </View>

        {/* Infos client */}
        {request?.client && (
          <View style={styles.clientDetails}>
            <View style={styles.clientAvatar}>
              <Ionicons name="person" size={28} color="#666" />
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{request.client.name}</Text>
              <Text style={styles.clientAddress}>{request.address}</Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallClient}>
              <Ionicons name="call" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Détails mission */}
        <View style={styles.missionDetails}>
          <Text style={styles.missionTitle}>{request?.serviceType}</Text>
          <Text style={styles.missionPrice}>{formatEuros(request?.price || 0)}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
            <Ionicons name="navigate" size={20} color="#FFF" />
            <Text style={styles.navigateButtonText}>Navigation GPS</Text>
          </TouchableOpacity>

          {status === 'ACCEPTED' && (
            <TouchableOpacity
              style={[styles.startButton, actionLoading && styles.buttonDisabled]}
              onPress={handleStartMission}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.startButtonText}>Démarrer la mission</Text>
              }
            </TouchableOpacity>
          )}

          {status === 'ONGOING' && (
            <TouchableOpacity
              style={[styles.completeButton, actionLoading && styles.buttonDisabled]}
              onPress={handleCompleteMission}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.completeButtonText}>Terminer la mission</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E9EC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#E8E9EC' },
  loadingText: { fontSize: 16, color: '#666', fontWeight: '500' },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F1F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCDDE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0F1F4',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#DCDDE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#DCDDE0',
  },
  etaItem: { alignItems: 'center' },
  etaDivider: { width: 1, backgroundColor: '#CACBCE' },
  etaLabel: { fontSize: 11, fontWeight: '500', color: '#ADADAD', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  etaValue: { fontSize: 24, fontWeight: '900', color: '#000' },
  clientDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#DCDDE0',
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E3E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  clientAddress: { fontSize: 13, color: '#888' },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missionDetails: { marginBottom: 20 },
  missionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  missionPrice: { fontSize: 20, fontWeight: '900', color: '#000' },
  actions: { gap: 12 },
  navigateButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navigateButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  startButton: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  completeButton: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  completeButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  buttonDisabled: {
    opacity: 0.6,
  },
});