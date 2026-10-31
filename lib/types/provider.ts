// lib/types/provider.ts
// Le prestataire : profil public, profil propre (/providers/me), pièces KYC,
// quiz métier, avis.
import type { Category } from './request';
import type { ISODateString } from './common';
import type { ProviderValidationStatus } from './user';

/** Disponibilité en temps réel (Prisma ProviderStatus). */
export type ProviderPresence = 'ONLINE' | 'READY' | 'OFFLINE' | 'BUSY' | (string & {});

export type ProviderDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Catégorie telle que portée par un prestataire (vue réduite). */
export type ProviderCategory = Pick<Category, 'id' | 'name'> & Partial<Pick<Category, 'slug' | 'icon'>>;

/** Prestataire vu par un client (liste, fiche, carte). */
export interface ProviderSummary {
  id: string;
  name?: string;
  avatarUrl?: string | null;
  city?: string | null;
  description?: string | null;
  status?: ProviderPresence;
  validationStatus?: ProviderValidationStatus | null;
  avgRating?: number | null;
  totalRatings?: number | null;
  jobsCompleted?: number | null;
  totalRequests?: number;
  acceptedRequests?: number;
  /** Taux d'acceptation, fraction 0..1. */
  acceptanceRate?: number | null;
  /** Temps de réponse moyen, en minutes. */
  avgResponseMin?: number | null;
  responseTimeMinutes?: number | null;
  languages?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  /** Distance au point de recherche, en km (/providers/nearby). */
  distance?: number;
  /** Distance au point de recherche, en km (/providers/available). */
  distanceKm?: number;
  categories?: ProviderCategory[];
  createdAt?: ISODateString;
}

/** Profil propre du prestataire connecté (GET /providers/me → `provider`). */
export interface ProviderProfile extends ProviderSummary {
  userId?: string;
  phone?: string | null;
  /** Numéro BCE/TVA belge enregistré. */
  vatNumber?: string | null;
  /** Posé quand VIES a confirmé le numéro. */
  vatVerifiedAt?: ISODateString | null;
  vatLegalName?: string | null;
  vatAddress?: string | null;
  bankIban?: string | null;
  /** Rayon d'intervention, en km. */
  radius?: number | null;
}

/**
 * GET /providers/me — le profil sous `provider`. Les appelants tolèrent aussi
 * les anciennes formes : sous `data`, `data.provider`, ou à la racine.
 */
export type ProviderMeResponse = Partial<ProviderProfile> & {
  provider?: ProviderProfile;
  data?: ProviderProfile & { provider?: ProviderProfile };
};

/** GET /providers/:id — { success, provider } (anciennes versions : à la racine). */
export type ProviderDetailResponse = Partial<ProviderSummary> & {
  success?: boolean;
  provider?: ProviderSummary;
  data?: ProviderSummary;
};

/** GET /providers/nearby — { success, providers }. */
export type NearbyProvidersResponse = { success?: boolean; providers?: ProviderSummary[]; data?: ProviderSummary[] };

/** Prestataire de GET /providers/available : champs toujours posés par cette route. */
export interface AvailableProvider {
  id: string;
  name: string;
  city: string | null;
  avgRating: number;
  jobsCompleted: number;
  /** Distance au point de recherche, en km. */
  distanceKm: number;
  /** Temps de réponse moyen, en minutes. */
  responseTimeMinutes: number;
  status: string;
  categories: { id: number; name: string; slug: string }[];
}

/** GET /providers/available — { providers }. */
export type AvailableProvidersResponse = { providers?: AvailableProvider[] };

/** GET /providers/:id/availability */
export type ProviderAvailability = { available?: boolean };

/** GET /providers/me/validation-status */
export type ValidationStatusResponse = { providerStatus: ProviderValidationStatus; rejectionReason?: string | null };

/** Pièce KYC déposée. */
export interface ProviderDocument {
  id: string;
  docKey: string;
  categoryId?: number | null;
  fileUrl?: string | null;
  status: ProviderDocStatus;
  rejectionReason?: string | null;
  approvedAt?: ISODateString | null;
  createdAt?: ISODateString | null;
}

/** GET /providers/documents — { documents } (parfois sous `data`). */
export type ProviderDocumentsResponse = { documents?: ProviderDocument[]; data?: ProviderDocument[] };

/** Pièce exigée pour une catégorie (GET /providers/doc-config/:slug). */
export type DocRequirement = { key: string; label: string; mandatory: boolean; mimeTypes?: string[] };
export type DocConfigResponse = { slug?: string; label?: string; requiredDocs?: DocRequirement[]; hasQuiz?: boolean };

/** POST /provider/vat — numéro normalisé, `verified: false` si VIES n'a pas encore confirmé. */
export type VatResponse = { vatNumber?: string; verified?: boolean; vies?: { name?: string | null; address?: string | null } | null };
/** POST /provider/iban — IBAN normalisé. */
export type IbanResponse = { iban?: string };

/** Avis laissé par un client. */
export interface Rating {
  id: string;
  clientId: string;
  /** Note sur 5. */
  rating: number;
  comment?: string;
  createdAt: ISODateString;
  client?: { name?: string; email?: string };
}

/** GET /ratings — tableau, `{ data }` ou `{ reviews }` selon la version. */
export type RatingsResponse =
  | (Rating[] & { data?: undefined; reviews?: undefined })
  | { data?: Rating[]; reviews?: Rating[] };

/** GET /provider/dashboard — chiffres du jour du prestataire. */
export type ProviderDashboardResponse = {
  stats?: {
    /** Gains du jour ; `total` en centimes (affiché via todayCents). */
    todayEarnings?: { total?: number } | null;
  } | null;
};

/** Question du quiz métier (la bonne réponse est masquée côté serveur). */
export type QuizQuestion = { q: string; options: string[] };
/** GET /providers/quiz-config/:slug */
export type QuizConfig = { slug: string; label: string; passMark: number; questions: QuizQuestion[] };
/** POST /providers/quiz/:slug */
export type QuizSubmitResult = { passed: boolean; score: number; total: number; passMark: number; detail?: boolean[] };
