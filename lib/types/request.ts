// lib/types/request.ts
// La demande (Request côté Prisma) : créée par le client, prise en charge par
// un prestataire. Côté prestataire, « mission ».
import type { MissionBrief, BriefPhoto } from '@/lib/mission/brief';
import type { ISODateString } from './common';

/**
 * Statuts serveur connus (lib/mission/stage.ts, lib/agenda/model.ts).
 * Le serveur peut en ajouter : `stageOf` retombe alors sur « terminal ».
 */
export type RequestStatus =
  | 'PUBLISHED'
  | 'PENDING_PAYMENT'
  | 'ACCEPTED'
  | 'ONGOING'
  | 'DONE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'QUOTE_PENDING'
  | 'QUOTE_SENT'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REFUSED'
  | 'QUOTE_EXPIRED';

/** Mode de tarification d'une prestation (lib/services/serviceSelection.ts). */
export type PricingMode = 'fixed_forfait' | 'estimate' | 'diagnostic' | 'free' | (string & {});

export interface Category {
  id: number;
  name: string;
  slug?: string | null;
  icon?: string | null;
  description?: string | null;
  /** Prix indicatif de la catégorie, en euros. */
  price?: number | null;
  subcategories?: Subcategory[] | null;
}

export interface Subcategory {
  id: number;
  categoryId?: number;
  name: string;
  slug?: string | null;
  nameI18n?: Record<string, string> | null;
  description?: string | null;
  pricingMode?: PricingMode | null;
  /** Prix de base, en euros. */
  basePrice?: number | null;
  /** Prix, en euros (ancien champ, repli de basePrice). */
  price?: number | null;
  /**
   * Frais de déplacement du catalogue, en EUROS (le stepper l'affiche avec
   * formatEUR) — à la différence de ServiceRequest.calloutFee, en centimes.
   */
  calloutFee?: number | null;
  durationMinutes?: number | null;
}

/** Personne liée à une demande (client ou prestataire), vue partielle. */
export interface RequestParty {
  id?: string;
  /** Compte utilisateur du prestataire (appel, messagerie) — `id` est la ligne Provider. */
  userId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  language?: string | null;
  avgRating?: number | null;
  jobsCompleted?: number | null;
  lat?: number | null;
  lng?: number | null;
  /** Statut de validation du prestataire ('ACTIVE' = vérifié). */
  validationStatus?: string | null;
  /** Compte lié (anciens payloads : le nom du prestataire vit ici). */
  user?: { name?: string | null; email?: string | null } | null;
}

/**
 * Une demande telle que la renvoient /requests, /requests/:id et
 * /providers/missions. Seuls `id` et `status` sont garantis : le reste dépend
 * de la route et de l'âge du payload (d'où `brief`, la fiche normalisée).
 */
export interface ServiceRequest {
  id: number;
  status: RequestStatus | (string & {});
  serviceType?: string | null;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  urgent?: boolean;
  /** Prix annoncé, en euros (affiché avec formatEUR). Parfois sérialisé en chaîne (Decimal). */
  price?: number | null;
  /** Prix estimé, en euros (ancien champ). */
  estimatedPrice?: number | null;
  /** Frais de déplacement, en centimes (affichés avec formatEURCents). */
  calloutFee?: number | null;
  pricingMode?: PricingMode | null;
  preferredTimeStart?: ISODateString | null;
  /** Anciens noms du créneau, lus en repli de preferredTimeStart. */
  scheduledAt?: ISODateString | null;
  scheduledFor?: ISODateString | null;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  acceptedAt?: ISODateString | null;
  startedAt?: ISODateString | null;
  completedAt?: ISODateString | null;
  categoryId?: number | null;
  subcategoryId?: number | null;
  clientId?: string;
  providerId?: string | null;
  category?: Category | null;
  subcategory?: Subcategory | null;
  client?: RequestParty | null;
  provider?: RequestParty | null;
  photos?: BriefPhoto[];
  beforePhotoUrl?: string | null;
  beforePhotoAt?: ISODateString | null;
  afterPhotoUrl?: string | null;
  afterPhotoAt?: ISODateString | null;
  /** Une note a déjà été laissée par le client. */
  reviewExists?: boolean;
  /** Code d'arrivée à donner au prestataire (vu par le client seulement). */
  pinCode?: string | number | null;
  /** Le code d'arrivée a été vérifié (mission démarrée). */
  pinVerified?: boolean;
  /** Commission de la plateforme, fraction 0..1 (0.2 = 20 %). */
  commissionRate?: number | null;
  /** Fiche mission normalisée par le serveur (absente des anciens payloads). */
  brief?: MissionBrief;
}

/** GET /providers/missions — missions actives du prestataire. */
export type ProviderMissionsResponse = { items?: ServiceRequest[] };
