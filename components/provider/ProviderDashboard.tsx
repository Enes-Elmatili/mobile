/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/ProviderDashboard.tsx — l'accueil prestataire, rendu par
// l'onglet Accueil (app/(tabs)/dashboard.tsx) : UNE instance, jamais deux.
// (La route /(tabs)/provider-dashboard ne fait plus que rediriger.) — l'accueil prestataire : le GO.
// Un seul objet dit l'état : le disque vert au centre du dock = hors ligne ;
// le stop à gauche + « Vous êtes en ligne » = en ligne ; disparu = une demande
// ou une mission occupe l'écran. La carte s'allume en ligne, la caméra suit
// les faits (moi, moi + la demande, moi + la porte), la journée reste lisible
// en bas, le gain du jour au centre du haut (spec 2026-09-17-provider-cockpit-go).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useLayoutClass } from '@/lib/layout';
import Reanimated, { Easing, useSharedValue, useAnimatedStyle, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useReduceMotion, dampingFor } from '@/lib/motion/sheet';
import { feedback } from '@/lib/feedback/feedback';
import { briefOf, type MissionBrief } from '@/lib/mission/brief';
import { IncomingMissionCard } from '@/components/mission/IncomingMissionCard';
import MapView from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { useTabBarPadding } from '@/app/(tabs)/_layout';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { useNetwork } from '@/lib/NetworkContext';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, COLORS, alpha } from '@/hooks/use-app-theme';
import { devWarn } from '@/lib/logger';
import { isOnlineStatus, gateCopyFor, GATE_CODES } from '@/lib/providerGate';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
import { useMapCamera } from '@/lib/mission/useMapCamera';
import { fetchRoute, type LatLng } from '@/lib/mission/route';
import { cockpitStageOf, cockpitCameraMode } from '@/lib/cockpit/stage';
import { useNavStore, providerDisc } from '@/stores/nav';
import { remindersOf, nextMissionOf, type MissionLite, type Reminder, type NextMission } from '@/lib/cockpit/day';
import { cockpitGeometry } from '@/lib/cockpit/geometry';
import { TopRow } from '@/components/cockpit/TopRow';
import { DayStrip } from '@/components/cockpit/DayStrip';
import { StateLabel } from '@/components/cockpit/StateLabel';
import { MissionFlow, type MissionFacts } from '@/components/provider/MissionFlow';
import { GpsCard } from '@/components/cockpit/GpsCard';
import { Veil } from '@/components/cockpit/Veil';
import { MePin, DemandPin, DoorPin, RouteTrace } from '@/components/cockpit/markers';
import { metersBetween } from '@/lib/mission/stage';

const TIMER_DURATION = 60;
const BRUSSELS: LatLng = { latitude: 50.8466, longitude: 4.3528 };

// Entrée de la carte de mission entrante : spring critique (ζ = 1.0).
// Une notification de mission doit se poser, pas rebondir (règle 2).
const CARD_ENTER_SPRING = {
  damping: dampingFor(1.0, 180, 1),
  stiffness: 180,
  mass: 1,
};

// ============================================================================
// TYPES
// ============================================================================

interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  clientId?: string;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
  latitude?: number;
  longitude?: number;
  isQuote?: boolean;
  pricingMode?: string;
  calloutFee?: number;
  /** Fiche mission (services/missionBrief) — celle du serveur, sinon le repli. */
  brief: MissionBrief;
  /** La demande telle que reçue : sert d'amorce à la feuille de mission, sans attendre le serveur. */
  raw: any;
}

type CurrentMission = {
  id: number; serviceType: string | null; status: string; address: string | null;
  clientName: string | null; lat: number | null; lng: number | null;
};

// ============================================================================
// INCOMING JOB CARD — la fiche « elle est pour vous »
// ============================================================================

