/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Définition de la Mission (adaptée de votre code)
interface Mission {
  id: string;
  serviceType: string; // ex: "Ménage", "UberX"
  price: string;       // ex: "25.50"
  rating: number;      // ex: 4.8
  etaDistance: string; // ex: "8 min • 2.5 km"
  pickup: string;      // Adresse départ
  destination?: string; // Adresse arrivée (optionnelle pour certains services)
}

interface ProviderMissionCardProps {
  mission: Mission;
  onAccept: (missionId: string) => void;
  onDecline: (missionId: string) => void;
}

export function ProviderMissionCard({ mission, onAccept, onDecline }: ProviderMissionCardProps) {
  return (
    <View style={styles.container}>
      {/* HEADER: PRIX & TEMPS */}
      <View style={styles.header}>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{mission.price}€</Text>
        </View>
        <View style={styles.etaContainer}>
          <Text style={styles.etaText}>{mission.etaDistance}</Text>
        </View>
      </View>

      {/* SERVICE & NOTE */}
      <View style={styles.subHeader}>
        <Text style={styles.serviceType}>{mission.serviceType}</Text>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{mission.rating.toFixed(1)}</Text>
          <Ionicons name="star" size={12} color="#000" style={{marginLeft: 2}} />
        </View>
      </View>

      <View style={styles.divider} />

      {/* TRAJET (Pickup -> Destination) */}
      <View style={styles.tripContainer}>
        {/* Ligne verticale */}
        <View style={styles.timeline}>
          <View style={styles.dotPickup} />
          {mission.destination && <View style={styles.line} />}
          {mission.destination && <View style={styles.squareDest} />}
        </View>

        <View style={styles.addresses}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Prise en charge</Text>
            <Text style={styles.addressText} numberOfLines={1}>{mission.pickup}</Text>
          </View>
          
          {mission.destination && (
            <View style={[styles.addressBlock, { marginTop: 20 }]}>
              <Text style={styles.addressLabel}>Destination</Text>
              <Text style={styles.addressText} numberOfLines={1}>{mission.destination}</Text>
            </View>
          )}
        </View>
      </View>

      {/* BOUTON D'ACTION FLASH */}
      <View style={styles.actionButtonContainer}>
        {/* Bouton Refuser (Rond, croix) */}
        <TouchableOpacity style={styles.declineButton} onPress={() => onDecline(mission.id)}>
          <Ionicons name="close" size={30} color="#000" />
        </TouchableOpacity>

        {/* Bouton Accepter (Gros, animé style Uber) */}
        <TouchableOpacity style={styles.acceptButton} onPress={() => onAccept(mission.id)}>
          <Text style={styles.acceptTitle}>Accepter</Text>
          <Text style={styles.acceptSubtitle}>{mission.serviceType}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceTag: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  etaContainer: {
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  etaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  serviceType: {
    fontSize: 18,
    color: '#545454',
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  tripContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timeline: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 4,
  },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  squareDest: {
    width: 10,
    height: 10,
    backgroundColor: '#000', // Carré pour destination
  },
  addresses: {
    flex: 1,
  },
  addressBlock: {},
  addressLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  actionButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  declineButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F3F3', // Gris clair
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    flex: 1,
    height: 60,
    backgroundColor: '#27AE60', // Vert Uber Driver
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  acceptSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
});
