import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

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
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    createdAt: string;
  }>;
}

interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  client: {
    name: string;
  };
}

export default function ProviderDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [provider, setProvider] = useState<ProviderStats | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les données du prestataire
  const loadProviderData = async () => {
    try {
      setLoading(true);

      // 1. Stats du prestataire
      const providerResponse = await api.get('/provider/me');
      setProvider(providerResponse);

      // 2. Wallet
      const walletResponse = await api.get('/wallet');
      setWallet(walletResponse);

    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      Alert.alert('Erreur', 'Impossible de charger vos données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProviderData();
  }, []);

  // WebSocket pour recevoir les demandes
  useEffect(() => {
    if (!provider?.id) return;

    const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
    
    console.log('🔌 Connexion Socket.io prestataire:', provider.id);
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Prestataire connecté:', newSocket.id);
      
      // Rejoindre en tant que prestataire
      newSocket.emit('provider:join', { providerId: provider.id });
    });

    // Recevoir nouvelles demandes
    newSocket.on('new_request', (data: IncomingRequest) => {
      console.log('🔔 Nouvelle demande reçue:', data);
      
      setIncomingRequests((prev) => [data, ...prev]);
      
      // Notification sonore/visuelle
      Alert.alert(
        '🔔 Nouvelle demande !',
        `${data.title}\n${data.price}€ - ${data.address}`,
        [
          { text: 'Ignorer', style: 'cancel' },
          { text: 'Voir', onPress: () => handleViewRequest(data) },
        ]
      );
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Socket déconnecté');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [provider?.id]);

  // Changer de statut
  const handleStatusChange = async (newStatus: 'ONLINE' | 'OFFLINE') => {
    if (!provider) return;

    try {
      await api.post('/provider/status', { status: newStatus });
      
      setProvider({ ...provider, status: newStatus });
      
      // Émettre via Socket.io
      socket?.emit('provider:set_status', {
        providerId: provider.id,
        status: newStatus,
      });

      console.log(`✅ Statut changé: ${newStatus}`);
    } catch (error) {
      console.error('❌ Erreur changement statut:', error);
      Alert.alert('Erreur', 'Impossible de changer votre statut');
    }
  };

  // Voir une demande
  const handleViewRequest = (request: IncomingRequest) => {
    router.push({
      pathname: '/request/[id]',
      params: { id: request.requestId },
    });
  };

  // Accepter une demande
  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.post(`/requests/${requestId}/accept`);
      
      Alert.alert('Succès', 'Demande acceptée !');
      
      // Retirer de la liste
      setIncomingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      
      // Rediriger vers la demande
      router.push({
        pathname: '/request/[id]',
        params: { id: requestId },
      });
    } catch (error: any) {
      console.error('❌ Erreur acceptation:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter la demande');
    }
  };

  // Refuser une demande
  const handleDeclineRequest = async (requestId: string) => {
    try {
      await api.post(`/requests/${requestId}/refuse`);
      
      // Retirer de la liste
      setIncomingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    } catch (error) {
      console.error('❌ Erreur refus:', error);
    }
  };

  const isOnline = provider?.status === 'ONLINE' || provider?.status === 'READY';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadProviderData();
        }} />
      }
    >
      {/* Header - Statut */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.name}>{provider?.name || 'Prestataire'}</Text>
        </View>

        <View style={styles.statusToggle}>
          <Text style={[styles.statusText, isOnline && styles.statusTextActive]}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={(value) => handleStatusChange(value ? 'ONLINE' : 'OFFLINE')}
            trackColor={{ false: '#767577', true: '#34C759' }}
            thumbColor={isOnline ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Wallet Card */}
      <TouchableOpacity
        style={styles.walletCard}
        onPress={() => router.push('/wallet')}
      >
        <View style={styles.walletHeader}>
          <Ionicons name="wallet" size={28} color="#fff" />
          <Text style={styles.walletLabel}>Mon portefeuille</Text>
        </View>

        <Text style={styles.walletBalance}>{wallet?.balance || 0}€</Text>

        <View style={styles.walletStats}>
          <View>
            <Text style={styles.walletStatLabel}>Gains totaux</Text>
            <Text style={styles.walletStatValue}>{wallet?.totalEarnings || 0}€</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.walletStatLabel}>En attente</Text>
            <Text style={styles.walletStatValue}>{wallet?.pendingAmount || 0}€</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.withdrawButton}>
          <Text style={styles.withdrawButtonText}>Retirer</Text>
          <Ionicons name="arrow-forward" size={16} color="#000" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Statistiques */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={32} color="#34C759" />
          <Text style={styles.statValue}>{provider?.jobsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Courses</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="star" size={32} color="#FFB800" />
          <Text style={styles.statValue}>{provider?.avgRating.toFixed(1) || '0.0'}</Text>
          <Text style={styles.statLabel}>Note moyenne</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="trophy" size={32} color="#FF9500" />
          <Text style={styles.statValue}>{provider?.rankScore.toFixed(0) || '0'}</Text>
          <Text style={styles.statLabel}>Rang</Text>
        </View>
      </View>

      {/* Demandes entrantes */}
      {incomingRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>
            🔔 Nouvelles demandes ({incomingRequests.length})
          </Text>

          {incomingRequests.map((request) => (
            <View key={request.requestId} style={styles.requestCard}>
              {request.urgent && (
                <View style={styles.urgentBadge}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}

              <Text style={styles.requestTitle}>{request.title}</Text>
              <Text style={styles.requestDesc} numberOfLines={2}>
                {request.description}
              </Text>

              <View style={styles.requestInfo}>
                <View style={styles.requestInfoItem}>
                  <Ionicons name="location" size={16} color="#666" />
                  <Text style={styles.requestInfoText}>{request.address}</Text>
                </View>

                <View style={styles.requestInfoItem}>
                  <Ionicons name="person" size={16} color="#666" />
                  <Text style={styles.requestInfoText}>{request.client.name}</Text>
                </View>
              </View>

              <View style={styles.requestFooter}>
                <Text style={styles.requestPrice}>{request.price}€</Text>

                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDeclineRequest(request.requestId)}
                  >
                    <Ionicons name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(request.requestId)}
                  >
                    <Text style={styles.acceptButtonText}>Accepter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions rapides */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/history')}
        >
          <Ionicons name="time" size={24} color="#000" />
          <Text style={styles.actionButtonText}>Historique</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/earnings')}
        >
          <Ionicons name="bar-chart" size={24} color="#000" />
          <Text style={styles.actionButtonText}>Gains</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="settings" size={24} color="#000" />
          <Text style={styles.actionButtonText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#34C759',
  },
  walletCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#000',
    borderRadius: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  walletLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  walletBalance: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  walletStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  walletStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  walletStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  withdrawButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  requestsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
  },
  urgentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    alignItems: 'center',
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  requestDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  requestInfo: {
    gap: 8,
    marginBottom: 16,
  },
  requestInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestInfoText: {
    fontSize: 14,
    color: '#666',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  requestPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
});