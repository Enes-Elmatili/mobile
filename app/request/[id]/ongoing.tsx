// app/request/[id]/ongoing.tsx
// Provider view with Google Directions API for accurate distance

import React, { useState, useEffect, useRef } from 'react';
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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCX2pt7Wi5RckO9ur-i4PwSH7XRKdhDe5s';

export default function MissionOngoing() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);
  
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<any>(null);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

  useEffect(() => {
    loadRequestDetails();
  }, [id]);

  useEffect(() => {
    if (request) {
      startLocationTracking();
    }
  }, [request]);

  const loadRequestDetails = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      setRequest(response.data || response);
    } catch (error) {
      console.error('Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteFromGoogle = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('📍 Fetching route from Google...');
      const response = await fetch(url);
      const data = await response.json();

      console.log('📊 Google API response status:', data.status);

      if (data.status !== 'OK') {
        console.error('❌ Google API error:', data.status, data.error_message);
        throw new Error(`Google API error: ${data.status}`);
      }

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        // Extract distance and duration
        const distanceText = leg.distance.text;
        const durationText = leg.duration.text;
        
        setDistance(distanceText);
        setDuration(durationText);

        // Decode polyline
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        console.log('✅ Route calculated:', distanceText, '/', durationText);

        return {
          distance: distanceText,
          duration: durationText,
        };
      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      // Fallback to straight line distance
      const dist = calculateDistance(originLat, originLng, destLat, destLng);
      const distText = `${dist.toFixed(1)} km`;
      const durText = `${Math.ceil(dist * 3)} min`;
      
      setDistance(distText);
      setDuration(durText);
      
      console.log('⚠️ Using fallback calculation:', distText, '/', durText);
      
      return {
        distance: distText,
        duration: durText,
      };
    }
  };

  const decodePolyline = (encoded: string) => {
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1E5,
        longitude: lng / 1E5,
      });
    }
    return points;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMyLocation(coords);

      // Fetch route from Google
      if (request?.lat && request?.lng) {
        await fetchRouteFromGoogle(coords.latitude, coords.longitude, request.lat, request.lng);
      }

      // Watch location updates
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Every 10 seconds
          distanceInterval: 50,
        },
        async (newLocation) => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setMyLocation(newCoords);

          // Update route
          if (request?.lat && request?.lng) {
            const routeData = await fetchRouteFromGoogle(
              newCoords.latitude,
              newCoords.longitude,
              request.lat,
              request.lng
            );

            // Send to client with accurate ETA
            socket?.emit('provider:location_update', {
              requestId: Number(id),
              lat: newCoords.latitude,
              lng: newCoords.longitude,
              eta: routeData?.duration || duration,
            });
          }
        }
      );
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const handleCallClient = () => {
    if (request?.client?.phone) {
      Linking.openURL(`tel:${request.client.phone}`);
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
    try {
      await api.post(`/requests/${id}/start`);
      Alert.alert('Mission démarrée', 'Le client a été notifié');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de démarrer');
    }
  };

  const handleCompleteMission = () => {
      Alert.alert(
        'Terminer la mission',
        'Confirmer que la mission est terminée ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                console.log(`🚀 [COMPLETION] Tentative de clôture de la mission ${id}...`);
                
                // Appel à l'API corrigée
                const response = await api.post(`/requests/${id}/complete`);
                
                console.log('✅ [COMPLETION] Mission terminée avec succès:', response.data);

                // Alerte de succès avant redirection
                Alert.alert(
                  'Félicitations !', 
                  `Mission terminée. Gains : ${response.data?.earnings || request?.price * 0.85}€`,
                  [{ 
                    text: 'OK', 
                    onPress: () => router.push(`/request/${id}/earnings`) 
                  }]
                );
                
              } catch (error: any) {
                console.error('❌ [COMPLETION] Erreur lors de la clôture:', error.response?.data || error.message);
                
                const errorMsg = error.response?.data?.message || "Une erreur est survenue lors de la validation.";
                Alert.alert('Erreur', errorMsg);
              }
            },
          },
        ]
      );
  };

  if (loading || !myLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...myLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        followsUserLocation
      >
        <Marker coordinate={clientLocation} title="Client" pinColor="#4CAF50" />

        {routeCoordinates.length > 0 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#000"
            strokeWidth={4}
          />
        ) : (
          <Polyline
            coordinates={[myLocation, clientLocation]}
            strokeColor="#000"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      <View style={styles.infoCard}>
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

        <View style={styles.missionDetails}>
          <Text style={styles.missionTitle}>{request?.serviceType}</Text>
          <Text style={styles.missionPrice}>{request?.price}€</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
            <Ionicons name="navigate" size={20} color="#FFF" />
            <Text style={styles.navigateButtonText}>Navigation</Text>
          </TouchableOpacity>

          {request?.status === 'ACCEPTED' && (
            <TouchableOpacity style={styles.startButton} onPress={handleStartMission}>
              <Text style={styles.startButtonText}>Démarrer la mission</Text>
            </TouchableOpacity>
          )}

          {request?.status === 'ONGOING' && (
            <TouchableOpacity style={styles.completeButton} onPress={handleCompleteMission}>
              <Text style={styles.completeButtonText}>Terminer la mission</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
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
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  completeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  completeButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});