import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export function RequestCompletedView({ 
  finalPrice, 
  onRate 
}: { 
  finalPrice: number; 
  onRate: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const priceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Staggered entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(priceAnim, {
          toValue: finalPrice,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const handleRate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRate();
  };

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated Success Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Glow effect */}
        <Animated.View
          style={[
            styles.glowCircle,
            {
              opacity: glowOpacity,
            },
          ]}
        />
        
        <LinearGradient
          colors={['#34C759', '#30D158']}
          style={styles.checkmarkCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="checkmark" size={80} color="#FFF" />
        </LinearGradient>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        Mission terminée !
      </Animated.Text>

      {/* Subtitle */}
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        Paiement effectué avec succès
      </Animated.Text>

      {/* Price Card */}
      <Animated.View
        style={[
          styles.priceCardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <BlurView intensity={20} style={styles.priceCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
            style={styles.priceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.priceLabel}>Montant total</Text>
            
            <Animated.Text style={styles.priceValue}>
              {priceAnim.interpolate({
                inputRange: [0, finalPrice],
                outputRange: ['0', finalPrice.toString()],
              })}€
            </Animated.Text>

            {/* Breakdown */}
            <View style={styles.breakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Service</Text>
                <Text style={styles.breakdownValue}>{(finalPrice * 0.85).toFixed(2)}€</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Frais de service</Text>
                <Text style={styles.breakdownValue}>{(finalPrice * 0.15).toFixed(2)}€</Text>
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.paymentMethod}>
              <Ionicons name="card" size={20} color="#999" />
              <Text style={styles.paymentText}>•••• 4242</Text>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.successText}>Payé</Text>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>

      {/* Features Grid */}
      <Animated.View
        style={[
          styles.featuresGrid,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <BlurView intensity={15} style={styles.featureCard}>
          <Ionicons name="shield-checkmark" size={24} color="#34C759" />
          <Text style={styles.featureText}>Paiement sécurisé</Text>
        </BlurView>

        <BlurView intensity={15} style={styles.featureCard}>
          <Ionicons name="document-text" size={24} color="#007AFF" />
          <Text style={styles.featureText}>Facture envoyée</Text>
        </BlurView>

        <BlurView intensity={15} style={styles.featureCard}>
          <Ionicons name="star" size={24} color="#FFD60A" />
          <Text style={styles.featureText}>Donnez votre avis</Text>
        </BlurView>
      </Animated.View>

      {/* Rate Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleRate}
          activeOpacity={0.9}
          style={styles.rateButton}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F5F5F5']}
            style={styles.rateGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="star" size={22} color="#000" />
            <Text style={styles.rateText}>Noter la prestation</Text>
            <Ionicons name="arrow-forward" size={20} color="#000" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton}>
          <Text style={styles.skipText}>Plus tard</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  checkmarkCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 48,
    fontWeight: '500',
    textAlign: 'center',
  },
  priceCardContainer: {
    width: '100%',
    marginBottom: 32,
  },
  priceCard: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  priceGradient: {
    padding: 28,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    marginBottom: 24,
  },
  breakdown: {
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 8,
  },
  paymentText: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  successText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '700',
  },
  featuresGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  featureText: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
  },
  rateButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  rateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  rateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});