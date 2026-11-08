// Day boundary is Fajr, not midnight (spec §10, Review Focus #1).
const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' of the day that started at the most recent Fajr. `fajr` is Fajr on now's calendar date. */
export function dayKey(now: Date, fajr: Date): string {
  if (now >= fajr) return ymd(now);
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  return ymd(prev);
}

/** Shift a day key by n days (noon anchor avoids DST edges). */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export const weekday = (key: string) => new Date(`${key}T12:00:00`).getDay();

export const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes from now until hh:mm on now's calendar date (negative if already past). */
export function minutesUntil(now: Date, hhmm: string): number {
  return hhmmToMin(hhmm) - (now.getHours() * 60 + now.getMinutes());
}

/** hh:mm on the calendar date of `key`; times before `dayStart` (e.g. 01:00 with a 05:30 day) fall on the next date. */
export function atOnDay(key: string, hhmm: string, dayStart = '00:00'): Date {
  const d = new Date(`${key}T00:00:00`);
  const m = hhmmToMin(hhmm);
  if (m < hhmmToMin(dayStart)) d.setDate(d.getDate() + 1);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}
