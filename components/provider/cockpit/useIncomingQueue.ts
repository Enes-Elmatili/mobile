/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useIncomingQueue.ts — la file des demandes
// entrantes par REST (/requests/incoming) : au montage, sur demande, et en
// filet de sécurité toutes les 20 s tant que le prestataire est en ligne.
import { useEffect, useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { devWarn } from '@/lib/logger';
import { incomingFromQueue, mergeQueue, type IncomingPayload, type IncomingRequest } from '@/lib/cockpit/incoming';

type Args = {
  userId: string | undefined;
  isOnline: boolean;
  router: ReturnType<typeof useRouter>;
  declinedIdsRef: RefObject<Set<string>>;
  setIncomingRequests: Dispatch<SetStateAction<IncomingRequest[]>>;
};

// Une erreur d'API telle que lib/api la lève (statut + corps).
type ApiError = { status?: number; data?: { code?: string } };

export function useIncomingQueue({ userId, isOnline, router, declinedIdsRef, setIncomingRequests }: Args) {
  // Load current incoming queue via REST — hydrates the card list on dashboard open
  // so the provider sees existing "now" + devis requests without waiting for the next
  // socket rebroadcast tick. Scheduled-for-future requests live in the missions tab.
  // Extracted as a stable callback so we can re-invoke on socket (re)connect.
  // In-flight guard: mount, socket 'connect', and the 20s polling timer can
  // all fire this within a few ms of each other; coalesce to a single GET.
  const incomingInFlightRef = useRef(false);
  // Hard-stop guard: once the backend tells us this account isn't a provider
  // (token has PROVIDER role flag but no provider profile exists), there's no
  // point re-trying every 20s and spamming logs. Latch it for the session and
  // bounce the user back to the client dashboard.
  const notProviderRef = useRef(false);
  const fetchIncomingQueue = useCallback(async () => {
    if (!userId) return;
    if (notProviderRef.current) return;
    if (incomingInFlightRef.current) return;
    incomingInFlightRef.current = true;
    try {
      const res = await api.get<{ data?: IncomingPayload[] } | IncomingPayload[] | null>('/requests/incoming');
      const items = (res && !Array.isArray(res) ? res.data : undefined) || res || [];
      if (Array.isArray(items) && items.length > 0) {
        const mapped: IncomingRequest[] = items.map(incomingFromQueue);
        setIncomingRequests(prev => mergeQueue(prev, mapped, declinedIdsRef.current));
      }
    } catch (e) {
      const err = e as ApiError | null;
      if (err?.status === 403 && err?.data?.code === 'NOT_PROVIDER') {
        notProviderRef.current = true;
        devWarn('⚠️ Account is not a provider — redirecting to client dashboard');
        router.replace('/(tabs)/dashboard');
      }
    } finally {
      incomingInFlightRef.current = false;
    }
  }, [userId, router]);

  useEffect(() => {
    fetchIncomingQueue();
  }, [fetchIncomingQueue]);

  // Polling safety net : rafraîchit /requests/incoming toutes les 20s tant que
  // le provider est online. Garantit l'apparition des cards même si le socket
  // rate un event (cas : register pas encore enregistré sur le backend quand
  // le new_request est émis, latence réseau, buffering, etc.).
  useEffect(() => {
    if (!userId || !isOnline) return;
    if (notProviderRef.current) return;
    const iv = setInterval(() => {
      fetchIncomingQueue();
    }, 20000);
    return () => clearInterval(iv);
  }, [userId, isOnline, fetchIncomingQueue]);

  return fetchIncomingQueue;
}
