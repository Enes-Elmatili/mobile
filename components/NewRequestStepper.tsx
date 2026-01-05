import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { api } from '../lib/api';

// Remplacez par votre clé API Google Maps
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

type IoniconsName = 'home' | 'construct' | 'car' | 'warning';

interface Category {
  id: number;
  name: string;
  icon: IoniconsName;
  price: number;
  description: string;
  slug: string;
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Ménage',
    icon: 'home',
    price: 30,
    description: 'Ménage & entretien express',
    slug: 'MENAGE',
  },
  {
    id: 2,
    name: 'Bricolage',
    icon: 'construct',
    price: 25,
    description: 'Petits travaux & réparations',
    slug: 'BRICOLAGE',
  },
  {
    id: 3,
    name: 'Transport',
    icon: 'car',
    price: 55,
    description: 'Déménagement & transport',
    slug: 'TRANSPORT',
  },
  {
    id: 4,
    name: 'Urgences techniques',
    icon: 'warning',
    price: 125,
    description: 'Serrurerie, plomberie, électricité',
    slug: 'URGENCES',
  },
];

// Région par défaut (Bruxelles)
const DEFAULT_REGION = {
  latitude: 50.8503,
  longitude: 4.3517,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export default function NewRequestStepper() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [timeOption, setTimeOption] = useState<'now' | 'later' | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const STEP_COUNT = 4;
  const selectedCategory = CATEGORIES.find((c) => c.id === categoryId);

  const progressPct = Math.round((step / STEP_COUNT) * 100);

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleNext = () => {
    // Validation par étape
    if (step === 1 && !categoryId) {
      Alert.alert('Attention', 'Veuillez sélectionner une catégorie');
      return;
    }
    if (step === 2 && !location) {
      Alert.alert('Attention', 'Veuillez sélectionner une adresse');
      return;
    }
    if (step === 3 && !timeOption) {
      Alert.alert('Attention', 'Veuillez choisir une date et heure');
      return;
    }
    if (step === 3 && timeOption === 'later' && (!scheduledDate || !scheduledTime)) {
      Alert.alert('Attention', 'Veuillez renseigner la date et l\'heure');
      return;
    }

    if (step < STEP_COUNT) {
      setStep(step + 1);
    }
  };

  const handlePlaceSelect = (data: any, details: any) => {
    if (details) {
      const { geometry, formatted_address } = details;
      const newLocation: LocationData = {
        address: formatted_address,
        lat: geometry.location.lat,
        lng: geometry.location.lng,
      };
      setLocation(newLocation);

      // Animer la carte vers la nouvelle position
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: geometry.location.lat,
          longitude: geometry.location.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    // Reverse geocoding pour obtenir l'adresse (nécessite une API call)
    setLocation({
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      lat: latitude,
      lng: longitude,
    });
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !location) return;

    setLoading(true);
    try {
      const requestData = {
        title: `${selectedCategory.name} - ${description.substring(0, 50) || 'Service'}`,
        description: description || `Service de ${selectedCategory.name}`,
        category: selectedCategory.slug,
        price: selectedCategory.price,
        location: {
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        },
        scheduledFor: timeOption === 'now' 
          ? new Date().toISOString() 
          : new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
      };

      console.log('📤 Creating request:', requestData);
      const response = await api.requests.create(requestData);
      console.log('✅ Request created:', response);

      Alert.alert(
        'Succès !',
        'Votre demande a été créée. Nous recherchons un prestataire...',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push({
                pathname: '/request/[id]',
                params: { id: response.id || response.data?.id },
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error creating request:', error);
      Alert.alert('Erreur', error.message || 'Impossible de créer la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={step > 1 ? handlePrev : () => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {step === 1 && 'Choisissez un service'}
              {step === 2 && 'Où intervenir ?'}
              {step === 3 && 'Quand ?'}
              {step === 4 && 'Confirmation'}
            </Text>
            <Text style={styles.headerStep}>
              {step}/{STEP_COUNT}
            </Text>
          </View>

          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Quel service vous faut-il ?</Text>
              <Text style={styles.stepSubtitle}>Sélectionnez une catégorie</Text>

              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => {
                  const isActive = categoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryCard, isActive && styles.categoryCardActive]}
                      onPress={() => setCategoryId(cat.id)}
                    >
                      {isActive && (
                        <View style={styles.categoryCheckmark}>
                          <Ionicons name="checkmark-circle" size={24} color="#000" />
                        </View>
                      )}
                      <Ionicons name={cat.icon} size={40} color={isActive ? '#000' : '#666'} />
                      <Text style={[styles.categoryName, isActive && styles.categoryNameActive]}>
                        {cat.name}
                      </Text>
                      <Text style={styles.categoryDescription}>{cat.description}</Text>
                      <Text style={styles.categoryPrice}>{cat.price}€</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {categoryId && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.inputLabel}>Décrivez votre besoin</Text>
                  <TextInput
                    style={styles.textArea}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Ex: Nettoyage complet d'un appartement 2 chambres..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </View>
          )}

          {/* Step 2: Address with Google Maps */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Où intervenir ?</Text>
              <Text style={styles.stepSubtitle}>Indiquez l'adresse du service</Text>

              {/* Google Places Autocomplete */}
              <View style={styles.autocompleteContainer}>
                <GooglePlacesAutocomplete
                  placeholder="Commencez à taper votre adresse..."
                  onPress={handlePlaceSelect}
                  query={{
                    key: GOOGLE_MAPS_API_KEY,
                    language: 'fr',
                    components: 'country:be', // Limiter à la Belgique
                  }}
                  fetchDetails={true}
                  styles={{
                    container: {
                      flex: 0,
                    },
                    textInputContainer: {
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      paddingHorizontal: 8,
                    },
                    textInput: {
                      height: 48,
                      color: '#000',
                      fontSize: 16,
                      paddingLeft: 32,
                    },
                    listView: {
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      marginTop: 8,
                    },
                    row: {
                      backgroundColor: '#fff',
                      padding: 13,
                      height: 56,
                    },
                  }}
                  renderLeftButton={() => (
                    <View style={styles.searchIcon}>
                      <Ionicons name="location" size={20} color="#666" />
                    </View>
                  )}
                />
              </View>

              {/* Google Map */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={DEFAULT_REGION}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  {location && (
                    <Marker
                      coordinate={{
                        latitude: location.lat,
                        longitude: location.lng,
                      }}
                      title="Adresse du service"
                      description={location.address}
                    />
                  )}
                </MapView>
              </View>

              {location && (
                <View style={styles.selectedLocationCard}>
                  <Ionicons name="location" size={20} color="#000" />
                  <Text style={styles.selectedLocationText}>{location.address}</Text>
                </View>
              )}

              {selectedCategory && (
                <View style={styles.selectedCategoryCard}>
                  <Ionicons name={selectedCategory.icon} size={24} color="#000" />
                  <View style={styles.selectedCategoryInfo}>
                    <Text style={styles.selectedCategoryName}>{selectedCategory.name}</Text>
                    <Text style={styles.selectedCategoryDescription}>
                      {selectedCategory.description}
                    </Text>
                  </View>
                  <Text style={styles.selectedCategoryPrice}>{selectedCategory.price}€</Text>
                </View>
              )}
            </View>
          )}

          {/* Step 3: Date/Time */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Quand ?</Text>
              <Text style={styles.stepSubtitle}>Choisissez date et heure</Text>

              <View style={styles.timeOptions}>
                <TouchableOpacity
                  style={[styles.timeOption, timeOption === 'now' && styles.timeOptionActive]}
                  onPress={() => setTimeOption('now')}
                >
                  {timeOption === 'now' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#000"
                      style={styles.timeOptionCheck}
                    />
                  )}
                  <Text
                    style={[styles.timeOptionTitle, timeOption === 'now' && styles.timeOptionTitleActive]}
                  >
                    Maintenant
                  </Text>
                  <Text style={styles.timeOptionSubtitle}>Dès que possible</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeOption, timeOption === 'later' && styles.timeOptionActive]}
                  onPress={() => setTimeOption('later')}
                >
                  {timeOption === 'later' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#000"
                      style={styles.timeOptionCheck}
                    />
                  )}
                  <Text
                    style={[
                      styles.timeOptionTitle,
                      timeOption === 'later' && styles.timeOptionTitleActive,
                    ]}
                  >
                    Planifier
                  </Text>
                  <Text style={styles.timeOptionSubtitle}>Choisir date/heure</Text>
                </TouchableOpacity>
              </View>

              {timeOption === 'later' && (
                <View style={styles.dateTimeInputs}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TextInput
                      style={styles.input}
                      value={scheduledDate}
                      onChangeText={setScheduledDate}
                      placeholder="2025-09-19"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Heure</Text>
                    <TextInput
                      style={styles.input}
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      placeholder="14:00"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Step 4: Summary */}
          {step === 4 && selectedCategory && location && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Confirmer</Text>
              <Text style={styles.stepSubtitle}>Vérifiez les détails</Text>

              {/* Service Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name={selectedCategory.icon} size={32} color="#000" />
                  <View style={styles.summaryHeaderText}>
                    <Text style={styles.summaryTitle}>{selectedCategory.name}</Text>
                  </View>
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.summaryLabel}>Description</Text>
                  <Text style={styles.summaryValue}>
                    {description || 'Aucune description'}
                  </Text>
                </View>

                <View style={styles.summarySection}>
                  <Ionicons name="location" size={16} color="#666" />
                  <Text style={styles.summaryValue}>{location.address}</Text>
                </View>

                <View style={styles.summarySection}>
                  <Ionicons name="time" size={16} color="#666" />
                  <Text style={styles.summaryValue}>
                    {timeOption === 'now'
                      ? 'Maintenant'
                      : `${scheduledDate} à ${scheduledTime}`}
                  </Text>
                </View>
              </View>

              {/* Price Card */}
              <View style={styles.priceCard}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Tarif de base</Text>
                  <Text style={styles.priceValue}>{selectedCategory.price}€</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.priceTotalLabel}>Total à payer</Text>
                  <Text style={styles.priceTotalValue}>{selectedCategory.price}€</Text>
                </View>
              </View>

              <Text style={styles.disclaimer}>
                En confirmant, vous acceptez nos conditions d'utilisation
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Navigation */}
        {step < 4 && (
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.nextButtonText}>
                {loading ? 'Création en cours...' : 'Confirmer la demande'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  headerStep: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  stepContainer: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  categoryCardActive: {
    borderColor: '#000',
    backgroundColor: '#F9FAFB',
  },
  categoryCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#666',
    marginTop: 12,
  },
  categoryNameActive: {
    color: '#000',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  categoryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 100,
  },
  autocompleteContainer: {
    zIndex: 1,
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 2,
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  selectedCategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  selectedCategoryInfo: {
    flex: 1,
  },
  selectedCategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  selectedCategoryDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectedCategoryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  timeOptions: {
    gap: 12,
  },
  timeOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  timeOptionActive: {
    borderColor: '#000',
    backgroundColor: '#F9FAFB',
  },
  timeOptionCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  timeOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  timeOptionTitleActive: {
    color: '#000',
  },
  timeOptionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  dateTimeInputs: {
    gap: 12,
    marginTop: 8,
  },
  inputGroup: {
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryHeaderText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  summarySection: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  priceTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  priceTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  disclaimer: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
