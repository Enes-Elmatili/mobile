/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useIncomingActions.ts — répondre à la fiche
// « elle est pour vous » : accepter (REST, la fiche se lit puis se replie et
// l'accueil passe en mission) ou passer (refus serveur, jamais revue).
import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import type { ServiceRequest } from '@/lib/types';
import { startsLater, missionFromAccept, type CurrentMission, type IncomingRequest } from '@/lib/cockpit/incoming';

type Args = {
  userId: string | undefined;
  router: ReturnType<typeof useRouter>;
  t: TFunction;
  reduced: boolean;
  declinedIdsRef: RefObject<Set<string>>;
  loadData: () => Promise<void>;
  setIncomingRequests: Dispatch<SetStateAction<IncomingRequest[]>>;
  setMissionSeed: Dispatch<SetStateAction<ServiceRequest | null>>;
  setCurrentMission: Dispatch<SetStateAction<CurrentMission | null>>;
  setLeavingId: Dispatch<SetStateAction<string | null>>;
};

// Réponse de POST /requests/:id/accept, et l'erreur que lib/api lève.
type AcceptResponse = { code?: string; message?: string; data?: Partial<ServiceRequest> } | null | undefined;
type AcceptError = { message?: string; response?: { data?: { code?: string } }; data?: { code?: string; message?: string } } | null | undefined;

export function useIncomingActions({ userId, router, t, reduced, declinedIdsRef, loadData, setIncomingRequests, setMissionSeed, setCurrentMission, setLeavingId }: Args) {
  // Accept — REST call (reliable) + socket notification (real-time bonus)
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!userId) return;

    // La fiche est déjà verte (IncomingJobCard) ; on la laisse se lire ~0,9 s
    // avant de continuer, même si le serveur répond plus vite. Puis elle se
    // replie (leaving) et l'accueil est déjà en mission : pas d'autre page.
    const t0 = Date.now();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const dwell = () => wait(Math.max(0, 1500 - (Date.now() - t0)));
    try {
      const res = await api.post<AcceptResponse>(`/requests/${request.requestId}/accept`);
      if (res?.code === 'REQUEST_ACCEPTED' || res?.data) {
        await dwell();

        // Mission planifiée pour plus tard ? Pas de redirection vers /ongoing — la mission
        // n'est pas encore active (pas sur place, pas de PIN à vérifier). Elle ira dans
        // l'onglet « À venir » de Missions, le provider la lancera depuis là le jour J.
        const isFutureScheduled = startsLater(res?.data?.preferredTimeStart, Date.now());

        if (isFutureScheduled) {
          setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
          feedback.info('provider.mission_accepted_scheduled_msg');
          loadData();
        } else {
          // L'accueil passe en mission tout de suite (stade busy : caméra sur la
          // porte, tracé, étiquette ambre, flèche) pendant que la fiche se replie.
          const d = res?.data ?? {};
          // L'amorce : la demande reçue, recouverte par la réponse du serveur.
          setMissionSeed({ ...(request.raw ?? {}), ...d, id: Number(request.requestId), status: d.status ?? 'ACCEPTED' } as ServiceRequest);
          setCurrentMission(missionFromAccept(request, d));
          setLeavingId(request.requestId);
          await wait(reduced ? 220 : 460);
          setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
          setLeavingId(null);
          loadData();
        }
      } else {
        throw new Error(res?.message || t('common.error'));
      }
    } catch (e) {
      const err = e as AcceptError;
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
  }, [userId, router, loadData, reduced]);

  // Explicit decline ("Passer") — refuse backend + never show again
  const handleDecline = useCallback(async (requestId: string) => {
    declinedIdsRef.current.add(requestId);
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  return { handleAccept, handleDecline };
}
