import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

const SOCKET_URL = 'https://radiosymmetrical-jeniffer-acquisitively.ngrok-free.dev';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // ---------- ÉVÉNEMENTS DE CONNEXION ----------
    newSocket.on('connect', async () => {
      console.log('✅ Socket connecté:', newSocket.id);
      setIsConnected(true);

      const providerData = await AsyncStorage.getItem('provider');
      if (providerData) {
        const provider = JSON.parse(providerData);
        newSocket.emit('provider:register', {
          providerId: provider.id,
          userId: user.id,
        });
      }
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    // ---------- 1. PHASE DE RECHERCHE (PRESTATAIRE) ----------
    newSocket.on('new_request', (data) => {
      console.log('🔔 [PROVIDER] Nouvelle mission disponible:', data);
      // Optionnel: On peut déclencher une vibration ou un son ici
    });

    newSocket.on('request:claimed', (requestId) => {
      console.log(`🚫 [PROVIDER] Mission ${requestId} prise par un autre.`);
      // Utilisé par le Dashboard pour retirer la carte de la liste
    });

    // ---------- 2. PHASE D'ACCEPTATION (REDIRECTION) ----------
    
    // Pour le Prestataire qui a cliqué sur "Accepter"
    newSocket.on('provider:accept_success', (data) => {
      console.log('🚀 [PROVIDER] Tu as eu la mission ! Redirection...');
      router.replace(`/request/${data.requestId}/ongoing`);
    });

    // Pour le Client dont la demande vient d'être acceptée
    newSocket.on('provider:accepted', (data) => {
      console.log('📱 [CLIENT] Prestataire trouvé ! Redirection...');
      router.replace(`/request/${data.requestId}/ongoing`);
    });

    // ---------- 3. PHASE DE SUIVI (ONGOING) ----------
    
    // Mise à jour de la position GPS du prestataire (pour le client)
    newSocket.on('provider:location_update', (data) => {
      // On peut stocker cela dans un state global ou via DeviceEventEmitter
    });

    // ---------- 4. PHASE DE FIN (COMPLETED) ----------
    
    newSocket.on('request:completed', (data) => {
      console.log('🏁 [TOUS] Mission terminée !');
      // On redirige vers l'écran de succès qui affiche le montant final
      router.replace(`/request/${data.requestId}/completed`);
    });

    // ---------- 5. PHASE DE NOTATION (RATING) ----------
    
    // Si on veut forcer le passage au rating après l'écran completed
    newSocket.on('request:go_to_rating', (data) => {
      router.replace(`/request/${data.requestId}/rating`);
    });

    // ---------- GESTION DES ERREURS ----------
    newSocket.on('error', (error) => {
      console.error('❌ Socket Error:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue avec le serveur de temps réel.');
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Nettoyage global des écouteurs');
      newSocket.off('new_request');
      newSocket.off('provider:accept_success');
      newSocket.off('provider:accepted');
      newSocket.off('request:completed');
      newSocket.off('request:claimed');
      newSocket.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};