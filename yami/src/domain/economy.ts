// The XP economy's hard limits, so nobody can type their way to LV 100 in a minute.
// Pace target: a perfect day earns at most DAILY_XP_CAP, so LV 100 takes ~5+ months even at the ceiling.
import type { Profile, Quest, Task } from './types';

/** A quest's whole-day reward is picked from these (Easy, Normal, Hard, Epic). Count quests split it across units. */
export const XP_TIERS = [10, 20, 35, 50] as const;
export const XP_TIER_NAMES = ['Easy', 'Normal', 'Hard', 'Epic'] as const;
export const DAILY_XP_CAP = 300;
export const MAX_QUESTS = 10;
export const COUNT_MAX = 20;
export const TIMER_MAX_MIN = 240;
export const TASK_XP = 5;
/** Only this many completed to-dos per day pay XP; the rest still tick off. */
export const TASKS_REWARDED_PER_DAY = 5;
export const MAX_MILESTONES = 10;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
/** Nearest allowed tier, so any old or hand-edited value lands on a real one. */
export const toTier = (xp: number) => XP_TIERS.reduce((best, t) => (Math.abs(t - xp) < Math.abs(best - xp) ? t : best), XP_TIERS[1] as number);

/** XP still allowed today, given what was already banked. Refunds (negative) always go through. */
export const capGrant = (earnedToday: number, want: number) => (want <= 0 ? want : Math.max(0, Math.min(want, DAILY_XP_CAP - earnedToday)));

export function sanitizeQuest(q: Quest): Quest {
  const target = q.type === 'check' ? 1 : Math.round(clamp(q.target, 1, q.type === 'count' ? COUNT_MAX : TIMER_MAX_MIN));
  return { ...q, xp: toTier(q.xp), target };
}

const sanitizeTask = (t: Task): Task => ({ ...t, xp: TASK_XP });

/** Applied on load and on restore: clamps values that could have been set before the limits existed. */
export function sanitize(p: Profile): Profile {
  return {
    ...p,
    quests: p.quests.slice(0, MAX_QUESTS).map(sanitizeQuest),
    tasks: p.tasks.map(sanitizeTask),
    dreams: p.dreams.map(d => ({ ...d, milestones: d.milestones.slice(0, MAX_MILESTONES) })),
  };
}
