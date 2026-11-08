import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dream, Profile, Protocol, Quest, ReportKind, Reward, StatId } from '../domain/types';
import { newProfile } from '../domain/defaults';
import { addDays, atOnDay, dayKey } from '../domain/time';
import { judgeDay } from '../domain/judgment';
import { fall } from '../domain/fall';
import { addDream as addDreamRule, claimReward as claimRule, completeMilestone as milestoneRule } from '../domain/progress';
import { prayerTimes } from '../prayer/prayer';
import { migrate } from './migrate';

export const EARN_CAP_MIN = 30;
const MAX_BACKFILL_DAYS = 3;

/** The current Yami day for this profile (resets at Fajr). */
export function todayKey(p: Profile, now = new Date()): string {
  const fajr = prayerTimes(now, p.protocol.coords, p.protocol.calcMethod).fajr;
  return dayKey(now, fajr);
}

/** New day: usage starts from the carried corruption. */
function rollUsage(p: Profile, key: string): Profile {
  if (p.usage.dayKey === key) return p;
  return {
    ...p,
    usage: { dayKey: key, usedMin: p.corruptionCarryMin, reserveUsedMin: 0, reserveOpen: false, reserveReasons: [], earnedMin: 0 },
    corruptionCarryMin: 0,
  };
}

export type JudgmentOutcome = ReturnType<typeof judgeDay>;

interface YamiState {
  profile: Profile;
  lastJudgment: JudgmentOutcome | null;
  report(questId: string, kind: ReportKind, units: number, now?: Date): void;
  addUsage(min: number, now?: Date): void;
  earnMinutes(min: number, now?: Date): number;
  openReserve(reason: string, now?: Date): void;
  setEnergy(energy: number, now?: Date): void;
  runJudgment(now?: Date): JudgmentOutcome | null;
  updateProtocol(patch: Partial<Protocol>): void;
  upsertQuest(q: Quest): void;
  deleteQuest(id: string): void;
  renameStat(id: StatId, name: string): void;
  toggleStat(id: StatId): boolean;
  setPlayer(patch: Partial<Pick<Profile, 'name' | 'title'>>): void;
  finishOnboarding(now?: Date): void;
  addDream(d: Dream): boolean;
  updateDream(d: Dream): void;
  completeMilestone(dreamId: string, milestoneId: string, now?: Date): void;
  upsertReward(r: Reward): void;
  deleteReward(id: string): void;
  claimReward(id: string, now?: Date): boolean;
  triggerFall(now?: Date): void;
  reset(): void;
}

