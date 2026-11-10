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
import { bookColumnsFor, foldLineFor, useHinge, useLayoutClass, useSceneFrame } from '@/lib/layout';
import { useReduceMotion } from '@/lib/motion/sheet';
import MapView from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useTabBarPadding } from '@/app/(tabs)/_layout';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { useNetwork } from '@/lib/NetworkContext';
import type { ServiceRequest } from '@/lib/types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme } from '@/hooks/use-app-theme';
import { gateCopyFor, GATE_CODES } from '@/lib/providerGate';
import { cockpitStageOf } from '@/lib/cockpit/stage';
import { remindersOf, nextMissionOf, type Reminder, type NextMission } from '@/lib/cockpit/day';
import { cockpitGeometry } from '@/lib/cockpit/geometry';
import { meToneOf } from '@/lib/cockpit/framing';
import type { CurrentMission, IncomingRequest } from '@/lib/cockpit/incoming';
import { TopRow } from '@/components/cockpit/TopRow';
import { DayStrip } from '@/components/cockpit/DayStrip';
import { StateLabel } from '@/components/cockpit/StateLabel';
import { MissionFlow, type MissionFacts } from '@/components/provider/MissionFlow';
import { GpsCard } from '@/components/cockpit/GpsCard';
import { Veil } from '@/components/cockpit/Veil';
import { IncomingJobCard } from '@/components/provider/cockpit/IncomingJobCard';
import { CockpitMap } from '@/components/provider/cockpit/CockpitMap';
import { useCockpitGeo } from '@/components/provider/cockpit/useCockpitGeo';
import { useCockpitData } from '@/components/provider/cockpit/useCockpitData';
import { useIncomingQueue } from '@/components/provider/cockpit/useIncomingQueue';
import { useOnlineState, useOnlineSwitch } from '@/components/provider/cockpit/useOnlineSwitch';
import { useCockpitSocket } from '@/components/provider/cockpit/useCockpitSocket';
import { useRequestDeepLink } from '@/components/provider/cockpit/useRequestDeepLink';
import { useIncomingActions } from '@/components/provider/cockpit/useIncomingActions';
import { useCockpitCamera } from '@/components/provider/cockpit/useCockpitCamera';
import { useCockpitNavBar } from '@/components/provider/cockpit/useCockpitNavBar';

