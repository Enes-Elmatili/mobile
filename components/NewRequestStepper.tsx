// app/(tabs)/request/NewRequestStepper.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import { io, Socket } from 'socket.io-client';

import { api } from '../lib/api';
import { computePrice } from '../../backend/services/priceService';

// Vues du flow
import { RequestSearchingView } from './request/RequestSearchingView';
import { RequestOngoingView } from './request/RequestOngoingView';
import { RequestCompletedView } from './request/RequestCompletedView';
import { RequestRatingView } from './request/RequestRatingView';

// --- CONFIG ---

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_REGION = {
  latitude: 50.8503,
  longitude: 4.3517,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

function extractArrayPayload(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  if (response?.data?.data && Array.isArray(response.data.data)) return response.data.data;
  return [];
}

export default function NewRequestStepper() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // --- ETATS ---

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Données formulaire
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [timeOption, setTimeOption] = useState<'now' | 'later' | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<any | null>(null);

  // Suivi demande (Live)
  const [currentRequest, setCurrentRequest] = useState<any | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [eta, setEta] = useState('5 min');

  const STEP_COUNT = 4;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || null,
    [categories, categoryId],
  );

  const selectedSubcategory = useMemo(
    () =>
      selectedCategory?.subcategories?.find((s: any) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId],
  );

  const progressPct = Math.round((step / STEP_COUNT) * 100);

  // --- CHARGEMENT INITIAL ---

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.request('/categories');
        if (mounted) setCategories(extractArrayPayload(response));
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // --- CALCUL PRIX ---

  useEffect(() => {
    if (!selectedCategory) return;
    const date = timeOption === 'now' ? new Date() : new Date(); // à affiner si tu gères le planning

    try {
      const priceDetails = computePrice({
        baseRate: selectedCategory.price || 0,
        hours: 1,
        isUrgent: timeOption === 'now',
        requestDate: date,
        distanceKm: 0,
      });
      setEstimatedPrice(priceDetails);
    } catch (_e) {}
  }, [selectedCategory, timeOption]);

  // --- WEBSOCKET LIVE ---

  useEffect(() => {
    if (!currentRequest?.id) return;

    const SOCKET_URL =
      process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';

    console.log('🔌 Connexion WebSocket req:', currentRequest.id);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { requestId: currentRequest.id },
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_request', currentRequest.id);
    });

    newSocket.on('request_status_update', (data: any) => {
      console.log('📡 Status:', data.status);
      setCurrentRequest((prev: any) => ({
        ...prev,
        status: data.status,
        provider: data.provider || prev?.provider,
      }));
    });

    newSocket.on('provider_accepted', (data: any) => {
      setCurrentRequest((prev: any) => ({
        ...prev,
        status: 'ACCEPTED',
        provider: data.provider,
      }));
      setEta(data.eta || '5 min');
    });

    newSocket.on('service_completed', (data: any) => {
      setCurrentRequest((prev: any) => ({
        ...prev,
        status: 'COMPLETED',
        finalPrice: data.finalPrice,
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentRequest?.id]);

  // --- ACTIONS ---

  const handleCancelSearch = async () => {
    if (!currentRequest?.id) return;

    Alert.alert('Annuler', 'Arrêter la recherche ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.request(`/requests/${currentRequest.id}`, {
              method: 'PATCH',
              body: { status: 'CANCELLED' },
            });
            setCurrentRequest(null);
            router.replace('/(tabs)/dashboard');
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!currentRequest?.id) return;
    try {
      await api.request(`/requests/${currentRequest.id}/rating`, {
        method: 'POST',
        body: { rating, comment },
      });
      Alert.alert('Merci !', 'Votre avis a été enregistré.');
      setCurrentRequest(null);
      router.replace('/(tabs)/dashboard');
    } catch (_e) {
      Alert.alert('Erreur', "Impossible d'enregistrer votre avis.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !location || !timeOption) {
      Alert.alert('Info', 'Complétez le service, l’adresse et le moment.');
      return;
    }

    setLoading(true);

    try {
      // 1. Création de la Request (PENDING_PAYMENT)
      const serviceType = selectedSubcategory?.name || selectedCategory.name;
      const price =
        estimatedPrice ? parseFloat(estimatedPrice.finalTotal) : selectedCategory.price;

      const payload = {
        title: serviceType,
        description: description || `Service de ${serviceType}`,
        serviceType,
        categoryId: selectedCategory.id,
        price,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        urgent: timeOption === 'now',
        scheduledFor: new Date().toISOString(),
        status: 'PENDING_PAYMENT',
      };

      const reqRes = await api.request('/requests', { method: 'POST', body: payload });
      const requestId = reqRes.id || reqRes.data?.id;

      if (!requestId) {
        throw new Error('Request ID manquant après création.');
      }

      // 2. Stripe Intent (backend lit la request => source de vérité)
      const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(
        requestId,
      );

      // 3. Init Payment Sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Mosaic',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        returnURL: 'mosaic://stripe-redirect',
        defaultBillingDetails: { address: { country: 'BE' } },
      });

      if (initError) throw new Error(initError.message);

      // 4. Présentation
      const { error: payError } = await presentPaymentSheet();

      if (payError) {
        if (payError.code !== 'Canceled') {
          Alert.alert('Erreur paiement', payError.message);
        }
        setLoading(false);
        return;
      }

      // 5. Validation côté API => request devient PUBLISHED + sockets providers
      await api.request('/payments/success', {
        method: 'POST',
        body: { requestId },
      });

      setCurrentRequest({
        id: requestId,
        status: 'PUBLISHED',
        estimatedPrice: price,
        serviceType: payload.serviceType,
        address: payload.address,
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erreur', e?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDU DES VUES LIVE (SEARCH / ONGOING / COMPLETED / RATING) ---

  if (currentRequest) {
    switch (currentRequest.status) {
      case 'PUBLISHED':
        return (
          <RequestSearchingView
            request={currentRequest}
            serviceType={currentRequest.serviceType}
            estimatedPrice={currentRequest.estimatedPrice}
            onCancel={handleCancelSearch}
          />
        );
      case 'ACCEPTED':
      case 'ONGOING':
        return (
          <RequestOngoingView
            request={currentRequest}
            provider={currentRequest.provider}
            eta={eta}
            onContact={() => console.log('Call')}
          />
        );
      case 'COMPLETED':
        return (
          <RequestCompletedView
            finalPrice={currentRequest.finalPrice || currentRequest.price}
            onRate={() =>
              setCurrentRequest((p: any) => ({ ...p, status: 'RATING_PENDING' }))
            }
          />
        );
      case 'RATING_PENDING':
      case 'RATED':
        return (
          <RequestRatingView provider={currentRequest.provider} onSubmit={handleSubmitRating} />
        );
      default:
        break;
    }
  }

  // --- UI STEPPER (Formulaire) ---

  const handleNext = () => setStep((s) => Math.min(STEP_COUNT, s + 1));
  const handlePrev = () => setStep((s) => Math.max(1, s - 1));

  const currentTitle =
    step === 1
      ? 'Choisissez un service'
      : step === 2
      ? 'Où avez-vous besoin d’aide ?'
      : step === 3
      ? 'Quand ?'
      : 'Confirmation & paiement';

  const mainButtonDisabled =
    loading ||
    (step === 1 && !categoryId) ||
    (step === 2 && !location) ||
    (step === 3 && !timeOption);

  if (step === 2) {
    // MAP FULLSCREEN
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handlePrev}>
            <Ionicons name="arrow-back" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Adresse de la prestation</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ flex: 1 }}>
          <GooglePlacesAutocomplete
            placeholder="Adresse..."
            onPress={(data, details = null) => {
              const lat = details?.geometry.location.lat || 0;
              const lng = details?.geometry.location.lng || 0;
              setLocation({ address: data.description, lat, lng });
              mapRef.current?.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
            }}
            query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr' }}
            fetchDetails
            styles={{
              container: {
                position: 'absolute',
                top: 50,
                left: 20,
                right: 20,
                zIndex: 100,
              },
              listView: { backgroundColor: 'white' },
            }}
          />

          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={DEFAULT_REGION}
            provider={PROVIDER_GOOGLE}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.lat,
                  longitude: location.lng,
                }}
              />
            )}
          </MapView>

          {location && (
            <TouchableOpacity style={styles.floatingBtn} onPress={handleNext}>
              <Text style={styles.btnText}>Confirmer l'adresse</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : handlePrev}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 16 }}>
          <Text style={styles.title}>{currentTitle}</Text>
          <View style={{ height: 4, backgroundColor: '#eee', borderRadius: 2, marginTop: 8 }}>
            <View
              style={{
                height: '100%',
                width: `${progressPct}%`,
                backgroundColor: 'black',
                borderRadius: 2,
              }}
            />
          </View>
        </View>
        <Text>{`${step}/${STEP_COUNT}`}</Text>
      </View>

      {/* Contenu */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {step === 1 && (
          <>
            <Text style={styles.bigTitle}>Quel service ?</Text>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[
                  styles.card,
                  categoryId === c.id && styles.cardActive,
                ]}
              >
                <View>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{c.name}</Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>{c.price}€/h</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.bigTitle}>Quand ?</Text>
            <TouchableOpacity
              onPress={() => setTimeOption('now')}
              style={[styles.card, timeOption === 'now' && styles.cardActive]}
            >
              <Ionicons name="flash" size={24} color="#FFD700" />
              <Text style={{ marginLeft: 10, fontWeight: 'bold' }}>Tout de suite (Urgent)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTimeOption('later')}
              style={[styles.card, timeOption === 'later' && styles.cardActive]}
            >
              <Ionicons name="time-outline" size={24} color="#333" />
              <Text style={{ marginLeft: 10, fontWeight: 'bold' }}>Planifier plus tard</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.bigTitle}>Récapitulatif</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                Service : {selectedCategory?.name || '—'}
              </Text>
              <Text style={styles.summaryText}>
                Lieu : {location?.address || '—'}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.totalPrice}>
                {estimatedPrice?.finalTotal || selectedCategory?.price || 0}€
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.mainBtn,
              mainButtonDisabled && { opacity: 0.4 },
            ]}
            onPress={step === STEP_COUNT ? handleSubmit : handleNext}
            disabled={mainButtonDisabled}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {step === STEP_COUNT ? 'Payer' : 'Continuer'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
  },
  title: { fontWeight: 'bold', fontSize: 16 },
  content: { padding: 20 },
  bigTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActive: { borderColor: 'black', borderWidth: 2, backgroundColor: '#f9f9f9' },
  floatingBtn: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'black',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  mainBtn: { backgroundColor: 'black', padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  summaryBox: { backgroundColor: '#f9f9f9', padding: 20, borderRadius: 12 },
  summaryText: { fontSize: 16, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 10 },
  totalPrice: { fontSize: 24, fontWeight: 'bold', textAlign: 'right' },
});
