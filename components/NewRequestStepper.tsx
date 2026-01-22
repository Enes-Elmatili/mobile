import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import { api } from '../lib/api';
import { computePrice } from '../../backend/services/priceService';

// --- CONFIGURATION ---
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAP_STYLE_ID = '32bfe39492798016ac5c9afb';
const { width } = Dimensions.get('window');

// --- INTERFACES ---
type SeedChoices = Record<string, string[]>;
type SeedMultiChoice = Record<string, string[]> | null;

interface SeedSubcategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  choices?: SeedChoices | null;
  multiChoice?: SeedMultiChoice;
  openQuestions?: any;
  remarque?: string | null;
}

interface Category {
  id: number;
  name: string;
  icon?: string | null;
  price: number;
  description?: string | null;
  subcategories?: SeedSubcategory[];
}

const DEFAULT_REGION = {
  latitude: 50.8503,
  longitude: 4.3517,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

function extractArrayPayload(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  if (response?.data?.data && Array.isArray(response.data.data)) return response.data.data;
  return [];
}

export default function NewRequestStepper() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // --- STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [timeOption, setTimeOption] = useState<'now' | 'later' | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<any>(null);

  const STEP_COUNT = 4;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || null,
    [categories, categoryId]
  );

  const selectedSubcategory = useMemo(() => {
    if (!selectedCategory?.subcategories?.length || !subcategoryId) return null;
    return selectedCategory.subcategories.find((s) => s.id === subcategoryId) || null;
  }, [selectedCategory, subcategoryId]);

  const progressPct = Math.round((step / STEP_COUNT) * 100);

  // --- EFFET INITIAL : Chargement des catégories ---
  useEffect(() => {
    let mounted = true;
    async function fetchCategories() {
      try {
        setCategoriesLoading(true);
        const response = await api.request('/categories');
        const rawData = extractArrayPayload(response);
        const mappedCats: Category[] = rawData.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon ?? null,
          price: typeof c.price === 'number' ? c.price : 0,
          description: c.description ?? null,
          subcategories: Array.isArray(c.subcategories) ? c.subcategories : [],
        }));
        if (mounted) setCategories(mappedCats);
      } catch (e) {
        console.error('❌ Erreur chargement catégories:', e);
        Alert.alert('Erreur', 'Impossible de charger les services. Vérifiez votre connexion.');
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    }
    fetchCategories();
    return () => {
      mounted = false;
    };
  }, []);

  // Reset subcategory quand on change de catégorie
  useEffect(() => {
    setSubcategoryId(null);
  }, [categoryId]);

  // --- EFFETS PRIX ---
  useEffect(() => {
    if (!selectedCategory) return;
    const date =
      timeOption === 'now'
        ? new Date()
        : scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`)
        : new Date();
    try {
      const baseRate = selectedCategory.price || 0;
      const priceDetails = computePrice({
        baseRate,
        hours: 1,
        isUrgent: timeOption === 'now',
        requestDate: date,
        distanceKm: 0,
      });
      setEstimatedPrice(priceDetails);
    } catch (_e) {
      // fallback
    }
  }, [selectedCategory, timeOption, scheduledDate, scheduledTime]);

  // --- HANDLERS ---
  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!categoryId) return Alert.alert('Attention', 'Sélectionnez une catégorie');
      if ((selectedCategory?.subcategories?.length || 0) > 0 && !subcategoryId) {
        return Alert.alert('Attention', 'Sélectionnez une sous-catégorie');
      }
    }
    if (step === 2 && !location) return Alert.alert('Attention', 'Sélectionnez une adresse');
    if (step === 3 && !timeOption) return Alert.alert('Attention', 'Choisissez une heure');
    if (step < STEP_COUNT) setStep(step + 1);
  };

  const handlePlaceSelect = (_data: any, details: any) => {
    if (!details) return;
    const { geometry, formatted_address } = details;
    const newLoc = {
      address: formatted_address,
      lat: geometry.location.lat,
      lng: geometry.location.lng,
    };
    setLocation(newLoc);
    mapRef.current?.animateToRegion({
      latitude: newLoc.lat,
      longitude: newLoc.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocation({
      address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      lat: latitude,
      lng: longitude,
    });
  };

  // --- ✅ SUBMIT PATCHÉ AVEC LOGS ---
  const handleSubmit = async () => {
    if (!selectedCategory || !location) return;
    setLoading(true);

    try {
      const serviceType = selectedSubcategory?.slug || selectedSubcategory?.name || selectedCategory.name;
      const titleBase = selectedSubcategory?.name || selectedCategory.name;

      const payload: any = {
        title: `${titleBase} - ${description.substring(0, 30) || 'Service'}`,
        description: description || `Service de ${titleBase}`,
        serviceType,
        categoryId: selectedCategory.id,
        ...(subcategoryId ? { subcategoryId } : {}),
        price: estimatedPrice ? parseFloat(estimatedPrice.finalTotal) : selectedCategory.price,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        scheduledFor:
          timeOption === 'now'
            ? new Date().toISOString()
            : new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
        urgent: timeOption === 'now',
      };

      console.log('📤 Création demande (Pending Payment)...', payload);
      const requestResponse = await api.requests.create(payload);

      const requestId = requestResponse.id || requestResponse.data?.id || requestResponse.request?.id;
      if (!requestId) {
        console.error('DEBUG RESPONSE:', JSON.stringify(requestResponse));
        throw new Error("Impossible de récupérer l'ID de la demande créée.");
      }

      console.log('✅ Demande créée avec ID:', requestId);

      // ✅ AJOUTÉ : Logs détaillés
      console.log('💳 Initialisation Stripe Payment Intent...');
      const intentResponse = await api.post('/payments/intent', { requestId });
      
      console.log('🔍 STRIPE RESPONSE:', JSON.stringify(intentResponse, null, 2));
      
      const { paymentIntent, ephemeralKey, customer, amount } = intentResponse;

      if (!paymentIntent || !ephemeralKey || !customer) {
        throw new Error('Réponse Stripe incomplète');
      }

      console.log('💰 Montant à payer:', amount / 100, '€');

      // ✅ MODIFIÉ : Configuration améliorée
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Fixed',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false, // ✅ Changé
        appearance: {
          colors: {
            primary: '#000000',
          },
        },
        defaultBillingDetails: {
          name: 'Client',
        },
      });

      if (initError) {
        console.error('❌ Erreur init Payment Sheet:', initError);
        throw new Error(initError.message);
      }

      console.log('✅ Payment Sheet initialisé avec succès');

      // ✅ AJOUTÉ : Délai avant présentation
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('🎨 Ouverture du Payment Sheet...');
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        console.log("⚠️ Paiement annulé par l'utilisateur:", paymentError.code);
        Alert.alert(
          'Paiement non terminé',
          'La demande est enregistrée en brouillon.',
          [{ text: 'Accueil', onPress: () => router.push('/(tabs)/dashboard') }]
        );
      } else {
        console.log('✅ Paiement Stripe réussi !');
        
        try {
          await api.post('/payments/success', { requestId });
          console.log('✅ Validation backend OK');
        } catch (e) {
          console.warn('⚠️ Validation backend échouée', e);
        }

        Alert.alert('Succès', 'Votre demande est publiée et payée !', [
          {
            text: 'Voir ma demande',
            onPress: () => {
              try {
                router.push({ pathname: '/request/[id]', params: { id: requestId } });
              } catch (e) {
                router.push('/(tabs)/requests');
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('❌ Erreur complète:', error);
      Alert.alert('Erreur', error.message || 'Impossible de finaliser la demande');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERERS ---
  const renderStep2FullMap = () => (
    <View style={styles.fullScreenMapContainer}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={DEFAULT_REGION}
        onPress={handleMapPress}
        customMapStyle={[]}
      >
        {location && <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />}
      </MapView>

      <View style={styles.floatingAutocompleteWrapper}>
        <GooglePlacesAutocomplete
          placeholder="Rechercher une adresse"
          onPress={handlePlaceSelect}
          query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr' }}
          fetchDetails
          styles={{
            container: styles.placesInputContainer,
            textInput: styles.placesInput,
            listView: styles.placesListView,
          }}
        />
      </View>

      {location && (
        <View style={styles.bottomLocationCard}>
          <View style={styles.locationInfoRow}>
            <View style={styles.locationIconBg}>
              <Ionicons name="location" size={24} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>Lieu d'intervention</Text>
              <Text style={styles.locationAddress}>{location.address}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.confirmLocationButton} onPress={handleNext}>
            <Text style={styles.confirmLocationText}>Confirmer cette adresse</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* HEADER */}
        {step !== 2 && (
          <View style={styles.header}>
            <TouchableOpacity onPress={step > 1 ? handlePrev : () => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 1 ? 'Service' : step === 3 ? 'Horaire' : 'Confirmation'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
        )}

        {/* PROGRESS */}
        {step !== 2 && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        )}

        {/* CONTENU */}
        {step === 2 ? (
          renderStep2FullMap()
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.stepContent}>
              {/* Step 1 */}
              {step === 1 && (
                <>
                  <Text style={styles.bigTitle}>Quel service ?</Text>
                  {categoriesLoading ? (
                    <ActivityIndicator size="large" color="#000" />
                  ) : (
                    categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        style={[styles.catCard, categoryId === cat.id && styles.catCardActive]}
                      >
                        <Text style={{ fontSize: 32, marginRight: 16 }}>{cat.icon || '🧩'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catName}>{cat.name}</Text>
                          {!!cat.description && <Text style={styles.catDesc}>{cat.description}</Text>}
                        </View>
                        <Text style={styles.catPrice}>{cat.price}€</Text>
                      </TouchableOpacity>
                    ))
                  )}

                  {!categoriesLoading && categories.length === 0 && (
                    <Text style={{ textAlign: 'center', color: '#999' }}>
                      Aucun service disponible pour le moment.
                    </Text>
                  )}

                  {/* Subcategories */}
                  {selectedCategory?.subcategories?.length ? (
                    <>
                      <Text style={[styles.bigTitle, { marginTop: 24 }]}>Choisis une sous-catégorie</Text>
                      {selectedCategory.subcategories.map((sub) => {
                        const active = subcategoryId === sub.id;
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            onPress={() => setSubcategoryId(sub.id)}
                            style={[styles.subCard, active && styles.subCardActive]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.subName}>{sub.name}</Text>
                              {!!sub.description && (
                                <Text style={styles.subDesc}>{sub.description}</Text>
                              )}
                            </View>
                            {active && <Ionicons name="checkmark-circle" size={24} color="#000" />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : null}

                  {(categoryId || subcategoryId) && (
                    <TextInput
                      placeholder="Décrivez votre besoin (optionnel)"
                      value={description}
                      onChangeText={setDescription}
                      style={styles.descInput}
                      multiline
                    />
                  )}
                </>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <>
                  <Text style={styles.bigTitle}>Quand ?</Text>
                  <TouchableOpacity
                    onPress={() => setTimeOption('now')}
                    style={[styles.timeOption, timeOption === 'now' && styles.timeOptionActive]}
                  >
                    <Ionicons name="flash" size={28} color={timeOption === 'now' ? '#000' : '#666'} />
                    <Text style={styles.timeText}>Tout de suite</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setTimeOption('later')}
                    style={[styles.timeOption, timeOption === 'later' && styles.timeOptionActive]}
                  >
                    <Ionicons name="calendar" size={28} color={timeOption === 'later' ? '#000' : '#666'} />
                    <Text style={styles.timeText}>Planifier</Text>
                  </TouchableOpacity>

                  {timeOption === 'later' && (
                    <>
                      <TextInput
                        placeholder="Date (YYYY-MM-DD)"
                        value={scheduledDate}
                        onChangeText={setScheduledDate}
                        style={styles.input}
                      />
                      <TextInput
                        placeholder="Heure (HH:mm)"
                        value={scheduledTime}
                        onChangeText={setScheduledTime}
                        style={styles.input}
                      />
                    </>
                  )}
                </>
              )}

              {/* Step 4 */}
              {step === 4 && (
                <>
                  <Text style={styles.bigTitle}>Récapitulatif</Text>
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Catégorie</Text>
                      <Text style={styles.summaryVal}>{selectedCategory?.name}</Text>
                    </View>
                    {selectedSubcategory && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sous-catégorie</Text>
                        <Text style={styles.summaryVal}>{selectedSubcategory.name}</Text>
                      </View>
                    )}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Lieu</Text>
                      <Text style={styles.summaryVal}>{location?.address}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total à payer</Text>
                      <Text style={styles.summaryValPrice}>
                        {estimatedPrice?.finalTotal ?? selectedCategory?.price ?? 0}€
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        )}

        {/* FOOTER */}
        {step !== 2 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={step === STEP_COUNT ? handleSubmit : handleNext}
              disabled={loading}
            >
              <Text style={styles.mainBtnText}>
                {loading
                  ? 'Traitement...'
                  : step === 4
                  ? `Payer (${estimatedPrice?.finalTotal ?? selectedCategory?.price ?? 0}€)`
                  : 'Continuer'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  progressBg: { height: 4, backgroundColor: '#F0F0F0' },
  progressFill: { height: '100%', backgroundColor: '#000' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  stepContent: { gap: 16 },
  bigTitle: { fontSize: 28, fontWeight: '700', marginBottom: 10 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  catCardActive: { borderColor: '#000', backgroundColor: '#F9F9F9', borderWidth: 2 },
  catName: { fontSize: 16, fontWeight: '600' },
  catDesc: { fontSize: 12, color: '#666' },
  catPrice: { fontSize: 16, fontWeight: '700' },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  subCardActive: { borderColor: '#000', backgroundColor: '#F9F9F9', borderWidth: 2 },
  subName: { fontSize: 14, fontWeight: '700' },
  subDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  descInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    marginTop: 10,
  },
  fullScreenMapContainer: { flex: 1, position: 'relative' },
  floatingAutocompleteWrapper: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 100 },
  placesInputContainer: { backgroundColor: 'transparent', borderTopWidth: 0, borderBottomWidth: 0 },
  placesInput: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingLeft: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    fontSize: 16,
  },
  placesListView: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  bottomLocationCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  locationInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationIconBg: {
    width: 40,
    height: 40,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTitle: { fontSize: 12, color: '#666', textTransform: 'uppercase', fontWeight: '600' },
  locationAddress: { fontSize: 16, fontWeight: '600', color: '#000' },
  confirmLocationButton: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  confirmLocationText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  timeOption: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 10 },
  timeOptionActive: { borderColor: '#000', backgroundColor: '#F9F9F9', borderWidth: 2 },
  timeText: { fontSize: 18, fontWeight: '600', marginLeft: 16 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', padding: 16, borderRadius: 12, fontSize: 16 },
  summaryBox: { backgroundColor: '#F9F9F9', padding: 20, borderRadius: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryVal: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  summaryValPrice: { fontSize: 18, fontWeight: '700', color: '#000' },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0' },
  mainBtn: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});