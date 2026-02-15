import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSocket } from '@/lib/SocketContext';

const { width, height } = Dimensions.get('window');

// Dark map style (like Uber)
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];

export default function RequestOngoingView() {
  const { id: requestId } = useLocalSearchParams();
  const router = useRouter();
  const { socket } = useSocket();

  const [eta, setEta] = useState('5 min');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Mock data - Replace with real data
  const provider = {
    name: 'Marc Dubois',
    avatar: 'https://i.pravatar.cc/150?img=12',
    rating: 4.9,
    totalRides: 1247,
    phone: '+32 456 78 90 12',
    vehicle: 'Mercedes Sprinter',
    plate: '1-ABC-123',
  };

  const pickup = { latitude: 50.8503, longitude: 4.3517 };
  const destination = { latitude: 50.8320, longitude: 4.3700 };

  useEffect(() => {
    // Slide up animation
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for ETA
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleComplete = () => {
    if (socket) {
      socket.emit('request:complete', { requestId });
      router.push(`/request/${requestId}/rating`);
    }
  };

  const handleCall = () => {
    // Implement call functionality
  };

  const handleMessage = () => {
    // Implement messaging
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: 50.8503,
          longitude: 4.3517,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        <Marker coordinate={pickup} title="Prise en charge">
          <View style={styles.customMarker}>
            <View style={styles.markerDot} />
          </View>
        </Marker>
        <Marker coordinate={destination} title="Destination">
          <View style={styles.customMarkerDest}>
            <Ionicons name="location" size={32} color="#FF3B30" />
          </View>
        </Marker>
      </MapView>

      {/* Top ETA Card */}
      <Animated.View
        style={[
          styles.etaCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim.interpolate({
              inputRange: [0, 300],
              outputRange: [0, -100],
            })}],
          },
        ]}
      >
        <BlurView intensity={80} style={styles.etaBlur}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={styles.etaTime}>{eta}</Text>
          </Animated.View>
          <Text style={styles.etaLabel}>Arrivée estimée</Text>
          <View style={styles.etaIndicator}>
            <View style={styles.etaIndicatorDot} />
            <Text style={styles.etaIndicatorText}>En route</Text>
          </View>
        </BlurView>
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8F8F8']}
          style={styles.sheetGradient}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Provider Info */}
          <View style={styles.providerSection}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: provider.avatar }}
                style={styles.avatar}
              />
              <View style={styles.onlineBadge} />
            </View>

            {/* Info */}
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#FFD60A" />
                <Text style={styles.ratingText}>
                  {provider.rating} • {provider.totalRides} courses
                </Text>
              </View>
              <Text style={styles.vehicleText}>
                {provider.vehicle} • {provider.plate}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMessage}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#F5F5F5', '#ECECEC']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="chatbubble" size={20} color="#000" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#34C759', '#2FB84A']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="call" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Separator */}
          <View style={styles.separator} />

          {/* Trip Details */}
          <View style={styles.tripDetails}>
            <View style={styles.tripRow}>
              <View style={styles.tripDot} />
              <View style={styles.tripInfo}>
                <Text style={styles.tripLabel}>Prise en charge</Text>
                <Text style={styles.tripAddress}>Rue de la Loi, 1000 Bruxelles</Text>
              </View>
            </View>

            <View style={styles.tripLine} />

            <View style={styles.tripRow}>
              <View style={[styles.tripDot, { backgroundColor: '#FF3B30' }]} />
              <View style={styles.tripInfo}>
                <Text style={styles.tripLabel}>Destination</Text>
                <Text style={styles.tripAddress}>Avenue Louise, 1050 Ixelles</Text>
              </View>
            </View>
          </View>

          {/* Complete Button */}
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleComplete}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#000000', '#1A1A1A']}
              style={styles.completeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.completeText}>Marquer comme terminé</Text>
              <Ionicons name="checkmark-circle" size={22} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  customMarkerDest: {
    alignItems: 'center',
  },
  etaCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  etaBlur: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  etaTime: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -1,
  },
  etaLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  etaIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  etaIndicatorText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetGradient: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  providerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34C759',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  vehicleText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionGradient: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginBottom: 24,
  },
  tripDetails: {
    marginBottom: 24,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    marginTop: 4,
    marginRight: 16,
  },
  tripLine: {
    width: 2,
    height: 32,
    backgroundColor: '#E5E5E5',
    marginLeft: 5,
    marginVertical: 8,
  },
  tripInfo: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tripAddress: {
    fontSize: 15,
    color: '#000',
    fontWeight: '600',
  },
  completeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  completeText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});