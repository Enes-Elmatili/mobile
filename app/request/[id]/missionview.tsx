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
import { ActivityIndicator, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline } from 'react-native-maps';
import { MapPin } from '@/components/map/MapPin';
import { PersonPin, EtaBubble } from '@/components/map/pins';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION, useReduceMotion, useRevealCount, useEntrance } from '@/lib/motion';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
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
import { ARRIVAL_RADIUS_M, isFutureScheduled, metersBetween, plannedEnd, stageOf, type Stage } from '@/lib/mission/stage';
import { distanceKm, fetchRoute, type LatLng } from '@/lib/mission/route';
import { SearchingOverlay } from '@/components/searching/SearchingOverlay';
import { SearchingSheet } from '@/components/searching/SearchingSheet';
import { useSearching } from '@/lib/mission/useSearching';
import { PhotoViewer } from '@/components/mission/photos';
import { DoneContent, EtaHero, MoneyLine, PhotoCard, PinCard, ProviderRow, QuoteSteps, Rail, RequestRow, StageHeader, StageSheet, TimerHero, providerFirstName, providerName, type RailRow, type SheetLevel } from '@/components/tracking';
import { useMapCamera, type CameraMode } from '@/lib/mission/useMapCamera';
import { usePresence } from '@/lib/motion/usePresence';

const ACCEPTED_MOMENT_MS = 2400;


