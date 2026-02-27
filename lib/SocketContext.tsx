/* eslint-disable react-hooks/exhaustive-deps */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Alert, Vibration } from 'react-native';
import Constants from 'expo-constants';

const SOCKET_URL = Constants.expoConfig?.extra?.socketUrl;
if (!SOCKET_URL) {
  throw new Error(
    'Socket URL is not configured. Set "socketUrl" in app.json extra or provide EXPO_PUBLIC_SOCKET_URL.'
  );
}

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
        console.log('👋 User logged out, disconnecting socket');
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    console.log('🔌 Initializing socket for user:', user.email, 'Role:', user.roles);

    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      query: {
        userId: user.id, // ✅ Envoi automatique du userId pour rejoindre la room
      },
      extraHeaders: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    // ============================================================================
    // ÉVÉNEMENTS DE CONNEXION
    // ============================================================================
    newSocket.on('connect', async () => {
      console.log('✅ Socket connected:', newSocket.id);
      console.log('👤 User will auto-join room: user:' + user.id);
      setIsConnected(true);

      // 🔧 Si l'utilisateur est PROVIDER, l'enregistrer
      if (user.roles?.includes('PROVIDER')) {
        try {
          const providerData = await AsyncStorage.getItem('provider');
          
          if (providerData) {
            const provider = JSON.parse(providerData);
            const providerId = provider.id || provider._id || provider.providerId || user.id;
            
            console.log('📝 Registering provider with ID:', providerId);
            
            newSocket.emit('provider:register', {
              providerId: providerId,
              userId: user.id,
            });
          } else {
            // Fallback: utiliser le user.id comme providerId
            console.log('📝 No stored provider data, using user.id:', user.id);
            newSocket.emit('provider:register', {
              providerId: user.id,
              userId: user.id,
            });
          }
        } catch (error) {
          console.error('❌ Error reading provider data:', error);
        }
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnection attempt ${attempt}`);
    });

    newSocket.on('reconnect', () => {
      console.log('✅ Socket reconnected');
      setIsConnected(true);
    });

    // ============================================================================
    // PROVIDER EVENTS
    // ============================================================================
    
    // 1️⃣ PROVIDER: Receive new request
    newSocket.on('new_request', (data) => {
      console.log('🔔 [PROVIDER] New request received:', data);
      Vibration.vibrate([0, 100, 50, 100]); // Vibration pattern
    });

    // 2️⃣ PROVIDER: Request was claimed by another provider
    newSocket.on('request:claimed', (requestId) => {
      console.log(`🚫 [PROVIDER] Request ${requestId} claimed by another provider`);
      Vibration.vibrate(200);
    });

    // 3️⃣ PROVIDER: Request expired (no one accepted)
    newSocket.on('request:expired', (requestId) => {
      console.log(`⏰ [PROVIDER] Request ${requestId} expired`);
    });

    // 4️⃣ PROVIDER: Your acceptance was confirmed
    newSocket.on('provider:accept_confirmed', (data) => {
      console.log('✅ [PROVIDER] Accept confirmed by server:', data);
      // Provider dashboard gère déjà la navigation
    });

    // 5️⃣ PROVIDER: Successfully accepted (alternative event)
    newSocket.on('provider:accept_success', (data) => {
      console.log('🚀 [PROVIDER] Mission accepted successfully!', data);
      Vibration.vibrate([0, 50, 100, 50]);
      // Provider dashboard gère déjà l'alerte et la navigation
    });

    // ============================================================================
    // CLIENT EVENTS
    // ============================================================================
    
    // 1️⃣ CLIENT: Provider accepted your request
    newSocket.on('provider:accepted', (data) => {
      console.log('🎉 [CLIENT] Provider accepted your request!', data);
      
      // Vérifier que c'est bien un client (pas un provider)
      if (user.roles?.includes('PROVIDER')) {
        console.log('⚠️ Ignoring provider:accepted because user is a PROVIDER');
        return;
      }

      Vibration.vibrate([0, 100, 50, 100, 50, 100]);
      
      Alert.alert(
        '✅ Mission acceptée !',
        `${data.provider?.name || 'Un professionnel'} a accepté votre demande et arrive bientôt.\n\n📞 ${data.provider?.phone || ''}`,
        [
          {
            text: 'Suivre en temps réel',
            onPress: () => {
              console.log('📍 Navigating to tracking for request:', data.requestId);
              router.push(`/request/${data.requestId}/tracking`);
            }
          },
          {
            text: 'Plus tard',
            style: 'cancel'
          }
        ]
      );
    });

    // 2️⃣ CLIENT: Request was published successfully
    newSocket.on('request:published', (data) => {
      console.log('📢 [CLIENT] Request published:', data);
    });

    // ============================================================================
    // SHARED EVENTS (CLIENT & PROVIDER)
    // ============================================================================
    
    // 1️⃣ TRACKING: Provider location update
    newSocket.on('provider:location_update', (data) => {
      console.log('📍 [GPS] Provider location update:', data);
      // TODO: Update map marker position in tracking screen
    });

    // 2️⃣ COMPLETION: Request marked as completed
    newSocket.on('request:completed', (data) => {
      console.log('🏁 [COMPLETION] Request completed:', data);
      
      Vibration.vibrate([0, 100, 50, 100]);
      
      // Different flow for client vs provider
      if (user.roles?.includes('PROVIDER')) {
        // Provider sees earnings
        Alert.alert(
          '🏁 Mission terminée',
          'Bravo ! Consultez vos gains.',
          [
            {
              text: 'Voir mes gains',
              onPress: () => router.push(`/request/${data.requestId}/earnings`)
            }
          ]
        );
      } else {
        // Client goes to rating
        Alert.alert(
          '🏁 Mission terminée',
          'Merci d\'évaluer le service reçu.',
          [
            {
              text: 'Évaluer',
              onPress: () => router.push(`/request/${data.requestId}/rating`)
            },
            {
              text: 'Plus tard',
              style: 'cancel',
              onPress: () => router.push('/(tabs)/dashboard')
            }
          ]
        );
      }
    });

    // 3️⃣ RATING: Go to rating screen (deprecated - handled in request:completed)
    newSocket.on('request:go_to_rating', (data) => {
      console.log('⭐ [RATING] Redirect to rating:', data);
      // This is now handled in request:completed above
    });

    // ============================================================================
    // PAYMENT EVENTS
    // ============================================================================
    
    newSocket.on('payment:succeeded', (data) => {
      console.log('💳 [PAYMENT] Payment succeeded:', data);
    });

    // ============================================================================
    // STATUS UPDATES
    // ============================================================================
    
    newSocket.on('provider:status_update', (data) => {
      console.log('🔄 [STATUS] Provider status update:', data);
    });

    newSocket.on('provider:registered', (data) => {
      console.log('✅ [PROVIDER] Registered successfully:', data);
    });

    // ============================================================================
    // ERROR HANDLING
    // ============================================================================
    
    newSocket.on('error', async (error: any) => {
      console.error('❌ Socket Error:', error);
      
      // Gestion des erreurs provider
      if (error?.code === 'PROVIDER_NOT_FOUND' || 
          error?.message?.includes('not found') ||
          error?.message?.includes('Invalid provider')) {
        console.warn('⚠️ Invalid provider ID detected. Cleaning up...');
        await AsyncStorage.removeItem('provider');
        
        Alert.alert(
          'Configuration requise',
          'Veuillez réinitialiser votre profil prestataire.',
          [{ text: 'OK' }]
        );
      } else if (error?.code === 'REQUEST_NOT_AVAILABLE') {
        Alert.alert(
          'Mission indisponible',
          'Cette mission a déjà été prise par un autre prestataire.',
          [{ text: 'OK' }]
        );
      } else if (error?.code === 'REQUEST_ALREADY_CLAIMED') {
        Alert.alert(
          'Trop tard',
          'Un autre prestataire a accepté cette mission en premier.',
          [{ text: 'OK' }]
        );
      } else if (error?.message) {
        Alert.alert('Erreur', error.message);
      }
    });

    setSocket(newSocket);

    // ============================================================================
    // CLEANUP
    // ============================================================================
    return () => {
      console.log('🧹 Cleaning up socket listeners');
      
      // Provider events
      newSocket.off('new_request');
      newSocket.off('request:claimed');
      newSocket.off('request:expired');
      newSocket.off('provider:accept_confirmed');
      newSocket.off('provider:accept_success');
      newSocket.off('provider:registered');
      newSocket.off('provider:status_update');
      
      // Client events
      newSocket.off('provider:accepted');
      newSocket.off('request:published');
      
      // Shared events
      newSocket.off('provider:location_update');
      newSocket.off('request:completed');
      newSocket.off('request:go_to_rating');
      newSocket.off('payment:succeeded');
      
      // Connection events
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('error');
      newSocket.off('connect_error');
      newSocket.off('reconnect_attempt');
      newSocket.off('reconnect');
      
      newSocket.disconnect();
    };
  }, [user?.id, user?.email, user?.roles]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};