import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

type MissionStatus = 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE' | 'CANCELLED';

type Mission = {
  id: string;
  title: string;
  description: string;
  price: number;
  status: MissionStatus;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  createdAt?: string;
};

export default function Missions() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const loadMissions = async () => {
    try {
      setError(null);
      const response = await api.requests.list();
      setMissions(response.data ?? []);
    } catch (e) {
      console.error(e);
      setError('Erreur de chargement des missions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMissions();
  };

  const handleMissionPress = async (missionId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const details = await api.requests.get(missionId);
      setSelectedMission(details);
    } catch (error) {
      console.error('Error loading mission details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const getStatusColor = (status: MissionStatus) => {
    const colors: Record<MissionStatus, string> = {
      PUBLISHED: '#F59E0B',
      ACCEPTED: '#172247',
      ONGOING: '#16A34A',
      DONE: '#10B981',
      CANCELLED: '#EF4444',
    };
    return colors[status] || '#9AA0A6';
  };

  const getStatusLabel = (status: MissionStatus) => {
    const labels: Record<MissionStatus, string> = {
      PUBLISHED: 'Publié',
      ACCEPTED: 'Accepté',
      ONGOING: 'En cours',
      DONE: 'Terminé',
      CANCELLED: 'Annulé',
    };
    return labels[status] || status;
  };

  const renderMission = ({ item }: { item: Mission }) => (
    <TouchableOpacity
      style={styles.missionCard}
      onPress={() => handleMissionPress(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.missionTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.missionDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.location?.address ?? 'Adresse inconnue'}
          </Text>
        </View>
        <Text style={styles.priceText}>{item.price}€</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#172247" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Missions</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/new-request')}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMissions}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={missions}
        renderItem={renderMission}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#172247']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#E5E7EB" />
            <Text style={styles.emptyText}>Aucune mission disponible</Text>
          </View>
        }
      />

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color="#172247" style={{ marginTop: 40 }} />
          ) : selectedMission ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{selectedMission.title}</Text>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Description</Text>
                <Text style={styles.sheetValue}>{selectedMission.description}</Text>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(selectedMission.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusLabel(selectedMission.status)}</Text>
                </View>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Prix</Text>
                <Text style={styles.sheetPriceValue}>{selectedMission.price}€</Text>
              </View>

              {selectedMission.location?.address && (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetLabel}>Localisation</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={18} color="#172247" />
                    <Text style={styles.sheetValue}>{selectedMission.location.address}</Text>
                  </View>
                </View>
              )}

              {selectedMission.createdAt && (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetLabel}>Date de création</Text>
                  <Text style={styles.sheetValue}>
                    {new Date(selectedMission.createdAt).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.viewFullButton}
                onPress={() => {
                  bottomSheetRef.current?.close();
                  router.push({ pathname: '/request/[id]', params: { id: selectedMission.id } });
                }}
              >
                <Text style={styles.viewFullText}>Voir la page complète</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#172247',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  missionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  missionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  missionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#172247',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  sheetSection: {
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sheetValue: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    marginLeft: 4,
  },
  sheetPriceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#172247',
  },
  viewFullButton: {
    flexDirection: 'row',
    backgroundColor: '#172247',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  viewFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
