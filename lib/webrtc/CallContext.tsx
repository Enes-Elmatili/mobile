// lib/webrtc/CallContext.tsx
// ─── Global call state management + WebRTC signaling via Socket.IO ───────────

import React, {
  createContext, useContext, useCallback, useRef, useState, useEffect,
} from 'react';
import { useRouter } from 'expo-router';
import { useSocket } from '../SocketContext';
import { useAuth } from '../auth/AuthContext';
import { CallService, isWebRTCAvailable } from './CallService';
import { devLog, devError } from '../logger';
import { Alert, Linking } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended';

/** Raison de fin d'appel — affichée par app/call/active.tsx (getStatusLabel). */
export type CallEndReason = 'hangup' | 'rejected' | 'busy' | 'failed' | 'timeout';

/** Délai avant de considérer un appel sans réponse (appelant ET appelé). */
const RING_TIMEOUT_MS = 40000;

export interface CallInfo {
  callId: string;
  remoteUserId: string;
  remoteName: string;
  requestId?: string;
  isCaller: boolean;
}

interface CallContextType {
  callState: CallState;
  callInfo: CallInfo | null;
  endReason: CallEndReason | null;
  isMuted: boolean;
  isSpeaker: boolean;
  callDuration: number;
  initiateCall: (params: { targetUserId: string; targetName: string; requestId?: string }) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextType>({
  callState: 'idle',
  callInfo: null,
  endReason: null,
  isMuted: false,
  isSpeaker: false,
  callDuration: 0,
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  hangup: () => {},
  toggleMute: () => {},
  toggleSpeaker: () => {},
});

export const useCall = () => useContext(CallContext);

// ─── Incoming call emitter (for overlay) ─────────────────────────────────────

export type IncomingCallData = {
  callId: string;
  callerId: string;
  callerName: string;
  requestId?: string;
};

const incomingCallEmitter = { listeners: [] as ((data: IncomingCallData | null) => void)[] };

export function onIncomingCall(handler: (data: IncomingCallData | null) => void): () => void {
  incomingCallEmitter.listeners.push(handler);
  return () => { incomingCallEmitter.listeners = incomingCallEmitter.listeners.filter(l => l !== handler); };
}

// ─── Micro permission helpers ────────────────────────────────────────────────

function isMicPermissionError(err: unknown): boolean {
  const msg = `${(err as any)?.name || ''} ${(err as any)?.message || ''}`;
  return /notallowed|permission|denied|security/i.test(msg);
}

function showMicPermissionAlert() {
  Alert.alert(
    'Micro refusé',
    'FIXED n\'a pas accès à votre micro. Activez-le dans les Réglages pour passer des appels.',
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Ouvrir les Réglages', onPress: () => Linking.openSettings() },
    ],
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const router = useRouter();

  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [endReason, setEndReason] = useState<CallEndReason | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const callServiceRef = useRef<CallService | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);

  // Latest callInfo for use inside timers (avoids stale closures).
  const callInfoRef = useRef<CallInfo | null>(null);
  useEffect(() => { callInfoRef.current = callInfo; }, [callInfo]);

