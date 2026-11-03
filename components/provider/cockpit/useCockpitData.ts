/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useCockpitData.ts — ce que l'accueil charge par
// REST : le gain du jour (TopRow → Wallet), les missions (la journée, la
// ré-entrée dans la mission active) et l'état des virements (rappels).
// Rechargé au montage, à chaque retour sur l'écran et sur lien profond.
import { useState, useEffect, useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { devWarn } from '@/lib/logger';
import type { MissionLite } from '@/lib/cockpit/day';
import { pickActiveMission, reconcileMission, type CurrentMission } from '@/lib/cockpit/incoming';

type Args = {
  wantedMissionRef: RefObject<string | null>;
  wantedMissionParam: string | undefined;
  setCurrentMission: Dispatch<SetStateAction<CurrentMission | null>>;
};

export function useCockpitData({ wantedMissionRef, wantedMissionParam, setCurrentMission }: Args) {
  const [today,         setToday]          = useState(0);
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [missions,      setMissions]       = useState<MissionLite[]>([]);
  const [connect,       setConnect]        = useState<{ needsOnboarding?: boolean; payoutsEnabled?: boolean } | null>(null);
  const [loading,       setLoading]        = useState(true);

  // Data
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
      api.dashboard.provider(),
      api.providers.missions(),
      api.connect.balance(),
    ]);

    const dashData = results[2].status === 'fulfilled' ? results[2].value : null;
    setToday(dashData?.stats?.todayEarnings?.total || 0);

    if (results[0].status === 'rejected') devWarn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    if (results[2].status === 'rejected') devWarn('Stats failed:', (results[2] as PromiseRejectedResult).reason?.message);

    if (results[4].status === 'fulfilled') {
      const c = results[4].value;
      setConnect({ needsOnboarding: c?.needsOnboarding, payoutsEnabled: c?.payoutsEnabled });
    }

    // Mission active : ACCEPTED/ONGOING/QUOTE_SENT/QUOTE_ACCEPTED, non planifiée future.
    // On ouvre le re-entry dans la mission pour le provider qui revient sur le dashboard.
    if (results[3].status === 'fulfilled') {
      const m = results[3].value?.items || [];
      setMissions(m);
      const found = pickActiveMission(m, wantedMissionRef.current, Date.now());
      setCurrentMission((prev) => reconcileMission(prev, found, m));
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

  return { today, statsLoading, missions, connect, loading, loadData };
}
