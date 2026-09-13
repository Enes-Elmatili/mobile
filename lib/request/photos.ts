// lib/request/photos.ts
// Logique pure des photos guidées : quelles prises pour une prestation, ce
// qui manque, la file de l'appareil photo, et l'envoi au serveur après la
// création de la demande. Testé dans __tests__/photos.test.js.
import { GENERIC_SHOTS, PHOTO_GUIDES, type ShotSpec } from '@/constants/photoGuides';

/** Même limite que le serveur (POST /requests/:id/photos). */
export const MAX_PHOTOS = 6;

/** Une photo prise localement, avant envoi. `key` null = photo libre. */
export type LocalShot = { key: string | null; uri: string; width: number; height: number };

/** Un élément de la file de l'appareil photo. */
export type ShotQueueItem = { key: string | null; required: boolean };

export function shotsFor(subcategorySlug: string | null | undefined): ShotSpec[] {
  if (!subcategorySlug) return GENERIC_SHOTS;
  return PHOTO_GUIDES[subcategorySlug] ?? GENERIC_SHOTS;
}

export function hasShot(shots: LocalShot[], key: string): boolean {
  return shots.some((s) => s.key === key);
}

/** Prises requises par la prestation sans photo prise. */
export function missingRequiredShots(shots: LocalShot[], specs: ShotSpec[]): ShotSpec[] {
  return specs.filter((s) => s.required && !hasShot(shots, s.key));
}

/**
 * File de l'appareil photo quand on touche une tuile : la prise touchée en
 * tête (même déjà faite : c'est une reprise), puis, dans l'ordre du guide,
 * toutes celles qui n'ont pas encore de photo. Tuile « + » (fromKey null) :
 * une seule photo libre.
 */
export function nextQueue(specs: ShotSpec[], shots: LocalShot[], fromKey: string | null): ShotQueueItem[] {
  if (fromKey === null) return [{ key: null, required: false }];
  const start = Math.max(0, specs.findIndex((s) => s.key === fromKey));
  const ordered = [...specs.slice(start), ...specs.slice(0, start)];
  const out: ShotQueueItem[] = [];
  for (const s of ordered) {
    if (s.key === fromKey || !hasShot(shots, s.key)) out.push({ key: s.key, required: s.required });
  }
  return out;
}

/** Remplace la photo d'une prise (ou ajoute une photo libre). */
export function mergeShots(current: LocalShot[], taken: LocalShot[]): LocalShot[] {
  let next = [...current];
  for (const t of taken) {
    if (t.key !== null) next = next.filter((s) => s.key !== t.key);
    next.push(t);
  }
  return next.slice(0, MAX_PHOTOS);
}

type Uploader = (requestId: number | string, form: FormData) => Promise<unknown>;

/**
 * Envoie les photos une par une (un nouvel essai chacune). Un échec ne bloque
 * pas la demande : l'appelant avertit et continue.
 */
export async function uploadRequestPhotos(
  requestId: number | string,
  shots: LocalShot[],
  upload: Uploader,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const shot of shots) {
    const form = new FormData();
    form.append('photo', { uri: shot.uri, name: `${shot.key ?? 'photo'}.jpg`, type: 'image/jpeg' } as unknown as Blob);
    if (shot.key) form.append('shotKey', shot.key);
    form.append('width', String(shot.width));
    form.append('height', String(shot.height));
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try { await upload(requestId, form); ok = true; } catch { /* nouvel essai */ }
    }
    if (ok) sent++; else failed++;
  }
  return { sent, failed };
}
