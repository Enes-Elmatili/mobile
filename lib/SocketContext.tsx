/* eslint-disable react-hooks/exhaustive-deps */
// lib/SocketContext.tsx
// ─── Production-ready Socket context : zéro Alert, redirections automatiques ───

import React, {
  createContext, useContext, useEffect, useState, useRef,
} from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Vibration } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  MissionRequestSheet,
  type MissionRequest,
} from '../components/sheets/MissionRequestSheet';

// ─── URL via variable d'environnement (EAS-safe) ─────────────────────────────
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  'https://radiosymmetrical-jeniffer-acquisitively.ngrok-free.dev';

// ─── Statut de connexion ──────────────────────────────────────────────────────
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

// ─── Context type ─────────────────────────────────────────────────────────────
interface SocketContextType {
  socket:           Socket | null;
  isConnected:      boolean;
  connectionStatus: ConnectionStatus;
}

const SocketContext = createContext<SocketContextType>({
  socket:           null,
  isConnected:      false,
  connectionStatus: 'disconnected',
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
        const bg =
          t.type === 'success' ? '#059669' :
          t.type === 'error'   ? '#1A1A1A' : '#1A1A1A';
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
// RECONNECTION BANNER
// ─── Barre discrète animée en haut de l'app lors d'une perte de connexion ─────
// ═══════════════════════════════════════════════════════════════════════════════
function ReconnectionBanner({ status }: { status: ConnectionStatus }) {
  const anim    = useRef(new Animated.Value(0)).current;
  const prevRef = useRef<ConnectionStatus>('connected');

  useEffect(() => {
    const showing = status === 'reconnecting' || status === 'disconnected';

    Animated.timing(anim, {
      toValue:  showing ? 1 : 0,
      duration: 300,
      easing:   Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Toast discret quand la connexion revient
    if (prevRef.current === 'reconnecting' && status === 'connected') {
      showSocketToast('Connexion rétablie.', 'success');
    }
    prevRef.current = status;
  }, [status]);

  const translateY    = anim.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] });
  const isReconnecting = status === 'reconnecting';

  return (
    <Animated.View
      style={[
        rb.bar,
        { opacity: anim, transform: [{ translateY }] },
        isReconnecting ? rb.reconnecting : rb.disconnected,
      ]}
      pointerEvents="none"
    >
      <View style={rb.dot} />
      <Text style={rb.label}>
        {isReconnecting ? 'Reconnexion en cours…' : 'Connexion perdue'}
      </Text>
    </Animated.View>
  );
}

const rb = StyleSheet.create({
  bar: {
    position:       'absolute',
    top: 0, left: 0, right: 0,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     Platform.OS === 'ios' ? 54 : 34,
    paddingBottom:  10,
    gap:    8,
    zIndex: 9998,
  },
  reconnecting: { backgroundColor: '#1A1A1A' },
  disconnected: { backgroundColor: '#4B4B4B' },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  label: { fontSize: 12, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
});

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const { user }  = useAuth();
  const router    = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        console.log('👋 User logged out, disconnecting socket');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
      return;
    }

    console.log('🔌 Initializing socket for user:', user.email, 'Role:', user.roles);

    const newSocket = io(SOCKET_URL, {
      // Websocket en priorité — plus rapide et moins énergivore sur mobile
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionDelay:    1000,
      reconnectionAttempts: 10,
      query:        { userId: user.id },
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });

    socketRef.current = newSocket;

    // ── CONNEXION ─────────────────────────────────────────────────────────────
    newSocket.on('connect', async () => {
      console.log('✅ Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionStatus('connected');

      if (user.roles?.includes('PROVIDER')) {
        try {
          const raw        = await AsyncStorage.getItem('provider');
          const providerId = raw
            ? (JSON.parse(raw).id || JSON.parse(raw)._id || JSON.parse(raw).providerId || user.id)
            : user.id;

          console.log('📝 Registering provider:', providerId);
          newSocket.emit('provider:register', { providerId, userId: user.id });
        } catch (error) {
          console.error('❌ Error reading provider data:', error);
        }
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      setConnectionStatus('disconnected');
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnection attempt ${attempt}`);
      setConnectionStatus('reconnecting');
    });

    newSocket.on('reconnect', () => {
      console.log('✅ Socket reconnected');
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed — all attempts exhausted');
      setConnectionStatus('disconnected');
      showSocketToast('Connexion impossible. Vérifiez votre réseau.', 'error');
    });

    // ── PROVIDER EVENTS ───────────────────────────────────────────────────────

    newSocket.on('new_request', (data) => {
      console.log('🔔 [PROVIDER] New request received:', data);
      // Vibration gérée dans MissionRequestSheet via expo-haptics
      // On pousse les données vers le layer global — zéro Alert
      showMissionRequest({
        requestId:       data.requestId  ?? data.id,
        service:         data.serviceType ?? data.service ?? data.category,
        distance:        data.distance    ? `${data.distance} km` : undefined,
        estimatedPrice:  data.estimatedPrice ?? data.price,
        clientName:      data.client?.name   ?? data.clientName,
        address:         data.address        ?? data.location?.address,
        scheduledAt:     data.scheduledAt    ?? data.date,
      });
    });

    newSocket.on('request:claimed', (requestId) => {
      console.log(`🚫 [PROVIDER] Request ${requestId} claimed by another`);
      Vibration.vibrate(200);
      clearMissionRequest(); // ferme la sheet si encore visible
      showSocketToast('Mission déjà prise par un autre prestataire.', 'error');
    });

    newSocket.on('request:expired', (requestId) => {
      console.log(`⏰ [PROVIDER] Request ${requestId} expired`);
      clearMissionRequest();
      showSocketToast('Cette mission a expiré.', 'info');
    });

    // Ces deux événements sont gérés dans le ProviderDashboard
    newSocket.on('provider:accept_confirmed', (data) => {
      console.log('✅ [PROVIDER] Accept confirmed:', data);
    });

    newSocket.on('provider:accept_success', (data) => {
      console.log('🚀 [PROVIDER] Mission accepted:', data);
      Vibration.vibrate([0, 50, 100, 50]);
    });

    // ── CLIENT EVENTS ─────────────────────────────────────────────────────────

    newSocket.on('provider:accepted', (data) => {
      console.log('🎉 [CLIENT] Provider accepted request!', data);

      // Ignorer si c'est un provider qui reçoit cet event
      if (user.roles?.includes('PROVIDER')) {
        console.log('⚠️ Ignoring provider:accepted — user is PROVIDER');
        return;
      }

      Vibration.vibrate([0, 100, 50, 100, 50, 100]);

      // Toast discret, puis redirection automatique — pas de popup à fermer
      const providerName = data.provider?.name || 'Un professionnel';
      showSocketToast(`${providerName} est en route vers vous.`, 'success');

      // requestId peut être un number (ex: 157) — on force en string
      const rid = String(data.requestId);
      console.log('📍 Navigating to missionview for requestId:', rid);
      setTimeout(() => {
        router.push({
          pathname: '/request/[id]/missionview',
          params:   { id: rid },
        });
      }, 800);
    });

    newSocket.on('request:published', (data) => {
      console.log('📢 [CLIENT] Request published:', data);
    });

    // ── SHARED EVENTS ─────────────────────────────────────────────────────────

    // location_update est géré localement dans MissionView
    newSocket.on('provider:location_update', (data) => {
      console.log('📍 [GPS] Location update:', data);
    });

    newSocket.on('request:completed', (data) => {
      console.log('🏁 [COMPLETION] Request completed:', data);
      Vibration.vibrate([0, 100, 50, 100]);

      if (user.roles?.includes('PROVIDER')) {
        showSocketToast('Mission terminée. Consultez vos gains.', 'success');
        setTimeout(() => router.push({ pathname: '/request/[id]/earnings', params: { id: String(data.requestId) } }), 900);
      } else {
        showSocketToast('Mission terminée. Merci !', 'success');
        setTimeout(() => router.push({ pathname: '/request/[id]/rating', params: { id: String(data.requestId) } }), 900);
      }
    });

    // Désormais géré dans request:completed
    newSocket.on('request:go_to_rating', (data) => {
      console.log('⭐ [RATING] Redirect to rating:', data);
    });

    // ── PAYMENT EVENTS ────────────────────────────────────────────────────────

    newSocket.on('payment:succeeded', (data) => {
      console.log('💳 [PAYMENT] Payment succeeded:', data);
      showSocketToast('Paiement confirmé.', 'success');
    });

    // ── STATUS / MISC ─────────────────────────────────────────────────────────

    newSocket.on('provider:status_update', (data) => {
      console.log('🔄 [STATUS] Provider status update:', data);
    });

    newSocket.on('provider:registered', (data) => {
      console.log('✅ [PROVIDER] Registered successfully:', data);
    });

    // ── ERROR HANDLING ────────────────────────────────────────────────────────

    newSocket.on('error', async (error: any) => {
      console.error('❌ Socket Error:', error);

      if (
        error?.code === 'PROVIDER_NOT_FOUND' ||
        error?.message?.includes('not found') ||
        error?.message?.includes('Invalid provider')
      ) {
        console.warn('⚠️ Invalid provider ID — cleaning AsyncStorage');
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

    // ── CLEANUP ───────────────────────────────────────────────────────────────
    return () => {
      console.log('🧹 Cleaning up socket listeners');

      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.off('reconnect_attempt');
      newSocket.off('reconnect');
      newSocket.off('reconnect_failed');
      newSocket.off('error');

      newSocket.off('new_request');
      newSocket.off('request:claimed');
      newSocket.off('request:expired');
      newSocket.off('provider:accept_confirmed');
      newSocket.off('provider:accept_success');
      newSocket.off('provider:registered');
      newSocket.off('provider:status_update');

      newSocket.off('provider:accepted');
      newSocket.off('request:published');

      newSocket.off('provider:location_update');
      newSocket.off('request:completed');
      newSocket.off('request:go_to_rating');
      newSocket.off('payment:succeeded');

      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?.email, user?.roles]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionStatus }}>
      {children}

      {/* Barre noire animée — visible uniquement si reconnecting/disconnected */}
      <ReconnectionBanner status={connectionStatus} />

      {/* Toasts globaux (paiement, acceptation, erreurs socket…) */}
      <SocketToastLayer />

      {/* Sheet "Nouvelle Mission" — visible uniquement pour les PROVIDERS */}
      <MissionRequestLayer />
    </SocketContext.Provider>
  );
};