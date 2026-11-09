// Progression v2 (spec §12): player level, rank, shards, streak, records, dreams, reward shop.
import type { DaySummary, Dream, Profile, RecordId, Streak } from './types';
import type { QuestResult } from './judgment';
import { applyXp } from './xp';

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const playerLevel = (p: Profile) =>
  Object.values(p.stats).reduce((sum, s) => sum + (s.enabled ? s.level : 0), 0);

/** Rank steps every 20 levels; S starts at LV 100, The Chosen One. */
export const RANK_AT: Record<Rank, number> = { E: 0, D: 20, C: 40, B: 60, A: 80, S: 100 };
export function rankFor(level: number): Rank {
  return (['S', 'A', 'B', 'C', 'D', 'E'] as Rank[]).find(r => level >= RANK_AT[r])!;
}

export function shardsFor(r: QuestResult): number {
  if (r.xpDelta <= 0) return 0;
  if (r.verdict === 'cleared') return Math.floor(r.xpDelta / 10);
  if (r.verdict === 'late') return Math.floor(r.xpDelta / 20);
  return 0;
}

const unitsOf = (p: Profile, dayKey: string, questId: string) =>
  p.reports.find(r => r.dayKey === dayKey && r.questId === questId && r.kind === 'done')?.units ?? 0;

export function summarizeDay(p: Profile, dayKey: string, results: QuestResult[]): DaySummary {
  const count = (v: QuestResult['verdict']) => results.filter(r => r.verdict === v).length;
  const usedMin = p.usage.dayKey === dayKey ? p.usage.usedMin : 0;
  const s: DaySummary = {
    dayKey,
    usedMin,
    capMin: p.protocol.capMin,
    cleared: count('cleared'),
    late: count('late'),
    confessed: count('confessed'),
    unreported: count('unreported'),
    xpGained: results.reduce((a, r) => a + Math.max(0, r.xpDelta), 0),
    xpLost: results.reduce((a, r) => a + Math.max(0, -r.xpDelta), 0),
    shards: results.reduce((a, r) => a + shardsFor(r), 0),
    // ponytail: salah/rehab found by seed quest id; switch to a quest "kind" field if users rebuild those quests
    salahOnTime: unitsOf(p, dayKey, 'salah'),
    rehabSets: unitsOf(p, dayKey, 'rehab'),
    energy: p.usage.dayKey === dayKey ? p.usage.energy : undefined,
    held: false,
  };
  s.held = dayHolds(s, p.protocol.reserveMin);
  return s;
}

/** A day holds at >= 60% cleared (late counts) and phone within cap + reserve. */
export function dayHolds(s: DaySummary, reserveMin: number): boolean {
  const judged = s.cleared + s.late + s.confessed + s.unreported;
  const doneEnough = judged === 0 || s.cleared + s.late >= 0.6 * judged;
  return doneEnough && s.usedMin <= s.capMin + reserveMin;
}

/** Never miss twice: one failed day bends the streak, two in a row break it. */
export function nextStreak(st: Streak, held: boolean): Streak {
  if (held) { const current = st.current + 1; return { current, best: Math.max(st.best, current), bent: false }; }
  if (!st.bent) return { ...st, bent: true };
  return { current: 0, best: st.best, bent: false };
}

const lastN = <T>(xs: T[], n: number) => (xs.length >= n ? xs.slice(-n) : null);

const RECORD_RULES: Record<RecordId, (p: Profile) => boolean> = {
  firstLight: p => p.history.some(h => h.cleared + h.late > 0),
  sevenUnbroken: p => p.streak.current >= 7,
  underCap: p => !!lastN(p.history, 7)?.every(h => h.usedMin <= h.capMin),
  fiveGates: p => !!lastN(p.history, 7)?.every(h => h.salahOnTime >= 5),
  ironKnees: p => p.history.reduce((a, h) => a + h.rehabSets, 0) >= 100,
  honestBlade: p => p.history.reduce((a, h) => a + h.confessed, 0) >= 10,
  day66: p => p.history.length >= 66,
  dreamer: p => p.dreams.some(d => d.achievedAt),
  supreme: p => playerLevel(p) >= 100,
};

