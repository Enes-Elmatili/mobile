import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSocket } from '@/lib/SocketContext';

const { width, height } = Dimensions.get('window');

interface RequestSearchingViewProps {
  requestId: string;
  userId: string;
  estimatedPrice?: number;
  serviceType?: string;
  onCancel: () => void;
}

export function RequestSearchingView({
  requestId,
  userId,
  estimatedPrice,
  serviceType = 'service',
  onCancel,
}: RequestSearchingViewProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous ripple effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Loading dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotsAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(dotsAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Socket listeners
    if (socket && isConnected) {
      socket.emit('provider:search', { requestId, userId, serviceType, estimatedPrice });

      const onProviderAccepted = (data: any) => {
        if (data.requestId === requestId) {
          router.push(`/request/${requestId}/ongoing`);
        }
      };

      socket.on('provider:accepted', onProviderAccepted);
      return () => socket.off('provider:accepted', onProviderAccepted);
    }
  }, [socket, isConnected, requestId, userId]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.2, 0],
  });

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Ripple circles */}
        <View style={styles.rippleContainer}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.ripple,
                {
                  transform: [
                    {
                      scale: rippleScale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1 + index * 0.3, 2.5 + index * 0.3],
                      }),
                    },
                  ],
                  opacity: rippleOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3 - index * 0.1, 0],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* Center icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#E8E8E8']}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="car-sport" size={48} color="#000" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Recherche en cours</Text>
        
        {/* Animated dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: dotsAnim.interpolate({
                    inputRange: [0, 0.33, 0.66, 1],
                    outputRange: index === 0 
                      ? [0.3, 1, 0.3, 0.3]
                      : index === 1
                      ? [0.3, 0.3, 1, 0.3]
                      : [0.3, 0.3, 0.3, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Connexion avec le meilleur professionnel
        </Text>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <BlurView intensity={20} style={styles.statCard}>
            <Ionicons name="speedometer" size={20} color="#FFFFFF" />
            <Text style={styles.statLabel}>Temps estimé</Text>
            <Text style={styles.statValue}>~2 min</Text>
          </BlurView>

          <BlurView intensity={20} style={styles.statCard}>
            <Ionicons name="people" size={20} color="#FFFFFF" />
            <Text style={styles.statLabel}>Pros disponibles</Text>
            <Text style={styles.statValue}>12+</Text>
          </BlurView>
        </View>

        {/* Price Display */}
        {estimatedPrice && (
          <BlurView intensity={30} style={styles.priceCard}>
            <Text style={styles.priceLabel}>Prix estimé</Text>
            <Text style={styles.priceValue}>{estimatedPrice}€</Text>
          </BlurView>
        )}

        {/* Connection status */}
        {!isConnected && (
          <BlurView intensity={20} style={styles.warningBadge}>
            <Ionicons name="warning" size={16} color="#FFD60A" />
            <Text style={styles.warningText}>Reconnexion en cours...</Text>
          </BlurView>
        )}
      </Animated.View>

      {/* Cancel Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <BlurView intensity={30} style={styles.cancelBlur}>
            <Ionicons name="close-circle" size={20} color="#FF3B30" />
            <Text style={styles.cancelText}>Annuler la recherche</Text>
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  rippleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  iconContainer: {
    marginBottom: 40,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 50,
    textAlign: 'center',
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 30,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1,
  },
  priceValue: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -1,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
    overflow: 'hidden',
  },
  warningText: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 30,
    right: 30,
  },
  cancelButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cancelBlur: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});