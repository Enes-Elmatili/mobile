import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RequestSearchingViewProps {
  estimatedPrice: string;
  serviceType: string;
  onCancel: () => void;
}

export function RequestSearchingView({
  estimatedPrice,
  serviceType,
  onCancel
}: RequestSearchingViewProps) {
  // Animation rotation pour l'icône de recherche
  const spinValue = useRef(new Animated.Value(0)).current;
  
  // Animation pulse pour le badge "EN RECHERCHE"
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animation rotation continue
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Animation pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Barre de drag */}
      <View style={styles.dragIndicator} />

      {/* Icône animée */}
      <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
        <Ionicons name="search" size={40} color="#fff" />
      </Animated.View>

      {/* Titre */}
      <Text style={styles.title}>Recherche en cours...</Text>
      <Text style={styles.subtitle}>
        Nous recherchons le meilleur prestataire pour votre {serviceType.toLowerCase()}
      </Text>

      {/* Badge "EN RECHERCHE" avec pulse */}
      <Animated.View style={[styles.searchingBadge, { transform: [{ scale: pulseValue }] }]}>
        <View style={styles.pulseDot} />
        <Text style={styles.searchingText}>EN RECHERCHE</Text>
      </Animated.View>

      {/* Infos prix */}
      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Prix estimé</Text>
        <Text style={styles.priceValue}>{estimatedPrice}€</Text>
      </View>

      {/* Points animés (Style "Connecting...") */}
      <View style={styles.dotsContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={300} />
        <AnimatedDot delay={600} />
      </View>

      {/* Informations */}
      <View style={styles.infoBox}>
        <Ionicons name="time-outline" size={20} color="#545454" />
        <Text style={styles.infoText}>
          Vous recevrez une notification dès qu'un prestataire accepte votre demande
        </Text>
      </View>

      {/* Bouton annuler */}
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Annuler la recherche</Text>
      </TouchableOpacity>
    </View>
  );
}

// Composant pour les dots animés
function AnimatedDot({ delay }: { delay: number }) {
  const opacityValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.dot, { opacity: opacityValue }]} />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#545454',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    backgroundColor: '#FF6B00',
    borderRadius: 4,
  },
  searchingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  priceContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 16,
    color: '#545454',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#545454',
    lineHeight: 20,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CC0000',
  },
});
