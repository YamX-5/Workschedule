// Judgment at Fajr (spec §10): honesty beats perfection.
import type { Preset, Profile, Quest, Report, StatId } from './types';
import { applyXp } from './xp';
import { addDays, weekday } from './time';
import { nextStreak, summarizeDay, unlock } from './progress';

export type Verdict = 'cleared' | 'confessed' | 'late' | 'unreported';
export interface QuestResult { questId: string; verdict: Verdict; xpDelta: number; honorDelta: number; stat: StatId }

const MULT: Record<Preset, number> = { mercy: 1, balanced: 1.5, ruthless: 2 };
export const UNREPORTED_HONOR = -5;
export const CONFESS_HONOR = 2;
export const CARRY_MIN = 10;
const FRACTURED = 0.8;

export function verdictFor(q: Quest, r: Report | undefined): Verdict {
  if (!r) return 'unreported';
  if (r.kind === 'didnt') return 'confessed';
  if (r.late) return 'late';
  return r.units >= q.target ? 'cleared' : 'confessed';
}

const baseXp = (q: Quest, units: number) => (q.type === 'count' ? q.xp * Math.min(units, q.target) : q.xp);

/** XP + Shards a report earns the moment it is made. Matches what Judgment would award, minus Judgment-only penalties. */
export function instantReward(p: Profile, q: Quest, r: Report): { xp: number; shards: number } {
  if (r.kind !== 'done' || r.units <= 0) return { xp: 0, shards: 0 };
  let xp = baseXp(q, r.units);
  if (r.late) xp = Math.round(xp * 0.5);
  if (p.debuffs.some(d => d.stat === q.stat && d.dayKey === r.dayKey)) xp = Math.round(xp * FRACTURED);
  const verdict = verdictFor(q, r);
  const shards = verdict === 'cleared' ? Math.floor(xp / 10) : verdict === 'late' ? Math.floor(xp / 20) : 0;
  return { xp, shards };
}
const clampHonor = (h: number) => Math.max(0, Math.min(100, h));
const scheduled = (q: Quest, key: string) => q.days.includes(weekday(key));
const reportFor = (p: Profile, q: Quest, key: string) => p.reports.find(r => r.questId === q.id && r.dayKey === key);

/** Pure. Judges `dayKey` once; a second call for the same day returns the profile unchanged. */
export function judgeDay(p: Profile, dayKey: string, now = Date.now()) {
  if (p.judgedDays.includes(dayKey)) return { profile: p, results: [] as QuestResult[], levelChanges: {}, debuffsAdded: [] as StatId[] };

  const mult = MULT[p.protocol.preset];
  const fractured = (s: StatId) => p.debuffs.some(d => d.stat === s && d.dayKey === dayKey);
  const prevKey = addDays(dayKey, -1);
  const results: QuestResult[] = [];
  const debuffsAdded: StatId[] = [];

  for (const q of p.quests) {
    if (!scheduled(q, dayKey)) continue;
    const r = reportFor(p, q, dayKey);
    const verdict = verdictFor(q, r);
    let xpDelta = 0;
    let honorDelta = 0;
    if (verdict === 'cleared') xpDelta = baseXp(q, r!.units);
    else if (verdict === 'late') xpDelta = Math.round(baseXp(q, r!.units) * 0.5);
    else if (verdict === 'confessed') {
      xpDelta = q.type === 'count' && r?.kind === 'done' ? baseXp(q, r.units) : 0;
      if (p.protocol.preset === 'ruthless') xpDelta -= Math.round(q.xp * 0.25);
      honorDelta = CONFESS_HONOR;
    } else {
      xpDelta = -Math.round(mult * q.xp);
      honorDelta = UNREPORTED_HONOR;
    }
    if (xpDelta > 0 && fractured(q.stat)) xpDelta = Math.round(xpDelta * FRACTURED);
    results.push({ questId: q.id, verdict, xpDelta, honorDelta, stat: q.stat });

    // Never miss twice: missed today AND missed on the previous judged day -> Fractured tomorrow.
    const missed = verdict === 'confessed' || verdict === 'unreported';
    if (missed && p.protocol.neverMissTwice && p.judgedDays.includes(prevKey) && scheduled(q, prevKey)) {
      const pv = verdictFor(q, reportFor(p, q, prevKey));
      if ((pv === 'confessed' || pv === 'unreported') && !debuffsAdded.includes(q.stat)) debuffsAdded.push(q.stat);
    }
  }

  const stats = { ...p.stats };
  const levelChanges: Partial<Record<StatId, number>> = {};
  for (const r of results) {
    // XP banked at report time is already on the stat; settle only the rest.
    const banked = p.reports.find(x => x.questId === r.questId && x.dayKey === dayKey)?.xp ?? 0;
    const { stat, levelChange } = applyXp(stats[r.stat], r.xpDelta - banked);
    stats[r.stat] = stat;
    if (levelChange) levelChanges[r.stat] = (levelChanges[r.stat] ?? 0) + levelChange;
  }

  const unreported = results.filter(r => r.verdict === 'unreported').length;
  let profile: Profile = {
    ...p,
    stats,
    honor: clampHonor(p.honor + results.reduce((a, r) => a + r.honorDelta, 0)),
    corruptionCarryMin: p.corruptionCarryMin + unreported * CARRY_MIN,
    judgedDays: [...p.judgedDays, dayKey],
    debuffs: [...p.debuffs, ...debuffsAdded.map(stat => ({ stat, dayKey: addDays(dayKey, 1) }))],
    day: p.day + 1,
  };

  // Progression: history, streak, shards, records (spec §12.4)
  const summary = summarizeDay(p, dayKey, results);
  profile = {
    ...profile,
    history: [...profile.history, summary],
    streak: nextStreak(profile.streak, summary.held),
    shards: Math.max(0, profile.shards + summary.shards
      - p.reports.filter(x => x.dayKey === dayKey).reduce((a, x) => a + (x.shards ?? 0), 0)),
  };
  profile = unlock(profile, now);

  return { profile, results, levelChanges, debuffsAdded, summary };
}