function IncomingJobCard({
  request,
  onAccept,
  onDecline,
  leaving,
  bottom,
  insetBottom,
  maxWidth,
}: {
  request: IncomingRequest;
  onAccept: () => void;
  onDecline: () => void;
  /** Le serveur a confirmé : la fiche se replie vers le bas, l'accueil passe en mission. */
  leaving: boolean;
  /** Bord bas de la fiche (0 : elle descend jusqu'au bord ; la barre s'est effacée). */
  bottom: number;
  /** Inset bas du device, DANS la fiche : rien de la carte ne transparaît dessous. */
  insetBottom: number;
  /** Largeur de lecture sur écran large ; toute la largeur sinon. */
  maxWidth: number | null;
}) {
  const theme = useAppTheme();
  const reduced    = useReduceMotion();
  const slideUp    = useSharedValue(400);
  const fade       = useSharedValue(1);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [expired, setExpired] = useState(false);
  // Le moment de l'acceptation, en UN mouvement, sur le même écran, et
  // discret : la fiche se teinte du vert pâle des pastilles (rien ne se
  // superpose, tout reste lisible), l'anneau du compte à rebours s'efface, le
  // curseur prend sa coche verte, le titre passe à « Acceptée » ; on la
  // laisse se lire, puis elle se replie vers le bas — et l'accueil est déjà en
  // mission dessous (carte recadrée, tracé, étiquette ambre, feuille).
  // L'haptique est partie sur la frame du glissé.
  const [accepted, setAccepted] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tint = useSharedValue(0);
  const accept = useCallback(() => {
    if (accepted) return;
    setAccepted(true);
    tint.value = withTiming(1, { duration: reduced ? 200 : 520, easing: Easing.out(Easing.cubic) });
    onAccept();
  }, [accepted, reduced, tint, onAccept]);
  useEffect(() => {
    if (!leaving) return;
    // Repli : la fiche descend et s'efface, en partant de sa position courante.
    slideUp.value = reduced ? withTiming(0, { duration: 1 }) : withTiming(Math.max(size.h, 400) + 80, { duration: 460, easing: Easing.in(Easing.cubic) });
    fade.value = withTiming(0, { duration: reduced ? 200 : 380 });
  }, [leaving, reduced, slideUp, fade, size.h]);
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value }));

  useEffect(() => {
    if (reduced) {
      // Règle 8 : pas de course, on pose l'état final.
      slideUp.value = 0;
      return;
    }
    // Entrée : spring critique (ζ = 1.0) — arrive vite, ne dépasse pas.
    slideUp.value = withSpring(0, CARD_ENTER_SPRING);
    return () => { cancelAnimation(slideUp); };
  }, [reduced, slideUp]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideUp.value }], opacity: fade.value }));

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // When countdown reaches 0, switch to "last chance" mode instead of dismissing
  useEffect(() => {
    if (timeLeft === 0) setExpired(true);
  }, [timeLeft]);

  const sheetBg = theme.bg;

  return (
    <Reanimated.View style={[jc.wrap, { bottom }, maxWidth != null && { maxWidth, alignSelf: 'center', left: undefined, right: undefined, width: '100%' }, cardStyle]}>
      {/* Gradient map → sheet */}
      <LinearGradient
        colors={['transparent', `${sheetBg}99`, sheetBg]}
        locations={[0, 0.4, 1]}
        style={jc.topFade}
        pointerEvents="none"
      />
      <View style={[jc.sheet, { backgroundColor: sheetBg, paddingBottom: Math.max(insetBottom, 12) + 12 }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* Le vert pâle des pastilles, en fondu sous le contenu. */}
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(COLORS.greenBrand, theme.isDark ? 0.16 : 0.13) }, tintStyle]} pointerEvents="none" />
        <View style={[jc.handle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }]} />
        {/* Fiche mission (planche 2A) : quoi, photos, faits, gain, glissé. */}
        <IncomingMissionCard
          brief={request.brief}
          timeLeft={timeLeft}
          total={TIMER_DURATION}
          expired={expired}
          accepted={accepted}
          onAccept={accept}
          onDecline={onDecline}
        />
      </View>
    </Reanimated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, zIndex: 8,
    shadowColor: '#000', shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.3,
    elevation: 28,
  },
  topFade: { height: 56 },
  sheet: { overflow: 'hidden' },
  handle: { width: 36, height: 3, borderRadius: 2, alignSelf: 'center', marginTop: 14 },
});

// ============================================================================
// DASHBOARD
// ============================================================================

