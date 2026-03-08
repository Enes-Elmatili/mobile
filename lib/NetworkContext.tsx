// lib/NetworkContext.tsx
// Détecte l'état réseau en temps réel via @react-native-community/netinfo

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean | null;
  connectionType: string | null;
  wasOffline: boolean; // true si on vient de se reconnecter
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

  useEffect(() => {
    // Lire l'état initial
    NetInfo.fetch().then((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      prevOnlineRef.current = online;
      setNetworkState({
        isOnline: online,
        isConnected: state.isConnected,
        connectionType: state.type,
        wasOffline: false,
      });
    });

    // Écouter les changements
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      const wasOffline = !prevOnlineRef.current && online;

      prevOnlineRef.current = online;

      setNetworkState({
        isOnline: online,
        isConnected: state.isConnected,
        connectionType: state.type,
        wasOffline,
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