// ─── Marqueurs ───────────────────────────────────────────────────────────────
// Le client, c'est moi : ma photo, anneau vert.
function ClientMarker({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  return <PersonPin name={name} avatarUrl={avatarUrl} size={34} tone="green" />;
}
// Le prestataire sur la carte : sa photo (48 pt) et la bulle des minutes
// attachée au-dessus, atterrit sur MOTION.land à sa première apparition.
function ProviderMarker({ name, avatarUrl, etaMin }: { name: string; avatarUrl?: string | null; etaMin: number | null }) {
  const land = useEntrance(10, MOTION.land);
  return (
    <Animated.View style={[m.providerWrap, land.style]}>
      {etaMin != null ? <EtaBubble minutes={etaMin} /> : null}
      <PersonPin name={name} avatarUrl={avatarUrl} size={48} tone="white" />
    </Animated.View>
  );
}
const m = StyleSheet.create({
  providerWrap: { alignItems: 'center' },
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

  const providerUserId = provider?.userId || null;
  const { count: unread, reset: resetUnread } = useConversationUnread(providerUserId, authUser?.id);

  // ─── Une carte, une feuille qu'on tient ────────────────────────────────
  // La feuille gorhom impose un palier par stade (l'utilisateur peut tirer) ;
  // sa hauteur atteinte rembourre la carte. Le bilan (done) est une page.
  const [sheetHeight, setSheetHeight] = useState(0);
  const sheetLevels: SheetLevel[] = done ? ['page'] : stage === 'at_door' || stage === 'ongoing' ? ['half', 'full'] : ['peek', 'half', 'full'];
  const sheetLevel: SheetLevel = done ? 'page' : 'half';
  const sheetVisibleH = sheetHeight;
  const mapOpacity = useSharedValue(1);
  useEffect(() => { mapOpacity.value = reduced ? withTiming(mapMode === 'gone' ? 0 : 1, { duration: 150 }) : withSpring(mapMode === 'gone' ? 0 : 1, MOTION.pane); }, [mapMode, reduced, mapOpacity]);
  const mapStyle = useAnimatedStyle(() => ({ opacity: mapOpacity.value }));
  const topBarEntrance = useEntrance(-12);
  // Le bilan monte depuis le bas quand la mission se termine (même page).
  const donePresence = usePresence(done, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => { if (tracking) topBarEntrance.replay(); }, [tracking]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── La caméra : cherche, suit, se resserre, se réduit, s'efface ─────────
  const cameraMode: CameraMode = searchingLayer ? 'search' : !tracking ? 'none' : stage === 'at_door' ? 'door' : bandMode ? 'band' : 'follow';
  const searchPoints = useMemo(() => search.pros.filter((p) => p.lat != null && p.lng != null).map((p) => ({ latitude: p.lat as number, longitude: p.lng as number })), [search.pros]);
  useMapCamera({ mapRef, ready: mapReady, mode: cameraMode, door: clientCoord, other: providerLocation, others: searchPoints, sheetHeight: sheetVisibleH, topInset: insets.top, reduced });

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
      const arrivedAt = brief.timeline.arrivedAt ?? work?.beforePhotoAt;
      const rows: RailRow[] = [
        { key: 'arrived', label: t('tracking.tl_arrived'), when: formatClock(arrivedAt ?? startedAt), done: true },
        { key: 'started', label: t('tracking.tl_started'), when: formatClock(startedAt), done: true },
        { key: 'after', label: t('tracking.tl_after_photo'), when: work?.afterPhotoUrl ? formatClock(work.afterPhotoAt) : null, done: !!work?.afterPhotoUrl },
        ...(end && !work?.afterPhotoUrl ? [{ key: 'end', label: t('tracking.tl_end_planned'), when: `~${formatClock(end)}`, done: false }] : []),
      ];
      return (
        <>
          <StageHeader stageKey="ongoing" live kicker={t('tracking.at_home', { name: firstName }).toUpperCase() + ' · ' + t('tracking.since', { time: formatClock(startedAt ?? now) })} />
          <TimerHero since={startedAt} />
          <Text style={[s.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{end ? t('tracking.ongoing_sub', { time: formatClock(end) }) : t('tracking.ongoing_sub_no_end')}</Text>
          {providerRow}
          <Rail rows={rows} />
          {work?.beforePhotoUrl || work?.afterPhotoUrl ? (
            <View style={s.photoRow}>
              {work?.beforePhotoUrl ? <PhotoCard uri={work.beforePhotoUrl} label={`${t('tracking.before')} · ${formatClock(work.beforePhotoAt)}`} onPress={() => setViewer(work.beforePhotoUrl)} /> : null}
              {work?.afterPhotoUrl ? <PhotoCard uri={work.afterPhotoUrl} label={`${t('tracking.after')} · ${formatClock(work.afterPhotoAt)}`} onPress={() => setViewer(work.afterPhotoUrl)} /> : null}
            </View>
          ) : null}
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
  }, [brief, stage, startedAt, now, now1s, isQuote, amount, calloutFee, provider, unread, message, call, openProfile, t, firstName, arrived, cancel, cancelling, theme.textMuted, theme.textSub, pinCode, work, hasLiveGps, etaMin, distance, providerLocation, router, searchingLayer, search, params.expiresAt, params.scheduledLabel, paramIsScheduled, request?.preferredTimeStart, justAccepted, acceptedName]);

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
          <Animated.View style={[StyleSheet.absoluteFillObject, mapStyle]} pointerEvents={done ? 'none' : 'auto'}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={MAP_PROVIDER}
              {...mapAppearance(theme.isDark)}
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
              {tracking ? <MapPin coordinate={clientCoord} trackKey={(authUser as any)?.avatarUrl ?? ''}><ClientMarker name={(authUser as any)?.name} avatarUrl={(authUser as any)?.avatarUrl} /></MapPin> : null}
              {tracking && visibleRoute.length > 1 && !bandMode ? (
                <Polyline coordinates={visibleRoute} strokeColor={theme.isDark ? 'rgba(248,247,244,0.55)' : 'rgba(26,26,26,0.45)'} strokeWidth={3} />
              ) : null}
              {tracking && providerLocation && !bandMode ? (
                <MapPin coordinate={providerLocation} anchor={{ x: 0.5, y: 1 }} trackKey={`${provider?.avatarUrl ?? ''}-${hasLiveGps ? etaMin : 'x'}`} trackMs={1600}><ProviderMarker name={providerName(provider)} avatarUrl={provider?.avatarUrl} etaMin={hasLiveGps ? etaMin : null} /></MapPin>
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

          {/* La feuille, unique : son contenu change, on la tient au doigt. */}
          {!done ? (
            <StageSheet levels={sheetLevels} level={sheetLevel} onHeightChange={setSheetHeight}>
              {sheet}
            </StageSheet>
          ) : (
            <Animated.View style={[StyleSheet.absoluteFillObject, donePresence.style]}>
              <DoneContent request={request} topInset={insets.top} />
            </Animated.View>
          )}
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
  topBar: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  sub: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 18, marginTop: 6 },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  linkBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  link: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  reassurance: { fontFamily: FONTS.sans, fontSize: 11.5, textAlign: 'center', marginTop: 12 },
});
