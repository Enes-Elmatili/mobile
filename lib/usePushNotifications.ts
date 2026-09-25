import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { api } from './api';
import { tokenStorage } from './storage';
import { devLog, devWarn } from './logger';
import { classifyNotification, navigateToRequestById, navigateToDestination, refundDestination, PROVIDER_HOME, PROVIDER_OPPORTUNITIES } from './requestDestination';
import { isSocketUp } from './socketStatus';

// Au premier plan : un événement du catalogue (data.event) arrive aussi par le
// socket, qui l'affiche depuis l'île avec son action — la bannière système se
// tait pour ne pas doubler. Sans socket, ou pour une notification hors
// catalogue (diffusion admin), la bannière s'affiche : rien ne se perd.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data: any = notification?.request?.content?.data || {};
    const quiet = typeof data.event === 'string' && isSocketUp();
    return {
      shouldShowAlert: !quiet,
      shouldPlaySound: !quiet,
      shouldSetBadge: true,
      shouldShowBanner: !quiet,
      shouldShowList: true,
    };
  },
});

/** Réponses de lancement déjà traitées (évite de rejouer la même navigation). */
const handledLaunchIds = new Set<string>();

/**
 * Demande la permission et synchronise le token Expo Push avec le backend.
 * Se déclenche dès que `userId` est non-null (utilisateur connecté).
 * Se nettoie automatiquement à la déconnexion.
 *
 * @param userId - ID de l'utilisateur connecté, ou null/undefined si déconnecté
 */
export function usePushNotifications(userId?: string | null, isProvider: boolean = false) {
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);
  const roleRef = useRef(isProvider);
  useEffect(() => { roleRef.current = isProvider; }, [isProvider]);

  useEffect(() => {
    if (!userId) return; // Pas d'utilisateur connecté → rien à faire

    registerForPushNotifications();

    // L'app a été LANCÉE par un tap sur une notification (app fermée) : le
    // listener ci-dessous ne reçoit pas cette réponse-là. On la relit ici, une
    // fois par identifiant, quand l'utilisateur est connecté et le routeur monté.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const id = response?.notification?.request?.identifier;
      if (!response || !id || handledLaunchIds.has(id)) return;
      handledLaunchIds.add(id);
      const data = response.notification.request.content.data as any;
      setTimeout(() => { handleNotificationNavigation(data, { isProvider: roleRef.current }); }, 600);
    }).catch(() => {});

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
        handledLaunchIds.add(response.notification.request.identifier);
        handleNotificationNavigation(data, { isProvider: roleRef.current });
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
    // En build EAS production, getExpoPushTokenAsync() doit recevoir le projectId
    // explicitement — sinon la résolution auto échoue et le token n'est pas généré
    // (donc aucune push possible, écran verrouillé ou non).
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    devLog('[Push] Token obtenu:', token);
    await syncTokenWithBackend(token);
  } catch (e: any) {
    // Sur simulateur iOS, getExpoPushTokenAsync() échoue — c'est normal, on ignore.
    devWarn('[Push] Impossible d\'obtenir le token:', e?.message);

    // Sur Android en revanche, il n'existe pas de cas bénin : un échec ici veut dire
    // que FCM n'est pas câblé (google-services.json absent du build, ou clé FCM V1
    // pas uploadée dans les credentials EAS). L'appareil n'aura JAMAIS de push, et
    // rien ne le signalait — devWarn est muet en production. On remonte à Sentry.
    if (Platform.OS === 'android') {
      Sentry.captureException(e, {
        tags: { area: 'push', platform: 'android', cause: 'fcm_not_configured' },
        extra: {
          hint: 'Aucun token FCM : vérifier android.googleServicesFile dans app.json '
            + 'et la clé FCM V1 dans `eas credentials`. Sans ça, zéro push sur Android.',
        },
      });
    }
  }
}

export async function handleNotificationNavigation(data: any, opts: { isProvider?: boolean } = {}) {
  if (!data) return;
  try {
    // ───────────────────────────────────────────────────────────────────────
    // On classe la notif puis on RE-RÉSOUT la destination contre l'état COURANT
    // de la demande (client OU prestataire), jamais sur l'intention figée à la
    // création de la notif. Toute la logique d'état vit dans requestDestination.
    //   → plus de searching view sur une mission annulée, plus de page de
    //     notation ré-ouverte, plus de provider-dashboard en aveugle.
    // ───────────────────────────────────────────────────────────────────────
    const intent = classifyNotification(data, opts);
    switch (intent.kind) {
      case 'support':          router.push('/support'); return;
      case 'kyc':              router.replace('/onboarding/provider/pending'); return;
      case 'opportunity': {
        // La demande désignée : l'accueil (?request=) ou l'agenda (?opportunity=) l'ouvre, ou dit qu'elle est partie.
        const base = intent.home ? PROVIDER_HOME : PROVIDER_OPPORTUNITIES;
        navigateToDestination(intent.requestId ? { ...base, params: { [intent.home ? 'request' : 'opportunity']: intent.requestId } } : base);
        return;
      }
      case 'route':            navigateToDestination(intent.dest); return;
      case 'refund':           navigateToDestination(refundDestination(intent.requestId)); return;
      case 'client-request':   await navigateToRequestById(intent.requestId, { provider: false }); return;
      case 'provider-request': await navigateToRequestById(intent.requestId, { provider: true }); return;
    }

    // Deep-links push restants, sans état de demande (messagerie, onglets).
    const { screen, senderId, requestId } = data;
    switch (screen) {
      case 'Messages':
        if (senderId) router.push({ pathname: '/messages/[userId]', params: { userId: String(senderId) } });
        else router.push('/messages');
        return;
      case 'Documents': // Documents est un onglet client ; le prestataire a ses factures
        if (opts.isProvider) router.push('/invoices');
        else router.push(requestId != null ? { pathname: '/(tabs)/documents', params: { openRequestId: String(requestId) } } : '/(tabs)/documents');
        return;
      case 'Dashboard': router.replace('/(tabs)/dashboard'); return;
      case 'Wallet':    router.push('/(tabs)/wallet'); return;
      case 'Missions':  router.replace('/(tabs)/missions'); return;
      case 'Profile':   router.push('/(tabs)/profile'); return;
      case 'Formules':  router.push('/formules'); return;
      case 'Support':   router.push('/support'); return;
    }

    // Fallback : écran d'info sûr, jamais l'écran opérationnel.
    router.replace('/(tabs)/dashboard');
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
