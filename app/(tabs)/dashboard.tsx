/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/dashboard.tsx
// L'accueil : l'écran (données, socket, navigation, sheet de détail). Les
// blocs visuels vivent dans components/dashboard/, le tri des demandes et les
// libellés dans lib/dashboard/ (purs, testés).
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { runWhenIdle } from '@/lib/idle';
import { usePressScale } from '@/lib/motion/press';
import { useSheetMotion } from '@/lib/motion/sheet';
import { CascadeItem } from '@/lib/motion/useCascade';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import { useAuth } from '../../lib/auth/AuthContext';
import { useSocket } from '../../lib/SocketContext';
import { useCallParty } from '../../lib/webrtc/CallContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProviderDashboard from '@/components/provider/ProviderDashboard';
import { useTabBarPadding } from './_layout';
import { useNavStore, clientDisc, BarLock } from '@/stores/nav';
import { localeFor } from '@/lib/format';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useInvoice } from '@/hooks/useInvoice';
import { devError } from '@/lib/logger';
import { cleanName } from '@/lib/displayName';
import { useLayoutClass } from '@/lib/layout';
import {
  PREVIEW_COUNT, activeMissionOf, searchingMissionOf, quoteMissionOf,
  activityRequestsOf, upcomingRequestsOf, visibleActivity, withRequestStatus,
} from '@/lib/dashboard/missions';
import { missionViewParams, quoteHref } from '@/lib/dashboard/navigation';
import type { DashboardData, Envelope, MissionLink, RequestDetails, RequestSocketPayload } from '@/lib/dashboard/types';
import { MissionIsland } from '@/components/dashboard/MissionIsland';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardTopBar, LoadErrorBanner } from '@/components/dashboard/DashboardTopBar';
import { IdleHero } from '@/components/dashboard/IdleHero';
import { UpcomingSection } from '@/components/dashboard/UpcomingSection';
import { ServicesGrid } from '@/components/dashboard/ServicesGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { RequestDetailContent } from '@/components/dashboard/RequestDetailContent';

// ─── Press feel : haptique légère + échelle à l'appui (PressScale) ──────────
const hapticLight  = () => feedback.haptic('light');

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// L'onglet Accueil : l'accueil prestataire pour un prestataire (une seule
// instance dans toute l'app), l'accueil client sinon — sans monter les hooks
// de l'un pour l'autre.
export default function Dashboard() {
  const { user } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');
  return isProvider ? <ProviderDashboard /> : <ClientDashboard />;
}

function ClientDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, unreadCount, unreadMessages } = useSocket();
  const callParty = useCallParty();
  const theme = useAppTheme();
  const { width: windowWidth, height: windowHeight } = useLayoutClass();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const tabBarPadding = useTabBarPadding();
  const brandRefresh = useBrandRefresh();

  // CTA — retour à l'appui (règle 4), amortissement critique, aucun rebond.
  const ctaPress = usePressScale();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const sheetMotion = useSheetMotion();
  // Sheet détail montée UNIQUEMENT quand ouverte : toujours montée avec
  // index={-1} + enableDynamicSizing, gorhom l'auto-ouvre sur Android et son
  // backdrop plein écran bloque tous les touchs. Le state contrôle le montage
  // et sert aussi au bouton back Android.
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const closeDetailSheet = useCallback(() => { bottomSheetRef.current?.close(); }, []);
  useAndroidBackClose(detailSheetOpen, closeDetailSheet);

  const invoiceRequestId = selectedRequest?.status?.toUpperCase() === 'DONE' ? selectedRequest?.id : null;
  const { invoice } = useInvoice(invoiceRequestId ? Number(invoiceRequestId) : null);

  // ── Data ──
  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get<Envelope<DashboardData>>('/client/dashboard');
      setData(response.data || response);
      setLoadError(false);
    } catch (error) {
      devError('Dashboard load error:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lastFetchRef = useRef(0);
  // Persist accepted-request deduplication across socket re-registrations so
  // we don't double-navigate on reconnect. Module-local would bleed across
  // users, so it's scoped per Dashboard mount via useRef.
  const acceptedIdsRef = useRef<Set<string>>(new Set());
  // Vrai tant que l'accueil est l'écran affiché (voir handleAccepted).
  const isFocusedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    return () => { isFocusedRef.current = false; };
  }, []));

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) { // 60s cache — socket handles real-time updates
      lastFetchRef.current = now;
      const task = runWhenIdle(() => loadDashboard());
      return () => task.cancel();
    }
  }, [loadDashboard]));
  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── Navigation ──
  const navigateToMissionView = useCallback((request: MissionLink) => {
    router.replace({
      pathname: '/request/[id]/missionview',
      params: missionViewParams(request, localeFor(i18n.language), () => t('common.now')),
    });
  }, [router]);

  const navigateToSearching = useCallback((request: MissionLink) => {
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  // ── Socket ──
  useEffect(() => {
    if (!socket || !user?.id) return;
    // Note: user room join is handled server-side on socket connection (server.js)
    // No need to emit join:user from client — avoids leave/join spam on re-render

    const updateRequestStatus = (requestId: string | number | undefined, newStatus: string) => {
      setData(prev => withRequestStatus(prev, requestId, newStatus));
    };

    const handleAccepted = (d: RequestSocketPayload) => {
      const reqId = String(d.id || d.requestId);
      if (acceptedIdsRef.current.has(reqId)) return;
      if (d.clientId && d.clientId !== user?.id) return;
      acceptedIdsRef.current.add(reqId);
      updateRequestStatus(reqId, 'ACCEPTED');
      // Le suivi (missionview) joue lui-même la bascule « accepté » sur sa
      // carte : on ne navigue que si l'accueil est l'écran affiché, sinon on
      // remonterait l'écran de suivi sous les pieds du client.
      if (!isFocusedRef.current) return;
      if (reqId) {
        api.get<Envelope<RequestDetails>>(`/requests/${reqId}`)
          .then(res => {
            const req = res?.data || res;
            // Scheduled future mission → recap screen, not missionview
            const pts = req.preferredTimeStart;
            if (pts && new Date(pts).getTime() > Date.now()) {
              router.replace({
                pathname: '/request/[id]/scheduled',
                params: { id: reqId, mode: 'recap' },
              });
            } else {
              navigateToMissionView(req);
            }
          })
          .catch(() => {
            router.replace({
              pathname: '/request/[id]/missionview',
              params: { id: reqId },
            });
          });
      }
    };
    const handleStarted       = (d: RequestSocketPayload) => { updateRequestStatus(d.id || d.requestId, 'ONGOING'); };
    const handleCompleted     = (d: RequestSocketPayload) => { updateRequestStatus(d.id || d.requestId, 'DONE');      loadDashboard(); };
    const handleCancelled     = (d: RequestSocketPayload) => { updateRequestStatus(d.id || d.requestId, 'CANCELLED'); loadDashboard(); };
    const handleExpired       = (d: RequestSocketPayload) => { updateRequestStatus(d.id || d.requestId, 'EXPIRED');   loadDashboard(); };
    const handlePublished     = (d: RequestSocketPayload) => { updateRequestStatus(d.requestId, 'PUBLISHED'); };
    const handleStatusUpdated = (d: RequestSocketPayload) => { updateRequestStatus(d.requestId, d.status);   loadDashboard(); };

    socket.on('request:accepted',      handleAccepted);
    socket.on('request:started',       handleStarted);
    socket.on('request:completed',     handleCompleted);
    socket.on('request:cancelled',     handleCancelled);
    socket.on('request:expired',       handleExpired);
    socket.on('request:published',     handlePublished);
    socket.on('request:statusUpdated', handleStatusUpdated);
    socket.on('provider:accepted',     handleAccepted);

    return () => {
      socket.off('request:accepted',      handleAccepted);
      socket.off('request:started',       handleStarted);
      socket.off('request:completed',     handleCompleted);
      socket.off('request:cancelled',     handleCancelled);
      socket.off('request:expired',       handleExpired);
      socket.off('request:published',     handlePublished);
      socket.off('request:statusUpdated', handleStatusUpdated);
      socket.off('provider:accepted',     handleAccepted);
    };
  }, [socket, user?.id, router, loadDashboard, navigateToMissionView]);

  // ── Actions ──
  const handleRequestPress = async (requestId: string) => {
    const localReq = data?.requests?.find(r => String(r.id) === String(requestId));
    if (localReq?.status?.toUpperCase() === 'PUBLISHED') {
      navigateToSearching(localReq);
      return;
    }
    if (localReq && ['ACCEPTED', 'ONGOING'].includes(localReq.status?.toUpperCase())) {
      navigateToMissionView(localReq);
      return;
    }
    setLoadingDetails(true);
    setDetailSheetOpen(true);
    try {
      const details = await api.get<Envelope<RequestDetails>>(`/requests/${requestId}`);
      const req = details.request || details.data || details;
      const st = req?.status?.toUpperCase();
      if (st === 'PUBLISHED') {
        bottomSheetRef.current?.close();
        navigateToSearching(req);
        return;
      }
      if (st === 'ACCEPTED' || st === 'ONGOING') {
        bottomSheetRef.current?.close();
        navigateToMissionView(req);
        return;
      }
      setSelectedRequest(req);
    } catch (error) {
      devError('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNavigateToMission = useCallback((request: MissionLink) => {
    bottomSheetRef.current?.close();
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />
    ), []
  );

  // L'îlot noir : une seule demande à la fois — active, sinon recherche, sinon
  // devis (les demandes planifiées futures vont dans « À venir »).
  const activeMission = useMemo(() => activeMissionOf(data?.requests), [data]);
  const searchingMission = useMemo(
    () => searchingMissionOf(data?.requests, activeMission),
    [data, activeMission]
  );
  const quoteMission = useMemo(
    () => quoteMissionOf(data?.requests, activeMission, searchingMission),
    [data, activeMission, searchingMission]
  );

  const activityRequests = useMemo(() => activityRequestsOf(data?.requests), [data]);
  const upcomingRequests = useMemo(() => upcomingRequestsOf(data?.requests), [data]);

  const displayedRequests = useMemo(
    () => visibleActivity(activityRequests, showAllRequests),
    [activityRequests, showAllRequests]
  );

  const totalCount = activityRequests.length;
  const hasMore = totalCount > PREVIEW_COUNT;

  // ── Le disque de la barre flottante : « + » au repos, la flèche quand une demande vit ──
  // Réglé ici, rendu par la barre, il suit sur Documents et Profil.
  const setDisc = useNavStore((st) => st.setDisc);
  const liveMission = activeMission || searchingMission;
  const liveMissionId = liveMission?.id ?? null;
  useEffect(() => {
    const kind = clientDisc(!!liveMission);
    setDisc({
      kind,
      label: kind === 'track' ? t('dashboard.track_mission') : t('dashboard.new_request'),
      onPress: kind === 'track' ? () => { if (liveMission) navigateToMissionView(liveMission); } : () => router.push('/request/NewRequestStepper'),
    });
  }, [liveMissionId, liveMission?.status, liveMission, t, setDisc, navigateToMissionView, router]);
  useEffect(() => () => setDisc({ kind: 'hidden' }), [setDisc]);

  // Skeleton shell during cold load — prevents layout reflow when data lands
  if (loading && !refreshing && !data) {
    return <DashboardSkeleton theme={theme} />;
  }

  const name = cleanName(data?.me?.name, { email: user?.email, fallback: '' });
  const hasIslandMission = !!(activeMission || searchingMission || quoteMission);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Moment 17 : le « fixed. » s'étire avec le tirage ; le RefreshControl natif garde le déclenchement. */}
      <BrandRefreshHeader style={brandRefresh.headerStyle} />
      <Reanimated.ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
        showsVerticalScrollIndicator={false}
        onScroll={brandRefresh.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Bannière d'erreur réseau + retry ── */}
        {loadError && <LoadErrorBanner onRetry={loadDashboard} theme={theme} />}
        {/* ══════════════════════════════════════════════════════════════
            ADAPTIVE TOP: État A (idle) vs État B (mission active)
            Quand une mission est active, elle ÉCRASE le hero.
            ══════════════════════════════════════════════════════════════ */}

        {/* ── TOP BAR — always visible, compact ── */}
        <DashboardTopBar
          city={data?.me?.city}
          name={name}
          compact={hasIslandMission}
          unreadCount={unreadCount}
          unreadMessages={unreadMessages}
          theme={theme}
        />

        {/* ── ÎLOT NOIR — un seul bloc, deux états ── */}
        <CascadeItem index={0} stepMs={50}>
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <View style={{
            backgroundColor: theme.heroBg, borderRadius: 24, overflow: 'hidden',
            borderWidth: theme.isDark ? 1 : 0, borderColor: theme.borderLight,
          }}>
            {hasIslandMission ? (
              /* ── État actif : mission en cours ── */
              <MissionIsland
                activeMission={activeMission}
                searchingMission={searchingMission}
                quoteMission={quoteMission}
                onActiveMissionPress={() => {
                  if (!activeMission) return;
                  hapticLight();
                  navigateToMissionView(activeMission);
                }}
                onSearchingPress={() => {
                  if (!searchingMission) return;
                  hapticLight();
                  navigateToSearching(searchingMission);
                }}
                onQuotePress={() => {
                  if (!quoteMission) return;
                  hapticLight();
                  router.push(quoteHref(quoteMission));
                }}
                onCallProvider={() => {
                  const provider = activeMission?.provider;
                  if (!provider) return;
                  // provider.id est l'id Provider, pas un userId : on n'appelle que le userId.
                  callParty({ userId: provider.userId, name: provider.name, requestId: activeMission.id });
                }}
                onMessageProvider={() => {
                  const provider = activeMission?.provider;
                  if (!provider) return;
                  const providerUserId = provider.userId || provider.id;
                  if (!providerUserId) return;
                  router.push({
                    pathname: '/messages/[userId]',
                    params: {
                      userId: String(providerUserId),
                      name: provider.name || '',
                      requestId: String(activeMission.id),
                    },
                  });
                }}
                theme={theme}
              />
            ) : (
              /* ── État idle : "Besoin d'un pro ?" ── */
              <IdleHero ctaPress={ctaPress} theme={theme} />
            )}
          </View>
        </View>

        </CascadeItem>
        {/* ── À VENIR (demandes planifiées futures) ── */}
        <CascadeItem index={1} stepMs={50}>
          <UpcomingSection requests={upcomingRequests} theme={theme} />
        </CascadeItem>
        {/* ── POPULAR SERVICES (2x2 grid) ── */}
        <CascadeItem index={2} stepMs={50}>
          <ServicesGrid windowWidth={windowWidth} theme={theme} />
        </CascadeItem>
        {/* ── ACTIVITÉ RÉCENTE ── */}
        <RecentActivity
          isEmpty={!data?.requests?.length}
          displayed={displayedRequests}
          totalCount={totalCount}
          hasMore={hasMore}
          showAll={showAllRequests}
          onToggleShowAll={() => setShowAllRequests(v => !v)}
          onRefresh={onRefresh}
          onRequestPress={handleRequestPress}
          theme={theme}
        />

      </Reanimated.ScrollView>

      {/* ── Bottom Sheet detail ── */}
      {detailSheetOpen && (
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        enableDynamicSizing
        enablePanDownToClose
        onClose={() => setDetailSheetOpen(false)}
        animationConfigs={sheetMotion.animationConfigs}
        overDragResistanceFactor={sheetMotion.overDragResistanceFactor}
        onAnimate={sheetMotion.onAnimate}
        backdropComponent={renderBackdrop}
        backgroundStyle={[s.sheetBg, { backgroundColor: theme.cardBg }]}
        handleIndicatorStyle={[s.sheetIndicator, { backgroundColor: theme.borderLight }]}
        maxDynamicContentSize={windowHeight * 0.85}
      >
        <BarLock />
        <BottomSheetScrollView contentContainerStyle={[s.sheet, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
          <RequestDetailContent
            loading={loadingDetails}
            request={selectedRequest}
            hasInvoice={!!invoice}
            close={() => bottomSheetRef.current?.close()}
            onTrackMission={handleNavigateToMission}
            onTrackSearch={navigateToSearching}
            onShowInvoice={() => setTimeout(() => setInvoiceVisible(true), 300)}
            theme={theme}
          />
        </BottomSheetScrollView>
      </BottomSheet>
      )}

      <InvoiceSheet
        invoice={invoice}
        isVisible={invoiceVisible}
        onClose={() => setInvoiceVisible(false)}
        userRole="client"
        providerName={selectedRequest?.provider?.name}
        serviceTitle={selectedRequest?.serviceType || selectedRequest?.title}
        missionDate={selectedRequest?.completedAt || selectedRequest?.createdAt}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32 },

  // ── Bottom sheet ──
  sheetBg: { borderRadius: 28 },
  sheetIndicator: { width: 36 },
  sheet: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
});
