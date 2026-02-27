/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/provider-dashboard.tsx
// v3 — "Perfection clinique" : Midnight map, Cockpit Island, Avatar marker, Edge vignette

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
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

const { width, height } = Dimensions.get('window');
const TIMER_DURATION = 15;

// ─── Map style "Midnight Aubergine" — routes lisibles, POI off, max contrast ──
// Routes gris-bleu sur fond presque noir. Labels très discrets. Effet pro navigation.
const MIDNIGHT_MAP_STYLE = [
  // Base
  { elementType: 'geometry',            stylers: [{ color: '#0e0e18' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#4a4a6a' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0e0e18' }] },
  // Landscape
  { featureType: 'landscape',           elementType: 'geometry',            stylers: [{ color: '#111120' }] },
  { featureType: 'landscape.man_made',  elementType: 'geometry',            stylers: [{ color: '#12121e' }] },
  // Routes — gris-bleu lisibles
  { featureType: 'road',                elementType: 'geometry',            stylers: [{ color: '#1e2035' }] },
  { featureType: 'road',                elementType: 'geometry.stroke',     stylers: [{ color: '#292940' }] },
  { featureType: 'road',                elementType: 'labels.text.fill',    stylers: [{ color: '#5a5a80' }] },
  { featureType: 'road.arterial',       elementType: 'geometry',            stylers: [{ color: '#22253a' }] },
  { featureType: 'road.arterial',       elementType: 'geometry.stroke',     stylers: [{ color: '#2e3150' }] },
  { featureType: 'road.highway',        elementType: 'geometry',            stylers: [{ color: '#2a2e4a' }] },
  { featureType: 'road.highway',        elementType: 'geometry.stroke',     stylers: [{ color: '#383c60' }] },
  { featureType: 'road.highway',        elementType: 'labels.text.fill',    stylers: [{ color: '#6060a0' }] },
  { featureType: 'road.local',          elementType: 'geometry',            stylers: [{ color: '#181828' }] },
  // Eau
  { featureType: 'water',               elementType: 'geometry',            stylers: [{ color: '#080815' }] },
  { featureType: 'water',               elementType: 'labels.text.fill',    stylers: [{ color: '#1a1a35' }] },
  // Admin
  { featureType: 'administrative',      elementType: 'geometry',            stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#5050a0' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#3a3a60' }] },
  // Off
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
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
// AVATAR MARKER — Remplace showsUserLocation natif : cercle + flèche de cap
// ============================================================================

function AvatarMarker({ heading }: { heading: number }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.1, 0] });

  return (
    <View style={av.wrap}>
      {/* Pulse */}
      <Animated.View style={[av.pulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
      {/* Précision circle */}
      <View style={av.accuracyRing} />
      {/* Core dot */}
      <View style={av.core}>
        {/* Flèche de cap */}
        <View style={[av.arrow, { transform: [{ rotate: `${heading}deg` }] }]}>
          <View style={av.arrowHead} />
        </View>
        <View style={av.dot} />
      </View>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4B7BEC',
  },
  accuracyRing: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(75,123,236,0.4)',
    backgroundColor: 'rgba(75,123,236,0.08)',
  },
  core: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#4B7BEC',
    borderWidth: 2.5, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4B7BEC', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FFF',
    position: 'absolute',
  },
  arrow: {
    position: 'absolute',
    width: 20, height: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: -12,
  },
  arrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#4B7BEC',
  },
});

// ============================================================================
// RADAR PULSE — visible uniquement en ligne
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
          Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 700);
    pulse(ring3, 1400);
  }, []);

  const ring = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
    opacity:   anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 0.15, 0] }),
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
  wrap: { width: 130, height: 130, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: 'rgba(75,123,236,0.6)',
  },
  core: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(75,123,236,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(75,123,236,0.3)',
  },
});

