// lib/dashboard/time.ts — les libellés temporels de l'accueil client : salut,
// comptes à rebours (recherche, « À venir »), ETA du prestataire. Pur : l'heure
// courante et `t` sont passés en paramètre.

type T = (key: string) => string;
type TOpts = (key: string, opts?: { min: number | null }) => string;

export const getGreeting = (t: T, hour: number = new Date().getHours()) => {
  if (hour < 12) return t('dashboard.greeting_morning');
  if (hour < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
};

// ─── Recherche en cours ─────────────────────────────────────────────────────

/** Secondes restantes avant `expiresAt` (jamais négatif) ; null sans échéance. */
export function secondsLeft(expiresAt: string | null, now: number = Date.now()): number | null {
  return expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
}

/** « 14:05 » — minutes:secondes. */
export const formatMinSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// ─── Demande planifiée ──────────────────────────────────────────────────────

// Live countdown: "2J 14H", "3H 45M", "45M", "< 1M"
export function countdownOf(target: Date | null, now: number): { label: string; fraction: number } {
  if (!target) return { label: '', fraction: 0 };
  const diff = Math.max(0, target.getTime() - now);
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const d = Math.floor(h / 24);
  const m = totalMin % 60;

  let label: string;
  if (d >= 1) label = `${d}J ${h % 24}H`;
  else if (h >= 1) label = `${h}H ${String(m).padStart(2, '0')}M`;
  else if (totalMin >= 1) label = `${totalMin}M`;
  else label = '< 1M';

  // fraction 0→1 based on 48h window (visual only, clamps)
  const maxWindow = 48 * 60 * 60 * 1000;
  const fraction = Math.min(1, Math.max(0, diff / maxWindow));
  return { label, fraction };
}

/** Vrai si `date` tombe demain (calendrier local). */
export function isTomorrow(date: Date, now: Date = new Date()): boolean {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return date.getDate() === tomorrow.getDate() &&
         date.getMonth() === tomorrow.getMonth() &&
         date.getFullYear() === tomorrow.getFullYear();
}

// ─── ETA du prestataire ─────────────────────────────────────────────────────

type Coords = { lat: number; lng: number };

/** Minutes estimées à vol d'oiseau (× 1,4 pour la route, 30 km/h en ville). */
export function haversineEtaMinutes(from: Coords, to: Coords): number {
  const R = 6371;
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLon = (to.lng - from.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.ceil((dist * 1.4 / 30) * 60);
}

/** Premier nombre d'un texte (« 21 mins », « Arrivée dans 21 min ») ; null sinon. */
export function firstNumber(text: string): string | null {
  const match = text.match(/(\d+)/);
  return match ? match[1] : null;
}

/** « Arrivée imminente » à une minute ou moins, « Arrivée dans N min » sinon. */
export function arrivalLabel(min: number | null, t: TOpts): string {
  return min !== null && min <= 1 ? t('dashboard.arrival_imminent') : t('dashboard.arrival_in_min', { min });
}
