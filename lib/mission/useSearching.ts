// lib/mission/useSearching.ts
// Les faits de la recherche : les prestataires proches (endormis), les vagues
// et les refus envoyés par le serveur (request:matching). Partagé par le
// calque de pastilles et la feuille du suivi.
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';

export type Pro = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lat: number | null;
  lng: number | null;
  etaMin: number | null;
  /** 0 = pas encore prévenu (endormi), sinon la vague. */
  wave: number;
  declined: boolean;
};

type WaveEvent = {
  requestId: number | string; kind: 'wave'; round: number;
  providers: { id: string; name: string | null; avatarUrl: string | null; lat: number | null; lng: number | null; distanceKm: number | null; etaMin: number | null }[];
  remaining: number; nextWaveInMs: number | null;
};
type DeclinedEvent = { requestId: number | string; kind: 'declined'; providerId: string };

type Snapshot = {
  requestId: number | string; kind: 'snapshot'; round: number;
  providers: { id: string; name: string | null; avatarUrl: string | null; lat: number | null; lng: number | null; distanceKm: number | null; etaMin: number | null; wave: number; declined: boolean }[];
  remaining: number | null; nextWaveInMs: number | null;
};

/** Le serveur prévient jusqu'à 30 km : les endormis sont cherchés dans le même rayon. */
export const NEARBY_RADIUS_KM = 30;

export function useSearching(missionId: string | number, coord: { latitude: number; longitude: number }, active: boolean) {
  const { socket } = useSocket();
  const [pros, setPros] = useState<Pro[]>([]);
  const [round, setRound] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [nextWaveAt, setNextWaveAt] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());

  // L'état déjà acquis : la première vague part quelques centaines de ms après
  // le paiement, avant que cet écran n'écoute. Le serveur la rejoue depuis son
  // journal (GET /requests/:id/matching).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.get(`/requests/${missionId}/matching`);
        const snap: Snapshot | null = res?.data ?? res ?? null;
        if (cancelled || !snap || !Array.isArray(snap.providers)) return;
        setRound((r) => Math.max(r, snap.round ?? 0));
        if (snap.remaining != null) setRemaining(snap.remaining);
        if (snap.nextWaveInMs != null) setNextWaveAt(Date.now() + snap.nextWaveInMs);
        setPros((cur) => {
          const byId = new Map(cur.map((p) => [p.id, p]));
          for (const p of snap.providers) {
            const prev = byId.get(String(p.id));
            byId.set(String(p.id), {
              id: String(p.id), name: p.name ?? prev?.name ?? null, avatarUrl: p.avatarUrl ?? prev?.avatarUrl ?? null,
              lat: p.lat ?? prev?.lat ?? null, lng: p.lng ?? prev?.lng ?? null, etaMin: p.etaMin ?? prev?.etaMin ?? null,
              wave: Math.max(prev?.wave ?? 0, p.wave || 1), declined: p.declined || prev?.declined || false,
            });
          }
          return Array.from(byId.values());
        });
      } catch (e: any) {
        devError('[useSearching] snapshot failed:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [active, missionId]);

  // Prestataires proches : endormis tant que le serveur ne les a pas prévenus.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.providers.nearby(coord.latitude, coord.longitude, NEARBY_RADIUS_KM);
        const list: Pro[] = (res?.providers ?? [])
          .map((p: any) => ({ id: String(p.id), name: p.name ?? null, avatarUrl: p.avatarUrl ?? null, lat: Number(p.lat), lng: Number(p.lng), etaMin: null, wave: 0, declined: false }))
          .filter((p: Pro) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .slice(0, 8);
        if (!cancelled) {
          // Une vague a pu arriver avant la liste : on garde les éveillés.
          setPros((cur) => {
            const byId = new Map(list.map((p) => [p.id, p]));
            for (const c of cur) byId.set(c.id, { ...(byId.get(c.id) ?? c), ...c });
            return Array.from(byId.values());
          });
        }
      } catch (e: any) {
        devError('[useSearching] nearby providers failed:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [active, coord.latitude, coord.longitude]);

  // Les faits : vagues et refus.
  useEffect(() => {
    if (!socket || !active) return;
    const onMatching = (e: WaveEvent | DeclinedEvent) => {
      if (String(e?.requestId) !== String(missionId)) return;
      if (e.kind === 'wave') {
        setRound((r) => Math.max(r, e.round));
        setRemaining(e.remaining);
        setNextWaveAt(e.nextWaveInMs != null ? Date.now() + e.nextWaveInMs : null);
        setPros((cur) => {
          const byId = new Map(cur.map((p) => [p.id, p]));
          for (const p of e.providers) {
            const prev = byId.get(String(p.id));
            byId.set(String(p.id), {
              id: String(p.id), name: p.name ?? prev?.name ?? null, avatarUrl: p.avatarUrl ?? prev?.avatarUrl ?? null,
              lat: p.lat ?? prev?.lat ?? null, lng: p.lng ?? prev?.lng ?? null, etaMin: p.etaMin ?? prev?.etaMin ?? null,
              wave: Math.max(1, e.round), declined: false,
            });
          }
          return Array.from(byId.values());
        });
      } else if (e.kind === 'declined') {
        setPros((cur) => cur.map((p) => (p.id === String(e.providerId) ? { ...p, declined: true } : p)));
      }
    };
    socket.on('request:matching', onMatching);
    return () => { socket.off('request:matching', onMatching); };
  }, [socket, missionId, active]);

  return { pros, round, remaining, nextWaveAt, startedAt };
}
