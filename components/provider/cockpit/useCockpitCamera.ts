/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useCockpitCamera.ts — la caméra de l'accueil
// (moi ; moi + la demande ; moi + la porte) et l'itinéraire vers la cible,
// dessiné point par point, qui donne aussi l'ETA de la mission.
import { useState, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type MapView from 'react-native-maps';
import { useMapCamera } from '@/lib/mission/useMapCamera';
import { fetchRoute, type LatLng } from '@/lib/mission/route';
import { metersBetween } from '@/lib/mission/stage';
import { cockpitCameraMode, type CockpitStage } from '@/lib/cockpit/stage';
import { extraCoverOf, routeKeyOf } from '@/lib/cockpit/framing';
import type { CurrentMission, IncomingRequest } from '@/lib/cockpit/incoming';
import type { MissionFacts } from '@/components/provider/MissionFlow';

export const BRUSSELS: LatLng = { latitude: 50.8466, longitude: 4.3528 };

type Args = {
  mapRef: RefObject<MapView | null>;
  mapReady: boolean;
  stage: CockpitStage;
  activeJob: IncomingRequest | null;
  currentMission: CurrentMission | null;
  location: LatLng | null;
  missionFacts: MissionFacts | null;
  /** Couvert par la journée en bas (cockpitGeometry.mapPaddingBottom). */
  stripCover: number;
  mapPaddingTop: number;
  windowHeight: number;
  reduced: boolean;
  setEtaMin: Dispatch<SetStateAction<number | null>>;
  /** Duo déplié : la fiche ou la mission occupent la page droite, à côté de la carte — rien ne la couvre en bas. */
  sidePanel?: boolean;
};

export function useCockpitCamera({ mapRef, mapReady, stage, activeJob, currentMission, location, missionFacts, stripCover, mapPaddingTop, windowHeight, reduced, setEtaMin, sidePanel = false }: Args) {
  // ─── La caméra : moi ; moi + la demande ; moi + la porte ─────────────────
  // Coordonnées lues hors mémo : chaque point ne dépend que d'elles, pas de tout l'objet.
  const jobLat = activeJob?.latitude, jobLng = activeJob?.longitude;
  const doorLat = currentMission?.lat, doorLng = currentMission?.lng;
  const jobCoord = useMemo<LatLng | null>(() => (jobLat && jobLng ? { latitude: jobLat, longitude: jobLng } : null), [jobLat, jobLng]);
  const doorCoord = useMemo<LatLng | null>(() => (doorLat != null && doorLng != null ? { latitude: doorLat, longitude: doorLng } : null), [doorLat, doorLng]);
  const other = stage === 'incoming' ? jobCoord : stage === 'busy' ? doorCoord : null;
  // La caméra ne suit « moi » que par pas de 25 m : une position qui tremble
  // sur place ne relance pas un recadrage toutes les 3 s.
  const [camDoor, setCamDoor] = useState<LatLng | null>(null);
  // Ajusté au rendu : ne bouge qu'au-delà de 25 m (ou à la première position).
  if (location && (!camDoor || metersBetween(camDoor.latitude, camDoor.longitude, location.latitude, location.longitude) > 25)) {
    setCamDoor(location);
  }
  // Le rembourrage du cadrage est donné à la caméra (edgePadding), pas à la
  // MapView : Apple Maps ignore `mapPadding` pour cadrer, et un padding qui
  // saute fait sauter la carte. La journée en bas est toujours couverte ; la
  // fiche « elle est pour vous » ou la feuille de mission s'ajoutent en marge.
  const extraCover = sidePanel ? 0 : extraCoverOf(stage, windowHeight, stripCover, missionFacts ? missionFacts.sheetHeight : null);
  // En mission, la feuille décide : moi + la porte en route, la bande serrée sur place, rien pendant l'intervention.
  const missionCam = stage === 'busy' && missionFacts ? missionFacts.mapMode : null;
  const camMode = missionCam ?? cockpitCameraMode(stage);
  const camAnchor = missionCam === 'band' && doorCoord ? doorCoord : (camDoor ?? BRUSSELS);
  const camOther = missionCam === 'band' ? camDoor : other;
  useMapCamera({ mapRef, ready: mapReady && !!camDoor, mode: camMode, door: camAnchor, other: camOther, sheetHeight: stripCover + extraCover, topInset: mapPaddingTop, reduced, viewportHeight: windowHeight });

  // ─── Itinéraire vers la demande ou la porte, dessiné point par point ─────
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const routeTarget = other;
  const routeKey = routeKeyOf(routeTarget);
  const lastRouteFetch = useRef(0);
  useEffect(() => {
    if (!camDoor || !routeTarget) { setRouteCoords([]); return; }
    const t0 = Date.now();
    if (routeCoords.length && t0 - lastRouteFetch.current < 30_000) return;
    lastRouteFetch.current = t0;
    let cancelled = false;
    fetchRoute(camDoor, routeTarget).then((r) => { if (cancelled) return; setEtaMin(r.etaMin); if (r.coords.length) setRouteCoords(r.coords); }).catch(() => {});
    return () => { cancelled = true; };
  }, [routeKey, camDoor?.latitude, camDoor?.longitude]);

  return { doorCoord, routeCoords };
}
