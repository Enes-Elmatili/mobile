import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ IMPORTANT: Remplacez par l'IP de votre backend
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

  useEffect(() => {
    // Ne connecter que si l'utilisateur est authentifié
    if (!user) {
      if (socket) {
        console.log('🔌 Déconnexion Socket.io (pas d\'utilisateur)');
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    console.log('🔌 Initialisation Socket.io pour user:', user.email);

    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // ✅ MODIFIÉ : polling en premier pour ngrok
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', async () => {
      console.log('✅ Socket.io connecté:', newSocket.id);
      setIsConnected(true);

      // Si l'utilisateur est un PROVIDER, l'enregistrer
      try {
        const providerData = await AsyncStorage.getItem('provider');
        if (providerData) {
          const provider = JSON.parse(providerData);
          console.log('📤 Enregistrement provider avec ID:', provider.id);
          
          // S'enregistrer comme provider
          newSocket.emit('provider:register', {
            providerId: provider.id,
            userId: user.id,
          });
        } else {
          console.log('ℹ️ Utilisateur non-provider (client ou admin)');
        }
      } catch (error) {
        console.error('❌ Erreur récupération providerId:', error);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket.io déconnecté');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erreur connexion Socket.io:', error.message);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.io reconnecté (tentative', attemptNumber, ')');
    });

    // Écouter les nouvelles demandes
    newSocket.on('new_request', (data) => {
      console.log('🔔 Nouvelle demande reçue via Socket.io:', data);
      // TODO: Afficher notification push ou alert
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Nettoyage Socket.io');
      newSocket.disconnect();
    };
  }, [user?.id]); // Reconnecte si l'user change

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
