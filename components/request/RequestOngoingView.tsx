/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Définition des props (basée sur votre fichier original)
interface Provider {
  name: string;
  avatar?: string;
  rating: number;
  vehicle: string;
  licensePlate: string;
}

interface RequestOngoingViewProps {
  provider: Provider;
  eta: string;      // ex: "5 min"
  statusLabel?: string; // ex: "En route vers vous"
  onContactProvider: () => void;
}

export function RequestOngoingView({ 
  provider, 
  eta, 
  statusLabel = "Le prestataire est en route",
  onContactProvider 
}: RequestOngoingViewProps) {
  
  return (
    <View style={styles.container}>
      {/* Barre de drag (indicateur visuel) */}
      <View style={styles.dragIndicator} />

      {/* En-tête : Temps et Statut */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.etaText}>{eta}</Text>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Carte Prestataire (Style "Fiche Uber") */}
      <View style={styles.driverCard}>
        {/* Infos Prestataire */}
        <View style={styles.vehicleInfo}>
          <Image 
            source={{ uri: provider.avatar || 'https://i.pravatar.cc/150?u=a042581f4e29026024d' }} 
            style={styles.avatar} 
          />
          <View style={styles.driverTextContainer}>
            <Text style={styles.driverName}>{provider.name}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text>
              <Ionicons name="star" size={12} color="#000" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>

        {/* Infos Véhicule / Service */}
        <View style={styles.carSection}>
          {/* Icône générique si pas d'image de voiture */}
          <Ionicons name="car-sport" size={36} color="#E0E0E0" />
          <Text style={styles.vehicleName}>{provider.vehicle}</Text>
          <View style={styles.plateContainer}>
            <Text style={styles.licensePlate}>{provider.licensePlate}</Text>
          </View>
        </View>
      </View>

      {/* Actions (Boutons ronds/gris comme Uber) */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.contactButton} onPress={onContactProvider}>
          <Ionicons name="call" size={20} color="#000" />
          <Text style={styles.contactButtonText}>Contacter</Text>
        </TouchableOpacity>
        
        {/* Bouton Annuler discret */}
        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40, // Espace pour la barre de navigation iPhone
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  etaText: {
    fontSize: 32, // Très gros comme Uber
    fontWeight: '700', // Gras
    color: '#000',
    letterSpacing: -0.5,
  },
  statusText: {
    fontSize: 16,
    color: '#545454',
    marginTop: 4,
    fontWeight: '500',
  },
  liveBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  driverCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 10,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
  },
  driverTextContainer: {
    marginLeft: 16,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  carSection: {
    alignItems: 'flex-end',
  },
  vehicleName: {
    fontSize: 12,
    color: '#757575',
    marginTop: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  plateContainer: {
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  licensePlate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'monospace', // Look plaque immatriculation
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EEEEEE',
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    flex: 0.4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CC0000',
  },
});
