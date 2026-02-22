// app/request/[id]/ongoing.tsx
// Provider view with Google Directions API for accurate distance

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
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import * as Location from 'expo-location';

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

// ============================================================================
// VALID STATES — statuts qui autorisent cette page
// ============================================================================

const ACTIONABLE_STATUSES = ['ACCEPTED', 'ONGOING'];

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

  const loadRequestDetails = useCallback(async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      const data = response.data || response;
      const status = (data?.status || '').toUpperCase();

      console.log('✅ [ONGOING] Request loaded:', data?.id, 'status:', status);

      // ── GUARD : si la mission n'est plus actionnable, on redirige proprement ──
      if (!ACTIONABLE_STATUSES.includes(status)) {
        console.warn(`⚠️ [ONGOING] Mission ${id} est en statut "${status}" — non actionnable, redirection`);

        if (status === 'DONE') {
          // Rediriger vers l'écran de gains si déjà terminée
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
          // Statut inconnu / non géré — retour dashboard
          Alert.alert(
            'Mission non disponible',
            `Cette mission ne peut pas être gérée (statut: ${status}).`,
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        }
        return; // Ne pas setter le request, arrêter le chargement via finally
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

        Alert.alert(
          'Mission annulée',
          'Le client a annulé la mission.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
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

  const handleNavigate = () => {
    if (request?.lat && request?.lng) {
      const url = Platform.select({
        ios: `maps://app?daddr=${request.lat},${request.lng}`,
        android: `google.navigation:q=${request.lat},${request.lng}`,
      });
      if (url) Linking.openURL(url);
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

              Alert.alert(
                '🎉 Félicitations !',
                `Mission terminée.\nGains : ${formatEuros(earnings)}`,
                [{
                  text: 'OK',
                  onPress: () => router.replace(`/request/${id}/earnings`),
                }]
              );
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
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={mapInitialRegion}
        showsUserLocation
        followsUserLocation
      >
        {/* Marker client */}
        <Marker coordinate={clientLocation} title="Client" pinColor="#4CAF50" />

        {/* Tracé de l'itinéraire */}
        {routeCoordinates.length > 0 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#000" strokeWidth={4} />
        ) : myLocation ? (
          <Polyline
            coordinates={[myLocation, clientLocation]}
            strokeColor="#999"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
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
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  etaItem: { alignItems: 'center' },
  etaDivider: { width: 1, backgroundColor: '#E0E0E0' },
  etaLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  etaValue: { fontSize: 24, fontWeight: '900', color: '#000' },
  clientDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  clientAddress: { fontSize: 14, color: '#666' },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  completeButton: {
    backgroundColor: '#2196F3',
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