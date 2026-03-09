// app/request/[id]/ongoing.tsx
// v3 — Photo + PIN verification flow

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
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { tokenStorage } from '@/lib/storage';
import { devError } from '@/lib/logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
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

// ─── Map style Silver ────────────────────────────────────────────────────────
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
// VALID STATES
// ============================================================================

const ACTIONABLE_STATUSES   = ['ACCEPTED', 'ONGOING'];
const TRANSITIONAL_STATUSES = ['PUBLISHED', 'PENDING'];

const RETRY_MAX   = 6;
const RETRY_DELAY = 800;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ============================================================================
// UPLOAD HELPER — multipart/form-data for mission photos
// ============================================================================

async function uploadMissionPhoto(requestId: string, type: 'before' | 'after', imageUri: string): Promise<string> {
  const token = await tokenStorage.getToken();
  const endpoint = type === 'before' ? 'before-photo' : 'after-photo';
  const url = `${API_BASE_URL}/requests/${requestId}/${endpoint}`;

  const formData = new FormData();
  const filename = imageUri.split('/').pop() || `mission_${type}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  formData.append('photo', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'ngrok-skip-browser-warning': 'true',
    },
    body: formData,
  });

  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('Reponse invalide du serveur'); }
  if (!response.ok) throw Object.assign(new Error(data?.message || `HTTP ${response.status}`), { status: response.status, data });
  return data.photoUrl;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MissionOngoing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Photo + PIN state ──────────────────────────────────────────────────────
  const [beforePhotoUri, setBeforePhotoUri] = useState<string | null>(null);
  const [beforePhotoUploaded, setBeforePhotoUploaded] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinVerified, setPinVerified] = useState(false);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [afterPhotoUploaded, setAfterPhotoUploaded] = useState(false);
  const pinInputRefs = useRef<(TextInput | null)[]>([]);

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

      return { distance: distText, duration: durText };
    } catch (error) {
      const dist = calculateDistance(originLat, originLng, destLat, destLng);
      const distText = `${dist.toFixed(1)} km`;
      const durText = `${Math.ceil(dist * 3)} min`;
      setDistance(distText);
      setDuration(durText);
      return { distance: distText, duration: durText };
    }
  }, []);

  // ============================================================================
  // LOAD REQUEST
  // ============================================================================

  const loadRequestDetails = useCallback(async (attempt = 0) => {
    try {
      const response = await api.get(`/requests/${id}`);
      const data = response.data || response;
      const status = (data?.status || '').toUpperCase();

      if (TRANSITIONAL_STATUSES.includes(status)) {
        if (attempt < RETRY_MAX) {
          setLoading(true);
          await sleep(RETRY_DELAY);
          return loadRequestDetails(attempt + 1);
        }
        Alert.alert(
          'Mission non disponible',
          "La mission n'a pas pu etre confirmee. Revenez au tableau de bord.",
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
        return;
      }

      if (!ACTIONABLE_STATUSES.includes(status)) {
        if (status === 'DONE') {
          Alert.alert('Mission deja terminee', 'Cette mission a deja ete cloturee.',
            [{ text: 'OK', onPress: () => router.replace(`/request/${id}/earnings`) }]);
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          Alert.alert('Mission annulee', 'Cette mission a ete annulee ou a expire.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]);
        } else {
          Alert.alert('Mission non disponible', `Statut : ${status}.`,
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]);
        }
        return;
      }

      // Restore photo/PIN state from server data
      if (data.beforePhotoUrl) {
        setBeforePhotoUploaded(true);
        setBeforePhotoUri(data.beforePhotoUrl);
      }
      if (data.pinVerified) {
        setPinVerified(true);
      }
      if (data.afterPhotoUrl) {
        setAfterPhotoUploaded(true);
        setAfterPhotoUri(data.afterPhotoUrl);
      }

      setRequest(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les details de la mission', [
        { text: 'Retour', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

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
        Alert.alert('Permission refusee', 'Activez la localisation pour utiliser cette fonctionnalite');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setMyLocation(coords);

      if (req?.lat && req?.lng) {
        await fetchRouteFromGoogle(coords.latitude, coords.longitude, req.lat, req.lng);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 30 },
        async (newLocation) => {
          const newCoords = { latitude: newLocation.coords.latitude, longitude: newLocation.coords.longitude };
          setMyLocation(newCoords);

          if (req?.lat && req?.lng) {
            const routeData = await fetchRouteFromGoogle(newCoords.latitude, newCoords.longitude, req.lat, req.lng);
            if (socket?.connected) {
              socket.emit('provider:location_update', {
                requestId: Number(id),
                lat: newCoords.latitude,
                lng: newCoords.longitude,
                eta: routeData.duration,
              });
            }
          }
        }
      );
    } catch (error) {
      devError('[ONGOING] Location error:', error);
    }
  }, [fetchRouteFromGoogle, socket, id]);

  useEffect(() => {
    if (request) startLocationTracking(request);
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [request]);

  // ============================================================================
  // SOCKET
  // ============================================================================

  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);

    const handleRequestCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        router.replace('/(tabs)/dashboard');
      }
    };

    socket.on('request:cancelled', handleRequestCancelled);
    return () => {
      leaveRoom('request', id);
      socket.off('request:cancelled', handleRequestCancelled);
    };
  }, [socket, id, router, joinRoom, leaveRoom]);

  // ============================================================================
  // ACTIONS — Photo + PIN flow
  // ============================================================================

  const handleCallClient = () => {
    if (request?.client?.phone) {
      Linking.openURL(`tel:${request.client.phone}`);
    } else {
      Alert.alert('Numero indisponible', "Le numero du client n'est pas disponible.");
    }
  };

  const handleNavigate = async () => {
    if (!request?.lat || !request?.lng) return;
    const { lat, lng } = request;

    if (Platform.OS === 'ios') {
      const googleMapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const appleMapsUrl  = `maps://?daddr=${lat},${lng}`;
      const webFallback   = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const canGoogle = await Linking.canOpenURL(googleMapsUrl);
      if (canGoogle) { Linking.openURL(googleMapsUrl); }
      else {
        const canApple = await Linking.canOpenURL(appleMapsUrl);
        Linking.openURL(canApple ? appleMapsUrl : webFallback);
      }
    } else {
      const googleNavUrl = `google.navigation:q=${lat},${lng}&mode=d`;
      const webFallback  = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const canOpen = await Linking.canOpenURL(googleNavUrl);
      Linking.openURL(canOpen ? googleNavUrl : webFallback);
    }
  };

  // ── Step 1: Take BEFORE photo ─────────────────────────────────────────────
  const handleTakeBeforePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez la camera pour prendre une photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setBeforePhotoUri(uri);
      setActionLoading(true);

      try {
        await uploadMissionPhoto(id!, 'before', uri);
        setBeforePhotoUploaded(true);
        Alert.alert('Photo enregistree', 'Demandez maintenant le code PIN au client.');
      } catch (err: any) {
        devError('[ONGOING] Before photo upload error:', err);
        setBeforePhotoUri(null);
        Alert.alert('Erreur', err.message || "Impossible d'envoyer la photo.");
      } finally {
        setActionLoading(false);
      }
    } catch (err) {
      devError('[ONGOING] Camera error:', err);
    }
  };

  // ── Step 2: Verify PIN ────────────────────────────────────────────────────
  const handlePinChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    setPinDigits(newDigits);

    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPin = async () => {
    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      Alert.alert('Code incomplet', 'Saisissez les 4 chiffres du code PIN.');
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/requests/${id}/verify-pin`, { pin });
      setPinVerified(true);
      Alert.alert('Code verifie', 'Vous pouvez maintenant demarrer la mission.');
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === 'PIN_INCORRECT') {
        Alert.alert('Code incorrect', error.data?.message || 'Reessayez.');
        setPinDigits(['', '', '', '']);
        pinInputRefs.current[0]?.focus();
      } else if (code === 'PIN_EXPIRED') {
        Alert.alert('Code expire', 'Le code PIN a expire. Contactez le support.');
      } else if (code === 'PIN_MAX_ATTEMPTS') {
        Alert.alert('Trop de tentatives', 'Nombre maximum de tentatives atteint. Contactez le support.');
      } else {
        Alert.alert('Erreur', error.message || 'Impossible de verifier le code.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Step 3: Start mission (photo + PIN both verified) ─────────────────────
  const handleStartMission = async () => {
    if (!request || request.status?.toUpperCase() !== 'ACCEPTED') {
      Alert.alert('Action impossible', `La mission est deja en statut "${request?.status}".`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/requests/${id}/start`);
      setRequest((prev: any) => ({ ...prev, status: 'ONGOING' }));
      Alert.alert('Mission demarree', 'Le client a ete notifie.');
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        await loadRequestDetails();
        Alert.alert('Statut mis a jour', 'La mission etait deja dans un etat different.');
      } else {
        Alert.alert('Erreur', error.message || 'Impossible de demarrer la mission');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Step 4: Take AFTER photo ──────────────────────────────────────────────
  const handleTakeAfterPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez la camera pour prendre une photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setAfterPhotoUri(uri);
      setActionLoading(true);

      try {
        await uploadMissionPhoto(id!, 'after', uri);
        setAfterPhotoUploaded(true);
        Alert.alert('Photo enregistree', 'Vous pouvez maintenant terminer la mission.');
      } catch (err: any) {
        devError('[ONGOING] After photo upload error:', err);
        setAfterPhotoUri(null);
        Alert.alert('Erreur', err.message || "Impossible d'envoyer la photo.");
      } finally {
        setActionLoading(false);
      }
    } catch (err) {
      devError('[ONGOING] Camera error:', err);
    }
  };

  // ── Step 5: Complete mission ──────────────────────────────────────────────
  const handleCompleteMission = () => {
    if (!request || request.status?.toUpperCase() !== 'ONGOING') {
      Alert.alert('Action impossible', `La mission est en statut "${request?.status}".`);
      return;
    }

    Alert.alert(
      'Terminer la mission',
      'Confirmer que la mission est terminee ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.post(`/requests/${id}/complete`);

              if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
              }

              const earnings = response.earnings ?? (request?.price * 0.85);
              router.replace({
                pathname: '/request/[id]/earnings',
                params: { id: String(id), earnings: String(earnings) },
              });
            } catch (error: any) {
              if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
                await loadRequestDetails();
                Alert.alert('Statut inattendu', 'La mission a ete mise a jour.');
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

  if (!request) return null;

  const clientLocation = {
    latitude: request?.lat || 50.8503,
    longitude: request?.lng || 4.3517,
  };

  const mapInitialRegion = myLocation
    ? { ...myLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { ...clientLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const status = (request.status || '').toUpperCase();

  // ── Determine current step for ACCEPTED state ─────────────────────────────
  const needsBeforePhoto = status === 'ACCEPTED' && !beforePhotoUploaded;
  const needsPin = status === 'ACCEPTED' && beforePhotoUploaded && !pinVerified;
  const readyToStart = status === 'ACCEPTED' && beforePhotoUploaded && pinVerified;
  const needsAfterPhoto = status === 'ONGOING' && !afterPhotoUploaded;
  const readyToComplete = status === 'ONGOING' && afterPhotoUploaded;

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
        <Marker coordinate={clientLocation} title="Client" pinColor="#111111" />
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

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      {/* Info card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.infoCardWrapper}
      >
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

          {/* Client info */}
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

          {/* Mission details */}
          <View style={styles.missionDetails}>
            <Text style={styles.missionTitle}>{request?.serviceType}</Text>
            <Text style={styles.missionPrice}>{formatEuros(request?.price || 0)}</Text>
          </View>

          {/* ── Step progress indicator ──────────────────────────────────────── */}
          {status === 'ACCEPTED' && (
            <View style={styles.stepProgress}>
              <View style={[styles.stepDot, beforePhotoUploaded && styles.stepDotDone]} />
              <View style={[styles.stepLine, beforePhotoUploaded && styles.stepLineDone]} />
              <View style={[styles.stepDot, pinVerified && styles.stepDotDone]} />
              <View style={[styles.stepLine, readyToStart && styles.stepLineDone]} />
              <View style={[styles.stepDot, readyToStart && styles.stepDotDone]} />
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
              <Ionicons name="navigate" size={20} color="#FFF" />
              <Text style={styles.navigateButtonText}>Navigation GPS</Text>
            </TouchableOpacity>

            {/* ── ACCEPTED: Step 1 — Before photo ──────────────────────────── */}
            {needsBeforePhoto && (
              <TouchableOpacity
                style={[styles.photoButton, actionLoading && styles.buttonDisabled]}
                onPress={handleTakeBeforePhoto}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#FFF" />
                    <Text style={styles.photoButtonText}>Prendre la photo AVANT</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Before photo preview */}
            {beforePhotoUploaded && beforePhotoUri && status === 'ACCEPTED' && (
              <View style={styles.photoPreviewRow}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.photoPreviewText}>Photo avant enregistree</Text>
              </View>
            )}

            {/* ── ACCEPTED: Step 2 — PIN entry ─────────────────────────────── */}
            {needsPin && (
              <View style={styles.pinSection}>
                <Text style={styles.pinTitle}>Code PIN du client</Text>
                <Text style={styles.pinSubtitle}>Demandez le code a 4 chiffres au client</Text>
                <View style={styles.pinInputRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => { pinInputRefs.current[i] = ref; }}
                      style={styles.pinInput}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={pinDigits[i]}
                      onChangeText={(text) => handlePinChange(text, i)}
                      onKeyPress={(e) => handlePinKeyPress(e, i)}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.verifyPinButton, actionLoading && styles.buttonDisabled]}
                  onPress={handleVerifyPin}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.verifyPinButtonText}>Verifier le code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* PIN verified indicator */}
            {pinVerified && status === 'ACCEPTED' && (
              <View style={styles.photoPreviewRow}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.photoPreviewText}>Code PIN verifie</Text>
              </View>
            )}

            {/* ── ACCEPTED: Step 3 — Start mission ─────────────────────────── */}
            {readyToStart && (
              <TouchableOpacity
                style={[styles.startButton, actionLoading && styles.buttonDisabled]}
                onPress={handleStartMission}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.startButtonText}>Demarrer la mission</Text>
                )}
              </TouchableOpacity>
            )}

            {/* ── ONGOING: Step 4 — After photo ───────────────────────────── */}
            {needsAfterPhoto && (
              <TouchableOpacity
                style={[styles.photoButton, actionLoading && styles.buttonDisabled]}
                onPress={handleTakeAfterPhoto}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#FFF" />
                    <Text style={styles.photoButtonText}>Prendre la photo APRES</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* After photo preview */}
            {afterPhotoUploaded && (
              <View style={styles.photoPreviewRow}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.photoPreviewText}>Photo apres enregistree</Text>
              </View>
            )}

            {/* ── ONGOING: Step 5 — Complete mission ──────────────────────── */}
            {readyToComplete && (
              <TouchableOpacity
                style={[styles.completeButton, actionLoading && styles.buttonDisabled]}
                onPress={handleCompleteMission}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.completeButtonText}>Terminer la mission</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
    top: 60, left: 20, width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F0F1F4',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#DCDDE0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
    elevation: 4,
  },
  infoCardWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  infoCard: {
    backgroundColor: '#F0F1F4',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24,
    borderTopWidth: 1, borderTopColor: '#DCDDE0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16,
    elevation: 8,
  },
  etaContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginBottom: 24, paddingBottom: 24,
    borderBottomWidth: 1, borderBottomColor: '#DCDDE0',
  },
  etaItem: { alignItems: 'center' },
  etaDivider: { width: 1, backgroundColor: '#CACBCE' },
  etaLabel: { fontSize: 11, fontWeight: '500', color: '#ADADAD', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  etaValue: { fontSize: 24, fontWeight: '900', color: '#000' },
  clientDetails: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#DCDDE0',
  },
  clientAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E2E3E6',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  clientAddress: { fontSize: 13, color: '#888' },
  callButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#111111',
    justifyContent: 'center', alignItems: 'center',
  },
  missionDetails: { marginBottom: 20 },
  missionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  missionPrice: { fontSize: 20, fontWeight: '900', color: '#000' },

  // ── Step progress ──
  stepProgress: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, gap: 0,
  },
  stepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#DCDDE0', borderWidth: 2, borderColor: '#CACBCE',
  },
  stepDotDone: { backgroundColor: '#22C55E', borderColor: '#16A34A' },
  stepLine: { width: 40, height: 2, backgroundColor: '#DCDDE0' },
  stepLineDone: { backgroundColor: '#22C55E' },

  // ── Actions ──
  actions: { gap: 12 },
  navigateButton: {
    flexDirection: 'row', backgroundColor: '#000',
    paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  navigateButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // ── Photo button ──
  photoButton: {
    flexDirection: 'row',
    backgroundColor: '#374151', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52,
  },
  photoButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // ── Photo preview ──
  photoPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: '#F0FDF4', borderRadius: 12,
  },
  photoPreviewText: { fontSize: 14, fontWeight: '600', color: '#15803D' },

  // ── PIN section ──
  pinSection: { alignItems: 'center', paddingVertical: 8 },
  pinTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 },
  pinSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  pinInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pinInput: {
    width: 56, height: 64, borderRadius: 14,
    backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DCDDE0',
    textAlign: 'center', fontSize: 28, fontWeight: '900', color: '#000',
  },
  verifyPinButton: {
    backgroundColor: '#111111', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 16, minHeight: 48,
  },
  verifyPinButtonText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // ── Start / Complete ──
  startButton: {
    backgroundColor: '#111111', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  completeButton: {
    backgroundColor: '#111111', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  completeButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  buttonDisabled: { opacity: 0.6 },
});