export const RECORD_TEXT: Record<RecordId, { name: string; rule: string }> = {
  firstLight: { name: 'First Light', rule: 'Clear your first quest' },
  sevenUnbroken: { name: 'Seven Unbroken', rule: 'Reach a 7-day streak' },
  underCap: { name: 'Under the Cap', rule: '7 days in a row under your phone cap' },
  fiveGates: { name: 'Five Gates', rule: 'All 5 salah, 7 days in a row' },
  ironKnees: { name: 'Iron Knees', rule: '100 rehab sets' },
  honestBlade: { name: 'Honest Blade', rule: '10 honest confessions' },
  day66: { name: 'Day 66', rule: 'Complete the 66-day arc' },
  dreamer: { name: 'Dreamer', rule: 'Achieve your first Dream' },
  supreme: { name: 'The Chosen One', rule: 'Reach player LV 100' },
};

/** Newly unlocked records only. */
export const checkRecords = (p: Profile): RecordId[] =>
  (Object.keys(RECORD_RULES) as RecordId[]).filter(id => p.records[id] === undefined && RECORD_RULES[id](p));

/** Unlock new records and remember the best player level ever reached (best form). */
export const unlock = (p0: Profile, now: number): Profile => {
  const best = Math.max(p0.bestLevel, playerLevel(p0));
  const p = best === p0.bestLevel ? p0 : { ...p0, bestLevel: best };
  const ids = checkRecords(p);
  if (!ids.length) return p;
  const records = { ...p.records };
  ids.forEach(id => { records[id] = now; });
  return { ...p, records };
};

// ---------------- Dreams ----------------
export const MAX_ACTIVE_DREAMS = 3;
const activeCount = (p: Profile) => p.dreams.filter(d => d.active && !d.achievedAt).length;

/** Linked-quest clears needed to fill the bar up to the next milestone. */
export const CLEARS_PER_STEP = 10;
const DAY_MS = 86_400_000;

/**
 * Dream progress: each confirmed milestone is one step; quest clears linked to the dream
 * fill the current step (capped, so only confirming the milestone completes it).
 */
export function dreamProgress(p: Profile, d: Dream, now = Date.now()) {
  const total = Math.max(1, d.milestones.length);
  const done = d.milestones.filter(m => m.doneAt).length;
  const since = Math.max(d.createdAt, ...d.milestones.map(m => m.doneAt ?? 0));
  const linked = new Set(p.quests.filter(q => q.dreamId === d.id).map(q => q.id));
  const clears = p.reports.filter(r => linked.has(r.questId) && r.kind === 'done' && r.at > since
    && r.units >= (p.quests.find(q => q.id === r.questId)?.target ?? 1)).length;
  const step = done >= total ? 0 : Math.min(1, clears / CLEARS_PER_STEP);
  const value = Math.min(1, (done + step) / total);
  let daysLeft: number | undefined;
  let onPace: boolean | undefined;
  if (d.due && !d.achievedAt) {
    const end = new Date(`${d.due}T23:59:59`).getTime();
    daysLeft = Math.ceil((end - now) / DAY_MS);
    const expected = (now - d.createdAt) / Math.max(DAY_MS, end - d.createdAt);
    onPace = value + 0.05 >= expected;
  }
  return { value, done, total, clears: Math.min(clears, CLEARS_PER_STEP), daysLeft, onPace };
}

export function addDream(p: Profile, d: Dream): Profile | 'too-many' {
  if (d.active && activeCount(p) >= MAX_ACTIVE_DREAMS) return 'too-many';
  return { ...p, dreams: [...p.dreams, d] };
}

export function completeMilestone(p: Profile, dreamId: string, milestoneId: string, now: number): Profile {
  const dream = p.dreams.find(d => d.id === dreamId);
  const ms = dream?.milestones.find(m => m.id === milestoneId);
  if (!dream || !ms || ms.doneAt) return p;
  const milestones = dream.milestones.map(m => (m.id === milestoneId ? { ...m, doneAt: now } : m));
  const achieved = milestones.every(m => m.doneAt);
  const updated: Dream = { ...dream, milestones, ...(achieved ? { achievedAt: now, active: false } : {}) };
  let next: Profile = {
    ...p,
    dreams: p.dreams.map(d => (d.id === dreamId ? updated : d)),
    stats: { ...p.stats, [dream.stat]: applyXp(p.stats[dream.stat], 100).stat },
    shards: p.shards + 20 + (achieved ? 100 : 0),
    titles: achieved && !p.titles.includes(dream.title) ? [...p.titles, dream.title] : p.titles,
  };
  next = unlock(next, now);
  return next;
}

// ---------------- Reward shop ----------------
export function claimReward(p: Profile, rewardId: string, now: number): Profile | 'not-enough' {
  const r = p.rewards.find(x => x.id === rewardId);
  if (!r || p.shards < r.cost) return 'not-enough';
  return { ...p, shards: p.shards - r.cost, claims: [...p.claims, { rewardId, at: now, cost: r.cost }] };
}
