/* eslint-disable react-hooks/exhaustive-deps */
// components/provider/cockpit/useCockpitGeo.ts — la position du prestataire
// sur l'accueil et son émission (provider:location_update) : au repos vers le
// matching toutes les 15 s, en mission vers le suivi du client toutes les 10 s.
import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import type { Socket } from 'socket.io-client';
import type { LatLng } from '@/lib/mission/route';
import type { CurrentMission } from '@/lib/cockpit/incoming';

type Args = {
  socket: Socket | null;
  userId: string | undefined;
  networkOnline: boolean;
  currentMissionRef: RefObject<CurrentMission | null>;
  etaRef: RefObject<number | null>;
  isOnlineRef: RefObject<boolean>;
};

// Geolocalisation — démarrée au montage ; si la permission a été refusée,
// on la redemande au retour sur l'écran (l'utilisateur revient des réglages).
// startGeo est créé une fois (deps []) : il lit socket, userId et réseau dans
// des refs tenues à jour. Avant, il gardait ceux du premier rendu — or la
// socket n'existe pas encore à ce moment-là (SocketContext la crée après
// avoir lu le jeton) : la position ne partait jamais, ni vers le matching ni
// vers le suivi du client.
export function useCockpitGeo({ socket, userId, networkOnline, currentMissionRef, etaRef, isOnlineRef }: Args) {
  const [location,      setLocation]      = useState<LatLng | null>(null);
  const [heading,       setHeading]        = useState(0);
  const [gpsDenied,     setGpsDenied]      = useState(false);

  const dashLocSubRef = useRef<Location.LocationSubscription | null>(null);
  const dashLastEmitRef = useRef(0);
  const missionEmitRef = useRef(0);
  const geoGenRef = useRef(0);
  const socketRef = useRef(socket);
  const userIdRef = useRef(userId);
  const networkOnlineRef = useRef(networkOnline);
  useEffect(() => {
    socketRef.current = socket;
    userIdRef.current = userId;
    networkOnlineRef.current = networkOnline;
  }, [socket, userId, networkOnline]);
  const lastCoordsRef = useRef<LatLng | null>(null);
  const startGeo = useCallback(async () => {
    const gen = ++geoGenRef.current;
    const stale = () => gen !== geoGenRef.current;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (stale()) return;
    if (status !== 'granted') { setGpsDenied(true); return; }
    setGpsDenied(false);

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (stale()) return;
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(coords);
    lastCoordsRef.current = coords;
    if (loc.coords.heading != null) setHeading(loc.coords.heading);

    // Sync initial position to backend so matching can find this provider
    // (si la socket n'est pas encore prête, l'effet plus bas s'en charge).
    const s0 = socketRef.current;
    if (s0 && userIdRef.current) {
      s0.emit('provider:location_update', { providerId: userIdRef.current, ...coords });
    }

    if (dashLocSubRef.current) { dashLocSubRef.current.remove(); dashLocSubRef.current = null; }
    const sub = await Location.watchPositionAsync(
      // distanceInterval réduit (10 m) + timeInterval court (3 s) pour que
      // la caméra suive bien les mouvements. Le throttle du socket emit
      // reste à 15s pour ne pas spammer le backend.
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
      (l) => {
        const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
        setLocation(c);
        lastCoordsRef.current = c;
        const socket = socketRef.current;
        const userId = userIdRef.current;
        if (l.coords.heading != null) setHeading(l.coords.heading);

        const now = Date.now();
        // En mission : la position (et l'ETA) partent vers le suivi du client toutes les 10 s.
        const cm = currentMissionRef.current;
        if (cm && now - missionEmitRef.current >= 10_000 && socket?.connected) {
          missionEmitRef.current = now;
          const eta = etaRef.current;
          socket.emit('provider:location_update', { requestId: Number(cm.id), lat: c.latitude, lng: c.longitude, eta: eta != null ? `${eta} min` : undefined });
        }
        if (now - dashLastEmitRef.current >= 15_000 && socket && isOnlineRef.current && networkOnlineRef.current && userId) {
          dashLastEmitRef.current = now;
          socket.emit('provider:location_update', { providerId: userId, ...c });
        }
      }
    );
    if (stale()) { sub.remove(); return; }
    dashLocSubRef.current = sub;
  }, []);

  // La socket arrive (ou change) après la première position : on la lui donne
  // tout de suite, sans attendre 15 s, pour que le matching trouve le prestataire.
  useEffect(() => {
    const coords = lastCoordsRef.current;
    if (socket && userId && coords) socket.emit('provider:location_update', { providerId: userId, ...coords });
  }, [socket, userId]);

  useEffect(() => {
    startGeo();
    return () => {
      geoGenRef.current++;
      if (dashLocSubRef.current) { dashLocSubRef.current.remove(); dashLocSubRef.current = null; }
    };
  }, [startGeo]);

  useFocusEffect(useCallback(() => {
    if (!gpsDenied) return;
    Location.getForegroundPermissionsAsync().then((p) => { if (p.status === 'granted') startGeo(); }).catch(() => {});
  }, [gpsDenied, startGeo]));

  return { location, heading, gpsDenied };
}
