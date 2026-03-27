import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';
import { devLog, devWarn } from './logger';

// Afficher les notifications même quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Demande la permission et synchronise le token Expo Push avec le backend.
 * Se déclenche dès que `userId` est non-null (utilisateur connecté).
 * Se nettoie automatiquement à la déconnexion.
 *
 * @param userId - ID de l'utilisateur connecté, ou null/undefined si déconnecté
 */
export function usePushNotifications(userId?: string | null) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!userId) return; // Pas d'utilisateur connecté → rien à faire

    registerForPushNotifications();

    // Listener : notification reçue en foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        devLog('[Push] Notification reçue:', notification.request.content.title);
      }
    );

    // Listener : l'utilisateur a appuyé sur la notification → navigation
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        devLog('[Push] Notification tapée:', data);
        handleNotificationNavigation(data);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);
}

async function registerForPushNotifications() {
  // Android : canal de notification requis
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Demander la permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    devWarn('[Push] Permission refusée par l\'utilisateur');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    devLog('[Push] Token obtenu:', token);
    await syncTokenWithBackend(token);
  } catch (e: any) {
    // Sur simulateur iOS, getExpoPushTokenAsync() échoue — c'est normal
    devWarn('[Push] Impossible d\'obtenir le token (simulateur ?):', e?.message);
  }
}

function handleNotificationNavigation(data: any) {
  if (!data) return;
  const { screen, requestId } = data;
  try {
    switch (screen) {
      case 'MissionView':
        router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } });
        break;
      case 'QuoteReview':
        router.push({ pathname: '/request/[id]/quote-review', params: { id: requestId } });
        break;
      case 'Rating':
        router.push({ pathname: '/request/[id]/rating', params: { id: requestId } });
        break;
      case 'Messages':
        router.push('/(tabs)/messages');
        break;
      case 'Dashboard':
        router.replace('/(tabs)/dashboard');
        break;
      default:
        if (requestId) {
          router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } });
        }
    }
  } catch (e: any) {
    devWarn('[Push] Navigation error:', e?.message);
  }
}

async function syncTokenWithBackend(token: string, attempt = 1) {
  try {
    await api.patch('/me/push-token', { pushToken: token });
    devLog('[Push] Token synchronisé avec le backend');
  } catch (e: any) {
    devWarn(`[Push] Échec synchronisation token (tentative ${attempt}):`, e?.message);
    if (attempt < 3) {
      setTimeout(() => syncTokenWithBackend(token, attempt + 1), attempt * 2000);
    }
  }
}
