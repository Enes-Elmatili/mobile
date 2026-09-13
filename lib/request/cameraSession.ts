// lib/request/cameraSession.ts
// Passe la file de prises à l'écran caméra (app/request/camera.tsx) et
// rapporte le résultat, sans sérialiser des URIs dans les params de route.
// Une seule session à la fois : le stepper démarre, la caméra résout ou annule.
import type { LocalShot, ShotQueueItem } from './photos';

type Session = { queue: ShotQueueItem[]; onDone: (shots: LocalShot[]) => void };

let current: Session | null = null;

export const cameraSession = {
  start(queue: ShotQueueItem[], onDone: (shots: LocalShot[]) => void) {
    current = { queue, onDone };
  },
  current(): Session | null {
    return current;
  },
  resolve(shots: LocalShot[]) {
    const s = current;
    current = null;
    s?.onDone(shots);
  },
  cancel(taken: LocalShot[] = []) {
    // Les prises déjà gardées avant la fermeture sont conservées.
    const s = current;
    current = null;
    if (taken.length) s?.onDone(taken);
  },
};
