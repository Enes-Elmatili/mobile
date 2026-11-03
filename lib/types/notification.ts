// lib/types/notification.ts
// La cloche : notifications in-app et préférences d'envoi.
import type { Notif, NotifData, Family } from '@/lib/notifications/model';

export type { Notif as AppNotification, NotifData, Family };

/** GET /notifications — toujours enveloppé dans `data`. */
export type NotificationsResponse = { data?: Notif[] };

/** Préférences par famille + heures calmes (« HH:MM »). */
export interface NotificationPrefs {
  message: boolean;
  money: boolean;
  account: boolean;
  news: boolean;
  quiet: { enabled: boolean; from: string; to: string };
}

/** GET / PATCH /notifications/prefs — enveloppé dans `data`, éventuellement partiel. */
export type NotificationPrefsResponse = { data?: Partial<NotificationPrefs> };
