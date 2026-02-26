/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/provider-dashboard.tsx
// Mode "Dispatch" — Google Maps dark plein écran + pop-up mission avec timer

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');
const TIMER_DURATION = 15;

// ─── Google Maps dark style (Uber driver aesthetic) ────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050505' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
];

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (cents: number): string =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
  clientId?: string;
  client: { name: string };
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// RADAR PULSE (affiché au centre de la carte quand online)
// ============================================================================

function RadarPulse() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 600);
    pulse(ring3, 1200);
  }, []);

  const ring = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] }),
  });

  return (
    <View style={radar.wrap}>
      <Animated.View style={[radar.ring, ring(ring1)]} />
      <Animated.View style={[radar.ring, ring(ring2)]} />
      <Animated.View style={[radar.ring, ring(ring3)]} />
      <View style={radar.core}>
        <Ionicons name="navigate-circle" size={44} color="#FFF" />
      </View>
    </View>
  );
}

const radar = StyleSheet.create({
  wrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  core: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ============================================================================
// INCOMING JOB CARD
// ============================================================================

function IncomingJobCard({
  request,
  onAccept,
  onDecline,
}: {
  request: IncomingRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const slideUp  = useRef(new Animated.Value(400)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: TIMER_DURATION * 1000,
      useNativeDriver: false,
    }).start();
    return () => clearInterval(interval);
  }, []);

  const netPrice = request.price * 0.85;
  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: ['#FF3B30', '#FF9500', '#34C759'],
  });

  return (
    <Animated.View style={[jc.wrap, { transform: [{ translateY: slideUp }] }]}>
      <View style={jc.timerTrack}>
        <Animated.View style={[jc.timerFill, {
          width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: timerColor,
        }]} />
      </View>

      <View style={jc.header}>
        <View style={jc.headerLeft}>
          {request.urgent && (
            <View style={jc.urgentPill}>
              <Ionicons name="flash" size={11} color="#FFF" />
              <Text style={jc.urgentText}>URGENT</Text>
            </View>
          )}
          <Text style={jc.title} numberOfLines={2}>{request.title}</Text>
        </View>
        <View style={jc.priceBlock}>
          <Text style={jc.priceLabel}>Net</Text>
          <Text style={jc.price}>{netPrice.toFixed(0)}€</Text>
          <Text style={jc.priceGross}>({request.price}€ brut)</Text>
        </View>
      </View>

      <View style={jc.metas}>
        <View style={jc.meta}>
          <Ionicons name="location-outline" size={14} color="#888" />
          <Text style={jc.metaText} numberOfLines={1}>{request.address}</Text>
        </View>
        {request.distance !== undefined && (
          <View style={jc.meta}>
            <Ionicons name="navigate-outline" size={14} color="#888" />
            <Text style={jc.metaText}>{request.distance.toFixed(1)} km · ~{Math.round(request.distance * 3)} min</Text>
          </View>
        )}
        <View style={jc.meta}>
          <Ionicons name="person-outline" size={14} color="#888" />
          <Text style={jc.metaText}>{request.client.name}</Text>
        </View>
      </View>

      <View style={jc.footer}>
        <View style={jc.timerCircle}>
          <Text style={[jc.timerNum, timeLeft <= 5 && jc.timerUrgent]}>{timeLeft}</Text>
        </View>
        <TouchableOpacity style={jc.declineBtn} onPress={onDecline} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#FF3B30" />
        </TouchableOpacity>
        <TouchableOpacity style={jc.acceptBtn} onPress={onAccept} activeOpacity={0.88}>
          <Text style={jc.acceptText}>Accepter</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  timerTrack: { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  headerLeft: { flex: 1, gap: 6 },
  urgentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF3B30', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  urgentText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '800', color: '#111', lineHeight: 24 },
  priceBlock: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 38, fontWeight: '900', color: '#111', lineHeight: 44, letterSpacing: -1 },
  priceGross: { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  metas: { gap: 8, marginBottom: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, color: '#555', fontWeight: '500', flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  timerNum: { fontSize: 16, fontWeight: '800', color: '#111' },
  timerUrgent: { color: '#FF3B30' },
  declineBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  acceptBtn: {
    flex: 1, height: 50, backgroundColor: '#111',
    borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acceptText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// WALLET PILL
// ============================================================================

function WalletPill({ wallet, onPress }: { wallet: WalletData | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={wp.wrap} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="wallet-outline" size={16} color="#FFF" />
      <Text style={wp.balance}>{formatEuros(wallet?.balance || 0)}</Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
    </TouchableOpacity>
  );
}

const wp = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  balance: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// STATS ROW — données réelles depuis /provider/dashboard
// ============================================================================

function StatsRow({ stats, loading }: { stats: ProviderStats; loading: boolean }) {
  const items = [
    { icon: 'checkmark-circle-outline', value: loading ? '—' : String(stats.jobsCompleted), label: 'Missions' },
    { icon: 'star-outline',             value: loading ? '—' : stats.avgRating.toFixed(1),   label: 'Note' },
    { icon: 'trophy-outline',           value: loading ? '—' : String(Math.round(stats.rankScore)), label: 'Rang' },
  ];
  return (
    <View style={srow.wrap}>
      {items.map((item, i) => (
        <View key={i} style={srow.pill}>
          <Ionicons name={item.icon as any} size={14} color="rgba(255,255,255,0.7)" />
          <Text style={srow.value}>{item.value}</Text>
          <Text style={srow.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const srow = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  value: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  label: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================


// ============================================================================
// FLOATING ISLAND HEADER — Online toggle (left) + Wallet (right)
// ============================================================================

function FloatingIslandHeader({
  isOnline,
  isConnected,
  wallet,
  onToggle,
  onWalletPress,
}: {
  isOnline: boolean;
  isConnected: boolean;
  wallet: WalletData | null;
  onToggle: () => void;
  onWalletPress: () => void;
}) {
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [isOnline]);

  const handleTogglePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const dotOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const dotScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });

  return (
    <Animated.View style={[island.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Left — Online toggle */}
      <TouchableOpacity
        style={island.toggleSide}
        onPress={handleTogglePress}
        activeOpacity={0.8}
      >
        <View style={island.dotWrap}>
          {isOnline && (
            <Animated.View style={[island.dotGlow, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]} />
          )}
          <View style={[island.dot, isOnline ? island.dotOnline : island.dotOffline]} />
        </View>
        <Text style={[island.toggleLabel, isOnline && island.toggleLabelOnline]}>
          {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
        </Text>
        <Ionicons
          name={isOnline ? 'radio-outline' : 'power-outline'}
          size={13}
          color={isOnline ? '#34C759' : '#555'}
        />
      </TouchableOpacity>

      {/* Divider */}
      <View style={island.divider} />

      {/* Right — Wallet */}
      <TouchableOpacity
        style={island.walletSide}
        onPress={onWalletPress}
        activeOpacity={0.8}
      >
        <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={island.walletBalance}>{formatEuros(wallet?.balance || 0)}</Text>
        <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const island = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    overflow: 'hidden',
  },
  toggleSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  walletSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dotWrap:  { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotGlow:  { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#34C759' },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  dotOnline:  { backgroundColor: '#34C759' },
  dotOffline: { backgroundColor: '#444' },
  toggleLabel:      { fontSize: 12, fontWeight: '800', color: '#444', letterSpacing: 0.8, flex: 1 },
  toggleLabelOnline: { color: '#34C759' },
  walletBalance: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});

export default function ProviderDashboard() {
  const router   = useRouter();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const mapRef   = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [location, setLocation]           = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [wallet, setWallet]               = useState<WalletData | null>(null);
  const [stats, setStats]                 = useState<ProviderStats>({ jobsCompleted: 0, avgRating: 5.0, rankScore: 100 });
  const [statsLoading, setStatsLoading]   = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isOnline, setIsOnline]           = useState(false);

  // ── Fade in ──
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ── Géolocalisation ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(true); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);

      // Centrer la carte sur la position du provider
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);

      // Tracking continu pour update le socket
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30 },
        (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setLocation(c);
          if (socket && isOnline && user?.id) {
            socket.emit('provider:location', { providerId: user.id, ...c });
          }
        }
      );
    })();
  }, []);

  // ── Data depuis /provider/dashboard (stats réelles) ──
  const loadData = useCallback(async () => {
    // Appels indépendants — si l'un échoue, l'autre continue
    const results = await Promise.allSettled([
      api.wallet.balance(),   // GET /wallet
      api.user.me(),          // GET /auth/me — contient jobsCompleted, avgRating, rankScore
    ]);

    // Wallet
    if (results[0].status === 'fulfilled') {
      const walletRes = results[0].value as any;
      setWallet({
        balance:       walletRes.balance       || 0,
        pendingAmount: walletRes.pendingAmount  || 0,
        totalEarnings: walletRes.totalEarnings  || 0,
      });
    } else {
      console.warn('Wallet load failed:', (results[0] as PromiseRejectedResult).reason?.message);
    }

    // Stats depuis /auth/me
    if (results[1].status === 'fulfilled') {
      const meRes = results[1].value as any;
      const u = meRes.user || meRes.data || meRes;
      setStats({
        jobsCompleted: u.jobsCompleted ?? u.completedMissions ?? u.totalCompleted ?? 0,
        avgRating:     u.avgRating     ?? u.averageRating      ?? u.rating        ?? 5.0,
        rankScore:     u.rankScore     ?? u.rank               ?? u.score         ?? 0,
      });
    } else {
      console.warn('Stats load failed:', (results[1] as PromiseRejectedResult).reason?.message);
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Socket ──
  useEffect(() => {
    if (!socket || !user?.id) return;

    if (socket.connected) socket.emit('provider:register', { providerId: user.id });

    const handleNewRequest = (data: any) => {
      Vibration.vibrate([0, 200, 100, 200]);
      const req: IncomingRequest = {
        requestId:   data.requestId || data.id,
        title:       data.title,
        description: data.description,
        price:       data.price,
        address:     data.location?.address || data.address || 'Adresse inconnue',
        urgent:      data.urgent || false,
        distance:    data.distance,
        clientId:    data.clientId || data.client?.id,
        client:      { name: data.client?.name || 'Client' },
        latitude:    data.location?.latitude  || data.latitude,
        longitude:   data.location?.longitude || data.longitude,
      };
      setIncomingRequests(prev =>
        prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]
      );

      // Zoomer sur le marker de la mission entrante
      if (req.latitude && req.longitude) {
        mapRef.current?.animateToRegion({
          latitude:      req.latitude,
          longitude:     req.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 600);
      }
    };

    const removeRequest = (id: string | number) =>
      setIncomingRequests(prev => prev.filter(r => r.requestId !== String(id)));

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) setIsOnline(['ONLINE', 'READY'].includes(data.status));
    };

    socket.on('new_request',           handleNewRequest);
    socket.on('request:claimed',       removeRequest);
    socket.on('request:expired',       removeRequest);
    socket.on('provider:status_update', handleStatusUpdate);

    return () => {
      socket.off('new_request',            handleNewRequest);
      socket.off('request:claimed',        removeRequest);
      socket.off('request:expired',        removeRequest);
      socket.off('provider:status_update', handleStatusUpdate);
    };
  }, [socket, user?.id]);

  // ── Toggle En ligne ──
  const handleToggleOnline = useCallback(() => {
    if (!user?.id) return;
    const next = !isOnline;
    setIsOnline(next);
    Vibration.vibrate(50);
    if (socket) socket.emit('provider:set_status', { providerId: user.id, status: next ? 'READY' : 'OFFLINE' });
    if (!next) setIncomingRequests([]);

    // Recentrer sur la position du provider quand il passe online
    if (next && location) {
      mapRef.current?.animateToRegion({
        ...location,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 600);
    }
  }, [isOnline, socket, user?.id, location]);

  // ── Accept / Decline ──
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;
    if (socket) {
      socket.emit('provider:accept', {
        requestId:  request.requestId,
        providerId: user.id,
        clientId:   request.clientId,
      });
    }
    Vibration.vibrate(100);
    setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
    router.push(`/request/${request.requestId}/ongoing`);
  }, [socket, user?.id, router]);

  const handleDecline = useCallback(async (requestId: string) => {
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  const activeJob = incomingRequests[0] || null;

  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="navigate-circle" size={48} color="rgba(255,255,255,0.3)" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Google Maps dark plein écran ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        initialRegion={{
          latitude:       location?.latitude  ?? 48.8566,
          longitude:      location?.longitude ?? 2.3522,
          latitudeDelta:  0.04,
          longitudeDelta: 0.04,
        }}
      >
        {/* Markers des missions entrantes */}
        {incomingRequests.map(req =>
          req.latitude && req.longitude ? (
            <Marker
              key={req.requestId}
              coordinate={{ latitude: req.latitude, longitude: req.longitude }}
              title={req.title}
              description={req.address}
            >
              <View style={s.missionMarker}>
                <Ionicons name="flash" size={14} color="#FFF" />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* ── Overlay UI au-dessus de la carte ── */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>

        {/* ── Floating Island Header — Online toggle + Wallet ── */}
        <FloatingIslandHeader
          isOnline={isOnline}
          isConnected={isConnected}
          wallet={wallet}
          onToggle={handleToggleOnline}
          onWalletPress={() => router.push('/wallet')}
        />

        {/* ── Hero Card — îlot opaque, gains en star ── */}
        <View style={s.heroCard}>

          {/* Salut discret */}
          <Text style={s.heroGreeting}>
            {user?.name || user?.email?.split('@')[0]}
          </Text>

          {/* Gains = héros absolu */}
          <TouchableOpacity onPress={() => router.push('/wallet')} activeOpacity={0.85}>
            <Text style={s.earningsCaption}>gains nets · ce mois</Text>
            <Text style={s.earningsHero}>
              {statsLoading ? '—' : formatEuros(wallet?.totalEarnings || 0)}
            </Text>
            {!statsLoading && (wallet?.pendingAmount || 0) > 0 && (
              <View style={s.pendingPill}>
                <Text style={s.pendingText}>+{formatEuros(wallet?.pendingAmount || 0)} en attente</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* KPIs — séparateurs verticaux, fond neutre */}
          <View style={s.kpiRow}>
            <View style={s.kpiItem}>
              <Text style={s.kpiValue}>{statsLoading ? '—' : stats.jobsCompleted}</Text>
              <Text style={s.kpiLabel}>Missions</Text>
            </View>
            <View style={s.kpiSep} />
            <View style={s.kpiItem}>
              <Text style={s.kpiValue}>{statsLoading ? '—' : stats.avgRating.toFixed(1)}</Text>
              <Text style={s.kpiLabel}>Note</Text>
            </View>
            <View style={s.kpiSep} />
            <View style={s.kpiItem}>
              <Text style={s.kpiValue}>{statsLoading ? '—' : `#${Math.round(stats.rankScore)}`}</Text>
              <Text style={s.kpiLabel}>Rang</Text>
            </View>
            <View style={s.kpiSep} />
            <TouchableOpacity style={s.kpiItem} onPress={() => router.push('/wallet')} activeOpacity={0.8}>
              <Text style={s.kpiValue}>{statsLoading ? '—' : formatEuros(wallet?.balance || 0)}</Text>
              <Text style={s.kpiLabel}>Solde</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Zone centrale — radar ou icône offline */}
        <View style={s.centerZone}>
          {isOnline ? (
            <>
              <RadarPulse />
              <View style={s.scanBadge}>
                <Text style={s.scanText}>
                  {incomingRequests.length > 0
                    ? `${incomingRequests.length} mission${incomingRequests.length > 1 ? 's' : ''} disponible${incomingRequests.length > 1 ? 's' : ''}`
                    : 'Recherche active...'}
                </Text>
              </View>
            </>
          ) : (
            <View style={s.offlineBadge}>
              <Ionicons name="power-outline" size={20} color="rgba(255,255,255,0.5)" />
              <Text style={s.offlineText}>Hors ligne</Text>
            </View>
          )}
        </View>

        {/* Bouton recenter */}
        <TouchableOpacity
          style={s.recenterBtn}
          onPress={() => location && mapRef.current?.animateToRegion({
            ...location, latitudeDelta: 0.04, longitudeDelta: 0.04,
          }, 600)}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={20} color="#FFF" />
        </TouchableOpacity>



      </Animated.View>

      {/* Pop-up mission */}
      {activeJob && (
        <IncomingJobCard
          request={activeJob}
          onAccept={() => handleAccept(activeJob)}
          onDecline={() => handleDecline(activeJob.requestId)}
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0A0A0A' },
  loadingScreen: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' },

  // Overlay transparent par-dessus la carte
  overlay: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    gap: 14,
  },

    // ── Hero Card ──
  heroCard: {
    backgroundColor: '#111111',
    borderRadius: 22,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  heroGreeting: {
    fontSize: 12, fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.3,
  },
  earningsCaption: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 2,
  },
  earningsHero: {
    fontSize: 46, fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2, lineHeight: 52,
  },
  pendingPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,149,0,0.12)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)',
    marginTop: 6,
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#FF9500' },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  kpiItem:  { flex: 1, alignItems: 'center', gap: 3 },
  kpiSep:   { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  kpiValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  kpiLabel: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.3 },

  centerZone: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },

  scanBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  scanText: { fontSize: 14, fontWeight: '700', color: '#FFF', textAlign: 'center' },

  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  offlineText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  recenterBtn: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 110 : 96,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },



  missionMarker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#FF3B30', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});