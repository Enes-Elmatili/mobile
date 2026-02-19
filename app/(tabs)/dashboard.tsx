import React, { useRef, useMemo, useState, useCallback } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import ProviderDashboard from '../../app/(tabs)/provider-dashboard';

const { width } = Dimensions.get('window');

/* ================= TYPES ================= */

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

/* ================= COMPONENT ================= */

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  const loadDashboard = useCallback(async () => {
    try {
      // ✅ PATCH: Utilisation de api.get pour correspondre à ton helper api.ts
      const response = await api.get('/client/dashboard');
      setData(response.data || response);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
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
      const details = await api.get(`/requests/${requestId}`);
      setSelectedRequest(details.request || details);
    } catch (error) {
      console.error('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  const getStatusInfo = (status: string) => {
  // ✅ On s'assure que status est une string et on gère les imprévus
  const s = (status || 'PENDING').toUpperCase();
  
  const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
    DONE: { label: 'Terminé', color: '#15803D', bgColor: '#DCFCE7', icon: 'checkmark-circle' },
    CANCELLED: { label: 'Annulé', color: '#B91C1C', bgColor: '#FEE2E2', icon: 'close-circle' },
    ONGOING: { label: 'En cours', color: '#1D4ED8', bgColor: '#DBEAFE', icon: 'time' },
    PUBLISHED: { label: 'Recherche', color: '#B45309', bgColor: '#FEF3C7', icon: 'radio' },
    ACCEPTED: { label: 'Accepté', color: '#7E22CE', bgColor: '#F3E8FF', icon: 'hand-left' },
    PENDING_PAYMENT: { label: 'Paiement', color: '#BE185D', bgColor: '#FCE7F3', icon: 'card' },
  };

  return statusMap[s] || { label: s, color: '#6B7280', bgColor: '#F3F4F6', icon: 'help-circle' };
};

  // ✅ Redirection si Provider
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
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color="#000" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Bonjour, {data?.me?.name || user?.email?.split('@')[0]}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#6B7280" />
                <Text style={styles.profileLocation}>{data?.me?.city || 'Bruxelles'}, BE</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.createBtn} 
            onPress={() => router.push('/request/NewRequestStepper')}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.createBtnText}>Nouvelle demande</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Actives</Text>
            <Text style={styles.statValue}>{data?.stats?.activeRequests || 0}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Terminées</Text>
            <Text style={styles.statValue}>{data?.stats?.completedRequests || 0}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Dépenses</Text>
            <Text style={styles.statValue}>{data?.stats?.totalSpent || 0}€</Text>
          </View>
        </View>

        {/* Historique Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes Services</Text>
          <TouchableOpacity onPress={onRefresh}>
             <Ionicons name="refresh" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.historyContainer}>
          {!data?.requests || data.requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune mission trouvée</Text>
            </View>
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
                      {new Date(request.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    {/* ✅ FIX: CHANGÉ <div> PAR <View> */}
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

        {/* Notifications Card */}
        <View style={styles.notifCard}>
          <View style={styles.notifIcon}>
            <Ionicons name="notifications" size={20} color="#000" />
          </View>
          <Text style={styles.notifText}>Vous n&apos;avez pas de nouvelles notifications.</Text>
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
                <Text style={styles.sheetLabel}>Détails de la mission</Text>
                <Text style={styles.sheetValue}>{selectedRequest.description || 'Aucune description.'}</Text>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetLabel}>État actuel</Text>
                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusInfo(selectedRequest.status).bgColor }]}>
                  <Text style={[styles.statusTextLarge, { color: getStatusInfo(selectedRequest.status).color }]}>
                    {getStatusInfo(selectedRequest.status).label.toUpperCase()}
                  </Text>
                </View>
              </View>

              {selectedRequest.status === 'ONGOING' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    router.push(`/request/${selectedRequest.id}/ongoing`);
                  }}
                >
                  <Text style={styles.actionBtnText}>Suivre l&apos;intervention</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 2 } }),
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  profileLocation: { fontSize: 13, color: '#6B7280', marginLeft: 4 },
  createBtn: { backgroundColor: '#000', flexDirection: 'row', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { backgroundColor: '#fff', width: (width - 48) / 3, padding: 16, borderRadius: 18, elevation: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  historyContainer: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 20, elevation: 1 },
  historyItem: { flexDirection: 'row', padding: 18, alignItems: 'center' },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  historyLeft: { flex: 1 },
  requestTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  requestDate: { fontSize: 12, color: '#9CA3AF' },
  historyRight: { alignItems: 'flex-end' },
  statusBadgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  statusTextSmall: { fontSize: 9, fontWeight: 'bold' },
  requestPrice: { fontSize: 15, fontWeight: '800', color: '#000' },
  notifCard: { backgroundColor: '#F3F4F6', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center' },
  notifIcon: { marginRight: 12 },
  notifText: { flex: 1, color: '#6B7280', fontSize: 13 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  sheetContent: { flex: 1, padding: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  sheetSection: { marginBottom: 20 },
  sheetLabel: { fontSize: 11, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 },
  sheetValue: { fontSize: 15, color: '#374151', lineHeight: 22 },
  statusBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  statusTextLarge: { fontSize: 11, fontWeight: '900' },
  actionBtn: { backgroundColor: '#000', flexDirection: 'row', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginRight: 8 },
});