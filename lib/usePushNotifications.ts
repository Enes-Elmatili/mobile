import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';
import { tokenStorage } from './storage';
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
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);

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
  // Android : canaux de notification requis pour réveiller l'écran verrouillé
  if (Platform.OS === 'android') {
    // Canal standard (paiements, messages, devis)
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications FIXED',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    // Canal urgent (nouvelles missions prestataire, alertes critiques)
    // bypassDnd permet de sonner même en mode Ne pas déranger.
    await Notifications.setNotificationChannelAsync('missions', {
      name: 'Missions urgentes',
      description: 'Alertes pour les nouvelles missions et opportunités',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FFFFFF',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      bypassDnd: true,
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
  const { screen, type, requestId } = data;
  try {
    // Handle by explicit screen name first
    switch (screen) {
      case 'MissionView':
        router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } });
        return;
      case 'QuoteReview':
        router.push({ pathname: '/request/[id]/quote-review', params: { id: requestId } });
        return;
      case 'Rating':
        router.push({ pathname: '/request/[id]/rating', params: { id: requestId } });
        return;
      case 'Messages':
        router.push('/(tabs)/messages');
        return;
      case 'Dashboard':
        router.replace('/(tabs)/dashboard');
        return;
    }

    // Handle by notification type (from matching/backend push)
    switch (type) {
      case 'new_request':
        // Provider received a new mission → go to provider dashboard (not client missionview)
        router.replace('/(tabs)/provider-dashboard');
        return;
      case 'quote_received':
        if (requestId) router.push({ pathname: '/request/[id]/quote-review', params: { id: requestId } });
        return;
      case 'quote_accepted':
      case 'quote_refused':
        if (requestId) router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } });
        return;
      case 'kyc_status':
        router.replace('/onboarding/provider/pending');
        return;
    }

    // Fallback: if we have a requestId but no type/screen, go to missionview
    if (requestId) {
      router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } });
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
      setTimeout(async () => {
        // Bail if the user logged out between attempts — otherwise the retry
        // will hit the backend with no auth and trigger the "Session expirée"
        // alert from api.ts on what was intentional logout.
        const stillAuthed = await tokenStorage.getToken();
        if (!stillAuthed) return;
        syncTokenWithBackend(token, attempt + 1);
      }, attempt * 2000);
    }
  }
}
