// components/provider/MissionFlow.tsx — la mission, sur l'accueil.
//
// Une seule feuille (StageSheet) hébergée par l'accueil prestataire : la carte
// reste, la feuille monte dessus et change de contenu à chaque stade
// (providerStageOf) : en route → sur place → code → (devis) → intervention →
// clôture → terminée. Chaque feuille fait la taille de son contenu, jamais
// plus. Les règles du serveur ne changent pas : photo avant → code (3 essais,
// 4 h) → photo après → clôture.
//
// La position, le cap et l'ETA viennent de l'accueil (une seule montre GPS,
// un seul itinéraire) ; la feuille remonte son stade et sa hauteur pour que
// la caméra et l'étiquette suivent. Ex-app/request/[id]/ongoing.tsx.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
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
import { briefOf, isQuoteMode, netFor, type MissionBrief } from '@/lib/mission/brief';
import { ARRIVAL_RADIUS_M, metersBetween, plannedEnd } from '@/lib/mission/stage';
import { distanceKm, type LatLng } from '@/lib/mission/route';
import { providerMapMode, providerStageOf, type ProviderStage } from '@/lib/mission/providerStage';
import { serviceName, modeLabel } from '@/components/mission/blocks';
import { PhotoGallery, PhotoViewer } from '@/components/mission/photos';
import { DigitReel } from '@/components/ui/DigitReel';
import { AccessChips, CodeEntry, Cta, EtaHero, NetLine, PhotoCard, ProviderRow, Rail, StageHeader, StageSheet, TimerHero, type RailRow, type SheetLevel } from '@/components/tracking';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const RETRY_MAX = 6;
const RETRY_DELAY = 800;
const GPS_STALE_MS = 30_000;
const PIN_MAX_ATTEMPTS = 3;
const PAYOUT_DELAY_DAYS = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ce que l'accueil doit savoir de la mission pour cadrer sa carte et écrire son étiquette. */
export type MissionFacts = {
  stage: ProviderStage;
  mapMode: 'me' | 'band' | 'none';
  door: LatLng | null;
  /** Hauteur visible de la feuille (px). */
  sheetHeight: number;
  startedAt: string | null;
};

type Props = {
  requestId: string;
  myLocation: LatLng | null;
  gpsDenied: boolean;
  /** Minutes de route jusqu'à la porte, calculées par l'accueil. */
  etaMin: number | null;
  onFacts: (f: MissionFacts) => void;
  /** La mission est finie (clôturée, annulée, retirée) : l'accueil reprend la main. */
  onExit: (reason: 'done' | 'gone') => void;
};

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

