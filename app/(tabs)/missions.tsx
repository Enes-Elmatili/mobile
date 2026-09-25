// app/(tabs)/missions.tsx — Missions, c'est l'agenda (planche 6, 20/09/2026).
//
// Un seul écran, sans onglets, lu de haut en bas : la semaine (un point par
// mission, ambre si un devis attend), « maintenant » (la mission active — elle
// vit sur l'accueil), « à prendre » (les demandes ouvertes autour de vous),
// le fil du jour choisi (l'heure à gauche, la mission à droite, le trajet ou
// le creux entre deux, « libre » à la fin, le net du jour en pied), puis les
// missions passées repliées par mois. Le temps, pas le statut.
//
// Mêmes données qu'avant (/requests, /requests/opportunities), même feuille
// de détail (components/agenda/details), même glissé pour accepter.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import BottomSheet, { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Reanimated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { briefOf } from '@/lib/mission/brief';
import { fetchRoute } from '@/lib/mission/route';
import { SplitPane, useSplitPane, useLayoutClass } from '@/lib/layout';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useSocket } from '@/lib/SocketContext';
import { feedback } from '@/lib/feedback/feedback';
import { useTabBarPadding } from './_layout';
import { BarLock, useNavStore } from '@/stores/nav';
import { currentOf, dayKey, dayTimeline, monthGroups, startOfWeek, tripPairs, weeksAround, type AgendaItem, type Trips } from '@/lib/agenda/model';
import { AgendaWeek, DayFoot, EmptyDay, NowRow, PastMonth, SectionHead, TakeRow, Timeline, useOpenMonths } from '@/components/agenda/rows';
import { MissionDetail, OpportunityDetail, getLocale, type Mission, type Opportunity } from '@/components/agenda/details';
import { LAYOUT } from '@/lib/motion/layout';
import { PressScale } from '@/components/ui/PressScale';

const WEEKS_BEFORE = 4;
const WEEKS_AFTER = 8;

/** Un item d'agenda depuis une demande brute de l'API. */
function itemOf(r: any): AgendaItem {
  const brief = briefOf(r);
  const at = new Date(r.preferredTimeStart || r.scheduledAt || r.createdAt || Date.now()).getTime();
  return { id: String(r.id), status: String(r.status || '').toUpperCase(), at, durationMin: brief.service.durationMinutes ?? 60, lat: r.lat ?? null, lng: r.lng ?? null, brief };
}

/** La forme attendue par la feuille de détail (inchangée). */
function missionOf(r: any, fallbackTitle: string): Mission {
  return {
    id: String(r.id), title: r.serviceType || r.title || fallbackTitle, serviceType: r.serviceType, description: r.description || '', price: r.price || 0,
    status: r.status, address: r.address, location: r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined, lat: r.lat, lng: r.lng,
    client: r.client ? { id: r.client.id, name: r.client.name || '', phone: r.client.phone } : undefined,
    createdAt: r.createdAt, scheduledAt: r.preferredTimeStart || r.scheduledAt, brief: briefOf(r),
  };
}

