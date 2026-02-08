import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useSocket } from '@/lib/SocketContext';

export default function RequestOngoingView() {
  const { id: requestId } = useLocalSearchParams();
  const router = useRouter();
  const { socket } = useSocket();

  // Mock data
  const request = {
    provider: { name: 'John Doe', avatar: '' },
    // Correction : Utilisation des clés attendues par react-native-maps (latitude/longitude)
    pickup: { latitude: 50.8503, longitude: 4.3517 }, 
    destination: { latitude: 50.8320, longitude: 4.3700 },
    status: 'ongoing',
  };

  const handleComplete = () => {
    // Correction TS 18047 : Vérification que le socket n'est pas null avant l'émission
    if (socket) {
      socket.emit('request:complete', { requestId });
      router.push(`/request/${requestId}/rating`);
    } else {
      console.warn("Socket non connecté");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 50.8503,
          longitude: 4.3517,
          latitudeDelta: 0.05, // Augmenté un peu pour voir les deux points
          longitudeDelta: 0.05,
        }}
      >
        {/* Les coordonnées sont maintenant valides pour le type LatLng */}
        <Marker coordinate={request.pickup} title="Prise en charge" pinColor="green" />
        <Marker coordinate={request.destination} title="Destination" pinColor="red" />
      </MapView>

      <View style={styles.bottomSheet}>
        <View style={styles.providerInfo}>
          <View>
            <Text style={styles.providerName}>{request.provider.name}</Text>
            <Text style={styles.status}>En route • ETA 5 min</Text>
          </View>
          
          <TouchableOpacity style={styles.chatButtonSmall}>
            <Ionicons name="chatbubble" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
          <Text style={styles.completeText}>Marquer comme terminé</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25, // Gestion de la zone sûre
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  providerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  providerName: { fontSize: 20, fontWeight: 'bold' },
  status: { color: '#666', fontSize: 14, marginTop: 4 },
  chatButtonSmall: {
    padding: 10,
    backgroundColor: '#F0F7FF',
    borderRadius: 50,
  },
  completeButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  completeText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});