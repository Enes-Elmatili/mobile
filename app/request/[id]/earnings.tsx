// app/request/[id]/earnings.tsx
// Provider sees their earnings after mission completion

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';

export default function EarningsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);

  useEffect(() => {
    loadRequestDetails();
  }, [id]);

  const loadRequestDetails = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      setRequest(response.data || response);
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const basePrice = request?.price || 0;
  const platformFee = basePrice * 0.15; // 15% commission
  const earnings = basePrice - platformFee;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={64} color="#FFF" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Mission terminée !</Text>
        <Text style={styles.subtitle}>Votre paiement a été traité</Text>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsLabel}>Vos gains</Text>
            <Text style={styles.earningsAmount}>{earnings.toFixed(2)}€</Text>
          </View>

          <View style={styles.divider} />

          {/* Breakdown */}
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Prix de la mission</Text>
              <Text style={styles.breakdownValue}>{basePrice.toFixed(2)}€</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Commission plateforme (15%)</Text>
              <Text style={styles.breakdownValue}>-{platformFee.toFixed(2)}€</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{earnings.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Mission Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Détails de la mission</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="construct" size={20} color="#666" />
            <Text style={styles.detailText}>{request?.serviceType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#666" />
            <Text style={styles.detailText}>{request?.address}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person" size={20} color="#666" />
            <Text style={styles.detailText}>{request?.client?.name}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.detailText}>
              {new Date(request?.createdAt).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.paymentInfoText}>
            Le paiement sera versé sur votre compte bancaire sous 2-3 jours ouvrés
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/dashboard')}
        >
          <Text style={styles.primaryButtonText}>Retour au tableau de bord</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/dashboard')}
        >
          <Text style={styles.secondaryButtonText}>Voir mes gains totaux</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  successIcon: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  earningsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  earningsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 48,
    fontWeight: '900',
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  breakdown: {
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 15,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  detailsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#1E40AF',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
});