// lib/cockpit/stage.ts — l'accueil prestataire est une machine à six stades.
// Un seul objet dit l'état (le disque détaché de la barre : GO · stop · flèche,
// stores/nav.providerDisc) ; le stade décide ce que la carte, l'étiquette
// d'état et la journée racontent (spec 2026-09-17-provider-cockpit-go).
//   off      : hors ligne — carte éteinte, GO dans le disque, journée lisible en bas
//   on       : en ligne — carte allumée, stop dans le disque, « vous êtes en ligne » en haut
//   incoming : une demande est pour vous — la fiche monte, le reste s'efface
//   busy     : mission acceptée en cours — flèche ambre dans le disque
//   gps      : localisation refusée — rien n'arrive, carte « Autoriser »
//   net      : pas de réseau — le serveur ne nous entend pas, on le dit
import type { CameraMode } from '@/lib/mission/useMapCamera';

export type CockpitStage = 'off' | 'on' | 'incoming' | 'busy' | 'gps' | 'net';

export type CockpitFacts = {
  online: boolean;
  gpsDenied?: boolean;
  /** Pas de connexion réseau : rien ne part, rien n'arrive. */
  noNetwork?: boolean;
  /** Une demande attend une réponse (première de la file). */
  hasIncoming?: boolean;
  /** Une mission acceptée est active (non planifiée à plus de 30 min). */
  hasMission?: boolean;
};

export function cockpitStageOf(f: CockpitFacts): CockpitStage {
  // La mission en cours prime : on ne se déconnecte pas chez un client, et
  // une nouvelle demande n'a pas à interrompre l'intervention.
  if (f.hasMission) return 'busy';
  if (f.noNetwork) return 'net';
  if (f.gpsDenied) return 'gps';
  if (!f.online) return 'off';
  if (f.hasIncoming) return 'incoming';
  return 'on';
}

/**
 * Ce que la caméra cadre à chaque stade (useMapCamera, avec `door` = moi) :
 * en ligne, moi seul ; une demande ou une mission, moi et elle dans le même
 * cadre (`other`). Hors ligne ou sans GPS, la carte ne bouge pas.
 */
export function cockpitCameraMode(stage: CockpitStage): CameraMode {
  return stage === 'off' || stage === 'gps' || stage === 'net' ? 'none' : 'me';
}
