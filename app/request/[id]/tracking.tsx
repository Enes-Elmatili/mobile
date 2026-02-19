// app/request/[id]/tracking.tsx
// Client view - Track provider arriving (like Uber)

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
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBmOMr3I4f7uQ-u5Qz7xRVHV6yCJDH8MYE';

export default function RequestTracking() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);
  
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [providerLocation, setProviderLocation] = useState<any>(null);
  const [eta, setEta] = useState('Calcul en cours...');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load request details
  useEffect(() => {
    loadRequestDetails();
  }, [id]);

  const loadRequestDetails = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      const requestData = response.data || response;
      setRequest(requestData);
      
      console.log('📍 [TRACKING] Request loaded:', requestData);
      
      // Set initial provider location if available
      if (requestData.provider?.lat && requestData.provider?.lng) {
        setProviderLocation({
          latitude: requestData.provider.lat,
          longitude: requestData.provider.lng,
        });
        console.log('📍 [TRACKING] Provider location set from request');
        
        // Calculate initial ETA using Google API
        if (requestData.lat && requestData.lng) {
          await fetchETAFromGoogle(
            requestData.provider.lat,
            requestData.provider.lng,
            requestData.lat,
            requestData.lng
          );
        }
      } else {
        console.log('⏱️ [TRACKING] No initial provider location, waiting for GPS update...');
        setEta('En attente de localisation...');
      }
    } catch (error) {
      console.error('Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la mission');
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch ETA from Google Directions API
  const fetchETAFromGoogle = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('📍 [TRACKING] Fetching ETA from Google...');
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const leg = data.routes[0].legs[0];
        const etaText = leg.duration.text;
        console.log('✅ [TRACKING] Google ETA:', etaText);
        setEta(etaText);
        return etaText;
      } else {
        throw new Error(`Google API error: ${data.status}`);
      }
    } catch (error) {
      console.error('❌ [TRACKING] Error fetching Google ETA:', error);
      // Fallback calculation
      const dist = calculateDistance(originLat, originLng, destLat, destLng);
      const roadDist = dist * 1.4;
      const avgSpeed = 30;
      const durationHours = roadDist / avgSpeed;
      const etaMinutes = Math.ceil(durationHours * 60);
      const etaText = etaMinutes === 1 ? '1 min' : `${etaMinutes} mins`;
      
      console.log('⚠️ [TRACKING] Using fallback ETA:', etaText);
      setEta(etaText);
      return etaText;
    }
  };

  // Listen for provider location updates
  useEffect(() => {
    if (!socket) {
      console.log('❌ [TRACKING] Socket not connected!');
      return;
    }

    const handleLocationUpdate = async (data: any) => {
      if (data.requestId === Number(id)) {
        console.log('📍 [TRACKING] Provider location update:', {
          lat: data.lat,
          lng: data.lng,
          eta: data.eta
        });
        
        setProviderLocation({
          latitude: data.lat,
          longitude: data.lng,
        });
        
        // Update ETA - prefer Google calculation over provider's simple calculation
        if (request?.lat && request?.lng) {
          // Always recalculate with Google API for accuracy
          await fetchETAFromGoogle(
            data.lat,
            data.lng,
            request.lat,
            request.lng
          );
        } else if (data.eta) {
          // Fallback to provider's ETA if we can't calculate
          console.log('⏱️ [TRACKING] Using provider ETA:', data.eta);
          setEta(data.eta);
        }

        // Center map on provider
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: data.lat,
            longitude: data.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    };

    console.log('👂 [TRACKING] Listening for provider location updates on request', id);
    socket.on('provider:location_update', handleLocationUpdate);

    return () => {
      socket.off('provider:location_update', handleLocationUpdate);
    };
  }, [socket, id, request]);

  // Pulse animation for provider marker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleCallProvider = () => {
    if (request?.provider?.phone) {
      Linking.openURL(`tel:${request.provider.phone}`);
    }
  };

  const handleCancelRequest = () => {
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
              Alert.alert('Annulé', 'La mission a été annulée');
              router.back();
            } catch (error) {
              Alert.alert('Erreur', "Impossible d'annuler la mission");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...clientLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
      >
        {/* Client location marker */}
        <Marker
          coordinate={clientLocation}
          title="Votre position"
          pinColor="#4CAF50"
        />

        {/* Provider location marker */}
        {providerLocation && (
          <Marker coordinate={providerLocation}>
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

      {/* Provider info card */}
      <View style={styles.infoCard}>
        {/* ETA */}
        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>Arrivée estimée</Text>
          <Text style={styles.etaTime}>{eta}</Text>
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
          <Text style={styles.missionPrice}>{request?.price}€</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRequest}>
            <Text style={styles.cancelButtonText}>Annuler la mission</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
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
  etaContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  etaLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  etaTime: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
  },
  providerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  providerRating: {
    fontSize: 14,
    color: '#666',
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missionDetails: {
    marginBottom: 20,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  missionAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  missionPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  actions: {
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
});