// Les morceaux de l'accueil vivent dans components/provider/cockpit/ (fiche,
// carte, et un hook par grappe d'état) ; la logique pure dans lib/cockpit/.
// Les hooks sont appelés à la place exacte du code d'origine : l'ordre des
// effets (montage, retour sur l'écran, abonnements) ne change pas.

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

  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  // La demande acceptée dont la mission s'ouvre : la fiche fait monter son vert sur l'écran.
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // Mission active actuelle (acceptée et en cours, non planifiée future) →
  // permet au provider qui revient sur le dashboard de re-rentrer dans la mission.
  const [currentMission, setCurrentMission] = useState<CurrentMission | null>(null);
  // Lien profond hérité (/request/:id/ongoing → accueil ?mission=) : cette
  // mission passe devant la dérivation, même planifiée un peu plus tôt.
  const { mission: wantedMissionParam, request: wantedRequestParam } = useLocalSearchParams<{ mission?: string; request?: string }>();
  const wantedMissionRef = useRef<string | null>(null);
  // Recopié après chaque commit (comme avant à chaque rendu), et déclaré avant
  // tout effet qui appelle loadData : celui-ci le lit déjà à jour.
  useEffect(() => {
    if (wantedMissionParam && wantedMissionRef.current !== String(wantedMissionParam)) wantedMissionRef.current = String(wantedMissionParam);
  });
  // Ce que la feuille de mission dit à l'accueil (stade, caméra, porte, hauteur).
  const [missionFacts, setMissionFacts] = useState<MissionFacts | null>(null);
  // L'amorce de la feuille de mission à l'acceptation : la demande reçue + la réponse du serveur.
  const [missionSeed, setMissionSeed] = useState<ServiceRequest | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const currentMissionRef = useRef<CurrentMission | null>(null);
  useEffect(() => { currentMissionRef.current = currentMission; }, [currentMission]);
  const etaRef = useRef<number | null>(null);
  useEffect(() => { etaRef.current = etaMin; }, [etaMin]);
  const online = useOnlineState();
  const { isOnline, isOnlineRef, userChoseRef, pendingRef, declinedIdsRef, onlineSince } = online;

  const { location, heading, gpsDenied } = useCockpitGeo({ socket, userId: user?.id, networkOnline, currentMissionRef, etaRef, isOnlineRef });

  // Fallback : si onMapReady ne fire pas dans les 3 secondes (Google Maps SDK
  // qui silencie parfois l'event sur iOS / simulateur), on force mapReady=true
  // pour débloquer la caméra. animateToRegion no-op si réellement pas prêt.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => setMapReady(true), 3000);
    return () => clearTimeout(t);
  }, [mapReady]);

  const { today, statsLoading, missions, connect, loading, loadData } = useCockpitData({ wantedMissionRef, wantedMissionParam, setCurrentMission });

  const fetchIncomingQueue = useIncomingQueue({ userId: user?.id, isOnline, router, declinedIdsRef, setIncomingRequests });

  const { applyOnline, sendStatus, handleToggleOnline } = useOnlineSwitch({ socket, userId: user?.id, online, setIncomingRequests, fetchIncomingQueue });

  useCockpitSocket({ socket, userId: user?.id, t, router, isOnlineRef, userChoseRef, pendingRef, declinedIdsRef, setIncomingRequests, fetchIncomingQueue, applyOnline, sendStatus });

  useRequestDeepLink({ loading, wantedRequestParam, router, currentMissionRef, isOnlineRef, pendingRef, userChoseRef, fetchIncomingQueue, sendStatus });

  const { handleAccept, handleDecline } = useIncomingActions({ userId: user?.id, router, t, reduced, declinedIdsRef, loadData, setIncomingRequests, setMissionSeed, setCurrentMission, setLeavingId });

  // ─── Le stade ────────────────────────────────────────────────────────────
  const activeJob = incomingRequests[0] || null;
  const stage = cockpitStageOf({ online: isOnline, gpsDenied, noNetwork: !networkOnline, hasIncoming: !!activeJob, hasMission: !!currentMission });
  const reminders = useMemo<Reminder[]>(() => remindersOf(missions, connect), [missions, connect]);
  const next = useMemo<NextMission | null>(() => nextMissionOf(missions), [missions]);

  // ─── Géométrie : décidée par l'écran (SE, Pro Max, Android 3 boutons, Fold) ──
  // La largeur est celle de la SCÈNE (elle s'arrête au rail du Duo), pas de la
  // fenêtre : les insets latéraux y valent déjà 0 côté rail.
  const scene = useSceneFrame();
  const hinge = useHinge();
  // Déplié : deux pages autour du pli. La gauche porte l'interface flottante,
  // la droite la fiche « elle est pour vous » puis la mission.
  const cols = layout.isRegular ? bookColumnsFor(foldLineFor(hinge, scene), scene.width) : null;
  const leftEnd = cols ? cols.left : null;
  const rightStart = cols ? cols.left + cols.gutter : null;
  const leftPage = useMemo(() => (leftEnd != null ? { left: 0, width: leftEnd } : null), [leftEnd]);
  const rightPage = useMemo(() => (rightStart != null ? { left: rightStart, width: Math.max(0, scene.width - rightStart) } : null), [rightStart, scene.width]);
  const g = useMemo(() => cockpitGeometry({ width: scene.width, height: layout.height, insets: layout.insets, cls: layout.cls, tabBarHeight, page: leftPage }), [scene.width, layout, tabBarHeight, leftPage]);
  const { stripBottom, topRowTop, marginLeft, contentWidth } = g;
  const band = useMemo(() => (leftPage ? { left: marginLeft, width: contentWidth } : null), [leftPage, marginLeft, contentWidth]);
  // Une fiche ou une mission tient la page droite : la carte s'arrête au pli.
  const sidePanel = !!rightPage && ((stage === 'incoming' && !!activeJob) || (stage === 'busy' && !!currentMission));

  const stripCover = g.mapPaddingBottom;
  const { doorCoord, routeCoords } = useCockpitCamera({ mapRef, mapReady, stage, activeJob, currentMission, location, missionFacts, stripCover, mapPaddingTop: g.mapPaddingTop, windowHeight, reduced, setEtaMin, sidePanel });

  // ─── Navigation ──────────────────────────────────────────────────────────
  // Ouvrir une mission depuis la journée : elle vit ici, sur l'accueil — on la
  // met devant (wantedMission) et on recharge ; pas d'autre page.
  const showMission = useCallback((id: number | string) => { wantedMissionRef.current = String(id); loadData(); }, [loadData]);
  const onReminder = useCallback((r: Reminder) => {
    if (r.kind === 'payouts') router.push(gateCopyFor(GATE_CODES.STRIPE_NOT_READY).route);
    else if (r.requestId != null) showMission(r.requestId);
  }, [router, showMission]);
  const onNext = useCallback((m: NextMission) => showMission(m.id), [showMission]);
  const goProfile = useCallback(() => router.push('/(tabs)/profile'), [router]);
  const goWallet = useCallback(() => router.push('/(tabs)/wallet'), [router]);
  const goMessages = useCallback(() => router.push('/messages'), [router]);
  const goNotifs = useCallback(() => router.push('/notifications'), [router]);
  // Ma photo sur ma carte : on se reconnaît. Stable tant que le profil ne change pas.
  const meName = user?.name ?? null, meAvatar = user?.avatarUrl ?? null;
  const me = useMemo(() => ({ name: meName, avatarUrl: meAvatar }), [meName, meAvatar]);

  useCockpitNavBar({ loading, stage, reminders, onToggleOnline: handleToggleOnline, t });
  // La feuille de mission rend la main : la mission est finie (ou retirée).
  const onMissionExit = useCallback((_reason: 'done' | 'gone') => {
    wantedMissionRef.current = null;
    setMissionFacts(null);
    setMissionSeed(null);
    setCurrentMission(null);
    loadData();
  }, [loadData, setMissionFacts, setMissionSeed, setCurrentMission]); // setters stables : pour le React Compiler

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

  const meTone = meToneOf(stage);
  const missionFlow = stage === 'busy' && currentMission ? (
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
      inPane={!!rightPage}
    />
  ) : null;
  const routeColor = theme.isDark ? 'rgba(248,247,244,0.55)' : 'rgba(26,26,26,0.45)';

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* -- Carte plein écran : l'écran, c'est elle ; l'interface flotte dessus -- */}
      <CockpitMap
        mapRef={mapRef}
        isDark={theme.isDark}
        onReady={() => setMapReady(true)}
        legalBottom={stripCover}
        legalLeft={layout.insets.left}
        right={sidePanel && rightPage ? rightPage.width : 0}
        stage={stage}
        location={location}
        heading={heading}
        routeCoords={routeCoords}
        routeColor={routeColor}
        incomingRequests={incomingRequests}
        doorCoord={doorCoord}
        meTone={meTone}
        arrow={stage === 'busy' && (missionFacts?.stage ?? 'en_route') === 'en_route'}
        me={me}
      />

      {/* -- Le voile : la carte s'éteint hors ligne (l'étiquette d'état, en haut, dit pourquoi) -- */}
      <Veil dimmed={stage === 'off' || stage === 'gps' || stage === 'net'} label={null} labelTop={g.veilLabelTop} band={band} />

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
      <StateLabel stage={stage} count={incomingRequests.length} onlineSince={onlineSince} missionId={currentMission?.id ?? null} missionStage={stage === 'busy' ? missionFacts?.stage ?? null : null} missionSince={missionFacts?.startedAt ? new Date(missionFacts.startedAt).getTime() : null} top={g.stateTop} band={band} />

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
      {/* Déplié : elle devient la page droite, fixe — la carte garde la page gauche. */}
      {/* Même arbre plié comme déplié : plier le Duo ne démonte pas la mission (photos, code en cours). */}
      {missionFlow ? (
        <View style={rightPage ? [s.pane, { left: rightPage.left }] : StyleSheet.absoluteFill} pointerEvents="box-none">{missionFlow}</View>
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
          page={rightPage}
          maxHeight={layout.height - Math.max(16, layout.insets.top)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  pane:          { position: 'absolute', top: 0, right: 0, bottom: 0 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
