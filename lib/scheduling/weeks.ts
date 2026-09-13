// lib/scheduling/weeks.ts
// Semaines du planning (WeekStrip) et créneaux inertes (SlotGrid). Tout est
// calculé en heure LOCALE de l'appareil ; `iso` est un YYYY-MM-DD local, le
// même format que `selectedDayIso` dans NewRequestStepper. Pur : testé dans
// __tests__/weeks.test.js et __tests__/slots.test.js.
export type WeekDay = {
  iso: string;
  /** 0 = dimanche … 6 = samedi (Date#getDay) */
  dayIndex: number;
  date: number;
  /** 0 = janvier … 11 = décembre */
  month: number;
  year: number;
  isPast: boolean;
  isToday: boolean;
};

export type Week = { days: WeekDay[]; from: WeekDay; to: WeekDay };

function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Le lundi de la semaine qui contient `d`. */
function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function buildWeeks(now: Date, count = 5): Week[] {
  const today = startOfDay(now);
  const todayIso = localIso(today);
  const first = mondayOf(today);
  const weeks: Week[] = [];
  for (let w = 0; w < count; w++) {
    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + w * 7 + i);
      const iso = localIso(d);
      days.push({
        iso,
        dayIndex: d.getDay(),
        date: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isPast: d.getTime() < today.getTime(),
        isToday: iso === todayIso,
      });
    }
    weeks.push({ days, from: days[0], to: days[6] });
  }
  return weeks;
}

export function findDay(weeks: Week[], iso: string | null): WeekDay | null {
  if (!iso) return null;
  for (const w of weeks) {
    for (const d of w.days) if (d.iso === iso) return d;
  }
  return null;
}

/** Un créneau « HH:MM » est inerte s'il est passé ou commence dans moins de `leadMinutes`. */
export function isSlotDisabled(dayIso: string, slot: string, now: Date, leadMinutes = 60): boolean {
  const [h, m] = slot.split(':').map(Number);
  const [y, mo, d] = dayIso.split('-').map(Number);
  const start = new Date(y, mo - 1, d, h, m, 0, 0);
  return start.getTime() < now.getTime() + leadMinutes * 60_000;
}
