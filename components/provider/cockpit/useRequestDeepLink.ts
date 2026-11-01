/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useRequestDeepLink.ts — une notification
// « nouvelle demande » tapée (?request=) : la demande désignée. En ligne, elle
// rejoint la file ; hors ligne, on propose de passer en ligne (hors ligne rien
// n'arrive, c'est la règle de l'accueil) ; prise ou annulée entre-temps, on le
// dit au lieu d'un accueil vide.
import { useEffect, useRef, type RefObject } from 'react';
import type { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { isStillOpen, type CurrentMission } from '@/lib/cockpit/incoming';

type Args = {
  loading: boolean;
  wantedRequestParam: string | undefined;
  router: ReturnType<typeof useRouter>;
  currentMissionRef: RefObject<CurrentMission | null>;
  isOnlineRef: RefObject<boolean>;
  pendingRef: RefObject<boolean>;
  userChoseRef: RefObject<boolean>;
  fetchIncomingQueue: () => void;
  sendStatus: (online: boolean) => void;
};

export function useRequestDeepLink({ loading, wantedRequestParam, router, currentMissionRef, isOnlineRef, pendingRef, userChoseRef, fetchIncomingQueue, sendStatus }: Args) {
  const handledRequestRef = useRef<string | null>(null);
  useEffect(() => {
    const rid = wantedRequestParam ? String(wantedRequestParam) : null;
    if (loading || !rid || handledRequestRef.current === rid) return;
    handledRequestRef.current = rid;
    router.setParams({ request: undefined });
    if (currentMissionRef.current) return; // en mission : rien d'autre n'arrive
    (async () => {
      let available = false;
      try {
        const res = await api.requests.get(rid);
        const r = res?.data ?? res;
        available = isStillOpen(r);
      } catch { available = false; }
      if (!available) { feedback.info('cockpit.request_gone'); return; }
      if (isOnlineRef.current) { fetchIncomingQueue(); return; }
      const go = await feedback.confirm({ titleKey: 'cockpit.request_waiting_title', messageKey: 'cockpit.request_waiting_msg', confirmKey: 'cockpit.go_a11y', cancelKey: 'cockpit.request_later' });
      if (go && !pendingRef.current) { userChoseRef.current = true; sendStatus(true); }
    })();
  }, [loading, wantedRequestParam, router, fetchIncomingQueue, sendStatus]);
}
