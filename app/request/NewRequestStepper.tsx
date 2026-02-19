// app/request/NewRequestStepper.tsx
// Ultra-simple Uber-style - NO DateTimePicker

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  useColorScheme,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';

const { width } = Dimensions.get('window');
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
  return [];
}

export default function NewRequestStepper() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Colors
  const colors = {
    bg: isDark ? '#000' : '#FFF',
    surface: isDark ? '#1C1C1E' : '#F2F2F7',
    text: isDark ? '#FFF' : '#000',
    textLight: isDark ? '#8E8E93' : '#6B7280',
    border: isDark ? '#38383A' : '#E5E7EB',
  };

  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || null,
    [categories, categoryId],
  );

  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories?.find((s: any) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId],
  );

  const estimatedPrice = selectedSubcategory?.price || selectedCategory?.price || 0;

  // Load categories
  useEffect(() => {
    (async () => {
      try {
        const response = await api.request('/categories');
        setCategories(extractArrayPayload(response));
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    })();
  }, []);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) router.back();
    else setStep((prev) => prev - 1);
  };

  const handlePay = async () => {
    if (!selectedCategory || !location) {
      Alert.alert('Erreur', 'Complétez les étapes');
      return;
    }

    setLoading(true);

    try {
      const serviceType = selectedSubcategory?.name || selectedCategory.name;

      const payload = {
        title: serviceType,
        description: description || `Service de ${serviceType}`,
        serviceType,
        categoryId: selectedCategory.id,
        ...(subcategoryId && { subcategoryId }),
        price: estimatedPrice,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        urgent: false,
        scheduledFor: new Date().toISOString(),
        status: 'PENDING_PAYMENT',
      };

      const reqRes = await api.request('/requests', { method: 'POST', body: payload });
      const requestId = reqRes.id || reqRes.data?.id;

      if (!requestId) throw new Error('Request ID manquant');

      const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(requestId);

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'MosaicApp',
        paymentIntentClientSecret: paymentIntent,
        customerEphemeralKeySecret: ephemeralKey,
        customerId: customer,
      });

      if (error) {
        Alert.alert('Erreur', error.message);
        setLoading(false);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        Alert.alert('Paiement annulé', presentError.message);
        setLoading(false);
        return;
      }

      await api.payments.success(requestId);
      
      Alert.alert('✅ Demande créée', 'Un professionnel sera notifié', [
        { text: 'OK', onPress: () => router.push('/(tabs)/dashboard') }
      ]);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.dots}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {step === 1 && (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>Quel service ?</Text>
          
          <View style={styles.grid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, categoryId === cat.id && styles.cardActive]}
                onPress={() => {
                  setCategoryId(cat.id);
                  setSubcategoryId(null);
                }}
              >
                <Ionicons 
                  name={cat.icon as any || 'hammer-outline'} 
                  size={32} 
                  color={categoryId === cat.id ? '#000' : colors.textLight} 
                />
                <Text style={[styles.cardText, categoryId === cat.id && styles.cardTextActive]}>
                  {cat.name}
                </Text>
                {cat.price && <Text style={styles.cardPrice}>{cat.price}€</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {selectedCategory?.subcategories?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Précisez</Text>
              <View style={styles.chips}>
                {selectedCategory.subcategories.map((sub: any) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.chip, subcategoryId === sub.id && styles.chipActive]}
                    onPress={() => setSubcategoryId(sub.id)}
                  >
                    <Text style={[styles.chipText, subcategoryId === sub.id && styles.chipTextActive]}>
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, !categoryId && styles.btnDisabled]}
            onPress={goNext}
            disabled={!categoryId}
          >
            <Text style={styles.btnText}>Continuer</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={styles.content}>
          <Text style={styles.title}>Où ?</Text>
          
          <GooglePlacesAutocomplete
            placeholder="Entrez une adresse"
            fetchDetails
            onPress={(data, details = null) => {
              if (details) {
                const { lat, lng } = details.geometry.location;
                setLocation({ address: data.description, lat, lng });
                mapRef.current?.animateToRegion({
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
              }
            }}
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: 'fr',
              components: 'country:be',
            }}
            styles={{
              container: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
              textInput: {
                ...styles.input,
                backgroundColor: colors.surface,
                color: colors.text,
              },
              listView: { backgroundColor: colors.surface },
              row: { backgroundColor: colors.surface },
              description: { color: colors.text },
            }}
            textInputProps={{
              placeholderTextColor: colors.textLight,
            }}
            enablePoweredByContainer={false}
          />

          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={[styles.map, { marginTop: 80 }]}
            initialRegion={DEFAULT_REGION}
            showsUserLocation
            userInterfaceStyle={isDark ? 'dark' : 'light'}
          >
            {location && (
              <Marker
                coordinate={{ latitude: location.lat, longitude: location.lng }}
                pinColor="#000"
              />
            )}
          </MapView>

          <TouchableOpacity
            style={[styles.btn, !location && styles.btnDisabled]}
            onPress={goNext}
            disabled={!location}
          >
            <Text style={styles.btnText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>Confirmer</Text>

          {/* Summary */}
          <View style={styles.summary}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Service</Text>
              <Text style={styles.rowValue}>
                {selectedSubcategory?.name || selectedCategory?.name}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Lieu</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {location?.address}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{estimatedPrice}€</Text>
            </View>
          </View>

          {/* Description (optional) */}
          <View style={styles.section}>
            <Text style={styles.label}>Détails (optionnel)</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Décrivez votre besoin..."
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Pay button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color="#FFF" />
                <Text style={styles.btnText}>Payer {estimatedPrice}€</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 24,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    card: {
      width: (width - 52) / 2,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      gap: 8,
    },
    cardActive: {
      backgroundColor: '#000',
    },
    cardText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    cardTextActive: {
      color: '#FFF',
    },
    cardPrice: {
      fontSize: 12,
      color: colors.textLight,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: '#000',
    },
    chipText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    chipTextActive: {
      color: '#FFF',
    },
    btn: {
      backgroundColor: '#000',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 'auto',
    },
    btnDisabled: {
      backgroundColor: colors.border,
    },
    btnText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFF',
    },
    input: {
      borderRadius: 12,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    map: {
      flex: 1,
      borderRadius: 16,
      marginBottom: 16,
    },
    summary: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    rowLabel: {
      fontSize: 14,
      color: colors.textLight,
      flex: 1,
    },
    rowValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    totalValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    textarea: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: colors.text,
      minHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}