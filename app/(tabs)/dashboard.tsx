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
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import ProviderDashboard from '../../components/providers/ProviderDashboard';

const { width } = Dimensions.get('window');

interface DashboardData {
  me: {
    id: string;
    email: string;
    name?: string;
    city?: string;
    roles: string[];
  };
  stats: { 
    activeRequests: number;
    completedRequests: number;
    totalSpent: number;
  };
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
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  // --- CHARGEMENT DES DONNÉES ---
  const loadDashboard = React.useCallback(async () => {
    try {
      const response = await api.request('/client/dashboard');
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
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleRequestPress = async (requestId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      // On récupère les détails via l'API
      const details = await api.request(`/requests/${requestId}`);
      setSelectedRequest(details);
    } catch (error) {
      console.error('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
      DONE: { label: 'Terminé', color: '#15803D', bgColor: '#DCFCE7', icon: 'checkmark-circle' },
      CANCELLED: { label: 'Annulé', color: '#B91C1C', bgColor: '#FEE2E2', icon: 'close-circle' },
      ONGOING: { label: 'En cours', color: '#1D4ED8', bgColor: '#DBEAFE', icon: 'time' },
      PUBLISHED: { label: 'Recherche', color: '#B45309', bgColor: '#FEF3C7', icon: 'radio' },
      ACCEPTED: { label: 'Accepté', color: '#7E22CE', bgColor: '#F3E8FF', icon: 'hand-left' },
      PENDING_PAYMENT: { label: 'Paiement', color: '#BE185D', bgColor: '#FCE7F3', icon: 'card' },
    };
    return statusMap[status] || { label: status, color: '#6B7280', bgColor: '#F3F4F6', icon: 'help-circle' };
  };

  // Switch vers Dashboard Prestataire si nécessaire
  if (user?.roles?.includes('PROVIDER')) {
    return <ProviderDashboard />;
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#666" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{data?.me.name || data?.me.email.split('@')[0]}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#666" />
                <Text style={styles.profileLocation}>{data?.me.city || 'Bruxelles'}, Belgique</Text>
              </View>
            </View>
          </View>

          {/* BOUTON CRÉER : Pointe vers ton Stepper */}
          <TouchableOpacity 
            style={styles.createBtn} 
            onPress={() => router.push('/request/NewRequestStepper')}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.createBtnText}>Créer une nouvelle demande</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="flash" size={20} color="#1D4ED8" />
            </View>
            <Text style={styles.statValue}>{data?.stats.activeRequests || 0}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-done" size={20} color="#15803D" />
            </View>
            <Text style={styles.statValue}>{data?.stats.completedRequests || 0}</Text>
            <Text style={styles.statLabel}>Terminées</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="trending-up" size={20} color="#B45309" />
            </View>
            <Text style={styles.statValue}>{data?.stats.totalSpent || 0}€</Text>
            <Text style={styles.statLabel}>Dépenses</Text>
          </View>
        </View>

        {/* Historique Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={22} color="#000" />
          <Text style={styles.sectionTitle}>Historique des services</Text>
        </View>

        <View style={styles.historyContainer}>
          {!data?.requests || data.requests.length === 0 ? (
            <Text style={styles.emptyText}>Aucune demande récente</Text>
          ) : (
            data.requests.map((request, index) => {
              const status = getStatusInfo(request.status);
              return (
                <TouchableOpacity
                  key={request.id}
                  style={[styles.historyItem, index < data.requests.length - 1 && styles.borderBottom]}
                  onPress={() => handleRequestPress(request.id)}
                >
                  <View style={styles.historyLeft}>
                    <Text style={styles.requestTitle} numberOfLines={1}>{request.title}</Text>
                    <Text style={styles.requestDate}>
                      {new Date(request.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <View style={[styles.statusBadgeSmall, { backgroundColor: status.bgColor }]}>
                      <Text style={[styles.statusTextSmall, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <Text style={styles.requestPrice}>{request.price || 0}€</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Notifications */}
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications" size={22} color="#000" />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <View style={styles.notifCard}>
          <Ionicons name="notifications-off-outline" size={32} color="#CCC" />
          <Text style={styles.emptyNotifText}>Aucune notification pour le moment</Text>
        </View>

      </ScrollView>

      {/* Bottom Sheet Details */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.sheetContent}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 50 }} />
          ) : selectedRequest && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{selectedRequest.title}</Text>
              
              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Description</Text>
                <Text style={styles.sheetValue}>{selectedRequest.description || 'Pas de description'}</Text>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>Statut actuel</Text>
                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusInfo(selectedRequest.status).bgColor }]}>
                  <Text style={[styles.statusTextLarge, { color: getStatusInfo(selectedRequest.status).color }]}>
                    {getStatusInfo(selectedRequest.status).label}
                  </Text>
                </View>
              </View>

              {/* Bouton de suivi si la mission est en cours */}
              {selectedRequest.status === 'ONGOING' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    router.push(`/request/${selectedRequest.id}/ongoing`);
                  }}
                >
                  <Text style={styles.actionBtnText}>Suivre l'intervention</Text>
                  <Ionicons name="map" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 3 } }),
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  profileLocation: { fontSize: 14, color: '#6B7280', marginLeft: 4 },
  createBtn: { backgroundColor: '#000', flexDirection: 'row', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { backgroundColor: '#fff', width: (width - 60) / 3, padding: 16, borderRadius: 20, alignItems: 'center', elevation: 2 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 11, color: '#6B7280' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#111' },
  historyContainer: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  historyItem: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  historyLeft: { flex: 1 },
  requestTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  requestDate: { fontSize: 13, color: '#9CA3AF' },
  historyRight: { alignItems: 'flex-end' },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginBottom: 4 },
  statusTextSmall: { fontSize: 10, fontWeight: 'bold' },
  requestPrice: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  notifCard: { backgroundColor: '#fff', borderRadius: 24, padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyNotifText: { color: '#9CA3AF', marginTop: 12, fontSize: 14 },
  emptyText: { textAlign: 'center', padding: 30, color: '#9CA3AF' },
  sheetContent: { flex: 1, padding: 24 },
  sheetTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  sheetSection: { marginBottom: 20 },
  sheetLabel: { fontSize: 12, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: 8 },
  sheetValue: { fontSize: 16, color: '#111', lineHeight: 24 },
  statusBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  statusTextLarge: { fontSize: 12, fontWeight: 'bold' },
  actionBtn: { backgroundColor: '#000', flexDirection: 'row', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginRight: 8 },
});