export function MissionFlow({ requestId: id, myLocation, gpsDenied, etaMin, onFacts, onExit }: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const { user: authUser } = useAuth();

  // ─── La demande et les faits du terrain ──────────────────────────────────
  const [request, setRequest] = useState<any>(null);
  const [gpsAt, setGpsAt] = useState<number | null>(null);
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
  const [viewer, setViewer] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const pendingCameraChecked = useRef(false);

  const brief: MissionBrief | null = useMemo(() => (request ? briefOf(request) : null), [request]);
  const isQuote = isQuoteMode(request?.pricingMode);
  const door: LatLng | null = useMemo(() => (request?.lat != null && request?.lng != null ? { latitude: request.lat, longitude: request.lng } : null), [request?.lat, request?.lng]);
  const near = !!myLocation && !!door && metersBetween(myLocation.latitude, myLocation.longitude, door.latitude, door.longitude) <= ARRIVAL_RADIUS_M;
  const stage: ProviderStage = doneAt ? 'done' : providerStageOf(request, { near, arrivedTapped, beforePhoto: !!beforeUri, pinVerified, afterPhoto: !!afterUri, isQuote, hasQuote });
  const mapMode = stage === 'done' ? 'me' : providerMapMode(stage);
  const clientName = cleanName(request?.client?.name, { fallback: t('provider.client') });
  const clientFirst = clientName.split(/\s+/)[0];
  const gpsLost = !gpsDenied && gpsAt != null && now - gpsAt > GPS_STALE_MS;
  const distance = myLocation && door ? distanceKm(myLocation, door) : null;
  useEffect(() => { if (myLocation) setGpsAt(Date.now()); }, [myLocation?.latitude, myLocation?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientUserId = request?.client?.id || request?.clientId || null;
  const { count: unread, reset: resetUnread } = useConversationUnread(clientUserId, authUser?.id);

  // L'accueil suit : stade, mode caméra, porte, hauteur de feuille.
  useEffect(() => {
    onFacts({ stage, mapMode, door, sheetHeight, startedAt: request?.startedAt ?? null });
  }, [stage, mapMode, door, sheetHeight, request?.startedAt, onFacts]);

  // ─── Charger ─────────────────────────────────────────────────────────────
  const loadRequest = useCallback(async (attempt = 0) => {
    try {
      const response: any = await api.get(`/requests/${id}`);
      const data = response?.data || response;
      const st = (data?.status || '').toUpperCase();
      if (['PUBLISHED', 'PENDING', 'QUOTE_PENDING'].includes(st)) {
        if (attempt < RETRY_MAX) { await sleep(RETRY_DELAY); return loadRequest(attempt + 1); }
        feedback.error('missions.load_error');
        onExit('gone');
        return;
      }
      if (!['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(st)) {
        if (st === 'DONE' || st === 'COMPLETED') router.replace({ pathname: '/request/[id]/earnings', params: { id: String(id) } });
        onExit('gone');
        return;
      }
      // Mission planifiée hors fenêtre (> 30 min avant) → écran d'attente dédié.
      if (st === 'ACCEPTED' && data?.preferredTimeStart) {
        const minutesUntilStart = Math.round((new Date(data.preferredTimeStart).getTime() - Date.now()) / 60_000);
        if (minutesUntilStart > 30) { router.push({ pathname: '/request/[id]/early', params: { id: String(id) } }); onExit('gone'); return; }
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
      onExit('gone');
    }
  }, [id, router, onExit]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  // Horloge : le kicker « GPS perdu » et les heures affichées.
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(iv); }, []);

  // ─── Photos ──────────────────────────────────────────────────────────────
  const sendPhoto = useCallback(async (type: 'before' | 'after', uri: string) => {
    setUploading(type);
    if (type === 'before') setBeforeUri(uri); else setAfterUri(uri);
    try {
      await uploadMissionPhoto(String(id), type, uri, myLocation);
      feedback.haptic('success');
    } catch (err: any) {
      devError('[MISSION] photo', err);
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
    } catch (err) { devError('[MISSION] camera', err); }
  }, [sendPhoto]);

  // Android : l'OS peut tuer l'app pendant que la caméra est ouverte. Au
  // retour, le cliché orphelin est repris à l'étape courante.
  useEffect(() => {
    if (Platform.OS !== 'android' || !request || pendingCameraChecked.current) return;
    pendingCameraChecked.current = true;
    (async () => {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        const first = (Array.isArray(pending) ? pending[0] : null) as ImagePicker.ImagePickerResult | null;
        const uri = first && !(first as any).code && !first.canceled ? first.assets?.[0]?.uri : null;
        if (uri) await sendPhoto(beforeUri ? 'after' : 'before', uri);
      } catch (err) { devError('[MISSION] getPendingResultAsync', err); }
    })();
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
    const onCancelled = (d: any) => { if (d?.reason === 'admin_reassign' || !same(d)) return; onExit('gone'); };
    const onStatusUpdated = (d: any) => { if (same(d)) loadRequest(); };
    const onUnassigned = (d: any) => { if (!same(d)) return; feedback.info('ext.ongoing_unassigned_msg'); onExit('gone'); };
    socket.on('request:cancelled', onCancelled);
    socket.on('request:unassigned', onUnassigned);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', String(id));
      socket.off('request:cancelled', onCancelled);
      socket.off('request:unassigned', onUnassigned);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
  }, [socket, id, joinRoom, leaveRoom, loadRequest, onExit]);

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
    if (!door) return;
    const { latitude: lat, longitude: lng } = door;
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
  }, [door]);

  const openMenu = useCallback(async () => {
    const abandon = async () => {
      const ok = await feedback.confirm({ titleKey: 'missions.abandon_title', messageKey: 'missions.abandon_msg', confirmKey: 'missions.abandon_short', cancelKey: 'missions.keep_mission', destructive: true });
      if (!ok) return;
      // On attend la confirmation du serveur avant de rendre la main : sinon le
      // prestataire croit avoir abandonné alors que la mission lui reste.
      const attempt = async (): Promise<void> => {
        setBusy(true);
        try {
          await api.post(`/requests/${id}/cancel`, { reason: 'provider_abandon' });
          feedback.haptic('warning');
          onExit('gone');
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
  }, [router, id, t, onExit]);

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
      feedback.event('mission_complete');
      // La feuille vire au vert, sur place : le bilan, puis « mission suivante ».
      setDoneAt(Date.now());
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE') await loadRequest();
      else feedback.error('ext.ongoing_complete_generic_error');
    } finally { setBusy(false); }
  }, [id, loadRequest]);

  // ─── Feuille : paliers ───────────────────────────────────────────────────
  // Chaque feuille fait la taille de son contenu (enableDynamicSizing) ; en
  // route, un palier « aperçu » laisse respirer la carte.
  const levels: SheetLevel[] = stage === 'en_route' ? ['peek', 'half', 'full'] : ['half', 'full'];
  const level: SheetLevel = 'half';

  // ─── Contenu par stade ───────────────────────────────────────────────────
  const clientMeta = brief?.client?.missionsCount != null
    ? t('pro.client_meta_missions', { lang: (brief.client.language ?? i18n.language).toUpperCase(), n: brief.client.missionsCount })
    : t('pro.client_meta', { lang: (brief?.client?.language ?? i18n.language).toUpperCase() });
  const clientRow = request?.client ? (
    <View style={{ marginTop: 14 }}>
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
  // Aide et abandon : une ligne discrète en bas de la feuille (plus de « … » en haut : l'accueil garde sa rangée).
  const options = stage !== 'done' ? (
    <Pressable onPress={openMenu} disabled={busy} style={s.options} accessibilityRole="button" accessibilityLabel={t('missions.options')} hitSlop={6}>
      <Feather name="more-horizontal" size={16} color={theme.textMuted as string} />
      <Text style={[s.optionsText, { color: theme.textMuted }]}>{t('missions.options')}</Text>
    </Pressable>
  ) : null;

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
            {options}
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
            {options}
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
            {options}
          </>
        );
        footer = (<><Cta label={t('pro.code_cta')} onPress={verifyPin} disabled={pin.length !== 4} loading={busy} /><Cta label={t('pro.call_client', { name: clientFirst })} icon="phone" tone="ghost" onPress={call} /></>);
        break;
      case 'quote_write':
        content = (
          <>
            <StageHeader stageKey="quote_write" kicker={t('pro.before_done')} title={t('pro.quote_write_title')} sub={t('pro.quote_write_sub')} />
            {addressBlock}
            {brief.photos.length ? <View style={{ marginTop: 14, marginHorizontal: -20 }}><PhotoGallery photos={brief.photos} title={t('mission.client_photos')} /></View> : null}
            {clientRow}
            {options}
          </>
        );
        footer = <Cta label={t('pro.quote_write_cta')} icon="file-text" onPress={() => router.push({ pathname: '/request/[id]/send-quote', params: { id: String(id) } })} />;
        break;
      case 'quote_wait':
        content = (
          <>
            <StageHeader stageKey="quote_wait" kicker={t('pro.quote_wait_kicker')} title={t('pro.quote_wait_title', { amount: quoteAmount != null ? formatEUR(quoteAmount, 0) : '', name: clientFirst })} sub={t('pro.quote_wait_sub')} />
            {clientRow}
            {options}
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
            {options}
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
      case 'done': {
        // La feuille vire au vert : le bilan tient en une feuille à la taille de son contenu.
        const netEur = netFor(brief);
        const startedAt = request.startedAt ? new Date(request.startedAt).getTime() : null;
        const durationMin = startedAt && doneAt ? Math.max(1, Math.round((doneAt - startedAt) / 60_000)) : null;
        const rows: RailRow[] = [
          { key: 'arrived', label: t('pro.rail_arrived'), when: formatClock(request.beforePhotoAt ?? request.startedAt), done: true },
          { key: 'started', label: t('pro.rail_started'), when: formatClock(request.startedAt), done: true },
          { key: 'after', label: t('pro.rail_after'), when: formatClock(request.afterPhotoAt ?? doneAt), done: true },
        ];
        content = (
          <View style={s.done}>
            <Text style={[s.doneKicker]} maxFontSizeMultiplier={1.2}>
              {[t('cockpit.m_done').toUpperCase(), doneAt ? formatClock(doneAt) : null, durationMin != null ? t('cockpit.done_duration', { n: durationMin }) : null].filter(Boolean).join(' · ')}
            </Text>
            <View style={s.doneRow}>
              <Text style={s.doneTitle} maxFontSizeMultiplier={1.2}>{t('cockpit.mission_done')}</Text>
              {netEur != null ? (
                <View style={s.doneNet} accessible accessibilityLabel={`+${formatEUR(netEur, 0)}`}>
                  <Text style={s.doneNetSign}>+</Text>
                  <DigitReel value={Math.round(netEur)} lineHeight={44} textStyle={s.doneNetText} />
                  <Text style={s.doneNetText}> €</Text>
                </View>
              ) : null}
            </View>
            <Text style={s.doneSub} maxFontSizeMultiplier={1.2}>{t('cockpit.done_net', { n: PAYOUT_DELAY_DAYS })}</Text>
            <View style={s.doneRail}>
              {rows.map((r) => (
                <View key={r.key} style={s.doneLine}>
                  <View style={s.doneDot} />
                  <Text style={s.doneLineText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{r.label}</Text>
                  {r.when ? <Text style={s.doneWhen} maxFontSizeMultiplier={1.2}>{r.when}</Text> : null}
                </View>
              ))}
            </View>
            <View style={s.thumbRow}>
              <PhotoCard uri={beforeUri} label={t('pro.photo_before')} onPress={() => setViewer(0)} />
              <PhotoCard uri={afterUri} label={t('pro.photo_after')} onPress={() => setViewer(beforeUri ? 1 : 0)} />
            </View>
          </View>
        );
        footer = <Cta label={t('cockpit.done_next')} onPress={() => onExit('done')} />;
        break;
      }
      default:
        break;
    }
  }

  const gallery = useMemo(() => [beforeUri, afterUri].filter(Boolean).map((u, i) => ({ id: i, url: u as string, shotKey: null, width: 0, height: 0 })), [beforeUri, afterUri]);

  if (!request || !brief) return null;

  return (
    <>
      <StageSheet levels={levels} level={level} onHeightChange={setSheetHeight} footer={footer} keyboard={stage === 'code'} tone={stage === 'done' ? 'green' : 'default'}>
        {content}
      </StageSheet>
      <PhotoViewer photos={gallery} index={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

const s = StyleSheet.create({
  addr: { marginTop: 14 },
  addrTitle: { fontFamily: FONTS.sansMedium, fontSize: 15, lineHeight: 20 },
  addrSub: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  sub: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 18, marginTop: 6 },
  thumbRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 6 },
  optionsText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  // Terminée : sur le vert de la marque, encre sombre.
  done: { paddingTop: 2 },
  doneKicker: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2, color: 'rgba(10,10,10,0.7)' },
  doneRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  doneTitle: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, color: '#0A0A0A', includeFontPadding: false, flexShrink: 1 },
  doneNet: { flexDirection: 'row', alignItems: 'flex-end' },
  doneNetSign: { fontFamily: FONTS.bebas, fontSize: 40, color: '#0A0A0A', includeFontPadding: false, lineHeight: 44 },
  doneNetText: { fontFamily: FONTS.bebas, fontSize: 40, color: '#0A0A0A', includeFontPadding: false, letterSpacing: 0.5 },
  doneSub: { fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(10,10,10,0.7)', marginTop: 2 },
  doneRail: { marginTop: 12, gap: 8 },
  doneLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A0A0A' },
  doneLineText: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: '#0A0A0A' },
  doneWhen: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1, color: 'rgba(10,10,10,0.75)' },
});

export const MISSION_DONE_GREEN = COLORS.greenBrand;
