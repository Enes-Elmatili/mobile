import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RequestCompletedViewProps {
  finalPrice: string;
  onClose: () => void;
}

export function RequestCompletedView({ finalPrice, onClose }: RequestCompletedViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark" size={40} color="#fff" />
      </View>
      
      <Text style={styles.title}>Service terminé</Text>
      <Text style={styles.subtitle}>Merci d'avoir utilisé notre service</Text>

      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Total</Text>
        <Text style={styles.priceValue}>{finalPrice}€</Text>
      </View>

      <TouchableOpacity style={styles.mainButton} onPress={onClose}>
        <Text style={styles.buttonText}>Noter le prestataire</Text>
      </TouchableOpacity>
    </View>
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
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#27AE60', // Vert succès Uber/UberEats
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
  },
  subtitle: {
    fontSize: 16,
    color: '#545454',
    marginBottom: 32,
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
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 18,
    color: '#000',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  mainButton: {
    width: '100%',
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
