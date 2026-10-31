// lib/dashboard/types.ts — la forme minimale des demandes que l'accueil client
// lit. lib/api renvoie `any` : on décrit ici seulement les champs consommés par
// l'écran (GET /client/dashboard, GET /requests/:id, événements socket).

export type DashboardProvider = {
  id: string;
  /** L'id User du prestataire (appel, messagerie) — distinct de `id` (Provider). */
  userId?: string | number | null;
  name?: string;
  avatarUrl?: string | null;
};

export type DashboardRequest = {
  id: string;
  title: string;
  serviceType?: string;
  status: string;
  description?: string;
  price?: number;
  address?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  expiresAt?: string;
  preferredTimeStart?: string | null;
  pricingMode?: string | null;
  calloutFee?: number | null;
  category?: { id: number; name: string; icon?: string; slug?: string | null };
  subcategory?: { id: number; name: string; nameI18n?: Record<string, string | null> | null };
  provider?: DashboardProvider | null;
};

/** Le détail d'une demande (GET /requests/:id) : la ligne du tableau de bord, plus. */
export type RequestDetails = Omit<DashboardRequest, 'provider'> & {
  completedAt?: string | null;
  scheduledFor?: string | null;
  provider?: (DashboardProvider & { lat?: number | null; lng?: number | null }) | null;
};

export interface DashboardData {
  me: { id: string; email: string; name?: string; city?: string; roles: string[] };
  stats: { activeRequests: number; completedRequests: number; totalSpent: number };
  requests: DashboardRequest[];
}

/** Réponse brute de l'API : l'objet, ou l'objet enveloppé dans `data` / `request`. */
export type Envelope<T> = T & { data?: T; request?: T };

/** Ce qu'il faut pour ouvrir le suivi (missionview) d'une demande. */
export type MissionLink = {
  id: string | number;
  title?: string | null;
  serviceType?: string | null;
  name?: string | null;
  address?: string | null;
  price?: number | string | null;
  scheduledFor?: string | null;
  preferredTimeStart?: string | null;
  expiresAt?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

/** Charge utile des événements `request:*` / `provider:accepted`. */
export type RequestSocketPayload = {
  id?: string | number;
  requestId?: string | number;
  clientId?: string;
  status: string;
};
