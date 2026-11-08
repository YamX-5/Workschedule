import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_AR: Record<PrayerName, string> = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
export type Times = Record<PrayerName, Date>;

type MethodName = keyof typeof CalculationMethod;

export function prayerTimes(date: Date, coords: { lat: number; lng: number }, method: string): Times {
  const factory = (CalculationMethod as Record<string, () => ReturnType<typeof CalculationMethod.MuslimWorldLeague>>)[method as MethodName]
    ?? CalculationMethod.MuslimWorldLeague;
  const t = new PrayerTimes(new Coordinates(coords.lat, coords.lng), date, factory());
  return { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

/** Next prayer after `now`; after Isha it is tomorrow's Fajr. */
export function nextPrayer(now: Date, times: Times, tomorrowFajr?: Date): { name: PrayerName; at: Date } {
  const name = PRAYERS.find(n => times[n] > now);
  if (name) return { name, at: times[name] };
  return { name: 'fajr', at: tomorrowFajr ?? new Date(times.fajr.getTime() + 864e5) };
}
