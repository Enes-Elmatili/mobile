// app/request/[id]/missionview.tsx
// Le suivi côté client, un seul écran à stades (spec 2026-09-14) :
//   recherche → accepté → en route → à la porte → en cours (→ terminé)
//   et « devis en préparation » sur la même carte.
// Chaque stade vient du serveur (statut + faits reçus par socket) via
// stageOf(). UNE carte, UNE feuille, du premier au dernier stade : le calque
// de recherche s'efface au profit du marqueur du prestataire, la feuille
// change de contenu, la carte suit puis se réduit en bandeau, et à la fin la
// feuille monte jusqu'en haut avec le bilan. Aucun changement d'écran.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION, useReduceMotion, useRevealCount, useEntrance } from '@/lib/motion';
import { useLayoutClass } from '@/lib/layout';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/constants/mapStyles';
import { feedback } from '@/lib/feedback/feedback';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useSocket } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCall } from '@/lib/webrtc/CallContext';
import { useConversationUnread } from '@/lib/useConversationUnread';
import { markCompletionHandled } from '@/lib/navDedup';
import { formatClock } from '@/lib/format';
import { briefOf, isQuoteMode, workOf, type MissionBrief } from '@/lib/mission/brief';
import { ARRIVAL_RADIUS_M, isFutureScheduled, metersBetween, minutesSince, plannedEnd, stageOf, type Stage } from '@/lib/mission/stage';
import { distanceKm, fetchRoute, type LatLng } from '@/lib/mission/route';
import { SearchingOverlay } from '@/components/searching/SearchingOverlay';
import { SearchingSheet } from '@/components/searching/SearchingSheet';
import { useSearching } from '@/lib/mission/useSearching';
import Avatar from '@/components/ui/Avatar';
import { PhotoViewer } from '@/components/mission/photos';
import { DoneContent, EtaHero, MapBand, MoneyLine, PinCard, ProviderRow, QuoteSteps, RequestRow, StageHeader, WorkTimeline, providerFirstName, providerName, type TimelineRow } from '@/components/tracking';

const ACCEPTED_MOMENT_MS = 2400;
// En cours : la carte garde au moins cette hauteur sous la barre de statut ;
// si la feuille n'a pas besoin de tout l'écran, la carte garde le reste.
const BAND_HEIGHT = 200;
const SHEET_MAX_RATIO = 0.62;

