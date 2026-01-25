import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';

import { api } from '@/lib/api';
import { useSocket } from '@/lib/SocketContext';
import { ProviderMissionCard } from './ProviderMissionCard';

const { width, height } = Dimensions.get('window');

// --- TYPES ---
interface ProviderStats {
  id: string;
  name: string;
  status: 'ONLINE' | 'READY' | 'OFFLINE' | 'BUSY';
  jobsCompleted: number;
  avgRating: number;
  totalRatings: number;
  rankScore: number;
  premium: boolean;
}

interface WalletData {
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
  transactions: {
    id: string;
    amount: number;
    type: string;
    createdAt: string;
  }[];
}

interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  lat?: number;
  lng?: number;
  client: { name: string };
  status?: string;
}

interface Mission {
  id: string;
  serviceType: string;
  price: string;
  rating: number;
  etaDistance: string;
  pickup: string;
  destination?: string;
  lat?: number;
  lng?: number;
}

// --- CONSTANTES MAP ---
const BRUSSELS_REGION = {
  latitude: 50.8503,
  longitude: 4.3517,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function ProviderDashboard() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  const [provider, setProvider] = useState<ProviderStats | null>(null);
  const [providerStatus, setProviderStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [wallet, setWallet] = useState<WalletData | null>(null);

  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- LOGIQUE METIER ---

  const handleViewRequest = useCallback(
    (requestId: string) => {
      router.push({ pathname: '/request/[id]', params: { id: requestId } });
    },
    [router],
  );

  const mapRequestToMission = useCallback(
    (req: IncomingRequest): Mission => {
      const etaDistance =
        typeof req.distance === 'number' ? `${req.distance.toFixed(1)} km` : '5 min';
      return {
        id: req.requestId,
        serviceType: req.title,
        price: Number.isFinite(req.price) ? req.price.toFixed(2) : '0.00',
        rating: provider?.avgRating ?? 5,
        etaDistance,
        pickup: req.address,
        destination: undefined,
        lat: req.lat,
        lng: req.lng,
      };
    },
    [provider?.avgRating],
  );

  const loadProviderData = useCallback(async () => {
    try {
      if (!provider) {
        setLoading(true);
      }

      const [providerRes, walletRes] = await Promise.allSettled([
        api.request('/providers/me'),
        api.request('/providers/wallet'),
      ]);

      if (providerRes.status === 'fulfilled') {
        const providerData: ProviderStats | null = providerRes.value?.provider ?? null;
        setProvider(providerData);

        if (providerData) {
          setProviderStatus(providerData.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE');
          await AsyncStorage.setItem('provider', JSON.stringify(providerData));
        }
      } else {
        console.error('Erreur provider:', providerRes.reason);
      }

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value as WalletData);
      } else {
        console.log('Wallet non dispo:', walletRes.reason);
      }
    } catch (error) {
      console.error('Erreur load:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Chargement initial : cache + refresh réseau
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('provider');
        if (cached) {
          const parsed: ProviderStats = JSON.parse(cached);
          setProvider(parsed);
          setProviderStatus(parsed.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE');
          setLoading(false);
        }
      } catch (e) {
        console.log('Impossible de lire le cache provider');
      } finally {
        loadProviderData();
      }
    })();
  }, [loadProviderData]);

  // Enregistrement du provider sur le socket
  useEffect(() => {
    if (!socket || !isConnected || !provider?.id) return;
    console.log('🚀 Provider registering:', provider.id);
    socket.emit('provider:register', { providerId: provider.id });
  }, [socket, isConnected, provider?.id]);

  // ✅ NOUVELLES DEMANDES (essentiel !)
  useEffect(() => {
    if (!socket) return;

    const onNewRequest = (data: any) => {
      console.log('🔔 Nouvelle demande:', data);

      // Sécurité UX: on ignore les demandes qui ne sont pas PUBLISHED
      if (data.status && data.status !== 'PUBLISHED') {
        console.log('⏭️ Demande ignorée car non publiée:', data.status);
        return;
      }

      const requestId = String(data?.requestId ?? data?.id ?? '');
      if (!requestId) return;

      const normalized: IncomingRequest = {
        requestId,
        title: data?.title ?? 'Nouvelle mission',
        description: data?.description ?? '',
        price: Number(data?.price ?? 0),
        address: data?.address ?? '',
        urgent: Boolean(data?.urgent),
        distance: data?.distance,
        lat: data?.lat,
        lng: data?.lng,
        client: { name: data?.client?.name ?? 'Client' },
        status: data?.status,
      };

      setIncomingRequests((prev) => {
        const exists = prev.some((r) => r.requestId === normalized.requestId);
        if (exists) return prev;
        const next = [normalized, ...prev];
        setActiveMission((curr) => curr ?? mapRequestToMission(next[0]));
        return next.slice(0, 5); // Max 5 requests
      });
    };

    socket.on('new_request', onNewRequest);
    return () => socket.off('new_request', onNewRequest);
  }, [socket, mapRequestToMission]);

  // ✅ GESTION STATUT PROVIDER (essentiel pour rejoindre providers:online)
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      console.log('🔄 Statut provider mis à jour:', data);
      if (provider?.id === data.providerId) {
        const newStatus = data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
        setProviderStatus(newStatus);
        setProvider(prev => prev ? { ...prev, status: data.status as any } : null);
      }
    };

    socket.on('provider:set_status', handleStatusUpdate);
    return () => socket.off('provider:set_status', handleStatusUpdate);
  }, [socket, provider?.id]);

  // ✅ NOTIFICATION MISSION ACCEPTÉE
  useEffect(() => {
    if (!socket) return;

    const handleProviderAccepted = (data: any) => {
      console.log('✅ Mission acceptée par:', data.provider);
      Alert.alert(
        'Mission attribuée !',
        `${data.provider.name} (${data.provider.rating?.toFixed(1)}⭐) a accepté votre mission`
      );
      // Refresh data
      loadProviderData();
      // Remove from queue
      setIncomingRequests([]);
      setActiveMission(null);
    };

    socket.on('provider_accepted', handleProviderAccepted);
    return () => socket.off('provider_accepted', handleProviderAccepted);
  }, [socket, loadProviderData]);

  const removeRequestAndUpdateCard = useCallback(
    (requestId: string) => {
      setIncomingRequests((prev) => {
        const nextQueue = prev.filter((r) => r.requestId !== requestId);
        setActiveMission((curr) => {
          if (!curr || curr.id === requestId) {
            return nextQueue.length > 0 ? mapRequestToMission(nextQueue[0]) : null;
          }
          return curr;
        });
        return nextQueue;
      });
    },
    [mapRequestToMission],
  );

  const handleStatusChange = useCallback(
    async (newStatus: 'ONLINE' | 'OFFLINE') => {
      if (!provider) return;
      try {
        await api.request('/providers/status', {
          method: 'POST',
          body: { status: newStatus },
        });
        setProviderStatus(newStatus);
        if (socket) {
          socket.emit('provider:set_status', {
            providerId: provider.id,
            status: newStatus,
          });
        }
        console.log(`✅ Provider status: ${newStatus}`);
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de changer le statut');
        setProviderStatus(newStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
      }
    },
    [provider, socket],
  );

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      try {
        await api.request(`/requests/${requestId}/accept`, { method: 'POST' });
        Alert.alert('Succès', 'Mission acceptée ! Direction le client.');
        removeRequestAndUpdateCard(requestId);
        handleViewRequest(requestId);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Mission déjà prise');
      }
    },
    [handleViewRequest, removeRequestAndUpdateCard],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        await api.request(`/requests/${requestId}/refuse`, { method: 'POST' });
        removeRequestAndUpdateCard(requestId);
      } catch (e) {
        console.error('Decline error:', e);
        removeRequestAndUpdateCard(requestId); // UX: on enlève quand même
      }
    },
    [removeRequestAndUpdateCard],
  );

  const isOnline = useMemo(() => providerStatus === 'ONLINE', [providerStatus]);

  if (loading && !provider) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  // --- RENDER ---
  return (
    <View style={styles.container}>
      {/* 1. MAP BACKGROUND */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={BRUSSELS_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {activeMission && activeMission.lat && activeMission.lng && (
          <Marker
            coordinate={{ latitude: activeMission.lat, longitude: activeMission.lng }}
            title={activeMission.serviceType}
            description={`€${activeMission.price}`}
          />
        )}
      </MapView>

      {/* 2. UI OVERLAY */}
      <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
        {/* HEADER */}
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.greeting}>Bonjour {provider?.name}</Text>
            <Text style={[styles.statusIndicator, isOnline && styles.statusOnline]}>
              {isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
              {socket && isConnected ? ' • Socket OK' : ' • Socket KO'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(val) => handleStatusChange(val ? 'ONLINE' : 'OFFLINE')}
            trackColor={{ false: '#767577', true: '#34C759' }}
            ios_backgroundColor="#eee"
          />
        </View>

        {/* DASHBOARD (si pas de mission active) */}
        {!activeMission && (
          <ScrollView
            style={styles.dashboardScroll}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadProviderData();
                }}
              />
            }
          >
            {/* Wallet Quick View */}
            <TouchableOpacity
              style={styles.walletCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.walletLabel}>Solde disponible</Text>
                <Ionicons name="chevron-forward" color="white" size={20} />
              </View>
              <Text style={styles.walletBalance}>{wallet?.balance?.toFixed(2) || '0.00'}€</Text>
              <Text style={styles.walletSub}>
                +{wallet?.pendingAmount?.toFixed(2) || '0.00'}€ en attente
              </Text>
            </TouchableOpacity>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{provider?.jobsCompleted || 0}</Text>
                <Text style={styles.statLbl}>Missions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>
                  {provider?.avgRating?.toFixed(1) || '5.0'}
                </Text>
                <Text style={styles.statLbl}>Note</Text>
              </View>
            </View>

            {/* Actions Rapides */}
            <View style={styles.menuGrid}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/(tabs)/missions')}
              >
                <Ionicons name="list" size={24} color="#333" />
                <Text style={styles.menuText}>Historique</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/earnings')}
              >
                <Ionicons name="bar-chart" size={24} color="#333" />
                <Text style={styles.menuText}>Stats</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Ionicons name="settings" size={24} color="#333" />
                <Text style={styles.menuText}>Profil</Text>
              </TouchableOpacity>
            </View>

            {/* Debug Info */}
            <View style={styles.debugCard}>
              <Text style={styles.debugText}>
                Requests en file: {incomingRequests.length}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* 3. MISSION CARD OVERLAY */}
        {activeMission && (
          <ProviderMissionCard
            mission={activeMission}
            onAccept={handleAcceptRequest}
            onDecline={handleDeclineRequest}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  overlayContainer: { flex: 1 },

  // Header
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 15,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  greeting: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusIndicator: { fontSize: 12, color: '#666', marginTop: 2 },
  statusOnline: { color: '#34C759', fontWeight: 'bold' },

  // Dashboard Scroll
  dashboardScroll: {
    paddingHorizontal: 15,
  },
  walletCard: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  walletLabel: { color: '#888', fontSize: 14 },
  walletBalance: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 5 },
  walletSub: { color: '#34C759', fontSize: 12 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: 'bold' },
  statLbl: { fontSize: 12, color: '#666' },

  menuGrid: { flexDirection: 'row', gap: 10 },
  menuItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuText: { fontSize: 12, fontWeight: '600', color: '#333' },

  debugCard: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
