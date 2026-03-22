// lib/NetworkContext.tsx
// Détecte l'état réseau avec debounce 15s — ne signale offline
// que si la connexion est réellement perdue depuis 15 secondes.

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const OFFLINE_DELAY_MS = 15_000; // 15 secondes avant de signaler offline

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean | null;
  connectionType: string | null;
  wasOffline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isConnected: true,
  connectionType: null,
  wasOffline: false,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isOnline: true,
    isConnected: true,
    connectionType: null,
    wasOffline: false,
  });

  const prevOnlineRef = useRef(true);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleState = (state: NetInfoState) => {
      const connected = state.isConnected !== false;

      if (connected) {
        // Connexion rétablie — annuler le timer offline s'il existe
        if (offlineTimerRef.current) {
          clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }

        const wasOffline = !prevOnlineRef.current;
        prevOnlineRef.current = true;

        setNetworkState({
          isOnline: true,
          isConnected: state.isConnected,
          connectionType: state.type,
          wasOffline,
        });
      } else {
        // Connexion perdue — attendre 15s avant de signaler offline
        if (!offlineTimerRef.current) {
          offlineTimerRef.current = setTimeout(() => {
            offlineTimerRef.current = null;
            prevOnlineRef.current = false;
            setNetworkState({
              isOnline: false,
              isConnected: false,
              connectionType: state.type,
              wasOffline: false,
            });
          }, OFFLINE_DELAY_MS);
        }
      }
    };

    NetInfo.fetch().then(handleState);
    const unsubscribe = NetInfo.addEventListener(handleState);

    return () => {
      unsubscribe();
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
