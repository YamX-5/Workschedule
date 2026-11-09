// Phone calendar bridge (iOS/Android) on the SDK 58 object API; the old *Async functions throw at runtime.
// Web uses calendar.web.ts. Calls can throw; callers catch.
import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import type { Task } from '../domain/types';
import { atOnDay, addDays } from '../domain/time';

export interface CalEvent { id: string; title: string; start: Date; allDay: boolean; calendar: string }

export const calendarSupported = true;

export async function requestCalendar(): Promise<boolean> {
  try {
    return (await Calendar.requestCalendarPermissions()).status === 'granted';
  } catch {
    return false;
  }
}

/** Events from every visible calendar between from and to. Read-only. */
export async function readEvents(from: Date, to: Date): Promise<CalEvent[]> {
  const cals = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter(c => c.isVisible !== false);
  if (!cals.length) return [];
  const name = new Map(cals.map(c => [c.id, c.title]));
  const evs = await Calendar.listEvents(cals, from, to);
  return evs.map(e => ({ id: e.id, title: e.title || '(no title)', start: new Date(e.startDate), allDay: !!e.allDay, calendar: name.get(e.calendarId) ?? '' }));
}

/** iOS default calendar; Android primary writable one; else a local "Yami" calendar (created once). */
async function targetCalendar(): Promise<Calendar.ExpoCalendar> {
  if (Platform.OS === 'ios') {
    try { return Calendar.getDefaultCalendarSync(); } catch { /* fall through */ }
  }
  const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const pick = cals.find(c => c.isPrimary && c.allowsModifications) ?? cals.find(c => c.title === 'Yami' && c.allowsModifications);
  if (pick) return pick;
  return Calendar.createCalendar({
    title: 'Yami',
    name: 'yami',
    color: '#9B5CFF',
    entityType: Calendar.EntityTypes.EVENT,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    ownerAccount: 'Yami',
    source: { isLocalAccount: true, name: 'Yami', type: Calendar.SourceType.LOCAL },
  });
}

/** Creates the task's event and returns its id. Timed tasks last 30 min; tasks without a time are all-day. */
export async function addTaskEvent(t: Task): Promise<string | null> {
  if (!t.date) return null;
  const cal = await targetCalendar();
  const allDay = !t.time;
  const start = allDay ? new Date(`${t.date}T00:00:00`) : atOnDay(t.date, t.time!);
  const end = allDay ? new Date(`${addDays(t.date, 1)}T00:00:00`) : new Date(start.getTime() + 30 * 60_000);
  const ev = await cal.createEvent({
    title: t.title, notes: t.notes, startDate: start, endDate: end, allDay,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return ev.id;
}

export async function removeEvent(id: string) {
  await (await Calendar.ExpoCalendarEvent.get(id)).delete();
}
