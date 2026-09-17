// lib/cockpit/stage.ts — l'accueil prestataire est une machine à cinq stades.
// Un seul objet dit l'état (le GO) ; le stade décide ce que la carte, le dock
// et la journée racontent (spec 2026-09-17-provider-cockpit-go).
//   off      : hors ligne — carte éteinte, GO au centre, journée lisible en bas
//   on       : en ligne — carte allumée, stop à gauche, barre « vous êtes en ligne »
//   incoming : une demande est pour vous — la fiche monte, le reste s'efface
//   busy     : mission acceptée en cours — carte mission, pas de stop
//   gps      : localisation refusée — rien n'arrive, carte « Autoriser »
import type { CameraMode } from '@/lib/mission/useMapCamera';

export type CockpitStage = 'off' | 'on' | 'incoming' | 'busy' | 'gps';

export type CockpitFacts = {
  online: boolean;
  gpsDenied?: boolean;
  /** Une demande attend une réponse (première de la file). */
  hasIncoming?: boolean;
  /** Une mission acceptée est active (non planifiée à plus de 30 min). */
  hasMission?: boolean;
};

export function cockpitStageOf(f: CockpitFacts): CockpitStage {
  // La mission en cours prime : on ne se déconnecte pas chez un client, et
  // une nouvelle demande n'a pas à interrompre l'intervention.
  if (f.hasMission) return 'busy';
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
  return stage === 'off' || stage === 'gps' ? 'none' : 'me';
}

/** Le GO est au centre (hors ligne), devient le stop (en ligne), ou disparaît. */
export function goShape(stage: CockpitStage): 'go' | 'stop' | 'hidden' {
  if (stage === 'off') return 'go';
  if (stage === 'on') return 'stop';
  return 'hidden';
}
