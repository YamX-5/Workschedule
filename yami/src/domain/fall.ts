import type { Profile, StatId } from './types';

/** FALL: back to Day 1. Honor, scars, fall record, protocol, quests, dreams and earned records stay. */
export function fall(p: Profile, now: number): Profile {
  const stats = { ...p.stats };
  (Object.keys(stats) as StatId[]).forEach(k => { stats[k] = { ...stats[k], level: 1, xp: 0 }; });
  return {
    ...p,
    day: 1,
    stats,
    reports: [],
    judgedDays: [],
    debuffs: [],
    corruptionCarryMin: 0,
    history: [],
    streak: { current: 0, best: p.streak.best, bent: false },
    shards: 0,
    fallRecord: [...p.fallRecord, { day: p.day, at: now }],
    scars: p.scars + 1,
  };
}