// ─── Marqueurs ───────────────────────────────────────────────────────────────
function ClientMarker() {
  const theme = useAppTheme();
  return <View style={[m.client, { backgroundColor: theme.greenText, borderColor: theme.cardBg }]} />;
}
function ProviderMarker({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const theme = useAppTheme();
  return (
    <View style={[m.provider, { borderColor: theme.cardBg, shadowOpacity: theme.shadowOpacity + 0.2 }]}>
      <Avatar name={name} size={36} avatarUrl={avatarUrl} />
    </View>
  );
}
const m = StyleSheet.create({
  client: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  provider: { borderRadius: 20, borderWidth: 2, shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});

// ═════════════════════════════════════════════════════════════════════════════
export default function MissionView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const id = params.id;
  const invalidId = !id || !/^\d+$/.test(id);
  const paramIsScheduled = params.isScheduled === '1';
  const { socket, joinRoom, leaveRoom } = useSocket();
  const { user: authUser } = useAuth();
  const { initiateCall } = useCall();
  const reduced = useReduceMotion();
  const { height: windowHeight } = useLayoutClass();
  const mapRef = useRef<MapView>(null);

  // ─── La demande et les faits ────────────────────────────────────────────
  const [request, setRequest] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [work, setWork] = useState<{ beforePhotoUrl: string | null; beforePhotoAt: string | null; afterPhotoUrl: string | null; afterPhotoAt: string | null } | null>(null);
  const [startedAtLocal, setStartedAtLocal] = useState<string | null>(null);
  const [justAccepted, setJustAccepted] = useState(false);
  const [acceptedProviderId, setAcceptedProviderId] = useState<string | null>(null);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);
  const [providerLocation, setProviderLocation] = useState<LatLng | null>(null);
  const [hasLiveGps, setHasLiveGps] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const viewerPhotos = useMemo(() => (viewer ? [{ id: 0, url: viewer, shotKey: null, width: 0, height: 0 }] : []), [viewer]);
  const [now, setNow] = useState(() => Date.now());
  const prevStatusRef = useRef<string | null>(null);

  const stage: Stage = stageOf(request, { arrived, pinVerified, justAccepted, now });
  const status = (request?.status || '').toUpperCase();
  const brief: MissionBrief | null = useMemo(() => (request ? briefOf(request) : null), [request]);
  const provider = request?.provider ?? null;
  const firstName = providerFirstName(provider);
  const clientCoord: LatLng = useMemo(() => ({
    latitude: request?.lat ?? (params.lat ? parseFloat(params.lat) : 50.8466),
    longitude: request?.lng ?? (params.lng ? parseFloat(params.lng) : 4.3528),
  }), [request?.lat, request?.lng, params.lat, params.lng]);
  const isQuote = isQuoteMode(brief?.money.pricingMode ?? brief?.service.pricingMode ?? request?.pricingMode);
  const amount: number | null = request?.price != null && Number(request.price) > 0 ? Number(request.price) : null;
  const calloutFee: number | null = brief?.money.calloutFee ?? null;
  const startedAt: string | null = brief?.timeline.startedAt ?? startedAtLocal;
  // Le calque de recherche reste pendant le moment « accepté » (2,4 s), puis s'efface.
  const searchingLayer = stage === 'searching' || (justAccepted && (stage === 'accepted' || stage === 'en_route' || stage === 'quote_pending'));
  const tracking = !searchingLayer && (stage === 'en_route' || stage === 'at_door' || stage === 'ongoing' || stage === 'quote_pending' || stage === 'accepted');
  const done = stage === 'done' && !!request && !request.reviewExists;
  const bandMode = stage === 'ongoing';
  // Géométrie de la carte : pleine, bandeau, ou effacée (bilan).
  const mapMode: 'full' | 'band' | 'gone' = done ? 'gone' : bandMode ? 'band' : 'full';
  const [mapReady, setMapReady] = useState(false);
  const [regionKey, setRegionKey] = useState(0);
  const [now1s, setNow1s] = useState(() => Date.now());
  const search = useSearching(String(id), clientCoord, searchingLayer);

  // ─── Géométrie animée : une carte, une feuille ──────────────────────────
  // La carte : pleine (recherche, en route, à la porte), bandeau (en cours),
  // effacée (bilan). La feuille est ancrée en bas ; son bord haut suit le
  // contenu mesuré, ou le bandeau, ou monte jusqu'en haut pour le bilan.
  const bandH = insets.top + BAND_HEIGHT;
  const [sheetContentH, setSheetContentH] = useState(0);
  const sheetFullTop = windowHeight - Math.min(sheetContentH + insets.bottom + 44, windowHeight * SHEET_MAX_RATIO);
  // Bandeau : la feuille prend ce que son contenu demande, jamais moins que le
  // bandeau minimum ; la carte occupe le reste (pas de feuille à moitié vide).
  const bandSheetTop = Math.max(bandH - 26, sheetFullTop);
  const mapTarget = mapMode === 'gone' ? 0 : mapMode === 'band' ? bandSheetTop + 26 : windowHeight;
  const sheetTarget = mapMode === 'gone' ? 0 : mapMode === 'band' ? bandSheetTop : sheetFullTop;
  const mapH = useSharedValue(windowHeight);
  const sheetTop = useSharedValue(windowHeight);
  useEffect(() => {
    mapH.value = reduced ? withTiming(mapTarget, { duration: 150 }) : withSpring(mapTarget, MOTION.pane);
    sheetTop.value = reduced ? withTiming(sheetTarget, { duration: 150 }) : withSpring(sheetTarget, MOTION.pane);
  }, [mapTarget, sheetTarget, reduced, mapH, sheetTop]);
  const mapStyle = useAnimatedStyle(() => ({ height: mapH.value }));
  const sheetStyle = useAnimatedStyle(() => ({ top: sheetTop.value }));
  // Le rembourrage bas de la carte en recherche = la hauteur visible de la feuille.
  const sheetVisibleH = Math.max(0, windowHeight - sheetFullTop);
  const topBarEntrance = useEntrance(-12);
  useEffect(() => { if (tracking) topBarEntrance.replay(); }, [tracking]); // eslint-disable-line react-hooks/exhaustive-deps


  const providerUserId = provider?.userId || null;
  const { count: unread, reset: resetUnread } = useConversationUnread(providerUserId, authUser?.id);

  // ─── Charger la demande, en tirer les faits ─────────────────────────────
  const apply = useCallback((data: any) => {
    if (!data) return;
    setRequest(data);
    if (data.pinCode) setPinCode(String(data.pinCode));
    if (data.pinVerified) setPinVerified(true);
    if (data.beforePhotoUrl || data.beforePhotoAt) setArrived(true);
    setWork(workOf(data));
    if (data.provider?.lat && data.provider?.lng) {
      setProviderLocation((cur) => (hasLiveGps && cur ? cur : { latitude: data.provider.lat, longitude: data.provider.lng }));
    }
  }, [hasLiveGps]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await api.get(`/requests/${id}`);
      apply(res?.data || res);
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 403) setNotFound(true);
      else devError('[MissionView] load', e);
    }
  }, [id, apply]);

  useEffect(() => { load(); }, [load]);

  // Sondage : 15 s en recherche, 45 s en suivi (filet si le socket rate un fait).
  useEffect(() => {
    if (!id) return;
    const every = searchingLayer || stage === 'loading' ? 15_000 : 45_000;
    const iv = setInterval(load, every);
    return () => clearInterval(iv);
  }, [id, searchingLayer, stage, load]);

  // « n MIN » de l'en-tête en cours : une fois par demi-minute suffit.
  useEffect(() => {
    if (stage !== 'ongoing') return;
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [stage]);
  // La ligne mono de la recherche compte les secondes.
  useEffect(() => {
    if (!searchingLayer) return;
    const iv = setInterval(() => setNow1s(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [searchingLayer]);

  // ─── Le moment « accepté » : sur la carte de recherche, 2,4 s ──────────
  const beginAcceptedMoment = useCallback((providerId: string | null, name: string | null) => {
    setAcceptedProviderId(providerId);
    setAcceptedName(name);
    setJustAccepted(true);
    feedback.haptic('success');
  }, []);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status || prev;
    if (prev === 'PUBLISHED' && (status === 'ACCEPTED' || status === 'QUOTE_PENDING') && !isFutureScheduled(request?.preferredTimeStart, now)) {
      beginAcceptedMoment(request?.provider?.id != null ? String(request.provider.id) : null, providerName(request?.provider));
    }
  }, [status, request?.preferredTimeStart, request?.provider, now, beginAcceptedMoment]);
  useEffect(() => {
    if (!justAccepted) return;
    const tm = setTimeout(() => setJustAccepted(false), reduced ? 0 : ACCEPTED_MOMENT_MS);
    return () => clearTimeout(tm);
  }, [justAccepted, reduced]);

  // ─── Redirections : les stades qui ne se rendent pas ici ────────────────
  useEffect(() => {
    if (!id) return;
    const rid = String(id);
    if (stage === 'pending_payment') router.replace({ pathname: '/request/[id]/resume-payment', params: { id: rid } });
    else if (stage === 'quote_sent') { feedback.haptic('success'); router.replace({ pathname: '/request/[id]/quote-review', params: { id: rid } }); }
    else if (stage === 'scheduled') router.replace({ pathname: '/request/[id]/scheduled', params: { id: rid, mode: 'recap' } });
    else if (stage === 'done') {
      // Le bilan s'ouvre ici, dans la feuille ; on marque la complétion pour que
      // SocketContext ne pousse pas la route rating par-dessus.
      markCompletionHandled(rid);
      if (request?.reviewExists) router.replace({ pathname: '/(tabs)/documents', params: { openRequestId: rid } });
    } else if (stage === 'terminal') {
      feedback.haptic('warning');
      router.replace('/(tabs)/dashboard');
    }
  }, [stage, id, router, request?.reviewExists]);

  // ─── Itinéraire et ETA ──────────────────────────────────────────────────
  const lastRouteFetch = useRef(0);
  const updateRoute = useCallback(async (from: LatLng, force = false) => {
    const t0 = Date.now();
    if (!force && t0 - lastRouteFetch.current < 30_000) return;
    lastRouteFetch.current = t0;
    const r = await fetchRoute(from, clientCoord);
    setEtaMin(r.etaMin);
    if (r.coords.length) setRouteCoords(r.coords);
  }, [clientCoord]);
  useEffect(() => {
    if (!providerLocation || !tracking || bandMode) return;
    updateRoute(providerLocation, routeCoords.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerLocation, tracking, bandMode]);
  const visibleCount = useRevealCount(routeCoords.length, tracking && routeCoords.length > 0);
  const visibleRoute = useMemo(() => routeCoords.slice(0, visibleCount), [routeCoords, visibleCount]);
  const distance = providerLocation ? distanceKm(providerLocation, clientCoord) : null;

  // ─── La carte suit, puis se resserre, puis s'efface ─────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (searchingLayer) {
      // Recherche : la carte est verrouillée, cadrée sur l'adresse et les
      // prestataires les plus proches (le serveur prévient jusqu'à 30 km),
      // rembourrée de la feuille pour que rien ne passe dessous.
      const near = search.pros
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ latitude: p.lat as number, longitude: p.lng as number, d: metersBetween(p.lat as number, p.lng as number, clientCoord.latitude, clientCoord.longitude) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
      // mapPadding porte déjà la feuille : le rembourrage ici est seulement
      // la marge visuelle (sinon la zone utile devient négative et Google
      // dézoome sur le monde entier).
      if (near.length && near[near.length - 1].d <= 40_000) {
        mapRef.current.fitToCoordinates([clientCoord, ...near], { edgePadding: { top: insets.top + 90, right: 60, bottom: 60, left: 60 }, animated: !reduced });
      } else {
        mapRef.current.animateToRegion({ ...clientCoord, latitudeDelta: 0.014, longitudeDelta: 0.014 }, reduced ? 0 : 600);
      }
      return;
    }
    if (!tracking) return;
    if (stage === 'at_door' || bandMode) {
      mapRef.current.animateToRegion({ ...clientCoord, latitudeDelta: 0.004, longitudeDelta: 0.004 }, reduced ? 0 : 600);
    } else if (providerLocation) {
      mapRef.current.fitToCoordinates([providerLocation, clientCoord], { edgePadding: { top: 120, right: 60, bottom: Math.round(windowHeight * SHEET_MAX_RATIO) + 40, left: 60 }, animated: !reduced });
    } else {
      mapRef.current.animateToRegion({ ...clientCoord, latitudeDelta: 0.015, longitudeDelta: 0.015 }, reduced ? 0 : 600);
    }
  }, [stage, bandMode, tracking, searchingLayer, mapReady, providerLocation, clientCoord, windowHeight, reduced, search.pros, sheetVisibleH, insets.top]);

  // ─── Sockets ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !id) return;
    const rid = String(id);
    const same = (d: any) => String(d?.requestId ?? d?.id) === rid;
    joinRoom('request', rid);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const onAccepted = (d: any) => {
      if (!same(d)) return;
      beginAcceptedMoment(d?.providerId != null ? String(d.providerId) : null, d?.providerName ?? null);
      load();
    };
    const onLocation = (d: any) => {
      if (!same(d) || typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      const loc = { latitude: d.lat, longitude: d.lng };
      setHasLiveGps(true);
      setProviderLocation(loc);
      if (metersBetween(loc.latitude, loc.longitude, clientCoord.latitude, clientCoord.longitude) <= ARRIVAL_RADIUS_M) {
        setArrived((was) => { if (!was) feedback.haptic('success'); return true; });
      }
    };
    const onStarted = (d: any) => {
      if (!same(d)) return;
      setStartedAtLocal((cur) => cur ?? new Date().toISOString());
      setRequest((p: any) => (p ? { ...p, status: 'ONGOING' } : p));
    };
    const onPinReady = (d: any) => { if (same(d) && d.pinCode) setPinCode(String(d.pinCode)); };
    const onBeforePhoto = (d: any) => {
      if (!same(d)) return;
      setArrived((was) => { if (!was) feedback.haptic('success'); return true; });
      setWork((w) => ({ ...(w ?? { beforePhotoUrl: null, beforePhotoAt: null, afterPhotoUrl: null, afterPhotoAt: null }), beforePhotoUrl: d.photoUrl ?? w?.beforePhotoUrl ?? null, beforePhotoAt: w?.beforePhotoAt ?? new Date().toISOString() }));
    };
    const onAfterPhoto = (d: any) => {
      if (!same(d)) return;
      setWork((w) => ({ ...(w ?? { beforePhotoUrl: null, beforePhotoAt: null, afterPhotoUrl: null, afterPhotoAt: null }), afterPhotoUrl: d.photoUrl ?? w?.afterPhotoUrl ?? null, afterPhotoAt: w?.afterPhotoAt ?? new Date().toISOString() }));
    };
    const onPinVerified = (d: any) => {
      if (!same(d)) return;
      setPinVerified(true);
      setStartedAtLocal((cur) => cur ?? new Date().toISOString());
      feedback.haptic('success');
      load();
    };
    const onCompleted = (d: any) => {
      if (!same(d)) return;
      setRequest((p: any) => (p ? { ...p, status: 'DONE' } : p));
    };
    const onCancelled = (d: any) => {
      if (!same(d)) return;
      feedback.toast(t('mission_view.mission_cancelled'), 'error');
      timers.push(setTimeout(() => router.replace('/(tabs)/dashboard'), 1200));
    };
    const onReassigning = (d: any) => {
      if (!same(d)) return;
      feedback.haptic('warning');
      feedback.toast(t('ext.missionview_reassigning_toast'), 'info');
      setArrived(false); setPinVerified(false); setPinCode(null); setJustAccepted(false);
      setAcceptedProviderId(null); setAcceptedName(null); setProviderLocation(null); setHasLiveGps(false);
      setEtaMin(null); setRouteCoords([]); setStartedAtLocal(null);
      prevStatusRef.current = 'PUBLISHED';
      setRequest((p: any) => (p ? { ...p, status: 'PUBLISHED', providerId: null, provider: null, pinCode: null, pinVerified: false } : p));
    };
    const onStatusUpdated = (d: any) => { if (same(d)) load(); };

    socket.on('request:accepted', onAccepted);
    socket.on('provider:accepted', onAccepted);
    socket.on('provider:location_update', onLocation);
    socket.on('request:started', onStarted);
    socket.on('mission:pin_ready', onPinReady);
    socket.on('mission:before_photo', onBeforePhoto);
    socket.on('mission:after_photo', onAfterPhoto);
    socket.on('mission:pin_verified', onPinVerified);
    socket.on('request:completed', onCompleted);
    socket.on('request:cancelled', onCancelled);
    socket.on('request:reassigning', onReassigning);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', rid);
      timers.forEach(clearTimeout);
      socket.off('request:accepted', onAccepted);
      socket.off('provider:accepted', onAccepted);
      socket.off('provider:location_update', onLocation);
      socket.off('request:started', onStarted);
      socket.off('mission:pin_ready', onPinReady);
      socket.off('mission:before_photo', onBeforePhoto);
      socket.off('mission:after_photo', onAfterPhoto);
      socket.off('mission:pin_verified', onPinVerified);
      socket.off('request:completed', onCompleted);
      socket.off('request:cancelled', onCancelled);
      socket.off('request:reassigning', onReassigning);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, clientCoord.latitude, clientCoord.longitude, load, beginAcceptedMoment]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const cancel = useCallback(async () => {
    const searching = searchingLayer;
    const ok = await feedback.confirm({
      titleKey: searching ? 'mission_view.cancel_search' : 'mission_view.cancel_mission',
      messageKey: searching ? 'mission_view.cancel_search_msg' : 'mission_view.cancel_confirm_msg',
      confirmKey: 'missions.yes_cancel',
      cancelKey: 'common.continue',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.post(`/requests/${id}/cancel`);
      feedback.haptic('warning');
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setCancelling(false);
      const code = e?.data?.code;
      if (code === 'INVALID_STATE' || e?.status === 400) {
        await load();
        const go = await feedback.confirm({ titleKey: 'common.error', messageKey: 'mission_view.state_updated', confirmKey: 'mission_view.contact_support', cancelKey: 'common.close' });
        if (go) router.push('/settings/help');
      } else {
        feedback.error(searching ? 'mission_view.cancel_failed' : 'mission_view.cancel_mission_failed');
      }
    }
  }, [id, searchingLayer, router, load]);

  const openMenu = useCallback(async () => {
    const options = bandMode
      ? [{ labelKey: 'mission_view.contact_support' }]
      : [{ labelKey: 'mission_view.contact_support' }, { labelKey: 'mission_view.cancel_mission', destructive: true }];
    const choice = await feedback.actionSheet({ titleKey: 'missions.options', options, cancelKey: 'common.close' });
    if (choice === 0) router.push('/settings/help');
    else if (choice === 1) cancel();
  }, [bandMode, router, cancel]);

  const call = useCallback(() => {
    if (!provider) return;
    const name = providerName(provider);
    if (provider.userId && socket) {
      initiateCall({ targetUserId: String(provider.userId), targetName: name, requestId: String(id) });
    } else if (provider.phone) {
      Linking.openURL(`tel:${String(provider.phone).replace(/\s+/g, '')}`).catch(() => feedback.error('mission_view.call_failed'));
    } else {
      feedback.error('mission_view.phone_unavailable');
    }
  }, [provider, socket, initiateCall, id]);

  const message = useCallback(() => {
    const uid = provider?.userId || provider?.id;
    if (!uid) { feedback.error('mission_view.provider_not_found'); return; }
    resetUnread();
    router.push({ pathname: '/messages/[userId]', params: { userId: String(uid), name: providerName(provider), requestId: String(id) } });
  }, [provider, id, router, resetUnread]);

  const openProfile = useCallback(() => { if (provider?.id) router.push(`/providers/${provider.id}`); }, [provider?.id, router]);
  const back = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/dashboard'); }, [router]);

  // ─── Contenu de la feuille par stade ────────────────────────────────────
  const sheet = useMemo(() => {
    if (!brief) return null;
    if (searchingLayer) {
      return (
        <SearchingSheet
          brief={brief}
          pros={search.pros} round={search.round} remaining={search.remaining} nextWaveAt={search.nextWaveAt} startedAt={search.startedAt}
          now={now1s}
          expiresAt={params.expiresAt || null}
          cancelling={cancelling}
          isScheduled={paramIsScheduled || isFutureScheduled(request?.preferredTimeStart, now)}
          scheduledLabel={params.scheduledLabel || null}
          acceptedName={justAccepted ? (acceptedName ?? providerName(provider)) : null}
          onCancel={cancel}
        />
      );
    }
    const sinceMin = minutesSince(startedAt, now);
    const end = plannedEnd({ timeline: { ...brief.timeline, startedAt }, service: brief.service });
    const promise = isQuote ? (amount != null ? t('tracking.quote_promise') : t('tracking.callout_promise')) : t('tracking.fixed_promise');
    const moneyAmount = amount ?? (isQuote ? calloutFee : null);
    const moneyCaption = amount != null ? t('mission.ttc') : (isQuote ? t('mission.callout') : t('mission.ttc'));
    const requestRow = <RequestRow brief={brief} amount={moneyAmount} amountCaption={moneyCaption} />;
    const providerRow = provider ? <View style={{ marginTop: 14 }}><ProviderRow provider={provider} unread={unread} onMessage={message} onCall={call} onOpenProfile={openProfile} /></View> : null;

    if (stage === 'quote_pending') {
      return (
        <>
          <StageHeader stageKey="quote" kicker={t('tracking.quote_kicker')} title={t('tracking.quote_title', { name: firstName })} sub={t('tracking.quote_sub')} />
          <QuoteSteps calloutFee={calloutFee} current={arrived ? '72h' : 'diag'} />
          {providerRow}
          {requestRow}
          <Pressable onPress={cancel} disabled={cancelling} accessibilityRole="button" style={s.linkBtn}><Text style={[s.link, { color: COLORS.red }]}>{t('missions.cancel')}</Text></Pressable>
        </>
      );
    }
    if (stage === 'at_door') {
      return (
        <>
          <StageHeader stageKey="at_door" kicker={t('tracking.arrived', { time: formatClock(brief.timeline.arrivedAt ?? work?.beforePhotoAt ?? now) })} title={t('tracking.at_door_title', { name: firstName })} />
          {pinCode ? <PinCard code={pinCode} mode="hero" name={firstName} /> : null}
          {providerRow}
          <Text style={[s.reassurance, { color: theme.textMuted }]}>{t('tracking.at_door_reassurance')}</Text>
        </>
      );
    }
    if (stage === 'ongoing') {
      const rows: TimelineRow[] = [];
      const arrivedAt = brief.timeline.arrivedAt ?? work?.beforePhotoAt;
      if (arrivedAt) rows.push({ key: 'arrived', time: formatClock(arrivedAt), label: t('tracking.tl_arrived') });
      if (startedAt) rows.push({ key: 'started', time: formatClock(startedAt), label: t('tracking.tl_started') });
      if (work?.beforePhotoUrl) rows.push({ key: 'before', time: formatClock(work.beforePhotoAt ?? arrivedAt ?? startedAt), label: t('tracking.tl_before_photo'), sub: t('tracking.tl_by', { name: firstName }), photoUrl: work.beforePhotoUrl, onPhoto: () => setViewer(work.beforePhotoUrl) });
      if (work?.afterPhotoUrl) rows.push({ key: 'after', time: formatClock(work.afterPhotoAt), label: t('tracking.tl_after_photo'), sub: t('tracking.tl_by', { name: firstName }), photoUrl: work.afterPhotoUrl, onPhoto: () => setViewer(work.afterPhotoUrl) });
      if (end && !work?.afterPhotoUrl) rows.push({ key: 'end', time: formatClock(end), label: t('tracking.tl_end_planned'), sub: brief.service.durationMinutes ? t('tracking.tl_usual_duration', { n: brief.service.durationMinutes }) : null, next: true });
      return (
        <>
          <StageHeader stageKey="ongoing" live kicker={sinceMin ? t('tracking.ongoing', { n: sinceMin }) : t('tracking.ongoing_now')} title={t('tracking.ongoing_title', { name: firstName })} sub={end ? t('tracking.ongoing_sub', { time: formatClock(end) }) : t('tracking.ongoing_sub_no_end')} />
          {rows.length ? <WorkTimeline rows={rows} /> : null}
          <MoneyLine amount={moneyAmount} caption={moneyCaption} promise={promise} />
          {requestRow}
          <Pressable onPress={() => router.push('/settings/help')} accessibilityRole="button" style={s.linkBtn}><Text style={[s.link, { color: theme.textMuted }]}>{t('tracking.support_link')}</Text></Pressable>
        </>
      );
    }
    // en_route (et le très court « accepted » si la carte de recherche n'est plus là)
    return (
      <>
        <StageHeader stageKey="en_route" live={hasLiveGps} kicker={hasLiveGps ? `${t('tracking.en_route')} · ${t('tracking.live_gps')}` : t('tracking.en_route')} />
        <EtaHero etaMin={etaMin} distanceKm={distance} hasGps={hasLiveGps || !!providerLocation} />
        {providerRow}
        {pinCode ? <PinCard code={pinCode} mode="compact" name={firstName} /> : null}
        {requestRow}
      </>
    );
  }, [brief, stage, startedAt, now, now1s, isQuote, amount, calloutFee, provider, unread, message, call, openProfile, t, firstName, arrived, cancel, cancelling, theme.textMuted, pinCode, work, hasLiveGps, etaMin, distance, providerLocation, router, searchingLayer, search, params.expiresAt, params.scheduledLabel, paramIsScheduled, request?.preferredTimeStart, justAccepted, acceptedName]);

  // ═════════════════════════════════════════════════════════════════════════
  if (invalidId || notFound) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={[s.notFound, { color: theme.textSub }]}>{t('mission_view.mission_not_found')}</Text>
        <Pressable onPress={back} accessibilityRole="button" style={s.linkBtn}><Text style={[s.link, { color: theme.text }]}>{t('common.back')}</Text></Pressable>
      </SafeAreaView>
    );
  }

  const showMap = stage !== 'loading' && !!brief;
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {stage === 'loading' && (
        <View style={[StyleSheet.absoluteFillObject, s.center]}>
          <ActivityIndicator size="large" color={theme.accent as string} />
        </View>
      )}

      {showMap && (
        <>
          {/* La carte, unique du premier au dernier stade. */}
          <Animated.View style={[s.mapWrap, mapStyle]}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              customMapStyle={theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
              initialRegion={{ ...clientCoord, latitudeDelta: 0.014, longitudeDelta: 0.014 }}
              onMapReady={() => setMapReady(true)}
              onRegionChangeComplete={() => setRegionKey((k) => k + 1)}
              mapPadding={searchingLayer ? { top: 0, right: 0, bottom: sheetVisibleH, left: 0 } : undefined}
              scrollEnabled={tracking && !bandMode}
              zoomEnabled={tracking && !bandMode}
              pitchEnabled={false}
              rotateEnabled={false}
              showsUserLocation={false}
              showsPointsOfInterest={false}
              showsBuildings={false}
              showsCompass={false}
              toolbarEnabled={false}
            >
              {tracking ? <Marker coordinate={clientCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}><ClientMarker /></Marker> : null}
              {tracking && visibleRoute.length > 1 && !bandMode ? (
                <Polyline coordinates={visibleRoute} strokeColor={theme.isDark ? 'rgba(248,247,244,0.55)' : 'rgba(26,26,26,0.45)'} strokeWidth={3} />
              ) : null}
              {tracking && providerLocation && !bandMode ? (
                <Marker coordinate={providerLocation} anchor={{ x: 0.5, y: 0.5 }}><ProviderMarker name={providerName(provider)} avatarUrl={provider?.avatarUrl} /></Marker>
              ) : null}
            </MapView>

            {/* Le calque de recherche : pastilles et traits, puis fondu. */}
            {(searchingLayer || search.pros.length > 0) && !bandMode && !done ? (
              <SearchingOverlay
                pros={search.pros}
                mapRef={mapRef}
                mapReady={mapReady}
                missionCoord={clientCoord}
                sheetHeight={sheetVisibleH}
                acceptedProviderId={justAccepted ? (acceptedProviderId ?? (provider?.id != null ? String(provider.id) : null)) : null}
                visible={searchingLayer}
                regionKey={regionKey}
              />
            ) : null}

            {bandMode && provider ? (
              <MapBand top={insets.top + 56} name={firstName} avatarUrl={provider.avatarUrl} sinceLabel={t('tracking.since', { time: formatClock(startedAt ?? now) })} onCall={call} onMessage={message} unread={unread} />
            ) : null}
          </Animated.View>

          {tracking ? (
            <Animated.View style={topBarEntrance.style}>
              <SafeAreaView style={s.topBar} edges={['top']} pointerEvents="box-none">
                <Pressable style={[s.roundBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={back} accessibilityLabel={t('common.back')} accessibilityRole="button" hitSlop={8}>
                  <Feather name="arrow-left" size={20} color={theme.text as string} />
                </Pressable>
                <View style={[s.badge, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
                  <Text style={[s.badgeText, { color: theme.text }]}>FIXED</Text>
                  <Text style={[s.badgeText, { color: theme.textMuted }]}>·</Text>
                  <Text style={[s.badgeText, { color: theme.textSub }]}>#{id}</Text>
                </View>
                <Pressable style={[s.roundBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={openMenu} accessibilityLabel={t('missions.options')} accessibilityRole="button" hitSlop={8}>
                  <Feather name="more-horizontal" size={22} color={theme.text as string} />
                </Pressable>
              </SafeAreaView>
            </Animated.View>
          ) : null}

          {/* La feuille, unique : son contenu change, son bord haut suit. */}
          <Animated.View style={[s.sheet, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity + 0.04 }, done && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }, sheetStyle]}>
            {done ? (
              <DoneContent request={request} topInset={insets.top} />
            ) : (
              <>
                <View style={[s.handle, { backgroundColor: theme.borderLight }]} />
                <ScrollView showsVerticalScrollIndicator={false} bounces={bandMode} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
                  <View onLayout={(e) => setSheetContentH(e.nativeEvent.layout.height)}>{sheet}</View>
                </ScrollView>
              </>
            )}
          </Animated.View>
        </>
      )}

      <PhotoViewer photos={viewerPhotos} index={viewer ? 0 : null} onClose={() => setViewer(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound: { fontFamily: FONTS.sans, fontSize: 14 },
  mapWrap: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  topBar: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, shadowColor: '#000', shadowRadius: 30, shadowOffset: { width: 0, height: -10 }, elevation: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  linkBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  link: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  reassurance: { fontFamily: FONTS.sans, fontSize: 11.5, textAlign: 'center', marginTop: 12 },
});
