import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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
    // Sur simulateur iOS, getExpoPushTokenAsync() échoue — c'est normal
    devWarn('[Push] Impossible d\'obtenir le token (simulateur ?):', e?.message);
  }
}

export function handleNotificationNavigation(data: any) {
  if (!data) return;
  const { screen, type, requestId, category } = data;
  try {
    // ───────────────────────────────────────────────────────────────────────
    // Règle de cohérence : un CTA de notification mène à un écran d'INFO ou
    // d'ACTION (dashboard, factures, devis, note, support, espace prestataire),
    // JAMAIS à l'écran opérationnel de recherche/tracking (missionview). Celui-ci
    // reste réservé aux deep-links push d'une mission EN DIRECT (étape 3).
    // ───────────────────────────────────────────────────────────────────────

    // 1) Notifs in-app : routées par CATÉGORIE (toujours présente sur ces notifs).
    switch (category) {
      case 'mission':         // prestataire trouvé / mission démarrée / terminée / abandon
      case 'mission_update':  // mission annulée / réassignée
      case 'dispute':         // litige (pas d'écran dédié → la mission est sur le dashboard)
        router.replace('/(tabs)/dashboard');
        return;
      case 'rating':
        if (requestId) { router.push({ pathname: '/request/[id]/rating', params: { id: requestId } }); return; }
        router.replace('/(tabs)/dashboard');
        return;
      case 'refund':
        router.push('/(tabs)/documents'); // facture passée en "Remboursé" = la preuve
        return;
      case 'support':
        router.push('/support');
        return;
    }

    // 2) Push sans catégorie : routés par TYPE (cohérents quel que soit le screen).
    switch (type) {
      case 'dispute_opened':
      case 'dispute_resolved':
        router.replace('/(tabs)/dashboard');
        return;
      case 'support_escalation':
        router.push('/support');
        return;
      case 'refund':
        router.push('/(tabs)/documents');
        return;
      case 'quote_received':            // CLIENT : son devis est prêt → écran de revue
        if (requestId) { router.push({ pathname: '/request/[id]/quote-review', params: { id: requestId } }); return; }
        router.replace('/(tabs)/dashboard');
        return;
      case 'quote_accepted':            // PRESTATAIRE : devis accepté/refusé → son espace
      case 'quote_refused':
      case 'new_request':               // PRESTATAIRE : nouvelle mission/opportunité
      case 'new_opportunity':
      case 'preferred_request':
      case 'preferred_opportunity':
        router.replace('/(tabs)/provider-dashboard');
        return;
      case 'kyc_status':                // PRESTATAIRE : statut de validation du dossier
        router.replace('/onboarding/provider/pending');
        return;
    }

    // 3) Deep-link push d'une mission EN DIRECT (prestataire en route, mission
    //    démarrée, abandon) → suivi opérationnel autorisé ici uniquement.
    switch (screen) {
      case 'MissionView':
        if (requestId) { router.push({ pathname: '/request/[id]/missionview', params: { id: requestId } }); return; }
        router.replace('/(tabs)/dashboard');
        return;
      case 'QuoteReview':
        if (requestId) router.push({ pathname: '/request/[id]/quote-review', params: { id: requestId } });
        else router.replace('/(tabs)/dashboard');
        return;
      case 'Rating':
        if (requestId) router.push({ pathname: '/request/[id]/rating', params: { id: requestId } });
        else router.replace('/(tabs)/dashboard');
        return;
      case 'Messages':
        // Deep-link direct dans la conversation si senderId fourni, sinon l'inbox.
        if (data.senderId) router.push({ pathname: '/messages/[userId]', params: { userId: String(data.senderId) } });
        else router.push('/messages');
        return;
      case 'Dashboard':
        router.replace('/(tabs)/dashboard');
        return;
      case 'Documents':
        router.push('/(tabs)/documents');
        return;
    }

    // 4) Fallback : écran d'info sûr, jamais l'écran opérationnel.
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
