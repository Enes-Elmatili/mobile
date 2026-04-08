import { devLog, devWarn, devError } from './logger';
/* eslint-disable react-hooks/exhaustive-deps */
// lib/SocketContext.tsx
// ─── Production-ready Socket context : zéro Alert, redirections automatiques ───

import React, {
  createContext, useContext, useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth/AuthContext';
import { useNetwork } from './NetworkContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStorage } from './storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from './api';
import { useSoundManager } from '../hooks/useSoundManager';
import {
  MissionRequestSheet,
  type MissionRequest,
} from '../components/sheets/MissionRequestSheet';

// ─── URL via variable d'environnement (EAS-safe) ─────────────────────────────
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;
if (!SOCKET_URL) {
  throw new Error('EXPO_PUBLIC_SOCKET_URL environment variable is required');
}

// ─── Statut de connexion ──────────────────────────────────────────────────────
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'connecting';

// ─── Context type ─────────────────────────────────────────────────────────────
interface SocketContextType {
  socket:              Socket | null;
  isConnected:         boolean;
  connectionStatus:    ConnectionStatus;
  unreadCount:         number;
  clearUnread:         () => void;
  unreadMessages:      number;
  clearUnreadMessages: () => void;
  joinRoom:            (type: string, id: string) => void;
  leaveRoom:           (type: string, id: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket:              null,
  isConnected:         false,
  connectionStatus:    'connecting',
  unreadCount:         0,
  clearUnread:         () => {},
  unreadMessages:      0,
  clearUnreadMessages: () => {},
  joinRoom:            () => {},
  leaveRoom:           () => {},
});

export const useSocket = () => useContext(SocketContext);

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ─── showSocketToast() est exporté et utilisable dans toute l'app ─────────────
// ═══════════════════════════════════════════════════════════════════════════════
type ToastType = 'success' | 'error' | 'info';
interface ToastData { id: number; message: string; type: ToastType }

const socketToastEmitter = { listeners: [] as ((t: ToastData) => void)[] };
let toastId = 0;

export function showSocketToast(message: string, type: ToastType = 'info') {
  const t: ToastData = { id: toastId++, message, type };
  socketToastEmitter.listeners.forEach(fn => fn(t));
}

function SocketToastLayer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const anims = useRef<Record<number, Animated.Value>>({});

  useEffect(() => {
    const handler = (t: ToastData) => {
      anims.current[t.id] = new Animated.Value(0);
      setToasts(prev => [t, ...prev]);
      Animated.sequence([
        Animated.timing(anims.current[t.id], {
          toValue: 1, duration: 300,
          easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
        }),
        Animated.delay(2800),
        Animated.timing(anims.current[t.id], {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
        delete anims.current[t.id];
      });
    };
    socketToastEmitter.listeners.push(handler);
    return () => {
      socketToastEmitter.listeners = socketToastEmitter.listeners.filter(l => l !== handler);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <View style={ts.stack} pointerEvents="none">
      {toasts.map(t => {
        const av = anims.current[t.id] || new Animated.Value(1);
        const bg = '#1A1A1A'; // Always dark toast background
        const icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '●';
        return (
          <Animated.View
            key={t.id}
            style={[
              ts.pill,
              { backgroundColor: bg },
              {
                opacity:   av,
                transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <Text style={ts.icon}>{icon}</Text>
            <Text style={ts.text}>{t.message}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const ts = StyleSheet.create({
  stack: {
    position: 'absolute',
    top:   Platform.OS === 'ios' ? 56 : 36,
    left:  20, right: 20,
    zIndex: 9999,
    gap: 8,
    pointerEvents: 'none',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  icon: { fontSize: 13, color: '#FFF', fontWeight: '800' },
  text: { fontSize: 14, color: '#FFF', fontWeight: '600', flex: 1 },
});


// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE EMITTER
// ─── Permet aux écrans de conversation de recevoir les messages en temps réel ──
// ═══════════════════════════════════════════════════════════════════════════════
export type IncomingMessage = { id: string; senderId: string; recipientId: string; text: string; createdAt: string; readAt: string | null };
const messageEmitter = { listeners: [] as ((msg: IncomingMessage) => void)[] };

export function onIncomingMessage(handler: (msg: IncomingMessage) => void): () => void {
  messageEmitter.listeners.push(handler);
  return () => { messageEmitter.listeners = messageEmitter.listeners.filter(l => l !== handler); };
}

// ── Typing indicator emitter ──
export type TypingEvent = { userId: string };
const typingEmitter = { listeners: [] as ((e: TypingEvent) => void)[] };
const stopTypingEmitter = { listeners: [] as ((e: TypingEvent) => void)[] };

export function onUserTyping(handler: (e: TypingEvent) => void): () => void {
  typingEmitter.listeners.push(handler);
  return () => { typingEmitter.listeners = typingEmitter.listeners.filter(l => l !== handler); };
}

export function onUserStopTyping(handler: (e: TypingEvent) => void): () => void {
  stopTypingEmitter.listeners.push(handler);
  return () => { stopTypingEmitter.listeners = stopTypingEmitter.listeners.filter(l => l !== handler); };
}

// ── Read receipt emitter ──
export type ReadEvent = { messageId?: string; readAt: string; readBy: string };
const readEmitter = { listeners: [] as ((e: ReadEvent) => void)[] };
const readAllEmitter = { listeners: [] as ((e: { readBy: string; readAt: string }) => void)[] };

export function onMessageRead(handler: (e: ReadEvent) => void): () => void {
  readEmitter.listeners.push(handler);
  return () => { readEmitter.listeners = readEmitter.listeners.filter(l => l !== handler); };
}

export function onMessageReadAll(handler: (e: { readBy: string; readAt: string }) => void): () => void {
  readAllEmitter.listeners.push(handler);
  return () => { readAllEmitter.listeners = readAllEmitter.listeners.filter(l => l !== handler); };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSION REQUEST EMITTER
// ─── Même pattern que socketToastEmitter ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const missionRequestEmitter = {
  listeners: [] as ((req: MissionRequest | null) => void)[],
};

export function showMissionRequest(req: MissionRequest) {
  missionRequestEmitter.listeners.forEach(fn => fn(req));
}

export function clearMissionRequest() {
  missionRequestEmitter.listeners.forEach(fn => fn(null));
}

// ─── Layer monté dans le Provider ────────────────────────────────────────────
function MissionRequestLayer() {
  const [request, setRequest] = useState<MissionRequest | null>(null);
  const { socket }            = useSocket();

  useEffect(() => {
    const handler = (req: MissionRequest | null) => setRequest(req);
    missionRequestEmitter.listeners.push(handler);
    return () => {
      missionRequestEmitter.listeners = missionRequestEmitter.listeners.filter(l => l !== handler);
    };
  }, []);

  const handleAccept = (requestId: string) => {
    socket?.emit('request:accept', { requestId });
    setRequest(null);
    // Le feedback (toast + navigation) est géré par provider:accept_success dans SocketContext
  };

  const handleDecline = () => {
    setRequest(null);
    // Optionnel : émettre un événement de refus
    // socket?.emit('request:decline', { requestId: request?.requestId });
  };

  return (
    <MissionRequestSheet
      request={request}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket]                     = useState<Socket | null>(null);
  const [isConnected, setIsConnected]           = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [unreadCount, setUnreadCount]           = useState(0);
  const [unreadMessages, setUnreadMessages]     = useState(0);
  const { user }  = useAuth();
  const router    = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const userRef   = useRef(user); // stable ref for user data (avoids deps instability)
  userRef.current = user;
  const { isOnline: networkOnline } = useNetwork();
  const { play }  = useSoundManager();
  const playRef   = useRef(play);
  playRef.current = play;

  // Reconnexion automatique du socket au retour en ligne
  useEffect(() => {
    if (networkOnline && socketRef.current && !socketRef.current.connected) {
      devLog('[Socket] Network back online — reconnecting socket');
      socketRef.current.connect();
    }
  }, [networkOnline]);

  // Reconnexion automatique quand l'app revient au premier plan (iOS/Android suspend les sockets)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && socketRef.current && !socketRef.current.connected) {
        devLog('[Socket] App returned to foreground — reconnecting socket');
        socketRef.current.connect();
      }
    });
    return () => subscription.remove();
  }, []);

  const clearUnread         = useCallback(() => setUnreadCount(0), []);
  const clearUnreadMessages = useCallback(() => setUnreadMessages(0), []);

  // ── Room join/leave avec déduplication ─────────────────────────────────────
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  const joinRoom = useCallback((type: string, id: string) => {
    const key = `${type}:${id}`;
    if (joinedRoomsRef.current.has(key)) return; // already joined
    joinedRoomsRef.current.add(key);
    socketRef.current?.emit(`join:${type}`, { [`${type}Id`]: id });
    devLog(`[Socket] join ${key}`);
  }, []);

  const leaveRoom = useCallback((type: string, id: string) => {
    const key = `${type}:${id}`;
    joinedRoomsRef.current.delete(key);
    socketRef.current?.emit(`leave:${type}`, { [`${type}Id`]: id });
    devLog(`[Socket] leave ${key}`);
  }, []);

  // ── Charger le nombre de notifications non lues au démarrage ──────────────
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    api.notifications.list().then((res: any) => {
      const items: any[] = res?.data ?? [];
      setUnreadCount(items.filter((n: any) => !n.readAt).length);
    }).catch(err => devError('Failed to load notification count:', err));
  }, [user?.id]);

  // Push token registration is handled by usePushNotifications() in _layout.tsx

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        devLog('👋 User logged out, disconnecting socket');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      setIsConnected(false);
      setConnectionStatus('connecting'); // reset : pas de bannière "connexion perdue" sur logout/401
      return;
    }

    devLog('🔌 Initializing socket for user:', user.id);

    let cancelled = false;

    (async () => {
    // Retrieve stored JWT for socket auth
    const token = await tokenStorage.getToken();
    if (cancelled) return;

    const newSocket = io(SOCKET_URL, {
      // Polling d'abord pour fiabilité à travers Railway proxy, upgrade WS ensuite
      transports:           ['polling', 'websocket'],
      upgrade:              true,
      reconnection:         true,
      reconnectionDelay:    1000,
      reconnectionAttempts: Infinity,
      auth:         { token },
      extraHeaders: __DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {},
    });

    socketRef.current = newSocket;

    // ── CONNEXION ─────────────────────────────────────────────────────────────
    newSocket.on('connect', async () => {
      devLog('✅ Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionStatus('connected');
      // Clear joined rooms on reconnect so components can re-join
      joinedRoomsRef.current.clear();

      const u = userRef.current;
      if (u?.roles?.includes('PROVIDER')) {
        try {
          // Use cached providerId first (fast), refresh from API in background
          let providerId: string | null = null;
          const raw = await AsyncStorage.getItem('provider');
          if (raw) {
            const cached = JSON.parse(raw);
            providerId = cached.id || cached._id || cached.providerId || null;
          }

          // Register immediately with cached or userId
          providerId = providerId || u.id;
          devLog('📝 Registering provider:', providerId);
          newSocket.emit('provider:register', { providerId, userId: u.id });

          // Background: validate and refresh cache (non-blocking)
          api.providers.me().then((meRes: any) => {
            const provData = meRes?.data || meRes;
            if (provData?.id && provData.id !== providerId) {
              AsyncStorage.setItem('provider', JSON.stringify({ id: provData.id }));
            }
          }).catch(() => {}); // ignore — cache is good enough
        } catch (error) {
          devError('❌ Error reading provider data:', error);
        }
      }
    });

    newSocket.on('disconnect', () => {
      devLog('🔌 Socket disconnected');
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    let authRetried = false; // prevent infinite connect → error → connect loop
    newSocket.on('connect_error', async (error) => {
      devError('❌ Socket connection error:', error.message);
      if (!authRetried && (error.message === 'AUTH_REQUIRED' || error.message === 'AUTH_INVALID' || error.message === 'AUTH_TOKEN_REVOKED')) {
        authRetried = true;
        devWarn('🔒 Socket auth failed — refreshing token and retrying (once)');
        try {
          const freshToken = await tokenStorage.getToken();
          if (freshToken) {
            newSocket.auth = { token: freshToken };
            newSocket.connect();
            return;
          }
        } catch {
          devWarn('🔒 Token refresh failed');
        }
      }
      setConnectionStatus('disconnected');
      setIsConnected(false);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      devLog(`🔄 Reconnection attempt ${attempt}`);
      setConnectionStatus('reconnecting');
    });

    newSocket.on('reconnect', () => {
      devLog('✅ Socket reconnected');
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    newSocket.on('reconnect_failed', () => {
      devError('❌ Reconnection failed — all attempts exhausted');
      setConnectionStatus('disconnected');
    });

    // ── PROVIDER EVENTS ───────────────────────────────────────────────────────

    newSocket.on('new_request', (data) => {
      devLog('🔔 [PROVIDER] New request received:', data);
      playRef.current('newMission');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Traité par IncomingJobCard dans le ProviderDashboard — pas de double card
    });

    newSocket.on('request:claimed', (requestId) => {
      devLog(`🚫 [PROVIDER] Request ${requestId} claimed by another`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      clearMissionRequest(); // ferme la sheet si encore visible
      showSocketToast('Mission déjà prise par un autre prestataire.', 'error');
    });

    newSocket.on('request:expired', (requestId) => {
      devLog(`⏰ [PROVIDER] Request ${requestId} expired`);
      clearMissionRequest();
      showSocketToast('Cette mission a expiré.', 'info');
    });

    // Guard: prevent double navigation from both accept events
    const acceptedRequestIds = new Set<string>();
    const handleProviderAccept = (data: any, eventName: string) => {
      devLog(`✅ [PROVIDER] ${eventName}:`, data);
      clearMissionRequest();
      const reqId = String(data?.requestId);
      if (!reqId || acceptedRequestIds.has(reqId)) return; // already handled
      acceptedRequestIds.add(reqId);
      playRef.current('missionAccepted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/request/${reqId}/ongoing`);
    };

    newSocket.on('provider:accept_confirmed', (data) => handleProviderAccept(data, 'accept_confirmed'));
    newSocket.on('provider:accept_success',   (data) => handleProviderAccept(data, 'accept_success'));

    // ── CLIENT EVENTS ─────────────────────────────────────────────────────────

    newSocket.on('provider:accepted', (data) => {
      devLog('🎉 [CLIENT] Provider accepted request!', data);

      // Ignorer si c'est un provider qui reçoit cet event
      if (userRef.current?.roles?.includes('PROVIDER')) {
        devLog('⚠️ Ignoring provider:accepted — user is PROVIDER');
        return;
      }

      playRef.current('providerFound');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Toast discret — la navigation vers missionview est geree par le dashboard
      const providerName = data.provider?.name || 'Un professionnel';
      showSocketToast(`${providerName} est en route vers vous.`, 'success');
    });

    newSocket.on('request:published', (data) => {
      devLog('📢 [CLIENT] Request published:', data);
    });

    // ── SHARED EVENTS ─────────────────────────────────────────────────────────

    // location_update est géré localement dans MissionView — pas de log global
    // (évite le double-log GPS qui spam la console)

    const completedRequestIds = new Set<string>();
    newSocket.on('request:completed', (data) => {
      const reqId = String(data?.requestId);
      if (completedRequestIds.has(reqId)) return; // deduplicate
      completedRequestIds.add(reqId);
      devLog('🏁 [COMPLETION] Request completed:', reqId);
      playRef.current('missionAccepted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (userRef.current?.roles?.includes('PROVIDER')) {
        showSocketToast('Mission terminée. Consultez vos gains.', 'success');
        setTimeout(() => router.push({ pathname: '/request/[id]/earnings', params: { id: reqId } }), 900);
      } else {
        showSocketToast('Mission terminée. Merci !', 'success');
        setTimeout(() => router.push({ pathname: '/request/[id]/rating', params: { id: reqId } }), 900);
      }
    });


    // ── PAYMENT EVENTS ────────────────────────────────────────────────────────

    newSocket.on('payment:succeeded', (data) => {
      playRef.current('paymentReceived');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSocketToast('Paiement confirmé.', 'success');
    });

    newSocket.on('payment:refunded', (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showSocketToast('Votre paiement a été remboursé.', 'info');
    });

    // Path 2 refactor — charge failed off-session when a provider tried to accept
    // (card declined, insufficient funds, 3DS required). The request stays PUBLISHED
    // and the client must update their payment method via resume-payment.
    newSocket.on('payment:charge_failed', (data: { requestId: number; reason?: string }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showSocketToast(
        data?.reason || 'Le paiement de votre mission a échoué. Mettez à jour votre carte.',
        'error',
      );
    });

    // ── STATUS / MISC ─────────────────────────────────────────────────────────

    // Status updates — handled by consumers, no global log needed
    newSocket.on('provider:status_update', () => {});
    newSocket.on('provider:registered', () => {});

    // ── MESSAGES IN-APP ───────────────────────────────────────────────────────
    newSocket.on('message:received', (msg: IncomingMessage) => {
      devLog('💬 [MESSAGE] Incoming message from:', msg.senderId);
      setUnreadMessages(prev => prev + 1);
      messageEmitter.listeners.forEach(fn => fn(msg));
    });

    // Own sent message confirmed (for multi-device or immediate UI feedback)
    newSocket.on('message:sent', (msg: IncomingMessage) => {
      devLog('💬 [MESSAGE] Sent confirmed:', msg.id);
      messageEmitter.listeners.forEach(fn => fn(msg));
    });

    // Typing indicators
    newSocket.on('user:typing', (e: { userId: string }) => {
      typingEmitter.listeners.forEach(fn => fn(e));
    });
    newSocket.on('user:stop_typing', (e: { userId: string }) => {
      stopTypingEmitter.listeners.forEach(fn => fn(e));
    });

    // Read receipts
    newSocket.on('message:read', (e: { messageId: string; readAt: string; readBy: string }) => {
      readEmitter.listeners.forEach(fn => fn(e));
    });
    newSocket.on('message:read_all', (e: { readBy: string; readAt: string }) => {
      readAllEmitter.listeners.forEach(fn => fn(e));
    });

    // ── NOTIFICATIONS IN-APP ──────────────────────────────────────────────────
    newSocket.on('notification:received', () => {
      setUnreadCount(prev => prev + 1);
    });

    // ── INVOICE GENERATED ───────────────────────────────────────────────────
    newSocket.on('invoice:generated', (data: any) => {
      devLog('📄 Invoice generated:', data?.invoiceNumber);
      showSocketToast('Votre facture est disponible', 'success');
    });

    // ── ERROR HANDLING ────────────────────────────────────────────────────────

    newSocket.on('error', async (error: any) => {
      devError('❌ Socket Error:', error);

      if (
        error?.code === 'PROVIDER_NOT_FOUND' ||
        error?.message?.includes('not found') ||
        error?.message?.includes('Invalid provider')
      ) {
        devWarn('⚠️ Invalid provider ID — cleaning AsyncStorage');
        await AsyncStorage.removeItem('provider');
        showSocketToast('Profil prestataire à reconfigurer.', 'error');

      } else if (error?.code === 'REQUEST_NOT_AVAILABLE') {
        clearMissionRequest();
        showSocketToast('Cette mission a déjà été prise.', 'error');

      } else if (error?.code === 'REQUEST_ALREADY_CLAIMED') {
        clearMissionRequest();
        showSocketToast('Un autre prestataire a accepté en premier.', 'error');

      } else if (error?.message) {
        showSocketToast(error.message, 'error');
      }
    });

    setSocket(newSocket);

    })(); // end async IIFE

    // ── CLEANUP ───────────────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      devLog('🧹 Cleaning up socket listeners');
      joinedRoomsRef.current.clear();

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  // Only depend on user?.id — roles and email are read from userRef inside handlers
  }, [user?.id]);

  const contextValue = useMemo(
    () => ({ socket, isConnected, connectionStatus, unreadCount, clearUnread, unreadMessages, clearUnreadMessages, joinRoom, leaveRoom }),
    [socket, isConnected, connectionStatus, unreadCount, clearUnread, unreadMessages, clearUnreadMessages, joinRoom, leaveRoom]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}

      {/* Toasts globaux (paiement, acceptation, erreurs socket…) */}
      <SocketToastLayer />

      {/* Sheet "Nouvelle Mission" — visible uniquement pour les PROVIDERS */}
      <MissionRequestLayer />
    </SocketContext.Provider>
  );
};