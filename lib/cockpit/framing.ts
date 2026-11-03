// lib/cockpit/framing.ts — le cadrage de la carte de l'accueil prestataire :
// ce que la fiche ou la feuille couvre en plus de la journée, la clé qui
// relance l'itinéraire, la teinte de mon repère. Pur, sans I/O.
import type { CockpitStage } from '@/lib/cockpit/stage';
import type { LatLng } from '@/lib/mission/route';

/** Part de l'écran que couvre la fiche « elle est pour vous ». */
export const INCOMING_COVER_RATIO = 0.55;

/**
 * Ce qui couvre la carte au-delà de la journée (déjà en `stripCover`) : la
 * fiche entrante (55 % de l'écran) ou la feuille de mission (sa hauteur).
 */
export function extraCoverOf(stage: CockpitStage, windowHeight: number, stripCover: number, missionSheetHeight: number | null): number {
  return stage === 'incoming'
    ? Math.max(0, Math.round(windowHeight * INCOMING_COVER_RATIO) - stripCover)
    : stage === 'busy' && missionSheetHeight != null ? Math.max(0, missionSheetHeight - stripCover) : 0;
}

/** Clé de l'itinéraire : la cible arrondie à ~10 m (vide sans cible). */
export function routeKeyOf(target: LatLng | null): string {
  return target ? `${target.latitude.toFixed(4)},${target.longitude.toFixed(4)}` : '';
}

export type MeTone = 'gps' | 'off' | 'on';

/** Mon repère : grisé sans GPS, éteint hors ligne, allumé sinon. */
export function meToneOf(stage: CockpitStage): MeTone {
  return stage === 'gps' ? 'gps' : stage === 'off' ? 'off' : 'on';
}
