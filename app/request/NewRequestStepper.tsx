// app/request/NewRequestStepper.tsx - ENHANCED PREMIUM VERSION
// Modern design with subcategories, polished UI, and cohesive color palette

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
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useStripe } from '@stripe/stripe-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { io, Socket } from 'socket.io-client';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { api } from '@/lib/api';

// Component imports
import { RequestSearchingView } from './RequestSearchingView';
import { RequestOngoingView } from './RequestOngoingView';
import { RequestCompletedView } from './RequestCompletedView';
import { RequestRatingView } from './RequestRatingView';

const { width, height } = Dimensions.get('window');

// 🎨 Color Palette - Modern & Cohesive
const COLORS = {
  primary: '#1A1A1A',
  secondary: '#2D2D2D',
  accent: '#FF6B35',
  accentLight: '#FF8F6B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#FAFAFA',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const computePrice = ({ 
  baseRate, 
  hours, 
  isUrgent 
}: { 
  baseRate: number; 
  hours: number; 
  isUrgent: boolean;
}) => {
  let total = baseRate * hours;
  if (isUrgent) total *= 1.5;
  return {
    baseRate,
    hours,
    isUrgent,
    total: total.toFixed(2),
    finalTotal: total.toFixed(2),
  };
};

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
  const [timeOption, setTimeOption] = useState<'now' | 'later' | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<any | null>(null);
  
  // 🆕 Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | null>(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  const [currentRequest, setCurrentRequest] = useState<any | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [eta, setEta] = useState('5 min');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  const STEP_COUNT = 5; // 🆕 5 steps: Service → Location → Time → Payment → Confirmation

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

  // Animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  // Load categories
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.request('/categories');
        if (mounted) setCategories(extractArrayPayload(response));
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Calculate price
  useEffect(() => {
    if (!selectedCategory && !selectedSubcategory) return;

    try {
      const basePrice = selectedSubcategory?.price || selectedCategory?.price || 0;
      const priceDetails = computePrice({
        baseRate: basePrice,
        hours: 1,
        isUrgent: timeOption === 'now',
      });
      setEstimatedPrice(priceDetails);
    } catch {}
  }, [selectedCategory, selectedSubcategory, timeOption]);

  // Debug current request
  useEffect(() => {
    if (currentRequest) {
      console.log('📊 CURRENT REQUEST STATUS:', currentRequest.status);
      console.log('📊 FULL REQUEST:', JSON.stringify(currentRequest, null, 2));
    }
  }, [currentRequest]);

  // Socket connection
  useEffect(() => {
    if (!currentRequest?.id) return;

    const SOCKET_URL =
      process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { requestId: currentRequest.id },
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_request', currentRequest.id);
    });

    newSocket.on('request_status_update', (data: any) => {
      console.log('🔄 STATUS UPDATE:', data);
      setCurrentRequest((prev: any) => ({
        ...prev,
        status: data.status,
        provider: data.provider || prev?.provider,
      }));
    });

    newSocket.on('provider_accepted', (data: any) => {
      console.log('✅ PROVIDER ACCEPTED:', data);
      setCurrentRequest((prev: any) => ({
        ...prev,
        status: 'ACCEPTED',
        provider: data.provider,
      }));
      setEta(data.eta || '5 min');
    });

    newSocket.on('service_completed', (data: any) => {
      console.log('🏁 SERVICE COMPLETED:', data);
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
          } catch {}
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
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer votre avis.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !location || !timeOption || !paymentMethod) {
      Alert.alert('Info', 'Complétez toutes les étapes.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const serviceType = selectedSubcategory?.name || selectedCategory.name;
      const price =
        estimatedPrice ? parseFloat(estimatedPrice.finalTotal) : selectedCategory.price;

      const payload = {
        title: serviceType,
        description: description || `Service de ${serviceType}`,
        serviceType,
        categoryId: selectedCategory.id,
        subcategoryId: subcategoryId || null,
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

      // 🆕 Handle payment based on selected method
      if (paymentMethod === 'card') {
        const { paymentIntent, ephemeralKey, customer } = await api.payments.intent(requestId);

        const { error } = await initPaymentSheet({
          merchantDisplayName: 'YourApp',
          paymentIntentClientSecret: paymentIntent,
          customerEphemeralKeySecret: ephemeralKey,
          customerId: customer,
          allowsDelayedPaymentMethods: false,
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
      } else if (paymentMethod === 'wallet') {
        // Handle wallet payment
        try {
          await api.wallet.debit(price);
        } catch (err: any) {
          Alert.alert('Erreur', err.message || 'Solde insuffisant');
          setLoading(false);
          return;
        }
      }

      await api.payments.success(requestId);

      const fullRequest = await api.request(`/requests/${requestId}`);
      const requestData = fullRequest?.data || fullRequest;
      
      setCurrentRequest(requestData);
      setLoading(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('❌ PAYMENT ERROR:', err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  // Render request status views
  if (currentRequest) {
    const status = currentRequest.status;
    console.log('🎯 RENDERING STATUS:', status);
    
    if (status === 'PENDING' || status === 'PUBLISHED' || status === 'PENDING_ASSIGNMENT') {
      return (
        <RequestSearchingView
          requestId={currentRequest.id}
          userId={currentRequest.clientId}
          estimatedPrice={currentRequest.price}
          serviceType={currentRequest.serviceType}
          onCancel={handleCancelSearch}
        />
      );
    }
    
    if (status === 'ACCEPTED' || status === 'ONGOING' || status === 'IN_PROGRESS') {
      return <RequestOngoingView />;
    }
    
    if (status === 'COMPLETED' || status === 'FINISHED') {
      return (
        <RequestCompletedView
          finalPrice={currentRequest.finalPrice || currentRequest.price}
          onRate={() =>
            setCurrentRequest((p: any) => ({ ...p, status: 'RATING_PENDING' }))
          }
        />
      );
    }
    
    if (status === 'RATING_PENDING' || status === 'RATED') {
      return (
        <RequestRatingView provider={currentRequest.provider} onSubmit={handleSubmitRating} />
      );
    }
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  };

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleCategorySelect = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategoryId(id);
    setSubcategoryId(null); // Reset subcategory when changing category
  };

  const handleSubcategorySelect = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubcategoryId(id);
  };

  const currentTitle =
    step === 1
      ? 'Service'
      : step === 2
      ? 'Adresse'
      : step === 3
      ? 'Quand'
      : step === 4
      ? 'Paiement'
      : 'Confirmation';

  const mainButtonDisabled =
    loading ||
    (step === 1 && !categoryId) ||
    (step === 2 && !location) ||
    (step === 3 && !timeOption) ||
    (step === 4 && !paymentMethod);

  // 🆕 Payment Sheet Modal
  const renderPaymentSheet = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    return (
      <Modal
        visible={showPaymentSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            activeOpacity={1}
            onPress={() => setShowPaymentSheet(false)}
          />
          
          <Animated.View 
            style={[
              styles.paymentSheet,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choisir un moyen de paiement</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentSheet(false)}
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Payment Options */}
            <ScrollView 
              style={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Credit Card */}
              <TouchableOpacity
                onPress={() => {
                  setPaymentMethod('card');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.paymentOption,
                  paymentMethod === 'card' && styles.paymentOptionActive,
                ]}
              >
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="card-outline" size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Carte bancaire</Text>
                    <Text style={styles.paymentOptionDesc}>Visa, Mastercard, Amex</Text>
                  </View>
                </View>
                {paymentMethod === 'card' && (
                  <View style={styles.paymentCheck}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Wallet */}
              <TouchableOpacity
                onPress={() => {
                  setPaymentMethod('wallet');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.paymentOption,
                  paymentMethod === 'wallet' && styles.paymentOptionActive,
                ]}
              >
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="wallet-outline" size={24} color={COLORS.warning} />
                  </View>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Portefeuille</Text>
                    <Text style={styles.paymentOptionDesc}>Solde: 120.00€</Text>
                  </View>
                </View>
                {paymentMethod === 'wallet' && (
                  <View style={styles.paymentCheck}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                  </View>
                )}
              </TouchableOpacity>

              {/* PayPal (Future) */}
              <TouchableOpacity
                disabled
                style={[styles.paymentOption, styles.paymentOptionDisabled]}
              >
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: '#E0E7FF' }]}>
                    <Ionicons name="logo-paypal" size={24} color="#6366F1" />
                  </View>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>PayPal</Text>
                    <Text style={styles.paymentOptionDesc}>Bientôt disponible</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Apple Pay (Future) */}
              <TouchableOpacity
                disabled
                style={[styles.paymentOption, styles.paymentOptionDisabled]}
              >
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="logo-apple" size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Apple Pay</Text>
                    <Text style={styles.paymentOptionDesc}>Bientôt disponible</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Confirm Button */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                onPress={() => {
                  if (paymentMethod) {
                    setShowPaymentSheet(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                disabled={!paymentMethod}
                style={[
                  styles.confirmPaymentBtn,
                  !paymentMethod && styles.confirmPaymentBtnDisabled,
                ]}
              >
                <Text 
                  style={[
                    styles.confirmPaymentBtnText,
                    !paymentMethod && styles.confirmPaymentBtnTextDisabled,
                  ]}
                >
                  Confirmer
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Step 2: Map view
  if (step === 2) {
    return (
      <View style={styles.mapContainer}>
        <SafeAreaView style={styles.mapHeader}>
          <TouchableOpacity onPress={handlePrev} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.searchContainer}>
          <GooglePlacesAutocomplete
            placeholder="Rechercher une adresse..."
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr' }}
            fetchDetails
            styles={{
              container: styles.autocomplete,
              textInput: styles.searchInput,
              listView: styles.searchList,
            }}
            renderLeftButton={() => (
              <View style={styles.searchIcon}>
                <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              </View>
            )}
          />
        </View>

        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={DEFAULT_REGION}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton={false}
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
          <Animated.View
            style={[
              styles.mapFooter,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TouchableOpacity onPress={handleNext} style={styles.confirmBtn}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.confirmGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  }

  // Steps 1, 3, 4, 5
  return (
    <View style={styles.container}>
      {showPaymentSheet && renderPaymentSheet()}
      
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={step === 1 ? () => router.back() : handlePrev}
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{currentTitle}</Text>
          </View>
          <Text style={styles.stepCounter}>{step}/{STEP_COUNT}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${progressPct}%`,
              },
            ]}
          />
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }}
            >
              {/* 🆕 STEP 1: Service Selection with Subcategories */}
              {step === 1 && (
                <View>
                  <Text style={styles.stepQuestion}>De quel service avez-vous besoin ?</Text>
                  
                  {/* Main Categories */}
                  {categories.map((cat) => (
                    <View key={cat.id}>
                      <TouchableOpacity
                        onPress={() => handleCategorySelect(cat.id)}
                        activeOpacity={0.7}
                        style={[
                          styles.categoryCard,
                          categoryId === cat.id && styles.categoryCardActive,
                        ]}
                      >
                        <View style={styles.categoryCardLeft}>
                          <View style={[
                            styles.categoryIcon,
                            categoryId === cat.id && styles.categoryIconActive,
                          ]}>
                            <Ionicons 
                              name={cat.icon || "construct-outline"} 
                              size={24} 
                              color={categoryId === cat.id ? COLORS.accent : COLORS.textSecondary} 
                            />
                          </View>
                          <View style={styles.categoryInfo}>
                            <Text style={styles.categoryTitle}>{cat.name}</Text>
                            <Text style={styles.categoryDesc}>{cat.description || ''}</Text>
                          </View>
                        </View>
                        <View style={styles.categoryCardRight}>
                          <Text style={styles.categoryPrice}>{cat.price}€</Text>
                          <Text style={styles.categoryPriceLabel}>/h</Text>
                        </View>
                      </TouchableOpacity>

                      {/* 🆕 Subcategories */}
                      {categoryId === cat.id && cat.subcategories && cat.subcategories.length > 0 && (
                        <View style={styles.subcategoriesContainer}>
                          <Text style={styles.subcategoriesTitle}>Spécialités</Text>
                          <View style={styles.subcategoriesGrid}>
                            {cat.subcategories.map((sub: any) => (
                              <TouchableOpacity
                                key={sub.id}
                                onPress={() => handleSubcategorySelect(sub.id)}
                                style={[
                                  styles.subcategoryChip,
                                  subcategoryId === sub.id && styles.subcategoryChipActive,
                                ]}
                              >
                                <Text 
                                  style={[
                                    styles.subcategoryChipText,
                                    subcategoryId === sub.id && styles.subcategoryChipTextActive,
                                  ]}
                                >
                                  {sub.name}
                                </Text>
                                {sub.price && sub.price !== cat.price && (
                                  <Text style={styles.subcategoryPrice}>+{sub.price - cat.price}€</Text>
                                )}
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  ))}

                  {/* Description */}
                  {categoryId && (
                    <View style={styles.descBox}>
                      <Text style={styles.descLabel}>Détails supplémentaires (optionnel)</Text>
                      <TextInput
                        style={styles.descInput}
                        placeholder="Décrivez votre besoin en quelques mots..."
                        placeholderTextColor={COLORS.textTertiary}
                        multiline
                        value={description}
                        onChangeText={setDescription}
                        maxLength={300}
                      />
                      <Text style={styles.charCount}>{description.length}/300</Text>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 3: Time Selection */}
              {step === 3 && (
                <View>
                  <Text style={styles.stepQuestion}>Pour quand ?</Text>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTimeOption('now');
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.timeCard,
                      timeOption === 'now' && styles.timeCardActive,
                    ]}
                  >
                    <View style={styles.timeCardLeft}>
                      <View style={[
                        styles.timeIcon,
                        timeOption === 'now' && styles.timeIconActive,
                      ]}>
                        <Ionicons 
                          name="flash" 
                          size={24} 
                          color={timeOption === 'now' ? COLORS.accent : COLORS.warning} 
                        />
                      </View>
                      <View>
                        <Text style={styles.timeTitle}>Maintenant</Text>
                        <Text style={styles.timeDesc}>Un pro dans les 15 minutes</Text>
                        {timeOption === 'now' && estimatedPrice && (
                          <View style={styles.urgentPill}>
                            <Text style={styles.urgentText}>+50% service immédiat</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {timeOption === 'now' && (
                      <View style={styles.timeCheck}>
                        <Ionicons name="checkmark-circle" size={28} color={COLORS.accent} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTimeOption('later');
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.timeCard,
                      timeOption === 'later' && styles.timeCardActive,
                    ]}
                  >
                    <View style={styles.timeCardLeft}>
                      <View style={[
                        styles.timeIcon,
                        timeOption === 'later' && styles.timeIconActive,
                      ]}>
                        <Ionicons 
                          name="calendar-outline" 
                          size={24} 
                          color={timeOption === 'later' ? COLORS.accent : COLORS.textSecondary} 
                        />
                      </View>
                      <View>
                        <Text style={styles.timeTitle}>Planifier</Text>
                        <Text style={styles.timeDesc}>Choisir une date et heure</Text>
                      </View>
                    </View>
                    {timeOption === 'later' && (
                      <View style={styles.timeCheck}>
                        <Ionicons name="checkmark-circle" size={28} color={COLORS.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* 🆕 STEP 4: Payment Method */}
              {step === 4 && (
                <View>
                  <Text style={styles.stepQuestion}>Mode de paiement</Text>

                  <TouchableOpacity
                    onPress={() => setShowPaymentSheet(true)}
                    style={styles.selectPaymentBtn}
                  >
                    <View style={styles.selectPaymentLeft}>
                      <Ionicons 
                        name={paymentMethod === 'card' ? 'card-outline' : paymentMethod === 'wallet' ? 'wallet-outline' : 'add-circle-outline'} 
                        size={24} 
                        color={paymentMethod ? COLORS.accent : COLORS.textSecondary} 
                      />
                      <Text style={styles.selectPaymentText}>
                        {paymentMethod === 'card' 
                          ? 'Carte bancaire' 
                          : paymentMethod === 'wallet' 
                          ? 'Portefeuille' 
                          : 'Choisir un moyen de paiement'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>

                  {paymentMethod && (
                    <View style={styles.paymentInfo}>
                      <Ionicons name="information-circle" size={18} color={COLORS.accent} />
                      <Text style={styles.paymentInfoText}>
                        {paymentMethod === 'card' 
                          ? 'Paiement sécurisé par Stripe' 
                          : 'Le montant sera débité de votre portefeuille'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 5: Confirmation */}
              {step === 5 && (
                <View>
                  <Text style={styles.stepQuestion}>Récapitulatif</Text>

                  <View style={styles.summary}>
                    {/* Service */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryIconContainer}>
                        <Ionicons name="construct-outline" size={22} color={COLORS.accent} />
                      </View>
                      <View style={styles.summaryInfo}>
                        <Text style={styles.summaryLabel}>SERVICE</Text>
                        <Text style={styles.summaryValue}>
                          {selectedSubcategory?.name || selectedCategory?.name || '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Location */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryIconContainer}>
                        <Ionicons name="location-outline" size={22} color={COLORS.accent} />
                      </View>
                      <View style={styles.summaryInfo}>
                        <Text style={styles.summaryLabel}>ADRESSE</Text>
                        <Text style={styles.summaryValue} numberOfLines={2}>
                          {location?.address || '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Time */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryIconContainer}>
                        <Ionicons
                          name={timeOption === 'now' ? 'flash' : 'calendar-outline'}
                          size={22}
                          color={COLORS.accent}
                        />
                      </View>
                      <View style={styles.summaryInfo}>
                        <Text style={styles.summaryLabel}>QUAND</Text>
                        <Text style={styles.summaryValue}>
                          {timeOption === 'now' ? 'Maintenant (Urgent)' : 'Planifié'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Payment */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryIconContainer}>
                        <Ionicons 
                          name={paymentMethod === 'card' ? 'card-outline' : 'wallet-outline'} 
                          size={22} 
                          color={COLORS.accent} 
                        />
                      </View>
                      <View style={styles.summaryInfo}>
                        <Text style={styles.summaryLabel}>PAIEMENT</Text>
                        <Text style={styles.summaryValue}>
                          {paymentMethod === 'card' ? 'Carte bancaire' : 'Portefeuille'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceDivider} />

                    {/* Price */}
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Total estimé</Text>
                      <View style={styles.priceValueContainer}>
                        <Text style={styles.priceValue}>
                          {estimatedPrice?.finalTotal || selectedCategory?.price || 0}
                        </Text>
                        <Text style={styles.priceCurrency}>€</Text>
                      </View>
                    </View>

                    {timeOption === 'now' && (
                      <View style={styles.notice}>
                        <Ionicons name="information-circle" size={16} color={COLORS.warning} />
                        <Text style={styles.noticeText}>
                          Tarif majoré de 50% pour service immédiat
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Security badge */}
                  <View style={styles.security}>
                    <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
                    <Text style={styles.securityText}>Paiement 100% sécurisé</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Footer button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={step === STEP_COUNT ? handleSubmit : handleNext}
              disabled={mainButtonDisabled}
              activeOpacity={0.9}
              style={styles.mainBtn}
            >
              <LinearGradient
                colors={
                  mainButtonDisabled
                    ? [COLORS.border, '#D1D1D6']
                    : [COLORS.accent, COLORS.accentLight]
                }
                style={styles.mainBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.mainBtnText,
                        mainButtonDisabled && styles.mainBtnTextDisabled,
                      ]}
                    >
                      {step === STEP_COUNT ? 'Confirmer et payer' : 'Continuer'}
                    </Text>
                    {!loading && (
                      <Ionicons
                        name={step === STEP_COUNT ? 'checkmark-circle' : 'arrow-forward'}
                        size={20}
                        color={mainButtonDisabled ? COLORS.textTertiary : '#FFF'}
                      />
                    )}
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  stepCounter: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    width: 44,
    textAlign: 'right',
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  content: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  stepQuestion: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 24,
    letterSpacing: -0.5,
  },

  // 🆕 Category Cards - Modern Design
  categoryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  categoryCardActive: {
    borderColor: COLORS.accent,
    shadowOpacity: 0.12,
    backgroundColor: '#FFF',
  },
  categoryCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: {
    backgroundColor: '#FEF3F2',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  categoryDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  categoryCardRight: {
    alignItems: 'flex-end',
  },
  categoryPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  categoryPriceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },

  // 🆕 Subcategories
  subcategoriesContainer: {
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  subcategoriesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  subcategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subcategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subcategoryChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  subcategoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subcategoryChipTextActive: {
    color: '#FFF',
  },
  subcategoryPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Description
  descBox: {
    marginTop: 24,
  },
  descLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    fontWeight: '600',
  },
  descInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: 8,
  },

  // 🆕 Time Cards
  timeCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  timeCardActive: {
    borderColor: COLORS.accent,
    shadowOpacity: 0.12,
  },
  timeCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeIconActive: {
    backgroundColor: '#FEF3F2',
  },
  timeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  timeDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  timeCheck: {
    marginLeft: 12,
  },
  urgentPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  urgentText: {
    fontSize: 11,
    color: COLORS.warning,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // 🆕 Payment Selection
  selectPaymentBtn: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  selectPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  selectPaymentText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    gap: 10,
  },
  paymentInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '500',
    lineHeight: 18,
  },

  // 🆕 Payment Sheet Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  paymentSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.75,
  },
  sheetHeader: {
    padding: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  sheetClose: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    flex: 1,
    padding: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#FEF3F2',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  paymentOptionDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  paymentCheck: {
    marginLeft: 12,
  },
  sheetFooter: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmPaymentBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmPaymentBtnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
  },
  confirmPaymentBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  confirmPaymentBtnTextDisabled: {
    color: COLORS.textTertiary,
  },

  // Summary
  summary: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },
  priceDivider: {
    height: 2,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  priceValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  priceCurrency: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 14,
    marginTop: 18,
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: '500',
    lineHeight: 18,
  },
  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  securityText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: COLORS.background,
  },
  mainBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  mainBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  mainBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  mainBtnTextDisabled: {
    color: COLORS.textTertiary,
  },

  // Map
  mapContainer: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  autocomplete: {
    flex: 0,
  },
  searchInput: {
    backgroundColor: COLORS.cardBg,
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 52,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchList: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchIcon: {
    position: 'absolute',
    left: 18,
    top: 17,
    zIndex: 10,
  },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  confirmBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: -0.2,
  },
});