export default function ProviderDashboard() {
  const router           = useRouter();
  const { t }            = useTranslation();
  const { user }         = useAuth();
  const { socket, unreadCount, unreadMessages } = useSocket();
  const { isOnline: networkOnline } = useNetwork();
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const layout = useLayoutClass();
  const windowHeight = layout.height;
  // Dessus de la barre flottante (et du disque d'action) depuis le bas de l'écran.
  const tabBarHeight = useTabBarPadding(0);

  const mapRef   = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const [location,      setLocation]      = useState<LatLng | null>(null);
  const [heading,       setHeading]        = useState(0);
  const [gpsDenied,     setGpsDenied]      = useState(false);
  const [today,         setToday]          = useState(0);
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [missions,      setMissions]       = useState<MissionLite[]>([]);
  const [connect,       setConnect]        = useState<{ needsOnboarding?: boolean; payoutsEnabled?: boolean } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  // La demande acceptée dont la mission s'ouvre : la fiche fait monter son vert sur l'écran.
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // Mission active actuelle (acceptée et en cours, non planifiée future) →
  // permet au provider qui revient sur le dashboard de re-rentrer dans la mission.
  const [currentMission, setCurrentMission] = useState<CurrentMission | null>(null);
  // Lien profond hérité (/request/:id/ongoing → accueil ?mission=) : cette
  // mission passe devant la dérivation, même planifiée un peu plus tôt.
  const { mission: wantedMissionParam } = useLocalSearchParams<{ mission?: string }>();
  const wantedMissionRef = useRef<string | null>(null);
  if (wantedMissionParam && wantedMissionRef.current !== String(wantedMissionParam)) wantedMissionRef.current = String(wantedMissionParam);
  // Ce que la feuille de mission dit à l'accueil (stade, caméra, porte, hauteur).
  const [missionFacts, setMissionFacts] = useState<MissionFacts | null>(null);
  // L'amorce de la feuille de mission à l'acceptation : la demande reçue + la réponse du serveur.
  const [missionSeed, setMissionSeed] = useState<any>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const currentMissionRef = useRef<CurrentMission | null>(null);
  useEffect(() => { currentMissionRef.current = currentMission; }, [currentMission]);
  const etaRef = useRef<number | null>(null);
  useEffect(() => { etaRef.current = etaMin; }, [etaMin]);
  const [loading,       setLoading]        = useState(true);
  const [isOnline,      setIsOnline]       = useState(false);
  const isOnlineRef = useRef(false);
  // C'est le prestataire qui choisit : tant qu'il n'a pas appuyé sur GO dans
  // cette session, un statut READY hérité d'une session précédente (renvoyé par
  // le serveur au register) est ramené à OFFLINE au lieu d'être affiché.
  const userChoseRef = useRef(false);
  const declinedIdsRef = useRef<Set<string>>(new Set());
  // Depuis quand on est en ligne (chrono du dock) — posé au passage à « en ligne ».
  const [onlineSince, setOnlineSince] = useState<number | null>(null);
  useEffect(() => { setOnlineSince((prev) => (isOnline ? prev ?? Date.now() : null)); }, [isOnline]);

  // Geolocalisation — démarrée au montage ; si la permission a été refusée,
  // on la redemande au retour sur l'écran (l'utilisateur revient des réglages).
  const dashLocSubRef = useRef<Location.LocationSubscription | null>(null);
  const dashLastEmitRef = useRef(0);
  const missionEmitRef = useRef(0);
  const geoGenRef = useRef(0);
  const startGeo = useCallback(async () => {
    const gen = ++geoGenRef.current;
    const stale = () => gen !== geoGenRef.current;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (stale()) return;
    if (status !== 'granted') { setGpsDenied(true); return; }
    setGpsDenied(false);

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (stale()) return;
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(coords);
    if (loc.coords.heading != null) setHeading(loc.coords.heading);

    // Sync initial position to backend so matching can find this provider
    if (socket && user?.id) {
      socket.emit('provider:location_update', { providerId: user.id, ...coords });
    }

    if (dashLocSubRef.current) { dashLocSubRef.current.remove(); dashLocSubRef.current = null; }
    const sub = await Location.watchPositionAsync(
      // distanceInterval réduit (10 m) + timeInterval court (3 s) pour que
      // la caméra suive bien les mouvements. Le throttle du socket emit
      // reste à 15s pour ne pas spammer le backend.
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
      (l) => {
        const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
        setLocation(c);
        if (l.coords.heading != null) setHeading(l.coords.heading);

        const now = Date.now();
        // En mission : la position (et l'ETA) partent vers le suivi du client toutes les 10 s.
        const cm = currentMissionRef.current;
        if (cm && now - missionEmitRef.current >= 10_000 && socket?.connected) {
          missionEmitRef.current = now;
          const eta = etaRef.current;
          socket.emit('provider:location_update', { requestId: Number(cm.id), lat: c.latitude, lng: c.longitude, eta: eta != null ? `${eta} min` : undefined });
        }
        if (now - dashLastEmitRef.current >= 15_000 && socket && isOnlineRef.current && networkOnline && user?.id) {
          dashLastEmitRef.current = now;
          socket.emit('provider:location_update', { providerId: user.id, ...c });
        }
      }
    );
    if (stale()) { sub.remove(); return; }
    dashLocSubRef.current = sub;
  }, []);

  useEffect(() => {
    startGeo();
    return () => {
      geoGenRef.current++;
      if (dashLocSubRef.current) { dashLocSubRef.current.remove(); dashLocSubRef.current = null; }
    };
  }, [startGeo]);

  useFocusEffect(useCallback(() => {
    if (!gpsDenied) return;
    Location.getForegroundPermissionsAsync().then((p) => { if (p.status === 'granted') startGeo(); }).catch(() => {});
  }, [gpsDenied, startGeo]));

  // Fallback : si onMapReady ne fire pas dans les 3 secondes (Google Maps SDK
  // qui silencie parfois l'event sur iOS / simulateur), on force mapReady=true
  // pour débloquer la caméra. animateToRegion no-op si réellement pas prêt.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => setMapReady(true), 3000);
    return () => clearTimeout(t);
  }, [mapReady]);

  // Data
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
      api.dashboard.provider(),
      api.providers.missions(),
      api.connect.balance(),
    ]);

    const dashData = results[2].status === 'fulfilled' ? (results[2].value as any) : null;
    setToday(dashData?.stats?.todayEarnings?.total || 0);

    if (results[0].status === 'rejected') devWarn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    if (results[2].status === 'rejected') devWarn('Stats failed:', (results[2] as PromiseRejectedResult).reason?.message);

    if (results[4].status === 'fulfilled') {
      const c = results[4].value as any;
      setConnect({ needsOnboarding: c?.needsOnboarding, payoutsEnabled: c?.payoutsEnabled });
    }

    // Mission active : ACCEPTED/ONGOING/QUOTE_SENT/QUOTE_ACCEPTED, non planifiée future.
    // On ouvre le re-entry dans la mission pour le provider qui revient sur le dashboard.
    if (results[3].status === 'fulfilled') {
      const m = (results[3].value as any)?.items || [];
      setMissions(m);
      const ACTIVE = ['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];
      const wanted = wantedMissionRef.current;
      const found = (wanted ? m.find((r: any) => String(r.id) === wanted && ACTIVE.includes(r.status)) : null) || m.find((r: any) => {
        if (!ACTIVE.includes(r.status)) return false;
        if (r.preferredTimeStart) {
          const startTs = new Date(r.preferredTimeStart).getTime();
          if (startTs > Date.now() + 30 * 60 * 1000) return false; // >30 min futur → "à venir"
        }
        return true;
      });
      // Une mission posée à l'acceptation (optimiste) que la liste ne connaît
      // pas encore reste en place : la retirer ferait clignoter la feuille.
      setCurrentMission((prev) => {
        if (found) return { id: found.id, serviceType: found.serviceType, status: found.status, address: found.address, clientName: found.client?.name ?? null, lat: found.lat ?? null, lng: found.lng ?? null };
        if (prev && !m.some((r: any) => Number(r.id) === Number(prev.id))) return prev;
        return null;
      });
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);
  // Un lien profond vers une mission précise (ancienne route /ongoing) : on recharge pour la mettre devant.
  useEffect(() => { if (wantedMissionParam) loadData(); }, [wantedMissionParam, loadData]);

  useEffect(() => { loadData(); }, [loadData]);
  // Refetch quand le provider revient sur le dashboard (après /ongoing par ex.)
  // pour rafraîchir la carte mission et le gain du jour.
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Load current incoming queue via REST — hydrates the card list on dashboard open
  // so the provider sees existing "now" + devis requests without waiting for the next
  // socket rebroadcast tick. Scheduled-for-future requests live in the missions tab.
  // Extracted as a stable callback so we can re-invoke on socket (re)connect.
  // In-flight guard: mount, socket 'connect', and the 20s polling timer can
  // all fire this within a few ms of each other; coalesce to a single GET.
  const incomingInFlightRef = useRef(false);
  // Hard-stop guard: once the backend tells us this account isn't a provider
  // (token has PROVIDER role flag but no provider profile exists), there's no
  // point re-trying every 20s and spamming logs. Latch it for the session and
  // bounce the user back to the client dashboard.
  const notProviderRef = useRef(false);
  const fetchIncomingQueue = useCallback(async () => {
    if (!user?.id) return;
    if (notProviderRef.current) return;
    if (incomingInFlightRef.current) return;
    incomingInFlightRef.current = true;
    try {
      const res: any = await api.get('/requests/incoming');
      const items = res?.data || res || [];
      if (Array.isArray(items) && items.length > 0) {
        const mapped: IncomingRequest[] = items.map((r: any) => ({
          requestId: String(r.id),
          title: r.serviceType || r.category?.name || 'Mission',
          description: r.description || '',
          price: r.price || 0,
          address: r.address || '',
          latitude: r.lat,
          longitude: r.lng,
          urgent: r.urgent || false,
          pricingMode: r.pricingMode,
          isQuote: r.status === 'QUOTE_PENDING',
          calloutFee: r.calloutFee ?? undefined,
          brief: briefOf(r),
          raw: r,
          client: { name: r.client?.name || 'Client' },
        }));
        setIncomingRequests(prev => {
          const existingIds = new Set(prev.map(r => r.requestId));
          const newOnes = mapped.filter((r: any) =>
            !existingIds.has(r.requestId) && !declinedIdsRef.current.has(r.requestId)
          );
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
    } catch (e: any) {
      if (e?.status === 403 && e?.data?.code === 'NOT_PROVIDER') {
        notProviderRef.current = true;
        devWarn('⚠️ Account is not a provider — redirecting to client dashboard');
        router.replace('/(tabs)/dashboard');
      }
    } finally {
      incomingInFlightRef.current = false;
    }
  }, [user?.id, router]);

  useEffect(() => {
    fetchIncomingQueue();
  }, [fetchIncomingQueue]);

  // Polling safety net : rafraîchit /requests/incoming toutes les 20s tant que
  // le provider est online. Garantit l'apparition des cards même si le socket
  // rate un event (cas : register pas encore enregistré sur le backend quand
  // le new_request est émis, latence réseau, buffering, etc.).
  useEffect(() => {
    if (!user?.id || !isOnline) return;
    if (notProviderRef.current) return;
    const iv = setInterval(() => {
      fetchIncomingQueue();
    }, 20000);
    return () => clearInterval(iv);
  }, [user?.id, isOnline, fetchIncomingQueue]);

  // Socket
  useEffect(() => {
    if (!socket || !user?.id) return;

    // Helper: register + refresh incoming queue. Called on mount (if already connected)
    // AND on every (re)connect, so a brief network blip doesn't leave the provider in a
    // zombie state where the server doesn't know their socket and they miss new_request
    // events. Without this, the provider could wait up to 45s (next rebroadcast tick)
    // before seeing an incoming card.
    const registerAndRefresh = () => {
      socket.emit('provider:register', { providerId: user.id });
      // Ne PAS présumer « en ligne » ici : le serveur ne met en READY qu'un
      // prestataire validé. Affirmer true à chaque (re)connexion affichait
      // « En ligne » à un prestataire que le backend gardait OFFLINE — le
      // switch mentait sans qu'aucune action de l'utilisateur ne l'explique.
      // L'état réel arrive via provider:registered ci-dessous.
      fetchIncomingQueue();
    };

    if (socket.connected) {
      registerAndRefresh();
    }

    const handleNewRequest = (data: any) => {
      const rid = String(data.requestId ?? data.id);
      if (declinedIdsRef.current.has(rid)) return; // already declined, ignore rebroadcast
      feedback.haptic('warning');
      const lat = data.latitude ?? data.lat;
      const lng = data.longitude ?? data.lng;
      const req: IncomingRequest = {
        requestId:   String(data.requestId ?? data.id),
        title:       data.title || data.serviceType || t('provider.mission'),
        description: data.description || '',
        price:       data.price ?? 0,
        address:     data.address || t('provider.unknown_address'),
        urgent:      data.urgent || false,
        distance:    data.distance,
        clientId:    data.clientId || data.client?.id,
        client:      { name: data.client?.name || data.clientName || t('provider.client'), avatarUrl: data.client?.avatarUrl || null, city: data.client?.city || null },
        latitude:    lat,
        longitude:   lng,
        isQuote:     data.isQuote || false,
        pricingMode: data.pricingMode || null,
        calloutFee:  data.calloutFee ?? undefined,
        brief:       briefOf(data),
        raw:         data,
      };
      // La caméra cadre moi + la demande via useMapCamera (stade « incoming »).
      setIncomingRequests(prev => prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]);
    };

    const removeRequest = (id: string | number) =>
      setIncomingRequests(prev => prev.filter(r => r.requestId !== String(id)));

    // Client a annulé → retirer la carte (payload objet { id, ... })
    const handleCancelled = (data: any) => removeRequest(data?.id ?? data);

    // Un « en ligne » que le prestataire n'a pas choisi dans cette session
    // (statut hérité, ou remise en READY après une mission) est refusé.
    const applyServerOnline = (online: boolean) => {
      if (online && !userChoseRef.current) {
        socket.emit('provider:set_status', { status: 'OFFLINE' });
        online = false;
      }
      isOnlineRef.current = online;
      setIsOnline(online);
      if (!online) setIncomingRequests([]);
    };

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) applyServerOnline(isOnlineStatus(data.status));
    };

    // Réponse du serveur à provider:register — porte le statut réel du compte.
    // Un dossier non validé revient en 'pending_validation' : le switch doit
    // refléter ça, pas un optimisme local.
    const handleRegistered = (data: any) => {
      // server.js émet { providerId, status, blocked? } ; on accepte aussi la
      // forme imbriquée au cas où un ancien serveur répondrait { provider }.
      applyServerOnline(isOnlineStatus(data?.status ?? data?.provider?.status));
    };

    // Le serveur refuse le passage en ligne (dossier incomplet ou Stripe non
    // finalisé). On remet le GO sur la vérité serveur et on propose
    // d'aller finir l'étape manquante — volet coulissant, pas d'alerte système.
    const handleStatusRejected = async (data: { code?: string; message?: string; status?: string }) => {
      const online = isOnlineStatus(data?.status);
      isOnlineRef.current = online;
      setIsOnline(online);
      if (!online) setIncomingRequests([]);
      feedback.haptic('warning');

      const copy = gateCopyFor(data?.code);
      const go = await feedback.confirm({
        titleKey:   copy.titleKey,
        messageKey: copy.messageKey,
        confirmKey: copy.confirmKey,
        cancelKey:  copy.cancelKey,
      });
      if (go) router.push(copy.route);
    };

    socket.on('connect',                registerAndRefresh);
    socket.on('new_request',            handleNewRequest);
    socket.on('request:claimed',        removeRequest);
    socket.on('request:expired',        removeRequest);
    socket.on('request:cancelled',      handleCancelled);
    socket.on('provider:status_update', handleStatusUpdate);
    socket.on('provider:registered',      handleRegistered);
    socket.on('provider:status_rejected', handleStatusRejected);

    return () => {
      socket.off('connect',                registerAndRefresh);
      socket.off('new_request',            handleNewRequest);
      socket.off('request:claimed',        removeRequest);
      socket.off('request:expired',        removeRequest);
      socket.off('request:cancelled',      handleCancelled);
      socket.off('provider:status_update', handleStatusUpdate);
      socket.off('provider:registered',      handleRegistered);
      socket.off('provider:status_rejected', handleStatusRejected);
    };
  }, [socket, user?.id, fetchIncomingQueue]);

  // Le GO : passer en ligne / hors ligne. L'haptique est partie à l'appui
  // (ActionDisc), sur la même frame que le départ du disque.
  const handleToggleOnline = useCallback(() => {
    if (!user?.id) return;
    const next = !isOnline;
    userChoseRef.current = true;
    isOnlineRef.current = next;
    setIsOnline(next);
    // providerId retiré du payload : le serveur prend l'identité sur le socket
    // authentifié (il l'ignore désormais côté backend).
    if (socket) socket.emit('provider:set_status', { status: next ? 'READY' : 'OFFLINE' });
    if (!next) setIncomingRequests([]);
  }, [isOnline, socket, user?.id]);

  // Accept — REST call (reliable) + socket notification (real-time bonus)
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;

    // La fiche est déjà verte (IncomingJobCard) ; on la laisse se lire ~0,9 s
    // avant de continuer, même si le serveur répond plus vite. Puis elle se
    // replie (leaving) et l'accueil est déjà en mission : pas d'autre page.
    const t0 = Date.now();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const dwell = () => wait(Math.max(0, 1500 - (Date.now() - t0)));
    try {
      const res: any = await api.post(`/requests/${request.requestId}/accept`);
      if (res?.code === 'REQUEST_ACCEPTED' || res?.data) {
        await dwell();

        // Mission planifiée pour plus tard ? Pas de redirection vers /ongoing — la mission
        // n'est pas encore active (pas sur place, pas de PIN à vérifier). Elle ira dans
        // l'onglet « À venir » de Missions, le provider la lancera depuis là le jour J.
        const startTs = res?.data?.preferredTimeStart ? new Date(res.data.preferredTimeStart).getTime() : null;
        const isFutureScheduled = startTs != null && startTs > Date.now() + 30 * 60 * 1000;

        if (isFutureScheduled) {
          setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
          feedback.info('provider.mission_accepted_scheduled_msg');
          loadData();
        } else {
          // L'accueil passe en mission tout de suite (stade busy : caméra sur la
          // porte, tracé, étiquette ambre, flèche) pendant que la fiche se replie.
          const d = res?.data ?? {};
          setMissionSeed({ ...(request.raw ?? {}), ...d, id: Number(request.requestId), status: d.status ?? 'ACCEPTED' });
          setCurrentMission({
            id: Number(request.requestId), serviceType: d.serviceType ?? request.title ?? null, status: d.status ?? 'ACCEPTED',
            address: d.address ?? request.address ?? null, clientName: d.client?.name ?? request.client?.name ?? null,
            lat: d.lat ?? request.latitude ?? null, lng: d.lng ?? request.longitude ?? null,
          });
          setLeavingId(request.requestId);
          await wait(reduced ? 220 : 460);
          setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
          setLeavingId(null);
          loadData();
        }
      } else {
        throw new Error(res?.message || t('common.error'));
      }
    } catch (err: any) {
      const code = err?.response?.data?.code || err?.data?.code;
      declinedIdsRef.current.add(request.requestId);
      setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      if (code === 'INVALID_STATE' || code === 'ALREADY_TAKEN') {
        feedback.error('provider.mission_unavailable_msg');
      } else {
        const msg = err?.message || err?.data?.message || t('common.error');
        feedback.error(msg);
      }
    }
  }, [user?.id, router, loadData, reduced]);

  // Explicit decline ("Passer") — refuse backend + never show again
  const handleDecline = useCallback(async (requestId: string) => {
    declinedIdsRef.current.add(requestId);
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  // ─── Le stade ────────────────────────────────────────────────────────────
  const activeJob = incomingRequests[0] || null;
  const stage = cockpitStageOf({ online: isOnline, gpsDenied, noNetwork: !networkOnline, hasIncoming: !!activeJob, hasMission: !!currentMission });
  const reminders = useMemo<Reminder[]>(() => remindersOf(missions, connect), [missions, connect]);
  const next = useMemo<NextMission | null>(() => nextMissionOf(missions), [missions]);

  // ─── Géométrie : décidée par l'écran (SE, Pro Max, Android 3 boutons, Fold) ──
  const g = useMemo(() => cockpitGeometry({ width: layout.width, height: layout.height, insets: layout.insets, cls: layout.cls, tabBarHeight }), [layout, tabBarHeight]);
  const { stripBottom, topRowTop, marginLeft, contentWidth } = g;

  // ─── La caméra : moi ; moi + la demande ; moi + la porte ─────────────────
  const jobCoord = useMemo<LatLng | null>(() => (activeJob?.latitude && activeJob?.longitude ? { latitude: activeJob.latitude, longitude: activeJob.longitude } : null), [activeJob?.latitude, activeJob?.longitude]);
  const doorCoord = useMemo<LatLng | null>(() => (currentMission?.lat != null && currentMission?.lng != null ? { latitude: currentMission.lat, longitude: currentMission.lng } : null), [currentMission?.lat, currentMission?.lng]);
  const other = stage === 'incoming' ? jobCoord : stage === 'busy' ? doorCoord : null;
  // La caméra ne suit « moi » que par pas de 25 m : une position qui tremble
  // sur place ne relance pas un recadrage toutes les 3 s.
  const [camDoor, setCamDoor] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!location) return;
    setCamDoor((prev) => (!prev || metersBetween(prev.latitude, prev.longitude, location.latitude, location.longitude) > 25 ? location : prev));
  }, [location?.latitude, location?.longitude]);
  // Le rembourrage du cadrage est donné à la caméra (edgePadding), pas à la
  // MapView : Apple Maps ignore `mapPadding` pour cadrer, et un padding qui
  // saute fait sauter la carte. La journée en bas est toujours couverte ; la
  // fiche « elle est pour vous » ou la feuille de mission s'ajoutent en marge.
  const stripCover = g.mapPaddingBottom;
  const extraCover = stage === 'incoming'
    ? Math.max(0, Math.round(windowHeight * 0.55) - stripCover)
    : stage === 'busy' && missionFacts ? Math.max(0, missionFacts.sheetHeight - stripCover) : 0;
  // En mission, la feuille décide : moi + la porte en route, la bande serrée sur place, rien pendant l'intervention.
  const missionCam = stage === 'busy' && missionFacts ? missionFacts.mapMode : null;
  const camMode = missionCam ?? cockpitCameraMode(stage);
  const camAnchor = missionCam === 'band' && doorCoord ? doorCoord : (camDoor ?? BRUSSELS);
  const camOther = missionCam === 'band' ? camDoor : other;
  useMapCamera({ mapRef, ready: mapReady && !!camDoor, mode: camMode, door: camAnchor, other: camOther, sheetHeight: stripCover + extraCover, topInset: g.mapPaddingTop, reduced, viewportHeight: layout.height });

  // ─── Itinéraire vers la demande ou la porte, dessiné point par point ─────
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const routeTarget = other;
  const routeKey = routeTarget ? `${routeTarget.latitude.toFixed(4)},${routeTarget.longitude.toFixed(4)}` : '';
  const lastRouteFetch = useRef(0);
  useEffect(() => {
    if (!camDoor || !routeTarget) { setRouteCoords([]); return; }
    const t0 = Date.now();
    if (routeCoords.length && t0 - lastRouteFetch.current < 30_000) return;
    lastRouteFetch.current = t0;
    let cancelled = false;
    fetchRoute(camDoor, routeTarget).then((r) => { if (cancelled) return; setEtaMin(r.etaMin); if (r.coords.length) setRouteCoords(r.coords); }).catch(() => {});
    return () => { cancelled = true; };
  }, [routeKey, camDoor?.latitude, camDoor?.longitude]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  // Ouvrir une mission depuis la journée : elle vit ici, sur l'accueil — on la
  // met devant (wantedMission) et on recharge ; pas d'autre page.
  const showMission = useCallback((id: number | string) => { wantedMissionRef.current = String(id); loadData(); }, [loadData]);
  const onReminder = useCallback((r: Reminder) => {
    if (r.kind === 'payouts') router.push(gateCopyFor(GATE_CODES.STRIPE_NOT_READY).route as any);
    else if (r.requestId != null) showMission(r.requestId);
  }, [router, showMission]);
  const onNext = useCallback((m: NextMission) => showMission(m.id), [showMission]);
  const goProfile = useCallback(() => router.push('/(tabs)/profile'), [router]);
  const goWallet = useCallback(() => router.push('/(tabs)/wallet'), [router]);
  const goMessages = useCallback(() => router.push('/messages'), [router]);
  const goNotifs = useCallback(() => router.push('/notifications'), [router]);
  // Ma photo sur ma carte : on se reconnaît. Stable tant que le profil ne change pas.
  const meName = (user as any)?.name ?? null, meAvatar = (user as any)?.avatarUrl ?? null;
  const me = useMemo(() => ({ name: meName, avatarUrl: meAvatar }), [meName, meAvatar]);

  // ─── Le disque de la barre flottante : GO · stop · flèche vers la mission ──
  // L'écran règle le disque ; la barre le rend ; il suit sur tous les onglets.
  const setDisc = useNavStore((st) => st.setDisc);
  const discKind = providerDisc(stage);
  const discLabel = discKind === 'go' ? t('cockpit.go_a11y') : discKind === 'stop' ? t('cockpit.stop_a11y') : undefined;
  useEffect(() => {
    if (loading) return;
    setDisc({ kind: discKind, onPress: discKind === 'hidden' ? undefined : handleToggleOnline, label: discLabel });
  }, [loading, discKind, discLabel, handleToggleOnline, setDisc]);
  // Quitter l'accueil prestataire (déconnexion, changement de rôle) : le disque s'efface.
  useEffect(() => () => setDisc({ kind: 'hidden' }), [setDisc]);
  // La fiche « elle est pour vous » prend l'écran : la barre s'efface avec le reste.
  const setBarHidden = useNavStore((st) => st.setBarHidden);
  useEffect(() => { setBarHidden(!loading && (stage === 'incoming' || stage === 'busy')); }, [loading, stage, setBarHidden]);
  // La feuille de mission rend la main : la mission est finie (ou retirée).
  const onMissionExit = useCallback((_reason: 'done' | 'gone') => {
    wantedMissionRef.current = null;
    setMissionFacts(null);
    setMissionSeed(null);
    setCurrentMission(null);
    loadData();
  }, [loadData]);
  useEffect(() => () => setBarHidden(false), [setBarHidden]);
  // Les badges de la barre : devis à rédiger sur Missions, virements à configurer sur Profil.
  const setBadge = useNavStore((st) => st.setBadge);
  const quotesToWrite = useMemo(() => reminders.filter((r) => r.kind === 'quote').length, [reminders]);
  const payoutsTodo = useMemo(() => reminders.some((r) => r.kind === 'payouts'), [reminders]);
  const toTake = useNavStore((st) => st.toTake);
  useEffect(() => { setBadge('missions', (quotesToWrite + toTake) || null); }, [quotesToWrite, toTake, setBadge]);
  useEffect(() => { setBadge('profile', payoutsTodo ? '!' : null); }, [payoutsTodo, setBadge]);

  // -- Loading screen --
  if (loading) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="navigation" size={52} color={theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.25)'} />
        <ActivityIndicator size="small" color={theme.textMuted} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const meTone = stage === 'gps' ? 'gps' : stage === 'off' ? 'off' : 'on';
  const routeColor = theme.isDark ? 'rgba(248,247,244,0.55)' : 'rgba(26,26,26,0.45)';

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* -- Carte plein écran : l'écran, c'est elle ; l'interface flotte dessus -- */}
      <MapView
        ref={mapRef}
        provider={MAP_PROVIDER}
        {...mapAppearance(theme.isDark)}
        style={StyleSheet.absoluteFill}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        legalLabelInsets={{ top: 0, left: layout.insets.left, bottom: stripCover, right: 0 }}
        initialRegion={{ ...(location ?? BRUSSELS), latitudeDelta: 0.035, longitudeDelta: 0.035 }}
      >
        <RouteTrace coords={routeCoords} color={routeColor} />

        {incomingRequests.map((req, i) =>
          req.latitude && req.longitude ? (
            <DemandPin key={req.requestId} id={req.requestId} coordinate={{ latitude: req.latitude, longitude: req.longitude }} index={i} big={stage === 'incoming' && i === 0} />
          ) : null
        )}

        {stage === 'busy' && doorCoord ? <DoorPin coordinate={doorCoord} /> : null}

        {location ? <MePin coordinate={location} tone={meTone} heading={heading} arrow={stage === 'busy' && (missionFacts?.stage ?? 'en_route') === 'en_route'} me={me} /> : null}
      </MapView>

      {/* -- Le voile : la carte s'éteint hors ligne (l'étiquette d'état, en haut, dit pourquoi) -- */}
      <Veil dimmed={stage === 'off' || stage === 'gps' || stage === 'net'} label={null} labelTop={g.veilLabelTop} />

      {/* -- Haut : profil · aujourd'hui · messages · cloche -- */}
      <TopRow
        visible={stage !== 'incoming'}
        top={topRowTop}
        left={marginLeft}
        width={contentWidth}
        todayCents={today}
        settled={!statsLoading}
        unreadMessages={unreadMessages}
        unreadNotifs={unreadCount}
        onProfile={goProfile}
        onToday={goWallet}
        onMessages={goMessages}
        onNotifs={goNotifs}
      />

      {/* -- L'état, écrit sous la rangée du haut -- */}
      <StateLabel stage={stage} count={incomingRequests.length} onlineSince={onlineSince} missionId={currentMission?.id ?? null} missionStage={stage === 'busy' ? missionFacts?.stage ?? null : null} missionSince={missionFacts?.startedAt ? new Date(missionFacts.startedAt).getTime() : null} top={g.stateTop} />

      {/* -- La journée, lisible en bas -- */}
      <DayStrip
        visible={stage === 'off' || stage === 'on'}
        bottom={stripBottom}
        left={marginLeft}
        width={contentWidth}
        dense={g.denseHeight}
        reminders={reminders}
        next={next}
        onReminder={onReminder}
        onNext={onNext}
      />

      {/* -- Sans position, rien n'arrive -- */}
      <GpsCard visible={stage === 'gps'} bottom={stripBottom} left={marginLeft} width={contentWidth} />

      {/* -- La mission, sur l'accueil : une feuille par étape, la carte reste -- */}
      {stage === 'busy' && currentMission ? (
        <MissionFlow
          key={String(currentMission.id)}
          requestId={String(currentMission.id)}
          seed={missionSeed && Number(missionSeed.id) === Number(currentMission.id) ? missionSeed : null}
          topInset={g.mapPaddingTop}
          myLocation={location}
          gpsDenied={gpsDenied}
          etaMin={etaMin}
          onFacts={setMissionFacts}
          onExit={onMissionExit}
        />
      ) : null}

      {/* -- Elle est pour vous -- */}
      {/* La fiche reste montée le temps de se replier (leaving) : l'accueil est déjà en mission dessous. */}
      {activeJob && (stage === 'incoming' || leavingId === activeJob.requestId) && (
        <IncomingJobCard
          // Une nouvelle carte = un nouveau compte à rebours et un curseur
          // vierge : sans clé, l'instance (et son état « confirmé ») survit
          // quand la demande suivante prend la place de la précédente.
          key={activeJob.requestId}
          request={activeJob}
          onAccept={() => handleAccept(activeJob)}
          onDecline={() => handleDecline(activeJob.requestId)}
          leaving={leavingId === activeJob.requestId}
          bottom={0}
          insetBottom={layout.insets.bottom}
          maxWidth={layout.isRegular ? 560 : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