export const useYami = create<YamiState>()(
  persist(
    (set, get) => {
      const patch = (fn: (p: Profile) => Profile) => set(s => ({ profile: fn(s.profile) }));
      return {
        profile: newProfile(),
        lastJudgment: null,

        report(questId, kind, units, now = new Date()) {
          patch(p => {
            const q = p.quests.find(x => x.id === questId);
            if (!q) return p;
            const key = todayKey(p, now);
            const late = now > atOnDay(key, q.deadline, p.protocol.fajrAlarm);
            const reports = p.reports.filter(r => !(r.questId === questId && r.dayKey === key));
            return { ...p, reports: [...reports, { questId, dayKey: key, kind, units, at: now.getTime(), late }] };
          });
        },

        addUsage(min, now = new Date()) {
          patch(p0 => {
            const p = rollUsage(p0, todayKey(p0, now));
            const atCap = p.usage.usedMin >= p.protocol.capMin;
            return {
              ...p,
              usage: {
                ...p.usage,
                usedMin: Math.max(0, p.usage.usedMin + min),
                reserveUsedMin: atCap && p.usage.reserveOpen && min > 0 ? p.usage.reserveUsedMin + min : p.usage.reserveUsedMin,
              },
            };
          });
        },

        /** Rehab earns phone minutes back, capped at +30/day (spec §4.6). Returns minutes granted. */
        earnMinutes(min, now = new Date()) {
          let granted = 0;
          patch(p0 => {
            const p = rollUsage(p0, todayKey(p0, now));
            granted = Math.max(0, Math.min(min, EARN_CAP_MIN - p.usage.earnedMin));
            return { ...p, usage: { ...p.usage, earnedMin: p.usage.earnedMin + granted, usedMin: Math.max(0, p.usage.usedMin - granted) } };
          });
          return granted;
        },

        openReserve(reason, now = new Date()) {
          patch(p0 => {
            const p = rollUsage(p0, todayKey(p0, now));
            return { ...p, usage: { ...p.usage, reserveOpen: true, reserveReasons: [...p.usage.reserveReasons, reason] } };
          });
        },

        setEnergy(energy, now = new Date()) {
          patch(p0 => {
            const p = rollUsage(p0, todayKey(p0, now));
            return { ...p, usage: { ...p.usage, energy } };
          });
        },

        /** Judges every unjudged day before today (at most 3 back; older gaps close without penalty). */
        runJudgment(now = new Date()) {
          let p = get().profile;
          const today = todayKey(p, now);
          if (!p.startKey) { set({ profile: { ...p, startKey: today } }); return null; }
          const last = p.judgedDays.length ? p.judgedDays[p.judgedDays.length - 1] : addDays(p.startKey, -1);
          const days: string[] = [];
          for (let k = addDays(last, 1); k < today; k = addDays(k, 1)) days.push(k);
          if (!days.length) return null;
          const skipped = days.slice(0, Math.max(0, days.length - MAX_BACKFILL_DAYS));
          if (skipped.length) p = { ...p, judgedDays: [...p.judgedDays, ...skipped] };
          let out: JudgmentOutcome | null = null;
          for (const k of days.slice(skipped.length)) {
            const r = judgeDay(p, k, now.getTime());
            p = r.profile;
            out = out
              ? { ...r, results: [...out.results, ...r.results], debuffsAdded: [...out.debuffsAdded, ...r.debuffsAdded],
                  levelChanges: mergeChanges(out.levelChanges, r.levelChanges) }
              : r;
          }
          p = rollUsage(p, today);
          set({ profile: p, lastJudgment: out });
          return out;
        },

        updateProtocol(pp) { patch(p => ({ ...p, protocol: { ...p.protocol, ...pp } })); },
        upsertQuest(q) {
          patch(p => ({ ...p, quests: p.quests.some(x => x.id === q.id) ? p.quests.map(x => (x.id === q.id ? q : x)) : [...p.quests, q] }));
        },
        deleteQuest(id) { patch(p => ({ ...p, quests: p.quests.filter(q => q.id !== id) })); },
        renameStat(id, name) { patch(p => ({ ...p, stats: { ...p.stats, [id]: { ...p.stats[id], name } } })); },
        toggleStat(id) {
          const p = get().profile;
          const enabled = Object.values(p.stats).filter(s => s.enabled).length;
          if (p.stats[id].enabled && enabled <= 3) return false;
          patch(x => ({ ...x, stats: { ...x.stats, [id]: { ...x.stats[id], enabled: !x.stats[id].enabled } } }));
          return true;
        },
        setPlayer(pp) { patch(p => ({ ...p, ...pp })); },
        finishOnboarding(now = new Date()) {
          patch(p => ({ ...p, onboarded: true, startKey: p.startKey || todayKey(p, now) }));
        },

        addDream(d) {
          const r = addDreamRule(get().profile, d);
          if (r === 'too-many') return false;
          set({ profile: r });
          return true;
        },
        updateDream(d) { patch(p => ({ ...p, dreams: p.dreams.map(x => (x.id === d.id ? d : x)) })); },
        completeMilestone(dreamId, milestoneId, now = new Date()) { patch(p => milestoneRule(p, dreamId, milestoneId, now.getTime())); },
        upsertReward(r) {
          patch(p => ({ ...p, rewards: p.rewards.some(x => x.id === r.id) ? p.rewards.map(x => (x.id === r.id ? r : x)) : [...p.rewards, r] }));
        },
        deleteReward(id) { patch(p => ({ ...p, rewards: p.rewards.filter(r => r.id !== id) })); },
        claimReward(id, now = new Date()) {
          const r = claimRule(get().profile, id, now.getTime());
          if (r === 'not-enough') return false;
          set({ profile: r });
          return true;
        },

        triggerFall(now = new Date()) { patch(p => fall(p, now.getTime())); },
        reset() { set({ profile: newProfile(), lastJudgment: null }); },
      };
    },
    {
      name: 'yami.profile.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ profile: s.profile }),
      merge: (persisted, current) => ({ ...current, profile: migrate((persisted as { profile?: unknown } | undefined)?.profile) }),
    },
  ),
);

function mergeChanges(a: Partial<Record<StatId, number>>, b: Partial<Record<StatId, number>>) {
  const out = { ...a };
  (Object.keys(b) as StatId[]).forEach(k => { out[k] = (out[k] ?? 0) + (b[k] ?? 0); });
  return out;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
