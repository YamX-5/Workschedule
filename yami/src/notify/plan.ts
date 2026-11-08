import type { Profile } from '../domain/types';
import { atOnDay, weekday } from '../domain/time';

export interface Reminder { id: string; at: Date; title: string; body: string }

/** Pure: one reminder per unreported quest due today (deadline − lead), plus wind-down. Past ones are skipped. */
export function planReminders(p: Profile, now: Date, dayKey: string): Reminder[] {
  const lead = p.protocol.reminderLeadMin;
  const out: Reminder[] = [];
  for (const q of p.quests) {
    if (!q.days.includes(weekday(dayKey))) continue;
    if (p.reports.some(r => r.questId === q.id && r.dayKey === dayKey)) continue;
    const at = new Date(atOnDay(dayKey, q.deadline, p.protocol.fajrAlarm).getTime() - lead * 60_000);
    if (at > now) out.push({ id: `q-${q.id}`, at, title: 'SYSTEM · Report window closing', body: `${q.title} · ${lead} min` });
  }
  const wd = atOnDay(dayKey, p.protocol.windDown, p.protocol.fajrAlarm);
  if (wd > now) out.push({ id: 'winddown', at: wd, title: 'SYSTEM · Wind-down', body: 'Feeds lock until Fajr.' });
  return out;
}
