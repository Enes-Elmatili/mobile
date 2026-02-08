import React, { useEffect, useRef } from 'react';
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
import { useSocket } from '@/lib/SocketContext'; // ✅ This works

interface RequestSearchingViewProps {
  requestId: string; // From parent
  userId: string; // From parent (no AuthContext needed)
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
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Spin animation
    spinValue.addListener(({ value }) => {
      // Continuous spin
    });
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();

    // Pulse badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Socket listeners for real-time
    if (socket && isConnected) {
      socket.emit('provider:search', { requestId, userId, serviceType, estimatedPrice });

      const onProviderAccepted = (data: any) => {
        if (data.requestId === requestId) {
          Alert.alert('Prestataire trouvé !', 'Redirection...');
          router.push(`/request/${requestId}/ongoing`);
        }
      };

      socket.on('provider:accepted', onProviderAccepted);
      return () => socket.off('provider:accepted', onProviderAccepted);
    }
  }, [socket, isConnected, requestId, userId]);

  const handleCancel = () => {
    socket?.emit('request:cancel', { requestId, userId });
    onCancel();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const safeServiceType = serviceType || 'service';

  return (
    <View style={styles.container}>
      <View style={styles.dragIndicator} />
      
      <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
        <Ionicons name="search" size={40} color="#fff" />
      </Animated.View>

      <Text style={styles.title}>Recherche en cours...</Text>
      <Text style={styles.subtitle}>
        Meilleur prestataire pour {safeServiceType.toLowerCase()}
      </Text>

      <Animated.View style={[styles.searchingBadge, { transform: [{ scale: pulseValue }] }]}>
        <Text style={styles.badgeText}>🔍 Recherche active</Text>
      </Animated.View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelText}>Annuler</Text>
      </TouchableOpacity>

      {!isConnected && (
        <Text style={styles.connectionStatus}>Vérifiez votre connexion</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  searchingBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 40,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  connectionStatus: {
    position: 'absolute',
    bottom: 20,
    color: '#FF3B30',
    fontSize: 14,
  },
});
