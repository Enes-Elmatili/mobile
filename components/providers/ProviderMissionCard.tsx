import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Mission { 
  id: string;
  serviceType: string;
  price: string;
  rating: number;
  etaDistance: string;
  pickup: string;
}

interface ProviderMissionCardProps {
  mission: Mission;
  onAccept: (missionId: string) => void;
  onDecline: (missionId: string) => void;
}

export function ProviderMissionCard({ mission, onAccept, onDecline }: ProviderMissionCardProps) {
  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>👤 {mission.serviceType}</Text>
        </View>
        <TouchableOpacity onPress={() => onDecline(mission.id)} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Price */}
      <View style={styles.priceSection}>
        <Text style={styles.priceText}>{mission.price}€</Text>
        <Ionicons name="flash" size={24} color="black" />
      </View>

      {/* Info Row */}
      <View style={styles.infoRow}>
        <View style={styles.ratingBox}>
          <Ionicons name="star" size={16} color="black" />
          <Text style={styles.ratingText}>{mission.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.etaText}>à {mission.etaDistance}</Text>
      </View>

      {/* Address */}
      <View style={styles.addressSection}>
        <View style={styles.markerLine}>
          <View style={styles.dot} />
        </View>
        <Text style={styles.addressText} numberOfLines={1}>{mission.pickup}</Text>
      </View>

      {/* Accept Button */}
      <TouchableOpacity 
        style={styles.acceptBtn} 
        onPress={() => onAccept(mission.id)}
      >
        <Text style={styles.acceptBtnText}>Accepter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: '#F3F3F3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontWeight: 'bold', fontSize: 14 },
  closeBtn: { padding: 5 },
  priceSection: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  priceText: { fontSize: 42, fontWeight: 'bold', marginRight: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
  ratingText: { fontWeight: 'bold', marginLeft: 4 },
  etaText: { color: '#666' },
  addressSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  markerLine: { width: 20, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'black' },
  addressText: { fontSize: 16, color: '#333', flex: 1 },
  acceptBtn: { backgroundColor: 'black', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  acceptBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});