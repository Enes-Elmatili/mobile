// lib/mission/brief.ts
// La fiche mission telle que le serveur l'envoie (services/missionBrief.js),
// et ce qu'il faut pour l'habiller : net, libellés de créneau et d'accès,
// repli depuis un payload ancien (socket en cache, API en cours de déploiement).
export type BriefPhoto = { id: number; url: string; shotKey: string | null; width: number; height: number };

export type MissionBrief = {
  id: number;
  status: string;
  service: {
    id: number | null; name: string | null; nameI18n: Record<string, string> | null; slug: string | null;
    categoryId: number | null; categoryName: string | null; categorySlug: string | null; categoryIcon: string | null;
    pricingMode: string | null; durationMinutes: number | null;
  };
  description: string;
  photos: BriefPhoto[];
  schedule: { at: string | null; urgent: boolean; mode: 'now' | 'slot' };
  place: { address: string | null; lat: number | null; lng: number | null; distanceKm: number | null };
  access: { buildingType: string | null; floor: number | null; hasElevator: boolean | null; notes: string | null } | null;
  client: { name: string | null; language: string | null; avatarUrl: string | null; city: string | null; missionsCount: number | null } | null;
  money: { gross: number | null; net: number | null; calloutFee: number | null; pricingMode: string | null };
  timeline: { createdAt: string | null; acceptedAt: string | null; completedAt: string | null };
  provider: { name: string | null; avatarUrl: string | null; avgRating: number | null; missionsCount: number | null } | null;
};

/** Part du prestataire quand le serveur n'a pas fourni de net (ancienne API). */
export const FALLBACK_NET_RATE = 0.8;

export function isQuoteMode(pricingMode: string | null | undefined): boolean {
  return pricingMode === 'estimate' || pricingMode === 'diagnostic';
}

/** Net affiché : celui du serveur, sinon brut × 0,8 ; null sans brut (devis). */
export function netFor(brief: MissionBrief): number | null {
  if (brief.money.net != null) return brief.money.net;
  if (brief.money.gross == null || brief.money.gross === 0) return null;
  return Math.round(brief.money.gross * FALLBACK_NET_RATE * 100) / 100;
}

/**
 * Repli : construit une fiche à partir d'un item d'API ou d'un payload socket
 * d'avant la fiche (title, price, address, client.name…). Les champs absents
 * restent null et les composants ne les affichent pas.
 */
export function briefFromLegacy(item: any): MissionBrief {
  const price = item?.price != null ? Number(item.price) : (item?.estimatedPrice != null ? Number(item.estimatedPrice) : null);
  const at = item?.preferredTimeStart ?? item?.scheduledFor ?? null;
  const createdAt = item?.createdAt ?? null;
  const mode: 'now' | 'slot' = at && createdAt && Math.abs(new Date(at).getTime() - new Date(createdAt).getTime()) >= 30 * 60 * 1000 ? 'slot' : (at && !createdAt ? 'slot' : 'now');
  const access = {
    buildingType: item?.accessBuildingType ?? null,
    floor: item?.accessFloor ?? null,
    hasElevator: item?.accessHasElevator ?? null,
    notes: item?.accessNotes ?? null,
  };
  const hasAccess = Object.values(access).some((v) => v !== null && v !== '');
  return {
    id: Number(item?.requestId ?? item?.id ?? 0),
    status: item?.status ?? 'PUBLISHED',
    service: {
      id: item?.subcategory?.id ?? item?.subcategoryId ?? null,
      name: item?.subcategory?.name ?? item?.title ?? item?.serviceType ?? item?.category?.name ?? null,
      nameI18n: item?.subcategory?.nameI18n ?? null,
      slug: item?.subcategory?.slug ?? null,
      categoryId: item?.categoryId ?? item?.category?.id ?? null,
      categoryName: item?.category?.name ?? null,
      categorySlug: item?.category?.slug ?? null,
      categoryIcon: item?.category?.icon ?? null,
      pricingMode: item?.pricingMode ?? item?.subcategory?.pricingMode ?? null,
      durationMinutes: item?.subcategory?.durationMinutes ?? null,
    },
    description: item?.description ?? '',
    photos: Array.isArray(item?.photos) ? item.photos : [],
    schedule: { at: at ? new Date(at).toISOString() : null, urgent: !!item?.urgent, mode },
    place: { address: item?.address ?? item?.location?.address ?? null, lat: item?.latitude ?? item?.lat ?? null, lng: item?.longitude ?? item?.lng ?? null, distanceKm: item?.distance != null ? Number(item.distance) : null },
    access: hasAccess ? access : null,
    client: item?.client || item?.clientName
      ? { name: item?.client?.name ?? item?.clientName ?? null, language: item?.client?.language ?? null, avatarUrl: item?.client?.avatarUrl ?? null, city: item?.client?.city ?? null, missionsCount: null }
      : null,
    // Les anciens payloads portent les frais de déplacement en cents (Request.calloutFee).
    money: { gross: price, net: null, calloutFee: item?.calloutFee != null ? Number(item.calloutFee) / 100 : null, pricingMode: item?.pricingMode ?? null },
    timeline: { createdAt, acceptedAt: item?.acceptedAt ?? null, completedAt: item?.completedAt ?? null },
    provider: item?.provider ? { name: item.provider.name ?? null, avatarUrl: item.provider.avatarUrl ?? null, avgRating: item.provider.avgRating ?? null, missionsCount: item.provider.jobsCompleted ?? null } : null,
  };
}

/** Fiche d'un item d'API : celle du serveur si présente, sinon le repli. */
export function briefOf(item: any): MissionBrief {
  return item?.brief ?? briefFromLegacy(item);
}

/** « 3e, ascenseur » / « RDC » / « Maison » — null si rien à dire. */
export function accessLabel(brief: MissionBrief, t: (k: string, o?: any) => string): string | null {
  const a = brief.access;
  if (!a) return null;
  const parts: string[] = [];
  if (a.floor != null) parts.push(a.floor === 0 ? t('ext.missions_ground_floor') : t('mission.floor_short', { n: a.floor }));
  if (a.hasElevator === true) parts.push(t('mission.elevator_short'));
  if (a.hasElevator === false) parts.push(t('mission.no_elevator_short'));
  if (parts.length === 0 && a.buildingType) {
    parts.push(t(`ext.missions_building_${a.buildingType}`));
  }
  return parts.length ? parts.join(', ') : null;
}

/** Durée estimée du trajet à ~20 km/h en ville. */
export function etaMinutes(distanceKm: number | null): number | null {
  if (distanceKm == null) return null;
  return Math.max(1, Math.round(distanceKm * 3));
}

/** « 4,9 » en locale FR/NL, « 4.9 » en EN. */
export function formatRating(r: number | null | undefined): string | null {
  if (r == null || r <= 0) return null;
  return r.toFixed(1);
}
