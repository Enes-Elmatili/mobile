// RequestSearchingView.tsx COMPLET avec Socket + Flow auto
import React, { useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SocketContext } from '@/lib/SocketContext'; // Ton SocketContext
import { AuthContext } from '@/contexts/AuthContext'; // Ton AuthContext

interface RequestSearchingViewProps {
  request?: any;
  estimatedPrice?: string | number;
  serviceType?: string;
  onCancel: () => void;
}

export function RequestSearchingView({
  request,
  estimatedPrice,
  serviceType,
  onCancel,
}: RequestSearchingViewProps) {
  const router = useRouter();
  const { socket, isConnected } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  const safeServiceType = serviceType || request?.serviceType || request?.category?.name || 'service';
  const safePrice = estimatedPrice || request?.estimatedPrice || request?.price || '0';

  // ✅ ANIMATION
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence(
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ✅ SOCKET LISTENER : Transition auto quand provider accepte
  useEffect(() => {
    if (!socket || !isConnected || !request?.id || !user?.id) return;

    console.log('🔍 [SEARCHING] Listening provider_accepted pour request', request.id);

    // Join channel client
    socket.emit('client:join_request', { 
      clientId: user.id, 
      requestId: request.id 
    });

    const handleProviderAccepted = (data: {
      requestId: string;
      provider: { id: string; name: string; rating: number; phone?: string };
      status: string;
    }) => {
      if (data.requestId === request.id.toString()) {
        console.log('🎉 PROVIDER ACCEPTÉ:', data.provider.name);
        
        Alert.alert(
          '✅ Mission acceptée !',
          `${data.provider.name} (${data.provider.rating?.toFixed(1) || 'N/A'}⭐) arrive bientôt`,
          [
            {
              text: 'OK',
              onPress: () => {
                // ✅ NAVIGATION AUTO VERS ONGOING
                router.push({
                  pathname: '/request/ongoing',
                  params: { 
                    requestId: request.id,
                    providerName: data.provider.name,
                    providerRating: data.provider.rating?.toString() || '0',
                    providerId: data.provider.id
                  }
                });
              }
            }
          ]
        );
      }
    };

    socket.on('provider_accepted', handleProviderAccepted);
    return () => socket.off('provider_accepted', handleProviderAccepted);
  }, [socket, isConnected, request?.id, user?.id, router]);

  // Polling fallback (toutes les 5s)
  useEffect(() => {
    if (!request?.id) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/requests/${request.id}`);
        const data = await res.json();
        if (data.data?.status === 'ACCEPTED') {
          router.push('/request/ongoing');
        }
      } catch (e) {
        console.log('Polling error:', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [request?.id, router]);

  return (
    <View style={styles.container}>
      <View style={styles.dragIndicator} />
      
      <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
        <Ionicons name="search" size={40} color="#fff" />
      </Animated.View>

      <Text style={styles.title}>Recherche en cours...</Text>
      <Text style={styles.subtitle}>
        Nous recherchons le meilleur prestataire pour votre{' '}
        {safeServiceType.toLowerCase()}
      </Text>

      <Animated.View style={[styles.searchingBadge, { transform: [{ scale: pulseValue }] }]}>
        <View style={styles.pulseDot} />
        <Text style={styles.searchingText}>EN RECHERCHE</Text>
      </Animated.View>

      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Prix estimé</Text>
        <Text style={styles.priceValue}>€{safePrice}</Text>
      </View>

      <View style={styles.dotsContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={300} />
        <AnimatedDot delay={600} />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="time-outline" size={20} color="#545454" />
        <Text style={styles.infoText}>
          Vous recevrez une notification dès qu'un prestataire accepte votre demande. 
          En général, cela prend moins de 2 minutes.
        </Text>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Annuler la recherche</Text>
      </TouchableOpacity>

      {/* Debug */}
      <View style={styles.debug}>
        <Text style={styles.debugText}>
          Socket: {isConnected ? '🟢' : '🔴'} | Request: {request?.id}
        </Text>
      </View>
    </View>
  );
}

function AnimatedDot({ delay }: { delay: number }) {
  const opacityValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence(
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
        })
      )
    ).start();
  }, [opacityValue, delay]);

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
    flex: 1,
    justifyContent: 'flex-start',
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
    fontSize: 19,
    fontWeight: '600',
    color: '#CC0000',
  },
  debug: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
