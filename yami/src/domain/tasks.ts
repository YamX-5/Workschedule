// One-off to-dos (distinct from repeating Quests). Pure: no React, no I/O.
import type { Profile, StatId, Task } from './types';
import { addDays, weekday } from './time';
import { applyXp } from './xp';
import { TASK_XP, TASKS_REWARDED_PER_DAY, capGrant } from './economy';

export { TASK_XP } from './economy';
export const TASK_STAT: StatId = 'craft';

const byWhen = (a: Task, b: Task) =>
  (a.date ?? '9999').localeCompare(b.date ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99') || a.title.localeCompare(b.title);

export const tasksForDay = (p: Profile, key: string) => p.tasks.filter(t => t.date === key).sort(byWhen);

/** Dated tasks after `fromKey`, up to and including fromKey + days. */
export function upcoming(p: Profile, fromKey: string, days: number) {
  const end = addDays(fromKey, days);
  return p.tasks.filter(t => t.date && t.date > fromKey && t.date <= end).sort(byWhen);
}

export const overdue = (p: Profile, todayKey: string) => p.tasks.filter(t => !t.doneAt && t.date && t.date < todayKey).sort(byWhen);
export const someday = (p: Profile) => p.tasks.filter(t => !t.date).sort(byWhen);

/** Case-insensitive over title + notes. Undated tasks count as future. */
export function searchTasks(p: Profile, query: string, todayKey: string) {
  const q = query.trim().toLowerCase();
  const hits = q ? p.tasks.filter(t => `${t.title} ${t.notes ?? ''}`.toLowerCase().includes(q)).sort(byWhen) : [];
  return { future: hits.filter(t => !t.date || t.date >= todayKey), past: hits.filter(t => t.date && t.date < todayKey).reverse() };
}

/**
 * Complete banks the task's XP into its stat now; undo takes exactly that back.
 * `earnedToday` is XP already banked today; `paidToday` is how many to-dos already paid XP today.
 */
export function toggleTaskRule(p: Profile, id: string, at: number, earnedToday = 0, paidToday = 0):
  { profile: Profile; xp: number; stat: StatId; levelChange: number } | null {
  const t = p.tasks.find(x => x.id === id);
  if (!t) return null;
  const stat = t.stat ?? TASK_STAT;
  const xp = t.doneAt
    ? -(t.xpEarned ?? t.xp)
    : paidToday >= TASKS_REWARDED_PER_DAY ? 0 : capGrant(earnedToday, TASK_XP);
  const r = applyXp(p.stats[stat], xp);
  return {
    profile: {
      ...p,
      stats: { ...p.stats, [stat]: r.stat },
      tasks: p.tasks.map(x => (x.id === id ? { ...x, doneAt: t.doneAt ? undefined : at, xpEarned: t.doneAt ? undefined : xp } : x)),
    },
    xp, stat, levelChange: r.levelChange,
  };
}

// ---- Quick-add parsing: deterministic rules, no AI. ----
const DAYS = ['sun|sunday', 'mon|monday', 'tue|tues|tuesday', 'wed|weds|wednesday', 'thu|thur|thurs|thursday', 'fri|friday', 'sat|saturday']
  .map(names => new RegExp(`\\b(?:on\\s+)?(?:${names})\\b`, 'i'));
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "call mom fri at 5pm" -> { title: 'call mom', date: <next Friday>, time: '17:00' }.
 * Dates: today, tomorrow/tmrw, next week (+7), weekday names (today counts if it is that day).
 * Times: "at 5pm", "5:30pm", "17:00", "at 9" (24h). A bare number like "read 20 pages" is left alone.
 * No date in the text -> `fallback` (the quick-add chip), else today if a time was given, else undated.
 */
export function parseQuick(input: string, todayKey: string, fallback?: string): { title: string; date?: string; time?: string } {
  let s = ` ${input} `;
  let date: string | undefined;
  let time: string | undefined;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (!m) return false;
    fn(m);
    s = s.replace(m[0], ' ');
    return true;
  };

  take(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i, m => {
    time = `${pad((Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0))}:${m[2] ?? '00'}`;
  }) ||
    take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, m => { time = `${pad(Number(m[1]))}:${m[2]}`; }) ||
    take(/\bat\s+([01]?\d|2[0-3])\b/i, m => { time = `${pad(Number(m[1]))}:00`; });

  take(/\bnext\s+week\b/i, () => { date = addDays(todayKey, 7); }) ||
    take(/\b(tomorrow|tmrw|tmr)\b/i, () => { date = addDays(todayKey, 1); }) ||
    take(/\btoday\b/i, () => { date = todayKey; }) ||
    DAYS.some((re, wd) => take(re, () => {
      date = addDays(todayKey, (wd - weekday(todayKey) + 7) % 7);
    }));

  const title = s.replace(/\s+/g, ' ').trim();
  return { title: title || input.trim(), date: date ?? fallback ?? (time ? todayKey : undefined), time };
}
