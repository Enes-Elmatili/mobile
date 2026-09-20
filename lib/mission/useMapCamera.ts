// lib/mission/useMapCamera.ts — un seul endroit pour piloter la caméra du suivi.
// Le stade dit ce que la carte doit montrer ; la feuille dit ce qu'elle cache.
//   search : l'adresse et les prestataires les plus proches (calque de recherche)
//   follow : le prestataire et la porte, recadrés à chaque position
//   me     : moi (prestataire) et la porte du client
//   door   : la porte, de près (arrivée)
//   band   : la porte, dans un bandeau
//   none   : rien à faire (carte effacée)
import { useEffect } from 'react';
import type MapView from 'react-native-maps';
import { MOTION } from '@/lib/motion/springs';
import { metersBetween } from './stage';
import type { LatLng } from './route';

export type CameraMode = 'search' | 'follow' | 'me' | 'door' | 'band' | 'none';

type Args = {
  mapRef: React.RefObject<MapView | null>;
  ready: boolean;
  mode: CameraMode;
  door: LatLng;
  other?: LatLng | null;
  /** Autres points à garder à l'écran (recherche : prestataires proches). */
  others?: LatLng[];
  /** Hauteur de la feuille (px) : la caméra cadre au-dessus. */
  sheetHeight: number;
  topInset: number;
  reduced: boolean;
  /** Ne recadre pas au-delà de cette distance (mètres) : évite le dézoom sur le monde. */
  maxSpanM?: number;
  /** Hauteur de la carte (px) : les modes centrés (porte, bande) décalent leur centre pour
   *  que le point tombe au milieu de la zone VISIBLE, entre le haut et la feuille. */
  viewportHeight?: number;
};

// La durée n'est qu'une approximation du ressort « recentrage » : MapView
// n'accepte pas de ressort, on lui donne son temps de réponse (~350 ms).
const MS = Math.round(1000 * (2 * Math.PI) / Math.sqrt(MOTION.recenter.stiffness) * 0.65);

export function useMapCamera({ mapRef, ready, mode, door, other, others = [], sheetHeight, topInset, reduced, maxSpanM = 40_000, viewportHeight }: Args) {
  const otherKey = other ? `${other.latitude.toFixed(4)},${other.longitude.toFixed(4)}` : '';
  const othersKey = others.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || mode === 'none') return;
    const dur = reduced ? 0 : MS;
    const pad = { top: topInset + 90, right: 60, bottom: sheetHeight + 60, left: 60 };
    const within = (p: LatLng) => metersBetween(p.latitude, p.longitude, door.latitude, door.longitude) <= maxSpanM;
    // Centre visible : au milieu de ce qui reste entre le haut et la feuille.
    const centered = (delta: number) => {
      const shift = viewportHeight ? delta * ((pad.bottom - pad.top) / 2) / viewportHeight : 0;
      return { latitude: door.latitude - shift, longitude: door.longitude, latitudeDelta: delta, longitudeDelta: delta };
    };
    if (mode === 'door') { map.animateToRegion(centered(0.004), dur); return; }
    if (mode === 'band') { map.animateToRegion(centered(0.006), dur); return; }
    if (mode === 'search') {
      const near = others.filter(within).map((p) => ({ ...p, d: metersBetween(p.latitude, p.longitude, door.latitude, door.longitude) })).sort((a, b) => a.d - b.d).slice(0, 4);
      if (near.length) map.fitToCoordinates([door, ...near], { edgePadding: { top: pad.top, right: pad.right, bottom: 60, left: pad.left }, animated: !reduced });
      else map.animateToRegion({ ...door, latitudeDelta: 0.014, longitudeDelta: 0.014 }, dur);
      return;
    }
    // follow / me
    if (other && within(other)) map.fitToCoordinates([other, door], { edgePadding: pad, animated: !reduced });
    else map.animateToRegion({ ...door, latitudeDelta: 0.015, longitudeDelta: 0.015 }, dur);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les clés résument les points
  }, [mapRef, ready, mode, door.latitude, door.longitude, otherKey, othersKey, sheetHeight, topInset, reduced, maxSpanM, viewportHeight]);
}
