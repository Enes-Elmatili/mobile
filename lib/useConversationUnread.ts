import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useSocket } from './SocketContext';
import { devLog } from './logger';

type AnyMessage = {
  senderId?: string;
  recipientId?: string;
  from?: string;
  to?: string;
  readAt?: string | null;
  read_at?: string | null;
};

function pickSender(m: AnyMessage): string | undefined {
  return m.senderId ?? m.from;
}
function pickRecipient(m: AnyMessage): string | undefined {
  return m.recipientId ?? m.to;
}
function isUnread(m: AnyMessage): boolean {
  return !m.readAt && !m.read_at;
}

/**
 * Compteur de messages non-lus dans la conversation entre `currentUserId` et `peerUserId`.
 *
 * - Initialise via REST `/messages/conversation/:peerId` (compte les msg reçus non-lus)
 * - Incrémente en temps réel via socket `message:received` filtré sur ce peer
 * - `reset()` à appeler quand l'utilisateur ouvre la conversation (bouton tapé)
 */
export function useConversationUnread(
  peerUserId?: string | null,
  currentUserId?: string | null,
) {
  const [count, setCount] = useState(0);
  const { socket } = useSocket();

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!peerUserId || !currentUserId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.messages.conversation(peerUserId, 1);
        if (cancelled) return;
        const list: AnyMessage[] = Array.isArray(res) ? res : (res?.data || res?.messages || []);
        const unread = list.filter(
          (m) => pickRecipient(m) === currentUserId && pickSender(m) === peerUserId && isUnread(m),
        ).length;
        setCount(unread);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [peerUserId, currentUserId]);

  // ── Socket: incoming messages from this peer ──────────────────────────────
  useEffect(() => {
    if (!socket || !peerUserId || !currentUserId) return;

    const handleReceived = (msg: AnyMessage) => {
      const from = pickSender(msg);
      const to = pickRecipient(msg);
      if (from === peerUserId && to === currentUserId) {
        devLog('[Unread] +1 from peer', peerUserId);
        setCount((c) => c + 1);
      }
    };

    socket.on('message:received', handleReceived);
    return () => {
      socket.off('message:received', handleReceived);
    };
  }, [socket, peerUserId, currentUserId]);

  const reset = useCallback(() => setCount(0), []);

  return { count, reset };
}
