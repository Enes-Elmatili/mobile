import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Vibration,
  Alert,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

// ============================================================================
// TYPES
// ============================================================================

interface WalletData {
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
}

interface ProviderStats {
  jobsCompleted: number;
  avgRating: number;
  rankScore: number;
}

interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  clientId?: string; // ✅ Add clientId to the interface
  client: {
    name: string;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProviderDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // State
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [stats, setStats] = useState<ProviderStats>({
    jobsCompleted: 0,
    avgRating: 5.0,
    rankScore: 100,
  });
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // ============================================================================
  // ANIMATIONS
  // ============================================================================

  useEffect(() => {
    // Fade in on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse when searching
    if (incomingRequests.length === 0 && isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [incomingRequests.length, isOnline]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load wallet
      const walletResponse = await api.get('/wallet');
      setWallet({
        balance: walletResponse.balance || 0,
        pendingAmount: walletResponse.pendingAmount || 0,
        totalEarnings: walletResponse.totalEarnings || 0,
      });

      // Load user info from /me
      const meResponse = await api.get('/me');
      const userData = meResponse.data || meResponse;
      
      // Extract stats (adapt based on your backend response)
      setStats({
        jobsCompleted: userData.jobsCompleted || 0,
        avgRating: userData.avgRating || 5.0,
        rankScore: userData.rankScore || 100,
      });

      console.log('✅ Provider data loaded');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger vos données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ============================================================================
  // SOCKET.IO LISTENERS
  // ============================================================================

  useEffect(() => {
    if (!socket || !user?.id) return;

    console.log('🔌 Setting up socket listeners for provider:', user.id);

    // Register as provider when socket connects
    if (socket.connected) {
      socket.emit('provider:register', { providerId: user.id });
      console.log('📡 Emitted provider:register');
    }

    // Listen for new requests (backend sends full request object)
    const handleNewRequest = (data: any) => {
      console.log('🔔 New request received:', data);
      Vibration.vibrate([0, 100, 50, 100]);
      
      // Transform backend data to match our interface
      const request: IncomingRequest = {
        requestId: data.requestId || data.id,
        title: data.title,
        description: data.description,
        price: data.price,
        address: data.location?.address || data.address || 'Adresse non spécifiée',
        urgent: data.urgent || data.priority === 'recent',
        distance: data.distance,
        clientId: data.clientId || data.client?.id, // ✅ Extract client ID
        client: {
          name: data.client?.name || 'Client',
        },
      };
      
      setIncomingRequests((prev) => {
        if (prev.some(r => r.requestId === request.requestId)) return prev;
        return [request, ...prev];
      });
    };

    // Listen for claimed requests (backend sends just requestId)
    const handleRequestClaimed = (requestId: string | number) => {
      const id = String(requestId);
      console.log('⚠️ Request claimed by another provider:', id);
      setIncomingRequests((prev) => prev.filter(r => r.requestId !== id));
    };

    // Listen for expired requests
    const handleRequestExpired = (requestId: string | number) => {
      const id = String(requestId);
      console.log('⏰ Request expired:', id);
      setIncomingRequests((prev) => prev.filter(r => r.requestId !== id));
    };

    // Listen for status updates
    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) {
        console.log('✅ Status updated:', data.status);
        setIsOnline(data.status === 'ONLINE' || data.status === 'READY');
      }
    };

    socket.on('new_request', handleNewRequest);
    socket.on('request:claimed', handleRequestClaimed);
    socket.on('request:expired', handleRequestExpired);
    socket.on('provider:status_update', handleStatusUpdate);

    return () => {
      socket.off('new_request', handleNewRequest);
      socket.off('request:claimed', handleRequestClaimed);
      socket.off('request:expired', handleRequestExpired);
      socket.off('provider:status_update', handleStatusUpdate);
    };
  }, [socket, user?.id]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleStatusChange = useCallback(() => {
    if (!user?.id) return;

    const newStatus = !isOnline;
    const statusValue = newStatus ? 'READY' : 'OFFLINE'; // Backend uses READY not ONLINE
    
    setIsOnline(newStatus);
    Vibration.vibrate(50);

    // Emit to socket (backend expects this exact format)
    if (socket) {
      socket.emit('provider:set_status', {
        providerId: user.id,
        status: statusValue,
      });
      console.log('📡 Emitted provider:set_status:', statusValue);
    }

    // Clear requests when going offline
    if (!newStatus) {
      setIncomingRequests([]);
    }

    // Optional: Update backend via REST (backend already does this via socket)
    // api.post('/providers/status', { status: statusValue })
    //   .catch(err => console.error('Status update failed:', err));
  }, [isOnline, socket, user?.id]);

  const handleAcceptRequest = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;

    try {
      // Check if we have the clientId
      if (!request.clientId) {
        console.warn('⚠️ Missing clientId in request, will try to get from API');
      }

      // Emit to socket FIRST (backend handles DB update)
      if (socket) {
        socket.emit('provider:accept', {
          requestId: request.requestId,
          providerId: user.id,
          clientId: request.clientId, // ✅ Send the actual client ID
        });
        console.log('📡 Emitted provider:accept:', { 
          requestId: request.requestId, 
          providerId: user.id, 
          clientId: request.clientId 
        });
      }

      // Haptic feedback
      Vibration.vibrate([0, 100]);
      
      // Remove from local list immediately (optimistic update)
      setIncomingRequests((prev) => prev.filter(r => r.requestId !== request.requestId));
      
      // Show success alert and navigate to ongoing screen
      Alert.alert(
        '✅ Mission acceptée',
        'Le client a été notifié. Vous pouvez maintenant voir les détails et démarrer la navigation.',
        [
          {
            text: 'Voir la mission',
            onPress: () => {
              // Navigate to ongoing screen to see mission details
              router.push(`/request/${request.requestId}/ongoing`);
            }
          },
          {
            text: 'Plus tard',
            style: 'cancel',
            onPress: () => {
              // Stay on dashboard
            }
          }
        ]
      );
      
      // Wait for socket confirmation
      const handleAcceptConfirm = (data: any) => {
        if (data.requestId === request.requestId) {
          console.log('✅ Provider accept confirmed by server');
          socket?.off('provider:accept_confirmed', handleAcceptConfirm);
        }
      };
      
      socket?.on('provider:accept_confirmed', handleAcceptConfirm);
      
      // Cleanup after 5 seconds
      setTimeout(() => {
        socket?.off('provider:accept_confirmed', handleAcceptConfirm);
      }, 5000);
    } catch (error: any) {
      console.error('❌ Error accepting request:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter la demande');
      
      // Re-add to list on error
      setIncomingRequests((prev) => {
        if (prev.some(r => r.requestId === request.requestId)) return prev;
        return [request, ...prev];
      });
    }
  }, [socket, user?.id, router]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    try {
      await api.post(`/requests/${requestId}/refuse`);
      setIncomingRequests((prev) => prev.filter(r => r.requestId !== requestId));
    } catch (error) {
      console.error('❌ Error declining request:', error);
    }
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.loadingPulse} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <FlatList
        data={incomingRequests}
        keyExtractor={(item) => item.requestId}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />
        }
        ListHeaderComponent={
          <>
            {/* HERO HEADER */}
            <LinearGradient colors={['#000000', '#1A1A1A']} style={styles.heroHeader}>
              <Animated.View 
                style={[
                  styles.heroContent,
                  {
                    opacity: fadeAnim,
                    transform: [{
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    }],
                  },
                ]}
              >
                {/* Status Indicator */}
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
                  <Text style={styles.statusText}>
                    {isConnected ? 'Connecté' : 'Déconnecté'}
                  </Text>
                </View>

                {/* Greeting */}
                <Text style={styles.heroGreeting}>Bonjour,</Text>
                <Text style={styles.heroName}>{user?.name || user?.email?.split('@')[0]}</Text>

                {/* Giant Status Toggle */}
                <TouchableOpacity
                  style={[styles.statusToggle, isOnline && styles.statusToggleActive]}
                  onPress={handleStatusChange}
                  activeOpacity={0.9}
                >
                  <View style={[styles.statusToggleIndicator, isOnline && styles.statusToggleIndicatorActive]} />
                  <Text style={[styles.statusToggleText, isOnline && styles.statusToggleTextActive]}>
                    {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                  </Text>
                  <Ionicons 
                    name={isOnline ? 'checkmark-circle' : 'pause-circle'} 
                    size={28} 
                    color={isOnline ? '#34C759' : '#666'} 
                  />
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>

            {/* WALLET MEGA CARD */}
            <Animated.View style={[styles.walletContainer, { opacity: fadeAnim }]}>
              <TouchableOpacity
                style={styles.walletCard}
                onPress={() => router.push('/wallet')}
                activeOpacity={0.95}
              >
                <LinearGradient colors={['#FFFFFF', '#F5F5F5']} style={styles.walletGradient}>
                  <View style={styles.walletHeader}>
                    <View style={styles.walletIconContainer}>
                      <Ionicons name="wallet-outline" size={32} color="#000" />
                    </View>
                    <Text style={styles.walletLabel}>Solde disponible</Text>
                  </View>

                  <Text style={styles.walletBalance}>
                    {(wallet?.balance || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </Text>

                  <View style={styles.walletStats}>
                    <View style={styles.walletStat}>
                      <Text style={styles.walletStatLabel}>Total gagné</Text>
                      <Text style={styles.walletStatValue}>
                        {(wallet?.totalEarnings || 0).toLocaleString('fr-FR')} €
                      </Text>
                    </View>
                    <View style={styles.walletStat}>
                      <Text style={styles.walletStatLabel}>En attente</Text>
                      <Text style={styles.walletStatValue}>
                        {(wallet?.pendingAmount || 0).toLocaleString('fr-FR')} €
                      </Text>
                    </View>
                  </View>

                  <View style={styles.walletAction}>
                    <Text style={styles.walletActionText}>Retirer</Text>
                    <Ionicons name="arrow-forward" size={24} color="#000" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* STATS PILLS */}
            <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
              <View style={styles.statPill}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <View style={styles.statPillContent}>
                  <Text style={styles.statPillValue}>{stats.jobsCompleted}</Text>
                  <Text style={styles.statPillLabel}>Courses</Text>
                </View>
              </View>

              <View style={styles.statPill}>
                <Ionicons name="star" size={24} color="#FFB800" />
                <View style={styles.statPillContent}>
                  <Text style={styles.statPillValue}>{stats.avgRating.toFixed(1)}</Text>
                  <Text style={styles.statPillLabel}>Note</Text>
                </View>
              </View>

              <View style={styles.statPill}>
                <Ionicons name="trophy" size={24} color="#FF9500" />
                <View style={styles.statPillContent}>
                  <Text style={styles.statPillValue}>{stats.rankScore.toFixed(0)}</Text>
                  <Text style={styles.statPillLabel}>Rang</Text>
                </View>
              </View>
            </Animated.View>

            {/* FEED TITLE */}
            <Text style={styles.feedTitle}>
              {incomingRequests.length > 0 
                ? `${incomingRequests.length} Mission${incomingRequests.length > 1 ? 's' : ''} disponible${incomingRequests.length > 1 ? 's' : ''}`
                : 'Missions'
              }
            </Text>

            {/* EMPTY STATES */}
            {!isOnline ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="power" size={64} color="#000" />
                </View>
                <Text style={styles.emptyTitle}>Mode hors ligne</Text>
                <Text style={styles.emptyDescription}>
                  Passez en ligne pour recevoir des missions
                </Text>
              </View>
            ) : incomingRequests.length === 0 ? (
              <Animated.View style={[styles.emptyState, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.scanningContainer}>
                  <View style={styles.scanningRing} />
                  <View style={[styles.scanningRing, styles.scanningRingDelay]} />
                  <Ionicons name="navigate-circle" size={64} color="#000" />
                </View>
                <Text style={styles.emptyTitle}>Recherche active</Text>
                <Text style={styles.emptyDescription}>
                  Nous cherchons des missions près de vous...
                </Text>
              </Animated.View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <Animated.View
            style={[
              styles.requestCard,
              { opacity: fadeAnim },
            ]}
          >
            {item.urgent && (
              <View style={styles.urgentBadge}>
                <Ionicons name="flash" size={16} color="#FFF" />
                <Text style={styles.urgentText}>URGENT</Text>
              </View>
            )}

            <Text style={styles.requestTitle}>{item.title}</Text>
            <Text style={styles.requestDescription} numberOfLines={2}>
              {item.description}
            </Text>

            <View style={styles.requestMeta}>
              <View style={styles.requestMetaItem}>
                <Ionicons name="location" size={18} color="#666" />
                <Text style={styles.requestMetaText} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
              
              {item.distance && (
                <View style={styles.requestMetaItem}>
                  <Ionicons name="navigate" size={18} color="#666" />
                  <Text style={styles.requestMetaText}>
                    {item.distance.toFixed(1)} km
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.requestFooter}>
              <Text style={styles.requestPrice}>{item.price} €</Text>

              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => handleDeclineRequest(item.requestId)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#FF3B30" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptRequest(item)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.acceptButtonText}>ACCEPTER</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
        ListFooterComponent={
          <Animated.View style={[styles.quickActionsContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/missions')}
            >
              <Ionicons name="time-outline" size={28} color="#000" />
              <Text style={styles.quickActionText}>Historique</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/wallet')}
            >
              <Ionicons name="bar-chart-outline" size={28} color="#000" />
              <Text style={styles.quickActionText}>Gains</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Ionicons name="settings-outline" size={28} color="#000" />
              <Text style={styles.quickActionText}>Profil</Text>
            </TouchableOpacity>
          </Animated.View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ============================================================================
// STYLES - BASE 44 DESIGN SYSTEM
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
  },
  listContent: {
    paddingBottom: 40,
  },

  // HERO HEADER
  heroHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroContent: {
    gap: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroGreeting: {
    fontSize: 18,
    color: '#999',
    fontWeight: '500',
  },
  heroName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 24,
  },

  // STATUS TOGGLE
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 16,
  },
  statusToggleActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  statusToggleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  statusToggleIndicatorActive: {
    backgroundColor: '#34C759',
  },
  statusToggleText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1,
  },
  statusToggleTextActive: {
    color: '#34C759',
  },

  // WALLET CARD
  walletContainer: {
    paddingHorizontal: 24,
    marginTop: -40,
    marginBottom: 24,
  },
  walletCard: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  walletGradient: {
    padding: 28,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  walletIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  walletLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  walletBalance: {
    fontSize: 56,
    fontWeight: '900',
    color: '#000',
    marginBottom: 24,
  },
  walletStats: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginBottom: 24,
  },
  walletStat: {
    flex: 1,
  },
  walletStatLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  walletStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
  },
  walletAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 24,
    gap: 12,
  },
  walletActionText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },

  // STATS PILLS
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 32,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statPillContent: {
    flex: 1,
  },
  statPillValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
  },
  statPillLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginTop: 2,
  },

  // FEED
  feedTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  // EMPTY STATE
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scanningContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  scanningRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#000',
    opacity: 0.3,
  },
  scanningRingDelay: {
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.2,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    textAlign: 'center',
  },

  // REQUEST CARD
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  urgentText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  requestTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  requestDescription: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 16,
  },
  requestMeta: {
    gap: 10,
    marginBottom: 20,
  },
  requestMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestMetaText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    flex: 1,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  requestPrice: {
    fontSize: 40,
    fontWeight: '900',
    color: '#000',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 10,
  },
  acceptButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // QUICK ACTIONS
  quickActionsContainer: {
    marginHorizontal: 24,
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
});