// ============================================================================
// INCOMING JOB CARD — inchangé, il est parfait
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
  const slideUp   = useRef(new Animated.Value(420)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    Animated.timing(timerAnim, { toValue: 0, duration: TIMER_DURATION * 1000, useNativeDriver: false }).start();
    return () => clearInterval(interval);
  }, []);

  const netPrice  = request.price * 0.85;
  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: ['#FF3B30', '#FF9500', '#34C759'],
  });

  return (
    <Animated.View style={[jc.wrap, { transform: [{ translateY: slideUp }] }]}>
      {/* Timer bar */}
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
    position: 'absolute',
    // Tab bar Expo Router : ~83px iOS / ~60px Android
    bottom: Platform.OS === 'ios' ? 83 : 60,
    left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 0, paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: -10 },
    elevation: 22,
  },
  timerTrack:  { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  timerFill:   { height: '100%', borderRadius: 2 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  headerLeft:  { flex: 1, gap: 6 },
  urgentPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF3B30', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  urgentText:  { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  title:       { fontSize: 18, fontWeight: '800', color: '#111', lineHeight: 24 },
  priceBlock:  { alignItems: 'flex-end' },
  priceLabel:  { fontSize: 10, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  price:       { fontSize: 38, fontWeight: '900', color: '#111', lineHeight: 44, letterSpacing: -1 },
  priceGross:  { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  metas:       { gap: 8, marginBottom: 20 },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText:    { fontSize: 13, color: '#555', fontWeight: '500', flex: 1 },
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  timerNum:    { fontSize: 16, fontWeight: '800', color: '#111' },
  timerUrgent: { color: '#FF3B30' },
  declineBtn:  {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  acceptBtn:   {
    flex: 1, height: 50, backgroundColor: '#111',
    borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acceptText:  { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// COCKPIT ISLAND v3 — Slim pill, Apple/Tesla style
// ============================================================================

function CockpitIsland({
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
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const dotGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotGlowAnim, { toValue: 1,   duration: 1400, useNativeDriver: true }),
          Animated.timing(dotGlowAnim, { toValue: 0.4, duration: 1400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      dotGlowAnim.stopAnimation();
      dotGlowAnim.setValue(0);
    }
  }, [isOnline]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60,  useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const dotOpacity = dotGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={[ci.island, { transform: [{ scale: scaleAnim }] }]}>

      {/* Statut — zone tactile gauche */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[ci.statusSection, isOnline ? ci.bgOnline : ci.bgOffline]}
      >
        <View style={ci.dotWrap}>
          {isOnline && (
            <Animated.View style={[ci.dotGlow, { opacity: dotOpacity }]} />
          )}
          <View style={[ci.dot, isOnline ? ci.dotOn : ci.dotOff]} />
        </View>
        <Text style={[ci.statusText, isOnline ? ci.statusOn : ci.statusOff]}>
          {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
        </Text>
      </TouchableOpacity>

      {/* Séparateur */}
      <View style={ci.sep} />

      {/* Wallet — solde réel Prisma */}
      <TouchableOpacity onPress={onWalletPress} activeOpacity={0.75} style={ci.walletSection}>
        <Text style={ci.walletLabel}>SOLDE</Text>
        <Text style={ci.walletAmount}>{formatEuros(wallet?.balance || 0)}</Text>
      </TouchableOpacity>

    </Animated.View>
  );
}

const ci = StyleSheet.create({
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,14,14,0.97)',
    borderRadius: 44,
    height: 52,           // +4px — plus d'air vertical
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 22,
  },
  // Statut = action principale, zone plus généreuse
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 20, // 20px minimum pour respirer
    borderRadius: 22,
    gap: 10,
  },
  bgOnline:  { backgroundColor: 'rgba(52,199,89,0.13)' },
  bgOffline: { backgroundColor: 'transparent' },
  dotWrap:   { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dotGlow:   { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#34C759' },
  dot:       { width: 7, height: 7, borderRadius: 3.5 },
  dotOn:     { backgroundColor: '#34C759' },
  dotOff:    { backgroundColor: '#3e3e3e' },
  statusText:  { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  statusOn:    { color: '#34C759' },
  statusOff:   { color: 'rgba(255,255,255,0.30)' },
  // Séparateur = suggestion, pas coupure
  sep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 2 },
  // Solde = info secondaire, compact mais lisible
  walletSection: {
    alignItems: 'flex-end',
    paddingLeft: 14,
    paddingRight: 22,   // air généreux côté droit
    gap: 1,
  },
  walletLabel:  { fontSize: 8.5, fontWeight: '600', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.8, textTransform: 'uppercase' },
  walletAmount: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
});


// ============================================================================
// STATS KPI — avec "Action Card" si zéro missions
// ============================================================================

function StatsSection({
  stats,
  wallet,
  loading,
  onWithdraw,
  onWallet,
}: {
  stats: ProviderStats;
  wallet: WalletData | null;
  loading: boolean;
  onWithdraw: () => void;
  onWallet: () => void;
}) {
  const isFirstTimer = !loading && stats.jobsCompleted === 0;

  if (loading) {
    return (
      <View style={ss.loadingRow}>
        {[0,1,2,3].map(i => (
          <View key={i} style={ss.shimmer} />
        ))}
      </View>
    );
  }
}

const ss = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 16,
  },
  shimmer: {
    flex: 1, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(75,123,236,0.10)',
    borderRadius: 16, padding: 16,
    // Bordure lumineuse = CTA visible, pas juste décoratif
    borderWidth: 1, borderColor: 'rgba(75,123,236,0.38)',
    shadowColor: '#4B7BEC', shadowOpacity: 0.15,
    shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  actionIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: 'rgba(75,123,236,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(75,123,236,0.3)',
  },
  actionTextWrap: { flex: 1, gap: 4 },
  actionTitle:    { fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 18 },
  actionSub:      { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  kpiItem:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiSep:   { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)' },
  kpiNum:   { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  kpiGold:  { color: '#FFD060' },
  kpiStar:  { fontSize: 12, color: '#FFD060' },
  kpiLabel: { fontSize: 10, fontWeight: '400', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.4 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProviderDashboard() {
  const router           = useRouter();
  const { user }         = useAuth();
  const { socket, isConnected } = useSocket();

  const mapRef   = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [location,      setLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading,       setHeading]        = useState(0);
  const [locationError, setLocationError] = useState(false);
  const [wallet,        setWallet]         = useState<WalletData | null>(null);
  const [stats,         setStats]          = useState<ProviderStats>({ jobsCompleted: 0, avgRating: 5.0, rankScore: 100 });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading,       setLoading]        = useState(true);
  const [isOnline,      setIsOnline]       = useState(false);

  // Fade in à l'ouverture
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Géolocalisation + heading
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(true); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      if (loc.coords.heading != null) setHeading(loc.coords.heading);

      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 900);

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setLocation(c);
          if (l.coords.heading != null) setHeading(l.coords.heading);
          if (socket && isOnline && user?.id) {
            socket.emit('provider:location', { providerId: user.id, ...c });
          }
        }
      );
    })();
  }, []);

  // Data (wallet + stats)
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
    ]);

    if (results[0].status === 'fulfilled') {
      const w = results[0].value as any;
      setWallet({
        balance:       w.balance       || 0,
        pendingAmount: w.pendingAmount  || 0,
        totalEarnings: w.totalEarnings  || 0,
      });
    } else {
      console.warn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    }

    if (results[1].status === 'fulfilled') {
      const u = (results[1].value as any)?.user || (results[1].value as any)?.data || results[1].value;
      setStats({
        jobsCompleted: u.jobsCompleted ?? u.completedMissions ?? u.totalCompleted ?? 0,
        avgRating:     u.avgRating     ?? u.averageRating      ?? u.rating        ?? 5.0,
        rankScore:     u.rankScore     ?? u.rank               ?? u.score         ?? 0,
      });
    } else {
      console.warn('Stats failed:', (results[1] as PromiseRejectedResult).reason?.message);
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Socket
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
      setIncomingRequests(prev => prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]);
      if (req.latitude && req.longitude) {
        mapRef.current?.animateToRegion({
          latitude: req.latitude, longitude: req.longitude,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
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
      socket.off('new_request',           handleNewRequest);
      socket.off('request:claimed',       removeRequest);
      socket.off('request:expired',       removeRequest);
      socket.off('provider:status_update', handleStatusUpdate);
    };
  }, [socket, user?.id]);

  // Toggle online
  const handleToggleOnline = useCallback(() => {
    if (!user?.id) return;
    const next = !isOnline;
    setIsOnline(next);
    Vibration.vibrate(next ? [0, 60, 30, 60] : 40);
    if (socket) socket.emit('provider:set_status', { providerId: user.id, status: next ? 'READY' : 'OFFLINE' });
    if (!next) setIncomingRequests([]);
    if (next && location) {
      mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 700);
    }
  }, [isOnline, socket, user?.id, location]);

  // Accept / Decline
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;
    if (socket) socket.emit('provider:accept', { requestId: request.requestId, providerId: user.id, clientId: request.clientId });
    Vibration.vibrate(100);
    setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
    router.push(`/request/${request.requestId}/ongoing`);
  }, [socket, user?.id, router]);

  const handleDecline = useCallback(async (requestId: string) => {
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  const activeJob = incomingRequests[0] || null;

  // ── Loading screen ──
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="navigate-circle" size={52} color="rgba(75,123,236,0.4)" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Carte Midnight Aubergine plein écran ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={MIDNIGHT_MAP_STYLE}
        showsUserLocation={false}        // Désactivé — on utilise notre AvatarMarker
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        initialRegion={{
          latitude:      location?.latitude  ?? 48.8566,
          longitude:     location?.longitude ?? 2.3522,
          latitudeDelta:  0.035,
          longitudeDelta: 0.035,
        }}
      >
        {/* Avatar marker custom avec cap de direction */}
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
            tracksViewChanges={false}
          >
            <AvatarMarker heading={heading} />
          </Marker>
        )}

        {/* Markers missions entrantes */}
        {incomingRequests.map(req =>
          req.latitude && req.longitude ? (
            <Marker
              key={req.requestId}
              coordinate={{ latitude: req.latitude, longitude: req.longitude }}
              title={req.title}
              description={req.address}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={s.missionMarker}>
                <Ionicons name="flash" size={14} color="#FFF" />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* ── Vignette top — dégradé derrière le Top Island ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.80)', 'rgba(0,0,0,0.35)', 'transparent']}
        style={s.vignetteTop}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════════
          TOP ISLAND — îlot unique absolu en haut
          Toggle online + Gains + Stats + Recenter
      ══════════════════════════════════════════════ */}
      {!activeJob && (
        <Animated.View style={[s.topIsland, { opacity: fadeAnim }]}>

          {/* Ligne 1 — CockpitIsland + Recenter côte à côte */}
          <View style={s.tiRow}>
            <CockpitIsland
              isOnline={isOnline}
              isConnected={isConnected}
              wallet={wallet}
              onToggle={handleToggleOnline}
              onWalletPress={() => router.push('/wallet')}
            />
            <TouchableOpacity
              style={s.recenterBtn}
              onPress={() => location && mapRef.current?.animateToRegion({
                ...location, latitudeDelta: 0.035, longitudeDelta: 0.035,
              }, 700)}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={s.tiSep} />

          {/* Ligne 2 — Gains hero + bouton Retirer */}
          <View style={s.earningsRow}>
            <View style={s.earningsLeft}>
              <Text style={s.greeting}>{user?.name || user?.email?.split('@')[0]}</Text>
              <View style={s.earningsCaptionRow}>
                <Text style={s.earningsCaption}>gains nets · ce mois</Text>
                {/* Label contextuel si zéro — évite le "data mismatch" */}

              </View>
              <Text style={s.earningsHero}>
                {statsLoading ? '—' : formatEuros(wallet?.totalEarnings || 0)}
              </Text>
              {!statsLoading && (wallet?.pendingAmount || 0) > 0 && (
                <View style={s.pendingPill}>
                  <Text style={s.pendingText}>
                    +{formatEuros(wallet?.pendingAmount || 0)} en attente
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={s.withdrawBtn}
              onPress={() => router.push('/wallet')}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up" size={15} color="#111" />
              <Text style={s.withdrawText}>Retirer</Text>
            </TouchableOpacity>
          </View>

          {/* Ligne 3 — KPIs / Action Card */}
          <StatsSection
            stats={stats}
            wallet={wallet}
            loading={statsLoading}
            onWithdraw={() => router.push('/wallet')}
            onWallet={() => router.push('/wallet')}
          />

        </Animated.View>
      )}

      {/* ── Radar au centre de la carte (online + pas de mission active) ── */}
      {isOnline && !activeJob && (
        <View style={s.centerZone} pointerEvents="none">
          <RadarPulse />
          <View style={s.scanBadge}>
            <View style={s.scanDot} />
            <Text style={s.scanText}>
              {incomingRequests.length > 0
                ? `${incomingRequests.length} mission${incomingRequests.length > 1 ? 's' : ''} disponible${incomingRequests.length > 1 ? 's' : ''}`
                : 'En écoute...'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Pop-up mission entrante ── */}
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
// STYLES PRINCIPAUX
// ============================================================================

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0e0e18' },
  loadingScreen: {
    flex: 1, backgroundColor: '#0e0e18',
    justifyContent: 'center', alignItems: 'center',
  },

  // Vignette top — derrière le Top Island
  vignetteTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 340 : 310,
    zIndex: 9000,
  },

  // ── TOP ISLAND — îlot absolu en haut, contient tout ──
  topIsland: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 44,
    left: 14, right: 14,
    zIndex: 9999,
    backgroundColor: '#111118',
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,  // respiration latérale obligatoire
    paddingBottom: 18,
    gap: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.85,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 28,
  },

  // Ligne 1 de l'îlot : CockpitIsland + Recenter
  tiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Séparateur interne
  tiSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },

  // Recenter — dans l'îlot, pas en absolu
  recenterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  // Zone centrale — radar au milieu de la carte
  centerZone: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 2,
  },

  scanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scanDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#34C759',
  },
  scanText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Earnings (dans le Top Island)
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  earningsLeft: { gap: 2, flex: 1 },
  greeting: {
    fontSize: 12, fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.2, marginBottom: 6,
  },
  earningsCaptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2,
  },
  earningsCaption: {
    fontSize: 10, fontWeight: '500',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  zeroBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  zeroBadgeText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.4 },
  earningsHero: {
    fontSize: 36, fontWeight: '900',  // 900 = imposant même à zéro
    color: '#FFFFFF',
    letterSpacing: -2, lineHeight: 42,
    marginTop: 2,
  },
  pendingPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.22)',
    marginTop: 8,
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#FF9500' },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 4, flexShrink: 0,
  },
  withdrawText: { fontSize: 13, fontWeight: '800', color: '#111' },

  // Mission marker
  missionMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: '#FF3B30', shadowOpacity: 0.7, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});