  // ── Ring timeout (40 s sans réponse, côté appelant et appelé) ───────────
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  // ── Duration timer ──────────────────────────────────────────────────────
  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearRingTimeout();
    stopDurationTimer();
    callServiceRef.current?.destroy();
    callServiceRef.current = null;
    pendingCandidatesRef.current = [];
    setCallState('idle');
    setCallInfo(null);
    setEndReason(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setCallDuration(0);
  }, [stopDurationTimer, clearRingTimeout]);

  // ── End call with brief "ended" state ───────────────────────────────────
  const endCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    // Cancel any pending end-call cleanup on provider unmount to avoid
    // setState-after-unmount when the user logs out during the "ended" window.
    if (endCallTimerRef.current) {
      clearTimeout(endCallTimerRef.current);
      endCallTimerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);
  const endCall = useCallback((reason: CallEndReason = 'hangup') => {
    clearRingTimeout();
    setEndReason(reason);
    setCallState('ended');
    stopDurationTimer();
    callServiceRef.current?.destroy();
    callServiceRef.current = null;
    // Auto-cleanup after brief display — un peu plus long quand il y a une
    // raison à lire ("Sans réponse", "Appel refusé", "Échec de connexion").
    if (endCallTimerRef.current) clearTimeout(endCallTimerRef.current);
    endCallTimerRef.current = setTimeout(() => {
      endCallTimerRef.current = null;
      setCallState('idle');
      setCallInfo(null);
      setEndReason(null);
      setIsMuted(false);
      setIsSpeaker(false);
      setCallDuration(0);
    }, reason === 'hangup' ? 1500 : 3000);
  }, [stopDurationTimer, clearRingTimeout]);

  // ── Initialize CallService ──────────────────────────────────────────────
  const initCallService = useCallback(async (targetUserId: string) => {
    const service = new CallService({
      onIceCandidate: (candidate) => {
        socket?.emit('call:ice-candidate', {
          callId: callInfo?.callId,
          targetUserId,
          candidate,
        });
      },
      onRemoteStream: (_stream: any) => {
        devLog('📞 [Call] Remote stream received');
        setCallState('connected');
        startDurationTimer();
      },
      onConnectionStateChange: (state) => {
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          endCall(state === 'failed' ? 'failed' : 'hangup');
        }
      },
    });

    await service.initialize();
    callServiceRef.current = service;

    // Flush pending ICE candidates
    for (const c of pendingCandidatesRef.current) {
      await service.addIceCandidate(c);
    }
    pendingCandidatesRef.current = [];

    return service;
  }, [socket, callInfo?.callId, startDurationTimer, endCall]);

  // ── Initiate call (caller) ──────────────────────────────────────────────
  const initiateCall = useCallback(({ targetUserId, targetName, requestId }: {
    targetUserId: string; targetName: string; requestId?: string;
  }) => {
    if (callState !== 'idle' || !socket) return;

    if (!isWebRTCAvailable()) {
      Alert.alert(
        'Appel non disponible',
        'Les appels VoIP nécessitent un build de développement. Utilisez l\'appel téléphonique classique.',
      );
      return;
    }

    setCallState('outgoing');
    setCallInfo({
      callId: '', // will be set by call:ringing response
      remoteUserId: targetUserId,
      remoteName: targetName,
      requestId,
      isCaller: true,
    });

    // callerName = utilisateur COURANT (celui qui appelle), pas le destinataire.
    socket.emit('call:initiate', {
      targetUserId,
      requestId,
      callerName: user?.name || user?.email || 'Inconnu',
    });

    // Timeout appelant : sans réponse après 40 s, annuler l'appel.
    clearRingTimeout();
    ringTimeoutRef.current = setTimeout(() => {
      ringTimeoutRef.current = null;
      const info = callInfoRef.current;
      // Le backend route call:hangup par targetUserId (callId non requis).
      socket.emit('call:hangup', { callId: info?.callId || '', targetUserId });
      endCall('timeout');
    }, RING_TIMEOUT_MS);

    // Navigate to call screen
    router.push({ pathname: '/call/active' });
  }, [callState, socket, router, user, clearRingTimeout, endCall]);

  // ── Accept call (callee) ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callInfo || !socket) return;

    clearRingTimeout();
    setCallState('connecting');
    socket.emit('call:accept', { callId: callInfo.callId, callerId: callInfo.remoteUserId });

    // Dismiss incoming call overlay
    incomingCallEmitter.listeners.forEach(fn => fn(null));

    // Navigate to call screen
    router.push({ pathname: '/call/active' });
  }, [callInfo, socket, router, clearRingTimeout]);

  // ── Reject call ─────────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (!callInfo || !socket) return;
    socket.emit('call:reject', { callId: callInfo.callId, callerId: callInfo.remoteUserId });
    incomingCallEmitter.listeners.forEach(fn => fn(null));
    cleanup();
  }, [callInfo, socket, cleanup]);

  // ── Hangup ──────────────────────────────────────────────────────────────
  const hangup = useCallback(() => {
    if (!callInfo || !socket) return;
    // Vérifié côté backend (server.js "call:hangup") : le routage se fait par
    // targetUserId uniquement (callId simplement réémis) — raccrocher pendant
    // la fenêtre où callId vaut encore '' atteint donc bien l'appelé.
    socket.emit('call:hangup', { callId: callInfo.callId, targetUserId: callInfo.remoteUserId });
    endCall();
  }, [callInfo, socket, endCall]);

  // ── Toggle controls ─────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (callServiceRef.current) {
      const muted = callServiceRef.current.toggleMute();
      setIsMuted(muted);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    if (callServiceRef.current) {
      const speaker = callServiceRef.current.toggleSpeaker();
      setIsSpeaker(speaker);
    }
  }, []);

  // ── Socket event listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    const handleIncoming = (data: IncomingCallData) => {
      if (callState !== 'idle') {
        // Already in a call — auto-reject
        socket.emit('call:reject', { callId: data.callId, callerId: data.callerId });
        return;
      }

      setCallState('incoming');
      setCallInfo({
        callId: data.callId,
        remoteUserId: data.callerId,
        remoteName: data.callerName,
        requestId: data.requestId,
        isCaller: false,
      });

      // Notify overlay
      incomingCallEmitter.listeners.forEach(fn => fn(data));

      // Timeout appelé : si personne ne décroche / aucun événement en 40 s
      // (ex. appelant qui a tué l'app), masquer l'overlay et revenir à idle.
      clearRingTimeout();
      ringTimeoutRef.current = setTimeout(() => {
        ringTimeoutRef.current = null;
        incomingCallEmitter.listeners.forEach(fn => fn(null));
        cleanup();
      }, RING_TIMEOUT_MS);
    };

    // Ringing confirmation (caller gets callId)
    const handleRinging = ({ callId, targetUserId }: { callId: string; targetUserId: string }) => {
      setCallInfo(prev => prev ? { ...prev, callId } : prev);
    };

    // Call accepted — start WebRTC handshake (caller creates offer)
    const handleAccepted = async ({ callId }: { callId: string }) => {
      if (!callInfo) return;
      clearRingTimeout();
      setCallState('connecting');
      try {
        const service = await initCallService(callInfo.remoteUserId);
        const offer = await service.createOffer();
        socket.emit('call:offer', {
          callId,
          targetUserId: callInfo.remoteUserId,
          sdp: offer,
        });
      } catch (err) {
        devError('📞 [Call] Failed to create offer:', err);
        if (isMicPermissionError(err)) showMicPermissionAlert();
        // Prévenir l'appelé pour ne pas le laisser en "connexion…".
        socket.emit('call:hangup', { callId, targetUserId: callInfo.remoteUserId });
        endCall('failed');
      }
    };

    // Rejected (le backend n'émet pas de raison distincte pour "occupé" :
    // un appelé déjà en ligne auto-rejette via le même événement)
    const handleRejected = () => {
      endCall('rejected');
    };

    // SDP Offer (callee receives)
    const handleOffer = async ({ callId, sdp, callerId }: { callId: string; sdp: any; callerId: string }) => {
      try {
        const service = await initCallService(callerId);
        const answer = await service.handleOffer(sdp);
        socket.emit('call:answer', { callId, callerId, sdp: answer });
      } catch (err) {
        devError('📞 [Call] Failed to handle offer:', err);
        if (isMicPermissionError(err)) showMicPermissionAlert();
        // Prévenir l'appelant pour ne pas le laisser sonner dans le vide.
        socket.emit('call:hangup', { callId, targetUserId: callerId });
        endCall('failed');
      }
    };

    // SDP Answer (caller receives)
    const handleAnswer = async ({ sdp }: { callId: string; sdp: any }) => {
      try {
        await callServiceRef.current?.handleAnswer(sdp);
      } catch (err) {
        devError('📞 [Call] Failed to handle answer:', err);
      }
    };

    // ICE candidate
    const handleIceCandidate = async ({ candidate }: { callId: string; candidate: any }) => {
      if (callServiceRef.current) {
        await callServiceRef.current.addIceCandidate(candidate);
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    // Call ended by remote
    const handleEnded = (payload?: { callId?: string; reason?: string }) => {
      // Si l'appelé sonne encore (appelant qui raccroche avant la réponse),
      // masquer l'overlay d'appel entrant.
      incomingCallEmitter.listeners.forEach(fn => fn(null));
      const r = payload?.reason;
      endCall(r === 'rejected' || r === 'busy' || r === 'failed' || r === 'timeout' ? r : 'hangup');
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:ringing', handleRinging);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:ringing', handleRinging);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:ended', handleEnded);
    };
  }, [socket, callState, callInfo, initCallService, endCall, cleanup, clearRingTimeout]);

  return (
    <CallContext.Provider value={{
      callState, callInfo, endReason, isMuted, isSpeaker, callDuration,
      initiateCall, acceptCall, rejectCall, hangup, toggleMute, toggleSpeaker,
    }}>
      {children}
    </CallContext.Provider>
  );
};