// lib/request/schedule.ts
// Planning de l'étape 3 : créneaux proposés, libellé du RDV, date ISO envoyée
// au serveur. Pur (l'horloge est injectée) : testé dans __tests__/stepperSchedule.test.js.
import type { TFunction } from 'i18next';
import type { WeekDay } from '@/lib/scheduling/weeks';

export type ScheduleMode = 'now' | 'later' | null;

/** Créneaux de la grille, par moment de la journée. */
export const TIME_SLOTS = {
  morning:   ['08:00', '09:00', '10:00', '11:00'],
  afternoon: ['14:00', '15:00', '16:00', '17:00'],
  evening:   ['18:00', '19:00'],
} as const;

export const getTimeGroups = (t: TFunction) => [
  { label: t('stepper.morning'),    slots: [...TIME_SLOTS.morning] },
  { label: t('stepper.afternoon'),  slots: [...TIME_SLOTS.afternoon] },
  { label: t('stepper.evening'),    slots: [...TIME_SLOTS.evening] },
];

/** Libellé du RDV (« Lun. 14 à 09:00 ») ; null tant que le créneau n'est pas complet. */
export function buildScheduledLabel(input: {
  mode: ScheduleMode;
  dayIso: string | null;
  time: string | null;
  day: WeekDay | null;
  dayLabel: (d: WeekDay) => string;
  nowLabel: string;
}): string | null {
  const { mode, dayIso, time, day, dayLabel, nowLabel } = input;
  return mode === 'now'
    ? nowLabel
    : (dayIso && time
      ? `${day ? dayLabel(day) : ''} ${day?.date ?? ''} à ${time}`
      : null);
}

/** Date ISO du RDV envoyée au serveur ; null tant que le créneau n'est pas complet. */
export function buildScheduledFor(mode: ScheduleMode, dayIso: string | null, time: string | null, now: Date = new Date()): string | null {
  return mode === 'now'
    ? now.toISOString()
    : (dayIso && time
      ? new Date(`${dayIso}T${time}:00`).toISOString()
      : null);
}

/** Date servant à l'estimation locale du prix (majorations soir/week-end) : maintenant par défaut. */
export function buildRequestDateIso(mode: ScheduleMode, dayIso: string | null, time: string | null, now: Date = new Date()): string {
  if (mode === 'now') return now.toISOString();
  if (dayIso && time) return new Date(`${dayIso}T${time}:00`).toISOString();
  return now.toISOString();
}

export function isScheduleReady(mode: ScheduleMode, dayIso: string | null, time: string | null): boolean {
  return mode === 'now' || (mode === 'later' && !!dayIso && !!time);
}