export default function Missions() {
  const router = useRouter();
  const { socket } = useSocket();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width, height: windowHeight } = useLayoutClass();
  const tabBarPadding = useTabBarPadding();
  const brandRefresh = useBrandRefresh();
  const isSplit = useSplitPane();
  const setToTake = useNavStore((st) => st.setToTake);

  // ─── Données ─────────────────────────────────────────────────────────────
  const [raw, setRaw] = useState<any[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingOpp, setAcceptingOpp] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(iv); }, []);

  const loadMissions = useCallback(async () => {
    try {
      setError(null);
      const response = await api.requests.list();
      const list: any[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      setRaw(list);
      setItems(list.map(itemOf));
    } catch (e) {
      devError('Missions load error:', e);
      setError(t('missions.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const fetchOpportunities = useCallback(async (): Promise<Opportunity[] | null> => {
    try {
      const res = await api.get('/requests/opportunities');
      const data = res?.data ?? res;
      const list: any[] = Array.isArray(data) ? data : data?.data ?? [];
      const mapped = list.map((o) => ({ ...o, brief: briefOf(o) }));
      setOpportunities(mapped);
      return mapped;
    } catch (e) {
      devError('Opportunities load error:', e);
      return null;
    }
  }, []);

  const handleAcceptOpp = useCallback(async (requestId: number) => {
    setAcceptingOpp(requestId);
    try {
      await api.post(`/requests/${requestId}/accept`);
      feedback.haptic('success');
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
      await loadMissions();
    } catch (e: any) {
      const code = e?.response?.data?.code || e?.data?.code;
      if (code === 'INVALID_STATE' || code === 'ALREADY_TAKEN') {
        setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
        feedback.error('provider.mission_unavailable_msg');
      } else {
        feedback.error(e?.response?.data?.message || e?.message || t('common.error'));
      }
    } finally {
      setAcceptingOpp(null);
    }
  }, [loadMissions, t]);

  const handleDeclineOpp = useCallback(async (requestId: number) => {
    setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    feedback.haptic('light');
    try { await api.post(`/requests/${requestId}/refuse`); } catch (e: any) { feedback.error(e?.response?.data?.message || e?.message || t('common.error')); }
  }, [t]);

  // Temps réel : nouvelles demandes, statuts, demandes prises ailleurs, annulations.
  useEffect(() => {
    if (!socket) return;
    const handleOpp = () => { fetchOpportunities(); };
    const handleStatus = () => { loadMissions(); };
    const handleClaimed = (requestId: number | string) => { const idNum = Number(requestId); setOpportunities((prev) => prev.filter((o) => o.id !== idNum)); };
    const handleCancelled = (data: any) => { handleClaimed(data?.id ?? data); loadMissions(); };
    socket.on('new_opportunity', handleOpp);
    socket.on('request:statusUpdated', handleStatus);
    socket.on('request:claimed', handleClaimed);
    socket.on('request:cancelled', handleCancelled);
    return () => {
      socket.off('new_opportunity', handleOpp);
      socket.off('request:statusUpdated', handleStatus);
      socket.off('request:claimed', handleClaimed);
      socket.off('request:cancelled', handleCancelled);
    };
  }, [socket, fetchOpportunities, loadMissions]);

  // Rattrapage au focus (cache court) ; les sockets font le temps réel.
  const lastFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    const t0 = Date.now();
    if (t0 - lastFetchRef.current > 60_000) { lastFetchRef.current = t0; loadMissions(); fetchOpportunities(); }
  }, [loadMissions, fetchOpportunities]));
  const onRefresh = () => { lastFetchRef.current = Date.now(); setRefreshing(true); loadMissions(); fetchOpportunities(); };

  // Le badge de l'onglet (à prendre + devis à rédiger) est écrit par l'accueil ; on lui donne « à prendre ».
  useEffect(() => { setToTake(opportunities.length); }, [opportunities.length, setToTake]);
  useEffect(() => () => setToTake(0), [setToTake]);

  // ─── L'agenda ────────────────────────────────────────────────────────────
  const todayKey = dayKey(now);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const weeks = useMemo(() => weeksAround(now, items, WEEKS_BEFORE, WEEKS_AFTER), [now, items]);
  const current = useMemo(() => currentOf(items, now), [items, now]);
  const [weekIndex, setWeekIndex] = useState(WEEKS_BEFORE);
  const [jump, setJump] = useState({ index: WEEKS_BEFORE, n: 0 });
  const monthOfStrip = useMemo(() => new Date((weeks[weekIndex] ?? weeks[WEEKS_BEFORE]).start + 3 * 86_400_000), [weeks, weekIndex]);

  // Les trajets entre deux missions consécutives du jour : une fois, en cache.
  const [trips, setTrips] = useState<Trips>({});
  const tripsRef = useRef<Trips>({});
  useEffect(() => {
    const pairs = tripPairs(items, selectedKey).filter((p) => tripsRef.current[p.key] === undefined);
    if (!pairs.length) return;
    let cancelled = false;
    (async () => {
      for (const p of pairs) {
        try {
          const r = await fetchRoute({ latitude: p.from.lat!, longitude: p.from.lng! }, { latitude: p.to.lat!, longitude: p.to.lng! });
          tripsRef.current[p.key] = r.etaMin;
        } catch { tripsRef.current[p.key] = undefined; }
      }
      if (!cancelled) setTrips({ ...tripsRef.current });
    })();
    return () => { cancelled = true; };
  }, [items, selectedKey]);

  const day = useMemo(() => dayTimeline(items, selectedKey, trips, current), [items, selectedKey, trips, current]);
  const past = useMemo(() => monthGroups(items), [items]);
  const { isOpen, toggle } = useOpenMonths(past[0]?.key ?? '');

  const locale = getLocale();
  const dayLabel = useCallback((dow: number) => new Date(startOfWeek(now) + dow * 86_400_000).toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''), [now, locale]);
  const longDay = (key: string) => { const d = new Date(`${key}T12:00:00`); return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' }); };
  const monthLabel = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString(locale, { month: 'long' });
  const shortDay = (ms: number) => new Date(ms).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }).replace('.', '');
  const whenLabel = (iso: string | null | undefined) => {
    if (!iso) return t('mission.now');
    const d = new Date(iso); const k = dayKey(d.getTime());
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (k === todayKey) return `${t('agenda.today_short')} ${time}`;
    if (k === dayKey(now + 86_400_000)) return `${t('agenda.tomorrow')} ${time}`;
    return `${shortDay(d.getTime())} ${time}`;
  };
  const currentSub = current ? [current.brief.place.address ? current.brief.place.address.split(',').slice(-2, -1)[0]?.trim() : null, current.status === 'ONGOING' ? t('cockpit.m_working').toLowerCase() : t('cockpit.m_en_route').toLowerCase()].filter(Boolean).join(' · ') : '';

  // ─── Détail (même feuille qu'avant) ──────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheet>(null);
  const sheetMotion = useSheetMotion();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const closeDetail = useCallback(() => { bottomSheetRef.current?.close(); setDetailOpen(false); }, []);
  useAndroidBackClose(detailOpen, closeDetail);

  const goHome = useCallback(() => router.replace('/(tabs)/dashboard'), [router]);
  const openMission = useCallback(async (item: AgendaItem, isCurrent: boolean) => {
    if (isCurrent) { goHome(); return; }
    setSelectedOpportunity(null);
    setLoadingDetails(true);
    setDetailOpen(true);
    const known = raw.find((r) => String(r.id) === item.id);
    if (known) setSelectedMission(missionOf(known, t('missions.mission')));
    try {
      const res = await api.get(`/requests/${item.id}`);
      setSelectedMission(missionOf(res?.data || res, t('missions.mission')));
    } catch { devError('Error loading mission details'); }
    finally { setLoadingDetails(false); }
  }, [raw, goHome, t]);
  const openOpportunity = useCallback((o: Opportunity) => { setSelectedMission(null); setSelectedOpportunity(o); setDetailOpen(true); }, []);

  // Une notification « demande planifiée / devis voulu » tapée (?opportunity=) :
  // sa fiche s'ouvre, ou on dit qu'elle est partie — pas un agenda muet.
  const { opportunity: wantedOpp } = useLocalSearchParams<{ opportunity?: string }>();
  const handledOppRef = useRef<string | null>(null);
  useEffect(() => {
    const rid = wantedOpp ? String(wantedOpp) : null;
    if (!rid || handledOppRef.current === rid) return;
    handledOppRef.current = rid;
    router.setParams({ opportunity: undefined });
    (async () => {
      const list = await fetchOpportunities();
      const o = list?.find((x) => String(x.id) === rid);
      if (o) openOpportunity(o);
      else if (list) feedback.info('cockpit.request_gone');
    })();
  }, [wantedOpp, router, fetchOpportunities, openOpportunity]);
  const openPast = useCallback((item: AgendaItem) => {
    if (item.status === 'DONE') router.push({ pathname: '/request/[id]/earnings', params: { id: item.id } });
    else openMission(item, false);
  }, [router, openMission]);

  const handleNavigate = (m: Mission) => {
    const lat = m.lat || m.location?.lat, lng = m.lng || m.location?.lng;
    if (!lat || !lng) return;
    const url = Platform.select({ ios: `maps://app?daddr=${lat},${lng}`, android: `google.navigation:q=${lat},${lng}` });
    if (url) Linking.openURL(url);
  };
  const handleComplete = useCallback(async (m: Mission) => {
    const ok = await feedback.confirm({ title: `${t('missions.complete_confirm')} ?`, message: m.title, confirm: t('missions.complete_cta'), cancel: t('common.cancel') });
    if (!ok) return;
    try {
      await api.post(`/requests/${m.id}/complete`);
      await loadMissions();
      router.push({ pathname: '/request/[id]/earnings', params: { id: m.id } });
    } catch (e: any) {
      if (e?.data?.code === 'INVALID_STATE' || e?.status === 400) await loadMissions();
      else feedback.error('ext.ongoing_complete_generic_error');
    }
  }, [loadMissions, router, t]);
  const onViewFull = (m: Mission) => {
    closeDetail();
    if ((m.status || '').toUpperCase() === 'QUOTE_PENDING') router.push({ pathname: '/request/[id]/send-quote', params: { id: m.id } });
    else router.replace({ pathname: '/(tabs)/dashboard', params: { mission: m.id } });
  };
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />, []);

  const detail = !detailOpen ? null : loadingDetails && !selectedMission ? (
    <ActivityIndicator size="large" color={theme.accent as string} style={{ marginTop: 60 }} />
  ) : selectedMission ? (
    <MissionDetail inPane={isSplit} mission={selectedMission} onNavigate={() => handleNavigate(selectedMission)} onComplete={() => { closeDetail(); handleComplete(selectedMission); }} onViewFull={() => onViewFull(selectedMission)} />
  ) : selectedOpportunity ? (
    <OpportunityDetail inPane={isSplit} opportunity={selectedOpportunity} accepting={acceptingOpp === selectedOpportunity.id} onAccept={() => { closeDetail(); handleAcceptOpp(selectedOpportunity.id); }} onDecline={() => { closeDetail(); handleDeclineOpp(selectedOpportunity.id); }} />
  ) : null;

  if (loading) {
    return <SafeAreaView edges={['top', 'left', 'right']} style={[s.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.accent as string} /></SafeAreaView>;
  }

  const dayTitle = longDay(selectedKey);
  const isToday = selectedKey === todayKey;
  const monthLabelText = monthOfStrip.toLocaleDateString(locale, { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <SplitPane
        master={(
          <>
            <BrandRefreshHeader style={brandRefresh.headerStyle} />
            <Reanimated.ScrollView
              onScroll={brandRefresh.onScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: tabBarPadding }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
            >
              {/* -- Titre : le mois affiché, « Missions », Aujourd'hui -- */}
              <View style={s.head}>
                <View>
                  {/* Le mois suit la semaine affichée, en fondu. */}
                  <Reanimated.Text key={monthLabelText} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={[s.month, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{monthLabelText}</Reanimated.Text>
                  <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('ext.missions_title').toUpperCase()}</Text>
                </View>
                {!isToday || weekIndex !== WEEKS_BEFORE ? (
                  <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                    <PressScale onPress={() => { feedback.haptic('selection'); setSelectedKey(todayKey); setJump((j) => ({ index: WEEKS_BEFORE, n: j.n + 1 })); }} style={[s.todayBtn, { borderColor: theme.border }]} accessibilityRole="button">
                      <Text style={[s.todayText, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('agenda.today')}</Text>
                    </PressScale>
                  </Reanimated.View>
                ) : null}
              </View>

              {/* -- La semaine -- */}
              <AgendaWeek weeks={weeks} selectedKey={selectedKey} onSelect={setSelectedKey} width={width} dayLabel={dayLabel} initialIndex={WEEKS_BEFORE} jump={jump} onWeekChange={setWeekIndex} />

              {error ? (
                <PressScale onPress={loadMissions} style={[s.error, { backgroundColor: theme.surface }]} accessibilityRole="button">
                  <Text style={[s.errorText, { color: theme.text }]}>{error} · {t('common.retry')}</Text>
                </PressScale>
              ) : null}

              {/* -- Maintenant -- */}
              {current ? (
                <Reanimated.View entering={FadeInDown.duration(240)} exiting={FadeOut.duration(140)} layout={LAYOUT}>
                  <SectionHead title={t('agenda.now')} /><NowRow item={current} sub={currentSub} onPress={goHome} />
                </Reanimated.View>
              ) : null}

              {/* -- À prendre -- */}
              {opportunities.length ? (
                <Reanimated.View entering={FadeInDown.duration(240)} exiting={FadeOut.duration(140)} layout={LAYOUT}>
                  <SectionHead title={t('agenda.to_take')} aside={t('agenda.around_you', { count: opportunities.length })} />
                  {opportunities.map((o, i) => (
                    <Reanimated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)} exiting={FadeOut.duration(160)} layout={LAYOUT}>
                      <TakeRow brief={o.brief} when={whenLabel(o.preferredTimeStart)} onPress={() => openOpportunity(o)} onAccept={acceptingOpp ? undefined : () => handleAcceptOpp(o.id)} onDecline={acceptingOpp ? undefined : () => handleDeclineOpp(o.id)} />
                    </Reanimated.View>
                  ))}
                </Reanimated.View>
              ) : null}

              {/* -- Le jour choisi -- */}
              {/* Changer de jour : le fil s'efface et le nouveau entre, ligne après ligne. */}
              <Reanimated.View key={selectedKey} entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} layout={LAYOUT}>
                <SectionHead title={dayTitle} aside={day.count ? t('agenda.n_missions', { count: day.count }) : t('agenda.nothing_planned')} />
                {day.count ? (
                  <>
                    <Timeline rows={day.rows} onPressMission={openMission} />
                    <DayFoot label={dayTitle.split(' ')[0].replace(/^./, (c) => c.toUpperCase())} net={day.net} />
                  </>
                ) : (
                  <EmptyDay title={t('agenda.free_day')} sub={t('agenda.free_day_sub')} />
                )}
              </Reanimated.View>

              {/* -- Passées -- */}
              {past.length ? (
                <Reanimated.View layout={LAYOUT}>
                  <SectionHead title={t('agenda.past')} />
                  <View style={{ marginTop: 8 }}>
                    {past.map((g) => <PastMonth key={g.key} group={g} label={monthLabel(g.key)} open={isOpen(g.key)} onToggle={() => toggle(g.key)} onPress={openPast} dayLabel={shortDay} />)}
                  </View>
                </Reanimated.View>
              ) : null}
            </Reanimated.ScrollView>
          </>
        )}
        detail={isSplit && detailOpen ? detail : null}
        placeholder={(
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.4, color: theme.textMuted, textTransform: 'uppercase' }}>{t('missions.select_hint', { defaultValue: 'Sélectionnez une mission' })}</Text>
          </View>
        )}
      />
      {detailOpen && !isSplit ? (
        <BottomSheet ref={bottomSheetRef} index={0} enableDynamicSizing enablePanDownToClose onClose={() => setDetailOpen(false)} {...sheetMotion} backdropComponent={renderBackdrop} backgroundStyle={{ backgroundColor: theme.cardBg }} handleIndicatorStyle={{ backgroundColor: theme.border }} maxDynamicContentSize={windowHeight * 0.85}>
          <BarLock />
          {detail}
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  month: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  title: { fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 0.5, includeFontPadding: false },
  todayBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  todayText: { fontFamily: FONTS.sansMedium, fontSize: 12 },
  error: { marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 12 },
  errorText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
