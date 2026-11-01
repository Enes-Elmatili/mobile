/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useCockpitSocket.ts — les abonnements temps réel
// de l'accueil prestataire : register à chaque (re)connexion, nouvelles
// demandes et leur retrait, statut du serveur (et ses refus de gate).
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { feedback } from '@/lib/feedback/feedback';
import { isOnlineStatus, gateCopyFor } from '@/lib/providerGate';
import { incomingFromSocket, type IncomingPayload, type IncomingRequest } from '@/lib/cockpit/incoming';

type Args = {
  socket: Socket | null;
  userId: string | undefined;
  t: TFunction;
  router: ReturnType<typeof useRouter>;
  isOnlineRef: RefObject<boolean>;
  userChoseRef: RefObject<boolean>;
  pendingRef: RefObject<boolean>;
  declinedIdsRef: RefObject<Set<string>>;
  setIncomingRequests: Dispatch<SetStateAction<IncomingRequest[]>>;
  fetchIncomingQueue: () => void;
  applyOnline: (online: boolean) => void;
  sendStatus: (online: boolean, opts?: { silent?: boolean }) => void;
};

// Socket
export function useCockpitSocket({ socket, userId, t, router, isOnlineRef, userChoseRef, pendingRef, declinedIdsRef, setIncomingRequests, fetchIncomingQueue, applyOnline, sendStatus }: Args) {
  useEffect(() => {
    if (!socket || !userId) return;

    // Helper: register + refresh incoming queue. Called on mount (if already connected)
    // AND on every (re)connect, so a brief network blip doesn't leave the provider in a
    // zombie state where the server doesn't know their socket and they miss new_request
    // events. Without this, the provider could wait up to 45s (next rebroadcast tick)
    // before seeing an incoming card.
    const registerAndRefresh = () => {
      socket.emit('provider:register', { providerId: userId });
      // Ne PAS présumer « en ligne » ici : le serveur ne met en READY qu'un
      // prestataire validé. Affirmer true à chaque (re)connexion affichait
      // « En ligne » à un prestataire que le backend gardait OFFLINE — le
      // switch mentait sans qu'aucune action de l'utilisateur ne l'explique.
      // L'état réel arrive via provider:registered ci-dessous.
      fetchIncomingQueue();
    };

    if (socket.connected) {
      registerAndRefresh();
    }

    const handleNewRequest = (data: IncomingPayload) => {
      const rid = String(data.requestId ?? data.id);
      if (declinedIdsRef.current.has(rid)) return; // already declined, ignore rebroadcast
      feedback.haptic('warning');
      const req = incomingFromSocket(data, t);
      // La caméra cadre moi + la demande via useMapCamera (stade « incoming »).
      setIncomingRequests(prev => prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]);
    };

    const removeRequest = (id: unknown) =>
      setIncomingRequests(prev => prev.filter(r => r.requestId !== String(id)));

    // Client a annulé → retirer la carte (payload objet { id, ... })
    // (un id nu est aussi accepté : `data?.id` vaut alors undefined).
    const handleCancelled = (data: { id?: unknown } | null | undefined) => removeRequest(data?.id ?? data);

    // Un « en ligne » que le prestataire n'a pas choisi dans cette session
    // (statut hérité, ou remise en READY par l'admin) est refusé.
    const applyServerOnline = (online: boolean) => {
      if (pendingRef.current) return; // la réponse au GO fait foi
      if (online && !userChoseRef.current) {
        socket.emit('provider:set_status', { status: 'OFFLINE' });
        online = false;
      }
      applyOnline(online);
    };

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === userId) applyServerOnline(isOnlineStatus(data.status));
    };

    // Réponse du serveur à provider:register — porte le statut réel du compte,
    // que le register ne modifie plus. Après une coupure réseau le serveur
    // est repassé OFFLINE : si le prestataire avait choisi d'être en ligne
    // dans cette session, on réaffirme son choix au lieu de le perdre.
    const handleRegistered = (data: { status?: string; blocked?: boolean; provider?: { status?: string } } | null | undefined) => {
      if (pendingRef.current) return;
      // server.js émet { providerId, status, blocked? } ; on accepte aussi la
      // forme imbriquée au cas où un ancien serveur répondrait { provider }.
      const serverOnline = isOnlineStatus(data?.status ?? data?.provider?.status);
      const wanted = userChoseRef.current && isOnlineRef.current;
      if (wanted && !serverOnline && !data?.blocked) { sendStatus(true, { silent: true }); return; }
      applyServerOnline(serverOnline);
    };

    // Le serveur refuse le passage en ligne (dossier incomplet ou Stripe non
    // finalisé). On remet le GO sur la vérité serveur et on propose
    // d'aller finir l'étape manquante — volet coulissant, pas d'alerte système.
    const handleStatusRejected = async (data: { code?: string; message?: string; status?: string }) => {
      pendingRef.current = false;
      applyOnline(isOnlineStatus(data?.status));
      feedback.haptic('warning');

      const copy = gateCopyFor(data?.code);
      const go = await feedback.confirm({
        titleKey:   copy.titleKey,
        messageKey: copy.messageKey,
        confirmKey: copy.confirmKey,
        cancelKey:  copy.cancelKey,
      });
      if (go) router.push(copy.route);
    };

    socket.on('connect',                registerAndRefresh);
    socket.on('new_request',            handleNewRequest);
    socket.on('request:claimed',        removeRequest);
    socket.on('request:expired',        removeRequest);
    socket.on('request:cancelled',      handleCancelled);
    socket.on('provider:status_update', handleStatusUpdate);
    socket.on('provider:registered',      handleRegistered);
    socket.on('provider:status_rejected', handleStatusRejected);

    return () => {
      socket.off('connect',                registerAndRefresh);
      socket.off('new_request',            handleNewRequest);
      socket.off('request:claimed',        removeRequest);
      socket.off('request:expired',        removeRequest);
      socket.off('request:cancelled',      handleCancelled);
      socket.off('provider:status_update', handleStatusUpdate);
      socket.off('provider:registered',      handleRegistered);
      socket.off('provider:status_rejected', handleStatusRejected);
    };
  }, [socket, userId, fetchIncomingQueue, applyOnline, sendStatus]);
}
