// app/request/[id]/ongoing.tsx — la mission côté prestataire (spec
// 2026-09-16, plan « la prochaine action sous le pouce »).
// Un seul écran à stades (providerStageOf) : en route → sur place → code →
// (devis) → intervention → clôture. À chaque stade, une action pleine en pied
// de feuille, et tout ce qu'il faut savoir sans chercher : l'adresse et
// l'accès, le client à joindre, le problème en photos, ce qu'on gagne.
// La carte suit (en route), devient un bandeau (sur place), s'efface
// (intervention). Les règles du serveur ne changent pas : photo avant → code
// (3 essais, 4 h) → photo après → clôture.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline } from 'react-native-maps';
import { MapPin } from '@/components/map/MapPin';
import { DropPin, DropGlyph } from '@/components/map/pins';
import Avatar from '@/components/ui/Avatar';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION, useReduceMotion, useRevealCount, useEntrance } from '@/lib/motion';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
import { feedback } from '@/lib/feedback/feedback';
import { api } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { devError } from '@/lib/logger';
import { useSocket } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useConversationUnread } from '@/lib/useConversationUnread';
import { markCompletionHandled } from '@/lib/navDedup';
import { formatClock, formatEUR } from '@/lib/format';
import { cleanName } from '@/lib/displayName';
import { briefOf, isQuoteMode, type MissionBrief } from '@/lib/mission/brief';
import { ARRIVAL_RADIUS_M, metersBetween, plannedEnd } from '@/lib/mission/stage';
import { distanceKm, fetchRoute, type LatLng } from '@/lib/mission/route';
import { providerMapMode, providerStageOf, type ProviderStage } from '@/lib/mission/providerStage';
import { useMapCamera } from '@/lib/mission/useMapCamera';
import { serviceName, modeLabel } from '@/components/mission/blocks';
import { PhotoGallery, PhotoViewer } from '@/components/mission/photos';
import { AccessChips, CodeEntry, Cta, EtaHero, NetLine, PhotoCard, ProviderRow, Rail, StageHeader, StageSheet, TimerHero, type RailRow, type SheetLevel } from '@/components/tracking';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const RETRY_MAX = 6;
const RETRY_DELAY = 800;
const GPS_STALE_MS = 30_000;
const PIN_MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Envoi d'une photo de chantier (multipart + position, preuve) ────────────
async function uploadMissionPhoto(requestId: string, type: 'before' | 'after', imageUri: string, coords?: LatLng | null): Promise<string> {
  const token = await tokenStorage.getToken();
  const url = `${API_BASE_URL}/requests/${requestId}/${type === 'before' ? 'before-photo' : 'after-photo'}`;
  const formData = new FormData();
  const filename = imageUri.split('/').pop() || `mission_${type}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  formData.append('photo', { uri: imageUri, name: filename, type: mimeType } as any);
  if (coords) { formData.append('latitude', String(coords.latitude)); formData.append('longitude', String(coords.longitude)); }
  const response = await fetch(url, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}) }, body: formData });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('INVALID_RESPONSE'), { status: response.status, code: 'INVALID_RESPONSE' }); }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.message || `HTTP ${response.status}`), { status: response.status, data, code: data?.code });
  return data.photoUrl;
}

// ─── Marqueurs ───────────────────────────────────────────────────────────────
// La porte du client : une goutte verte avec la maison, ancrée sur sa pointe.
function DoorMarker() {
  return <DropPin size={40} color={COLORS.greenBrand}><DropGlyph name="home" /></DropPin>;
}
// Moi, en route : ma photo dans une goutte qui pointe le cap.
function MeMarker({ name, avatarUrl, heading }: { name?: string | null; avatarUrl?: string | null; heading: number | null }) {
  return (
    <DropPin size={44} color="#1A1A1A" heading={heading}>
      <Avatar name={name || '?'} size={34} avatarUrl={avatarUrl} />
    </DropPin>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function MissionOngoing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const { user: authUser } = useAuth();
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // ─── La demande et les faits du terrain ──────────────────────────────────
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [myHeading, setMyHeading] = useState<number | null>(null);
  const [gpsAt, setGpsAt] = useState<number | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [busy, setBusy] = useState(false);
  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(PIN_MAX_ATTEMPTS);
  const [hasQuote, setHasQuote] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);
  const [arrivedTapped, setArrivedTapped] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pendingCameraChecked = useRef(false);

  const brief: MissionBrief | null = useMemo(() => (request ? briefOf(request) : null), [request]);
  const isQuote = isQuoteMode(request?.pricingMode);
  const door: LatLng = useMemo(() => ({ latitude: request?.lat ?? 50.8466, longitude: request?.lng ?? 4.3528 }), [request?.lat, request?.lng]);
  const near = !!myLocation && !!request?.lat && metersBetween(myLocation.latitude, myLocation.longitude, door.latitude, door.longitude) <= ARRIVAL_RADIUS_M;
  const stage: ProviderStage = providerStageOf(request, { near, arrivedTapped, beforePhoto: !!beforeUri, pinVerified, afterPhoto: !!afterUri, isQuote, hasQuote });
  const mapMode = providerMapMode(stage);
  const clientName = cleanName(request?.client?.name, { fallback: t('provider.client') });
  const clientFirst = clientName.split(/\s+/)[0];
  const gpsLost = !gpsDenied && gpsAt != null && now - gpsAt > GPS_STALE_MS;
  const distance = myLocation ? distanceKm(myLocation, door) : null;

  const clientUserId = request?.client?.id || request?.clientId || null;
  const { count: unread, reset: resetUnread } = useConversationUnread(clientUserId, authUser?.id);

  // ─── Charger ─────────────────────────────────────────────────────────────
  const loadRequest = useCallback(async (attempt = 0) => {
    try {
      const response: any = await api.get(`/requests/${id}`);
      const data = response?.data || response;
      const st = (data?.status || '').toUpperCase();
      if (['PUBLISHED', 'PENDING', 'QUOTE_PENDING'].includes(st)) {
        if (attempt < RETRY_MAX) { setLoading(true); await sleep(RETRY_DELAY); return loadRequest(attempt + 1); }
        feedback.error('missions.load_error');
        router.replace('/(tabs)/dashboard');
        return;
      }
      if (!['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(st)) {
        if (st === 'DONE') router.replace({ pathname: '/request/[id]/earnings', params: { id: String(id) } });
        else router.replace('/(tabs)/dashboard');
        return;
      }
      // Mission planifiée hors fenêtre (> 30 min avant) → écran d'attente dédié.
      if (st === 'ACCEPTED' && data?.preferredTimeStart) {
        const minutesUntilStart = Math.round((new Date(data.preferredTimeStart).getTime() - Date.now()) / 60_000);
        if (minutesUntilStart > 30) { router.replace({ pathname: '/request/[id]/early', params: { id: String(id) } }); return; }
      }
      if (data.beforePhotoUrl) setBeforeUri((cur) => cur ?? data.beforePhotoUrl);
      if (data.afterPhotoUrl) setAfterUri((cur) => cur ?? data.afterPhotoUrl);
      if (data.pinVerified) setPinVerified(true);
      setRequest(data);
      if (isQuoteMode(data.pricingMode)) {
        try {
          const qRes: any = await api.get(`/quotes/request/${id}`);
          const q = qRes?.quotes?.[0];
          if (q) { setHasQuote(true); setQuoteAmount(q.totalAmount != null ? q.totalAmount / 100 : null); }
        } catch { /* pas encore de devis */ }
      }
    } catch {
      feedback.error('missions.load_error');
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadRequest(); }, [loadRequest]);
  const hasMountedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    loadRequest();
  }, [loadRequest]));

  // Horloge : le kicker « GPS perdu » et les heures affichées.
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(iv); }, []);

  // ─── Quitter (bouton système et flèche : même confirmation) ──────────────
  const handleLeave = useCallback(async () => {
    const ok = await feedback.confirm({ title: t('ext.ongoing_leave_title'), message: t('ext.ongoing_leave_msg'), confirm: t('ext.leave'), cancel: t('ext.stay') });
    if (!ok) return;
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/dashboard');
  }, [router, t]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleLeave(); return true; });
    return () => sub.remove();
  }, [handleLeave]);

  // ─── Photos ──────────────────────────────────────────────────────────────
  const sendPhoto = useCallback(async (type: 'before' | 'after', uri: string) => {
    setUploading(type);
    if (type === 'before') setBeforeUri(uri); else setAfterUri(uri);
    try {
      await uploadMissionPhoto(String(id), type, uri, myLocation);
      feedback.haptic('success');
    } catch (err: any) {
      devError('[ONGOING] photo', err);
      if (type === 'before') setBeforeUri(null); else setAfterUri(null);
      const code = err?.code || err?.data?.code;
      if (code === 'INVALID_STATE') await loadRequest();
      feedback.error(code === 'INVALID_STATE' ? 'mission_view.state_updated' : 'pro.photo_error_generic');
    } finally {
      setUploading(null);
    }
  }, [id, myLocation, loadRequest]);

  const takePhoto = useCallback(async (type: 'before' | 'after') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { feedback.error('profile.camera_denied'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await sendPhoto(type, result.assets[0].uri);
    } catch (err) { devError('[ONGOING] camera', err); }
  }, [sendPhoto]);

  // Android : l'OS peut tuer l'app pendant que la caméra est ouverte. Au
  // retour, le cliché orphelin est repris à l'étape courante.
  useEffect(() => {
    if (Platform.OS !== 'android' || loading || pendingCameraChecked.current) return;
    pendingCameraChecked.current = true;
    (async () => {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        const first = (Array.isArray(pending) ? pending[0] : null) as ImagePicker.ImagePickerResult | null;
        const uri = first && !(first as any).code && !first.canceled ? first.assets?.[0]?.uri : null;
        if (uri) await sendPhoto(beforeUri ? 'after' : 'before', uri);
      } catch (err) { devError('[ONGOING] getPendingResultAsync', err); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ─── Position : suivre, prévenir le client, détecter l'arrivée ───────────
  const requestRef = useRef<any>(null);
  useEffect(() => { requestRef.current = request; }, [request]);
  const trackingStartedRef = useRef(false);
  const lastEmitRef = useRef(0);
  const lastRouteRef = useRef(0);
  const updateRoute = useCallback(async (from: LatLng) => {
    const req = requestRef.current;
    if (!req?.lat || !req?.lng) return null;
    const r = await fetchRoute(from, { latitude: req.lat, longitude: req.lng });
    setEtaMin(r.etaMin);
    if (r.coords.length) setRouteCoords(r.coords);
    return r;
  }, []);
  const startTracking = useCallback(async () => {
    if (trackingStartedRef.current) return;
    trackingStartedRef.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsDenied(true); trackingStartedRef.current = false; return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMyLocation(coords); setGpsAt(Date.now());
      if (loc.coords.heading != null && loc.coords.heading >= 0) setMyHeading(Math.round(loc.coords.heading / 10) * 10);
      await updateRoute(coords);
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 30 },
        async (newLoc) => {
          const c = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
          setMyLocation(c); setGpsAt(Date.now());
          if (newLoc.coords.heading != null && newLoc.coords.heading >= 0) setMyHeading(Math.round(newLoc.coords.heading / 10) * 10);
          const t0 = Date.now();
          let eta: number | null = null;
          if (t0 - lastRouteRef.current >= 30_000) { lastRouteRef.current = t0; eta = (await updateRoute(c))?.etaMin ?? null; }
          if (t0 - lastEmitRef.current >= 10_000 && socket?.connected) {
            lastEmitRef.current = t0;
            socket.emit('provider:location_update', { requestId: Number(id), lat: c.latitude, lng: c.longitude, eta: eta != null ? `${eta} min` : undefined });
          }
        },
      );
    } catch (e) { devError('[ONGOING] Location', e); trackingStartedRef.current = false; }
  }, [updateRoute, socket, id]);
  useEffect(() => {
    if (request && !trackingStartedRef.current) startTracking();
    return () => {
      if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
      trackingStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!request]);
  // À l'arrivée dans le rayon : une haptique, une seule fois.
  const wasNearRef = useRef(false);
  useEffect(() => { if (near && !wasNearRef.current) { wasNearRef.current = true; feedback.haptic('success'); } }, [near]);

  // ─── Sockets ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', String(id));
    const same = (d: any) => String(d?.requestId ?? d?.id) === String(id);
    const stop = () => { if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; } };
    const onCancelled = (d: any) => { if (d?.reason === 'admin_reassign' || !same(d)) return; stop(); router.replace('/(tabs)/dashboard'); };
    const onStatusUpdated = (d: any) => { if (same(d)) loadRequest(); };
    const onUnassigned = (d: any) => { if (!same(d)) return; stop(); feedback.info('ext.ongoing_unassigned_msg'); router.replace('/(tabs)/dashboard'); };
    socket.on('request:cancelled', onCancelled);
    socket.on('request:unassigned', onUnassigned);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', String(id));
      socket.off('request:cancelled', onCancelled);
      socket.off('request:unassigned', onUnassigned);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
  }, [socket, id, router, joinRoom, leaveRoom, loadRequest]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const call = useCallback(() => {
    if (request?.client?.phone) Linking.openURL(`tel:${String(request.client.phone).replace(/\s+/g, '')}`).catch(() => feedback.error('mission_view.call_failed'));
    else feedback.error('mission_view.phone_unavailable');
  }, [request?.client?.phone]);
  const message = useCallback(() => {
    if (!clientUserId) return;
    resetUnread();
    router.push({ pathname: '/messages/[userId]', params: { userId: String(clientUserId), name: clientName, requestId: String(id) } });
  }, [clientUserId, clientName, id, router, resetUnread]);
  const navigate = useCallback(async () => {
    if (!request?.lat || !request?.lng) return;
    const { lat, lng } = request;
    const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    try {
      if (Platform.OS === 'ios') {
        const g = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
        const a = `maps://?daddr=${lat},${lng}`;
        if (await Linking.canOpenURL(g)) return Linking.openURL(g);
        return Linking.openURL((await Linking.canOpenURL(a)) ? a : web);
      }
      const nav = `google.navigation:q=${lat},${lng}&mode=d`;
      return Linking.openURL((await Linking.canOpenURL(nav)) ? nav : web);
    } catch { return Linking.openURL(web); }
  }, [request]);

  const openMenu = useCallback(async () => {
    const abandon = async () => {
      const ok = await feedback.confirm({ titleKey: 'missions.abandon_title', messageKey: 'missions.abandon_msg', confirmKey: 'missions.abandon_short', cancelKey: 'missions.keep_mission', destructive: true });
      if (!ok) return;
      // On attend la confirmation du serveur avant de partir : sinon le
      // prestataire croit avoir abandonné alors que la mission lui reste.
      const attempt = async (): Promise<void> => {
        setBusy(true);
        try {
          await api.post(`/requests/${id}/cancel`, { reason: 'provider_abandon' });
          feedback.haptic('warning');
          router.replace('/(tabs)/dashboard');
        } catch (err: any) {
          devError('[abandon]', err?.message);
          feedback.error('ext.ongoing_abandon_failed');
          const retry = await feedback.confirm({ title: t('ext.ongoing_abandon_retry_title'), message: t('ext.ongoing_abandon_retry_msg'), confirm: t('common.retry'), cancel: t('ext.later') });
          if (retry) return attempt();
        } finally { setBusy(false); }
      };
      await attempt();
    };
    const choice = await feedback.actionSheet({ titleKey: 'missions.options', options: [{ labelKey: 'mission_view.contact_support' }, { labelKey: 'missions.cancel', destructive: true }], cancelKey: 'common.close' });
    if (choice === 0) router.push('/settings/help');
    else if (choice === 1) abandon();
  }, [router, id, t]);

  const verifyPin = useCallback(async () => {
    if (pin.length !== 4) return;
    setBusy(true); setPinError(false);
    try {
      await api.post(`/requests/${id}/verify-pin`, { pin });
      setPinVerified(true);
      setRequest((p: any) => (p ? { ...p, status: 'ONGOING', startedAt: p.startedAt ?? new Date().toISOString() } : p));
      feedback.haptic('success');
    } catch (error: any) {
      const code = error?.data?.code;
      setPin(''); setPinError(true);
      if (code === 'PIN_INCORRECT') {
        const left = error?.data?.attemptsRemaining;
        if (typeof left === 'number') setAttemptsLeft(left); else setAttemptsLeft((n) => Math.max(0, n - 1));
        feedback.haptic('error');
      } else if (code === 'PIN_EXPIRED') feedback.error('ext.ongoing_pin_expired_msg');
      else if (code === 'PIN_MAX_ATTEMPTS') feedback.error('ext.ongoing_pin_max_msg');
      else feedback.error('ext.ongoing_pin_verify_fail');
    } finally { setBusy(false); }
  }, [id, pin]);

  const complete = useCallback(async () => {
    const ok = await feedback.confirm({ titleKey: 'ext.ongoing_complete_title', messageKey: 'ext.ongoing_complete_msg', confirmKey: 'common.confirm', cancelKey: 'common.cancel' });
    if (!ok) return;
    setBusy(true);
    // Marqué AVANT l'appel : le serveur émet request:completed avant de
    // répondre, SocketContext ne doit pas naviguer une seconde fois.
    markCompletionHandled(String(id));
    try {
      await api.post(`/requests/${id}/complete`);
      if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
      feedback.event('mission_complete');
      router.replace({ pathname: '/request/[id]/earnings', params: { id: String(id) } });
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE') await loadRequest();
      else feedback.error('ext.ongoing_complete_generic_error');
    } finally { setBusy(false); }
  }, [id, router, loadRequest]);

  // ─── Carte et feuille ─────────────────────────────────────────────────────
  useMapCamera({ mapRef, ready: mapReady && mapMode !== 'none', mode: mapMode, door, other: myLocation, sheetHeight, topInset: insets.top, reduced });
  const visibleCount = useRevealCount(routeCoords.length, stage === 'en_route' && routeCoords.length > 0);
  const visibleRoute = useMemo(() => routeCoords.slice(0, visibleCount), [routeCoords, visibleCount]);
  const mapVisible = useSharedValue(1);
  useEffect(() => { mapVisible.value = reduced ? withTiming(mapMode === 'none' ? 0 : 1, { duration: 150 }) : withSpring(mapMode === 'none' ? 0 : 1, MOTION.pane); }, [mapMode, reduced, mapVisible]);
  const mapStyle = useAnimatedStyle(() => ({ opacity: mapVisible.value }));
  const topBar = useEntrance(-12);
  useEffect(() => { topBar.replay(); }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const levels: SheetLevel[] = stage === 'working' || stage === 'closing' ? ['page'] : stage === 'en_route' ? ['peek', 'half', 'full'] : ['half', 'full'];
  const level: SheetLevel = stage === 'working' || stage === 'closing' ? 'page' : 'half';

  // ─── Contenu par stade ───────────────────────────────────────────────────
  const clientMeta = brief?.client?.missionsCount != null
    ? t('pro.client_meta_missions', { lang: (brief.client.language ?? i18n.language).toUpperCase(), n: brief.client.missionsCount })
    : t('pro.client_meta', { lang: (brief?.client?.language ?? i18n.language).toUpperCase() });
  const clientRow = request?.client ? (
    <View style={{ marginTop: 16 }}>
      <ProviderRow provider={{ id: request.client.id, name: clientName, avatarUrl: request.client.avatarUrl, phone: request.client.phone }} meta={clientMeta} unread={unread} onMessage={message} onCall={call} />
    </View>
  ) : null;
  const addressBlock = brief ? (
    <View style={s.addr}>
      <Text style={[s.addrTitle, { color: theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{brief.place.address}</Text>
      <Text style={[s.addrSub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {[serviceName(brief), modeLabel(brief, t).toLowerCase(), brief.service.durationMinutes ? t('mission.minutes', { n: brief.service.durationMinutes }) : null].filter(Boolean).join(' · ')}
      </Text>
      <AccessChips brief={brief} />
    </View>
  ) : null;
  const net = brief ? <NetLine brief={brief} commissionRate={request?.commissionRate != null ? Number(request.commissionRate) : null} sub={stage === 'working' || stage === 'closing' ? t('pro.net_at_close') : undefined} /> : null;
  const end = brief ? plannedEnd(brief) : null;

  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;
  if (brief) {
    switch (stage) {
      case 'en_route':
        content = (
          <>
            <StageHeader stageKey="en_route" live={!gpsLost && !gpsDenied && !!myLocation} kicker={gpsDenied ? `${t('pro.en_route')} · ${t('pro.gps_denied')}` : gpsLost ? `${t('pro.en_route')} · ${t('pro.gps_lost')}` : `${t('pro.en_route')} · ${t('pro.live_gps')}`} />
            <EtaHero etaMin={etaMin} distanceKm={distance} hasGps={!!myLocation} />
            {addressBlock}
            {clientRow}
            {brief.photos.length ? <View style={{ marginTop: 14, marginHorizontal: -20 }}><PhotoGallery photos={brief.photos} title={t('mission.client_photos')} /></View> : null}
            {net}
          </>
        );
        footer = (<><Cta label={t('pro.navigate')} icon="navigation" onPress={navigate} /><Cta label={t('pro.arrived_cta')} tone="ghost" onPress={() => setArrivedTapped(true)} /></>);
        break;
      case 'on_site':
        content = (
          <>
            <StageHeader stageKey="on_site" kicker={t('pro.on_site', { time: formatClock(now) })} title={t('pro.before_title')} sub={t('pro.before_sub')} />
            {addressBlock}
            {clientRow}
            {net}
          </>
        );
        footer = <Cta label={t('pro.before_cta')} icon="camera" onPress={() => takePhoto('before')} loading={uploading === 'before'} />;
        break;
      case 'code':
        content = (
          <>
            <StageHeader stageKey="code" kicker={t('pro.before_done')} title={t('pro.code_title')} sub={t('pro.code_sub', { name: clientFirst })} />
            <CodeEntry value={pin} onChange={(v) => { setPin(v); setPinError(false); }} onSubmit={verifyPin} error={pinError} hint={t('pro.code_hint', { n: attemptsLeft })} />
            <View style={s.thumbRow}><View style={{ width: 120 }}><PhotoCard uri={beforeUri} label={t('pro.photo_before')} pending={uploading === 'before'} onPress={() => setViewer(0)} /></View></View>
            {clientRow}
          </>
        );
        footer = (<><Cta label={t('pro.code_cta')} onPress={verifyPin} disabled={pin.length !== 4} loading={busy} /><Cta label={t('pro.call_client', { name: clientFirst })} icon="phone" tone="ghost" onPress={call} /></>);
        break;
      case 'quote_write':
        content = (
          <>
            <StageHeader stageKey="quote_write" kicker={t('pro.before_done')} title={t('pro.quote_write_title')} sub={t('pro.quote_write_sub')} />
            {addressBlock}
            {clientRow}
            {brief.photos.length ? <View style={{ marginTop: 14, marginHorizontal: -20 }}><PhotoGallery photos={brief.photos} title={t('mission.client_photos')} /></View> : null}
            {net}
          </>
        );
        footer = <Cta label={t('pro.quote_write_cta')} icon="file-text" onPress={() => router.push({ pathname: '/request/[id]/send-quote', params: { id: String(id) } })} />;
        break;
      case 'quote_wait':
        content = (
          <>
            <StageHeader stageKey="quote_wait" kicker={t('pro.quote_wait_kicker')} title={t('pro.quote_wait_title', { amount: quoteAmount != null ? formatEUR(quoteAmount, 0) : '', name: clientFirst })} sub={t('pro.quote_wait_sub')} />
            {clientRow}
          </>
        );
        footer = <Cta label={t('pro.call_client', { name: clientFirst })} icon="phone" tone="ghost" onPress={call} />;
        break;
      case 'working':
      case 'closing': {
        const rows: RailRow[] = [
          { key: 'arrived', label: t('pro.rail_arrived'), when: formatClock(request.beforePhotoAt ?? request.startedAt), done: true },
          { key: 'started', label: t('pro.rail_started'), when: formatClock(request.startedAt), done: true },
          { key: 'after', label: t('pro.rail_after'), when: afterUri ? formatClock(request.afterPhotoAt ?? now) : null, done: !!afterUri },
          { key: 'done', label: t('pro.rail_done'), done: false },
        ];
        content = (
          <>
            <StageHeader stageKey={stage} live kicker={t('pro.working', { time: formatClock(request.startedAt ?? now) })} />
            <TimerHero since={request.startedAt ?? null} />
            <Text style={[s.sub, { color: theme.textSub }]}>{end ? t('pro.working_sub', { time: formatClock(end), n: brief.service.durationMinutes }) : t('pro.working_sub_no_end')}</Text>
            {net}
            <Rail rows={rows} />
            <View style={s.thumbRow}>
              <PhotoCard uri={beforeUri} label={t('pro.photo_before')} onPress={() => setViewer(0)} pending={uploading === 'before'} />
              <PhotoCard uri={afterUri} label={t('pro.photo_after')} placeholder={t('pro.photo_after_placeholder')} onPress={() => setViewer(beforeUri ? 1 : 0)} pending={uploading === 'after'} />
            </View>
            {clientRow}
          </>
        );
        footer = (
          <>
            {stage === 'working' ? <Cta label={t('pro.after_cta')} icon="camera" onPress={() => takePhoto('after')} loading={uploading === 'after'} /> : null}
            <Cta label={t('pro.complete_cta')} tone="green" onPress={complete} disabled={stage !== 'closing'} loading={busy && stage === 'closing'} />
          </>
        );
        break;
      }
      default:
        break;
    }
  }

  const gallery = useMemo(() => [beforeUri, afterUri].filter(Boolean).map((u, i) => ({ id: i, url: u as string, shotKey: null, width: 0, height: 0 })), [beforeUri, afterUri]);

  if (loading || !request || !brief) {
    return <View style={[s.center, { backgroundColor: theme.bg }]}><StatusBar barStyle={theme.statusBar} /><ActivityIndicator size="large" color={theme.accent as string} /></View>;
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {mapMode !== 'none' ? (
        <Animated.View style={[StyleSheet.absoluteFillObject, mapStyle]}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={MAP_PROVIDER}
            {...mapAppearance(theme.isDark)}
            initialRegion={{ ...door, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
            onMapReady={() => setMapReady(true)}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsPointsOfInterest={false}
            showsBuildings={false}
            pitchEnabled={false}
            rotateEnabled={false}
            toolbarEnabled={false}
            scrollEnabled={stage === 'en_route'}
            zoomEnabled={stage === 'en_route'}
          >
            <MapPin coordinate={door} anchor={{ x: 0.5, y: 1 }}><DoorMarker /></MapPin>
            {myLocation && stage === 'en_route' ? <MapPin coordinate={myLocation} anchor={{ x: 0.5, y: 1 }} trackKey={`${myHeading ?? 'x'}-${(authUser as any)?.avatarUrl ?? ''}`} trackMs={1600}><MeMarker name={(authUser as any)?.name} avatarUrl={(authUser as any)?.avatarUrl} heading={myHeading} /></MapPin> : null}
            {stage === 'en_route' && visibleRoute.length > 1 ? <Polyline coordinates={visibleRoute} strokeColor={theme.isDark ? 'rgba(248,247,244,0.55)' : 'rgba(26,26,26,0.45)'} strokeWidth={3} /> : null}
          </MapView>
          {near && stage === 'on_site' ? (
            <View style={[s.arrive, { top: insets.top + 60, backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[s.arriveTitle, { color: theme.greenText }]}>{t('pro.you_are_here')}</Text>
              <Text style={[s.arriveSub, { color: theme.textSub }]} numberOfLines={1}>{brief.place.address}</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View style={topBar.style}>
        <SafeAreaView style={s.topBar} edges={['top']} pointerEvents="box-none">
          <Pressable style={[s.roundBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={handleLeave} accessibilityLabel={t('common.back')} accessibilityRole="button" hitSlop={8}>
            <Feather name="arrow-left" size={20} color={theme.text as string} />
          </Pressable>
          <View style={[s.badge, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
            <Text style={[s.badgeText, { color: theme.text }]}>FIXED</Text>
            <Text style={[s.badgeText, { color: theme.textMuted }]}>·</Text>
            <Text style={[s.badgeText, { color: theme.textSub }]}>#{id}</Text>
          </View>
          <Pressable style={[s.roundBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={openMenu} disabled={busy} accessibilityLabel={t('missions.options')} accessibilityRole="button" hitSlop={8}>
            <Feather name="more-horizontal" size={22} color={theme.text as string} />
          </Pressable>
        </SafeAreaView>
      </Animated.View>

      <StageSheet levels={levels} level={level} onHeightChange={setSheetHeight} footer={footer} keyboard={stage === 'code'}>
        {level === 'page' ? <View style={{ height: 52 }} /> : null}
        {content}
      </StageSheet>

      <PhotoViewer photos={gallery} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, zIndex: 10 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  arrive: { position: 'absolute', left: 16, right: 16, padding: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  arriveTitle: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 1, includeFontPadding: false },
  arriveSub: { flex: 1, fontFamily: FONTS.sans, fontSize: 11.5 },
  addr: { marginTop: 16 },
  addrTitle: { fontFamily: FONTS.sansMedium, fontSize: 15, lineHeight: 20 },
  addrSub: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  sub: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 18, marginTop: 6 },
  thumbRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
