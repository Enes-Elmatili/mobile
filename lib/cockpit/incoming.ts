// lib/cockpit/incoming.ts — ce que l'accueil prestataire tire des payloads :
// la fiche d'une demande entrante (file REST ou socket new_request), la file
// sans doublon ni refus, et la mission active à rouvrir. Pur, sans I/O.
import { briefOf, type MissionBrief } from '@/lib/mission/brief';

/** Une demande telle que le serveur l'envoie (REST /requests/incoming ou socket). Tout est optionnel : payloads anciens tolérés. */
export type IncomingPayload = {
  id?: number | string;
  requestId?: number | string;
  title?: string | null;
  serviceType?: string | null;
  category?: { name?: string | null } | null;
  description?: string | null;
  price?: number | null;
  address?: string | null;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  urgent?: boolean | null;
  distance?: number;
  status?: string | null;
  isQuote?: boolean | null;
  pricingMode?: string | null;
  calloutFee?: number | null;
  clientId?: string;
  clientName?: string | null;
  client?: { id?: string; name?: string | null; avatarUrl?: string | null; city?: string | null } | null;
};

export interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  clientId?: string;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
  latitude?: number;
  longitude?: number;
  isQuote?: boolean;
  pricingMode?: string | null;
  calloutFee?: number;
  /** Fiche mission (services/missionBrief) — celle du serveur, sinon le repli. */
  brief: MissionBrief;
  /** La demande telle que reçue : sert d'amorce à la feuille de mission, sans attendre le serveur. */
  raw: IncomingPayload;
}

export type CurrentMission = {
  id: number; serviceType?: string | null; status: string; address?: string | null;
  clientName: string | null; lat: number | null; lng: number | null;
};

/** Une mission de /providers/missions, réduite à ce que la ré-entrée lit. */
export type MissionRow = {
  id: number;
  status: string;
  serviceType?: string | null;
  address?: string | null;
  preferredTimeStart?: string | null;
  lat?: number | null;
  lng?: number | null;
  client?: { name?: string | null } | null;
};

/** Au-delà de 30 min, une mission est « à venir » : pas de ré-entrée, pas de feuille. */
export const SOON_MS = 30 * 60 * 1000;
export const ACTIVE_STATUSES = ['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];

/** Le créneau commence à plus de 30 min (sans créneau, ou date illisible : non). */
export function startsLater(preferredTimeStart: string | null | undefined, now: number): boolean {
  if (!preferredTimeStart) return false;
  return new Date(preferredTimeStart).getTime() > now + SOON_MS;
}

/** Une ligne de la file REST /requests/incoming. */
export function incomingFromQueue(r: IncomingPayload): IncomingRequest {
  return {
    requestId: String(r.id),
    title: r.serviceType || r.category?.name || 'Mission',
    description: r.description || '',
    price: r.price || 0,
    address: r.address || '',
    latitude: r.lat,
    longitude: r.lng,
    urgent: r.urgent || false,
    pricingMode: r.pricingMode,
    isQuote: r.status === 'QUOTE_PENDING',
    calloutFee: r.calloutFee ?? undefined,
    brief: briefOf(r),
    raw: r,
    client: { name: r.client?.name || 'Client' },
  };
}

/** Un new_request du socket ; `t` donne les libellés de repli. */
export function incomingFromSocket(data: IncomingPayload, t: (key: string) => string): IncomingRequest {
  const lat = data.latitude ?? data.lat;
  const lng = data.longitude ?? data.lng;
  return {
    requestId:   String(data.requestId ?? data.id),
    title:       data.title || data.serviceType || t('provider.mission'),
    description: data.description || '',
    price:       data.price ?? 0,
    address:     data.address || t('provider.unknown_address'),
    urgent:      data.urgent || false,
    distance:    data.distance,
    clientId:    data.clientId || data.client?.id,
    client:      { name: data.client?.name || data.clientName || t('provider.client'), avatarUrl: data.client?.avatarUrl || null, city: data.client?.city || null },
    latitude:    lat,
    longitude:   lng,
    isQuote:     data.isQuote || false,
    pricingMode: data.pricingMode || null,
    calloutFee:  data.calloutFee ?? undefined,
    brief:       briefOf(data),
    raw:         data,
  };
}

/** Ajoute à la file ce qu'elle n'a pas déjà et que l'on n'a pas refusé ; même référence si rien de neuf. */
export function mergeQueue(prev: IncomingRequest[], mapped: IncomingRequest[], declined: ReadonlySet<string>): IncomingRequest[] {
  const existingIds = new Set(prev.map(r => r.requestId));
  const newOnes = mapped.filter((r) =>
    !existingIds.has(r.requestId) && !declined.has(r.requestId)
  );
  return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
}

/**
 * La mission à rouvrir : celle du lien profond si elle est active, sinon la
 * première active qui n'est pas planifiée à plus de 30 min.
 */
export function pickActiveMission<M extends MissionRow>(items: M[], wanted: string | null, now: number): M | null | undefined {
  return (wanted ? items.find((r) => String(r.id) === wanted && ACTIVE_STATUSES.includes(r.status)) : null) || items.find((r) => {
    if (!ACTIVE_STATUSES.includes(r.status)) return false;
    if (startsLater(r.preferredTimeStart, now)) return false; // >30 min futur → "à venir"
    return true;
  });
}

/**
 * La mission courante après rechargement. Une mission posée à l'acceptation
 * (optimiste) que la liste ne connaît pas encore reste en place : la retirer
 * ferait clignoter la feuille.
 */
export function reconcileMission(prev: CurrentMission | null, found: MissionRow | null | undefined, items: MissionRow[]): CurrentMission | null {
  if (found) return { id: found.id, serviceType: found.serviceType, status: found.status, address: found.address, clientName: found.client?.name ?? null, lat: found.lat ?? null, lng: found.lng ?? null };
  if (prev && !items.some((r) => Number(r.id) === Number(prev.id))) return prev;
  return null;
}

/** Réponse du serveur à l'acceptation (`data`), complétée par la demande reçue. */
export type AcceptedData = {
  serviceType?: string | null; status?: string; address?: string | null;
  client?: { name?: string | null } | null; lat?: number | null; lng?: number | null;
};

export function missionFromAccept(request: IncomingRequest, d: AcceptedData): CurrentMission {
  return {
    id: Number(request.requestId), serviceType: d.serviceType ?? request.title ?? null, status: d.status ?? 'ACCEPTED',
    address: d.address ?? request.address ?? null, clientName: d.client?.name ?? request.client?.name ?? null,
    lat: d.lat ?? request.latitude ?? null, lng: d.lng ?? request.longitude ?? null,
  };
}

/** Une demande désignée par notification est-elle encore à prendre ? */
export function isStillOpen(r: { status?: string | null; providerId?: unknown } | null | undefined): boolean {
  return (r?.status === 'PUBLISHED' || r?.status === 'QUOTE_PENDING') && !r?.providerId;
}
