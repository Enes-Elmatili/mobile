// lib/mission/route.ts
// Itinéraire du prestataire vers l'adresse : polyline Google décodée, ETA
// Directions (clé publique) avec repli sur la distance à vol d'oiseau.
import { etaMinutes } from './brief';
import { metersBetween } from './stage';

export type LatLng = { latitude: number; longitude: number };

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return metersBetween(a.latitude, a.longitude, b.latitude, b.longitude) / 1000;
}

/** Minutes et tracé depuis Google Directions ; sans clé ou en erreur, repli sur la distance (~20 km/h). */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<{ etaMin: number; coords: LatLng[] }> {
  const fallback = { etaMin: etaMinutes(distanceKm(from, to)) ?? 1, coords: [] as LatLng[] };
  if (!GOOGLE_MAPS_API_KEY) return fallback;
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const leg = data?.routes?.[0]?.legs?.[0];
    if (data?.status !== 'OK' || !leg) return fallback;
    const seconds = Number(leg.duration?.value);
    const encoded = data.routes[0].overview_polyline?.points;
    return { etaMin: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : fallback.etaMin, coords: encoded ? decodePolyline(encoded) : [] };
  } catch {
    return fallback;
  }
}
