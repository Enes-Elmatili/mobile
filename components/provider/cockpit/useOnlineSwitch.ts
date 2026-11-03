/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useOnlineSwitch.ts — le GO « En ligne » de
// l'accueil prestataire : l'état affiché, les refs qui arbitrent entre le choix
// du prestataire et les échos du serveur, et l'envoi du statut (accusé 8 s).
import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { feedback } from '@/lib/feedback/feedback';
import { isOnlineStatus, GATE_CODES } from '@/lib/providerGate';
import type { IncomingRequest } from '@/lib/cockpit/incoming';

/** L'état du GO et ses refs. Appelé à la place des déclarations d'origine : l'effet du chrono garde son rang. */
export function useOnlineState() {
  const [isOnline,      setIsOnline]       = useState(false);
  const isOnlineRef = useRef(false);
  // C'est le prestataire qui choisit : tant qu'il n'a pas appuyé sur GO dans
  // cette session, un statut READY hérité d'une session précédente (renvoyé par
  // le serveur au register) est ramené à OFFLINE au lieu d'être affiché.
  const userChoseRef = useRef(false);
  // Un GO en vol : tant que le serveur n'a pas répondu, ses échos plus anciens
  // (status_update d'avant l'appui) ne défont pas l'état choisi.
  const pendingRef = useRef(false);
  const declinedIdsRef = useRef<Set<string>>(new Set());
  // Depuis quand on est en ligne (chrono du dock) — posé au passage à « en ligne ».
  const [onlineSince, setOnlineSince] = useState<number | null>(null);
  useEffect(() => { setOnlineSince((prev) => (isOnline ? prev ?? Date.now() : null)); }, [isOnline]);

  return { isOnline, setIsOnline, isOnlineRef, userChoseRef, pendingRef, declinedIdsRef, onlineSince };
}

type SwitchArgs = {
  socket: Socket | null;
  userId: string | undefined;
  online: ReturnType<typeof useOnlineState>;
  setIncomingRequests: Dispatch<SetStateAction<IncomingRequest[]>>;
  fetchIncomingQueue: () => void;
};

// Accusé de provider:set_status.
type StatusAck = { ok?: boolean; status?: string; code?: string };

/** Appliquer un statut, l'envoyer au serveur, et le GO lui-même. Que des callbacks : aucun effet. */
export function useOnlineSwitch({ socket, userId, online, setIncomingRequests, fetchIncomingQueue }: SwitchArgs) {
  const { setIsOnline, isOnlineRef, userChoseRef, pendingRef } = online;

  const applyOnline = useCallback((on: boolean) => {
    isOnlineRef.current = on;
    setIsOnline(on);
    if (!on) setIncomingRequests([]);
  }, []);

  // Demande un statut au serveur et attend son accusé. Optimiste à l'écran,
  // mais sans réponse (socket coupée, serveur muet, erreur) on revient à l'état
  // d'avant et on le dit : le GO ne ment plus. Un refus de gate arrive aussi
  // par provider:status_rejected, qui ouvre la feuille « finir l'étape ».
  const sendStatus = useCallback((next: boolean, { silent = false }: { silent?: boolean } = {}) => {
    const before = isOnlineRef.current;
    if (!socket?.connected) {
      if (!silent) feedback.error('cockpit.status_offline');
      return;
    }
    pendingRef.current = true;
    applyOnline(next);
    socket.timeout(8000).emit('provider:set_status', { status: next ? 'READY' : 'OFFLINE' }, (err: Error | null, res?: StatusAck) => {
      pendingRef.current = false;
      if (!err && res?.ok) {
        const on = isOnlineStatus(res.status);
        applyOnline(on);
        if (on) fetchIncomingQueue(); // en ligne : la file tout de suite, pas au prochain tick de 20 s
        return;
      }
      if (res?.code === GATE_CODES.NOT_VALIDATED || res?.code === GATE_CODES.STRIPE_NOT_READY) return;
      applyOnline(silent ? false : before);
      if (!silent) feedback.error('cockpit.status_failed');
    });
  }, [socket, applyOnline, fetchIncomingQueue]);

  // Le GO : passer en ligne / hors ligne. L'haptique est partie à l'appui
  // (ActionDisc), sur la même frame que le départ du disque. Lu dans les refs :
  // le handler reste stable et un double appui ne calcule pas deux fois le même « next ».
  const handleToggleOnline = useCallback(() => {
    if (!userId || pendingRef.current) return;
    userChoseRef.current = true;
    sendStatus(!isOnlineRef.current);
  }, [sendStatus, userId]);

  return { applyOnline, sendStatus, handleToggleOnline };
}
