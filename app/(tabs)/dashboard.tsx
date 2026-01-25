/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import ProviderDashboard from '../../components/providers/ProviderDashboard';

interface DashboardData {
  me: {
    id: string;
    email: string;
    name?: string;
    city?: string;
    roles: string[];
  };
  stats: { activeRequests: number };
  requests: {
    id: string;
    title: string;
    status: string;
    description?: string;
    price?: number;
    createdAt: string;
  }[];
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<any>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  // 🆕 Vérifier si l'utilisateur est un prestataire
  const isProvider = user?.roles?.includes('PROVIDER');

  const loadDashboard = React.useCallback(async () => {
    try {
      console.log('📡 Loading dashboard...');
      const response = await api.request('/client/dashboard');
      console.log('✅ Dashboard data:', response);
      setData(response);
    } catch (error) {
      console.error('❌ Dashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Ne charger le dashboard client que si ce n'est pas un provider
      if (!isProvider) {
        loadDashboard();
      } else {
        setLoading(false);
      }
    }, [loadDashboard, isProvider])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleRequestPress = async (requestId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const details = await api.requests.get(requestId);
      setSelectedRequest(details);
    } catch (error) {
      console.error('Error loading request details:', error);
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

  // 🆕 Si prestataire, afficher le dashboard prestataire
  if (isProvider) {
    return <ProviderDashboard />;
  }

  // Dashboard CLIENT (code existant)
  if (loading || !data) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any }> = {
      DONE: { label: 'DONE', color: '#22C55E', icon: 'checkmark-circle' },
      CANCELLED: { label: 'CANCELLED', color: '#EF4444', icon: 'close-circle' },
      ONGOING: { label: 'EN COURS', color: '#3B82F6', icon: 'time' },
      PUBLISHED: { label: 'PUBLIÉ', color: '#F59E0B', icon: 'eye' },
      ACCEPTED: { label: 'ACCEPTÉ', color: '#8B5CF6', icon: 'hand-left' },
      PENDING_PAYMENT: { label: 'PAIEMENT', color: '#EC4899', icon: 'card' },
    };
    return statusMap[status] || { label: status, color: '#6B7280', icon: 'help-circle' };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#999" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{data.me.name || data.me.email.split('@')[0]}</Text>
              <Text style={styles.profileLocation}>{data.me.city || 'Bruxelles'}, Belgique</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.createTicketBtn} onPress={() => router.push('/new-request')}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.createTicketText}>Créer un ticket</Text>
          </TouchableOpacity>
        </View>

        {/* Historique Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={24} color="#000" />
            <Text style={styles.sectionTitle}>Historique</Text>
          </View>

          <View style={styles.historyCard}>
            {data.requests.length === 0 ? (
              <Text style={styles.emptyText}>Aucune requête récente</Text>
            ) : (
              data.requests.slice(0, 3).map((request, index) => {
                const statusInfo = getStatusInfo(request.status);
                return (
                  <TouchableOpacity
                    key={request.id}
                    style={[styles.historyItem, index < 2 && styles.historyItemBorder]}
                    onPress={() => handleRequestPress(request.id)}
                  >
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyTitle}>{request.title}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Ionicons name={statusInfo.icon} size={18} color={statusInfo.color} />
                      <Text style={[styles.historyStatus, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={24} color="#000" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={styles.notificationCard}>
            <Text style={styles.emptyNotification}>Aucune notification récente.</Text>
          </View>
        </View>
      </ScrollView>

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
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : selectedRequest ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{selectedRequest.title}</Text>
              
              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Description</Text>
                <Text style={styles.sheetValue}>
                  {selectedRequest.description || 'Aucune description'}
                </Text>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusInfo(selectedRequest.status).color }]}>
                  <Text style={styles.statusText}>{getStatusInfo(selectedRequest.status).label}</Text>
                </View>
              </View>

              {selectedRequest.price && (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetLabel}>Prix</Text>
                  <Text style={styles.sheetValue}>{selectedRequest.price}€</Text>
                </View>
              )}

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Date de création</Text>
                <Text style={styles.sheetValue}>
                  {new Date(selectedRequest.createdAt).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewFullButton}
                onPress={() => {
                  bottomSheetRef.current?.close();
                  router.push({ pathname: '/request/[id]', params: { id: selectedRequest.id } });
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
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 15,
    color: '#666',
  },
  createTicketBtn: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTicketText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyLeft: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    color: '#999',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyNotification: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
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
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  viewFullButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
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
