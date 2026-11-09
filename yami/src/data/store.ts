import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STAT_IDS, type Dream, type GateMark, type Profile, type Protocol, type Quest, type RecordId, type Report, type ReportKind, type Reward, type StatId, type Task } from '../domain/types';
import { newProfile, prayerQuest } from '../domain/defaults';
import { addDays, atOnDay, dayKey } from '../domain/time';
import { instantReward, judgeDay, shardsForXp, verdictFor } from '../domain/judgment';
import { MAX_QUESTS, TASK_XP, capGrant, sanitizeQuest } from '../domain/economy';
import { fall } from '../domain/fall';
import { applyXp } from '../domain/xp';
import { formFor } from '../domain/forms';
import { addDream as addDreamRule, claimReward as claimRule, completeMilestone as milestoneRule, playerLevel, unlock } from '../domain/progress';
import { prayerTimes } from '../prayer/prayer';
import { migrate } from './migrate';
import { toggleTaskRule } from '../domain/tasks';

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

export type JudgmentOutcome = ReturnType<typeof judgeDay> & { newRecords?: RecordId[]; levelBefore?: number };

/** A small "+XP" pop after a report. Not persisted. */
export interface Gain { id: number; xp: number; shards: number; stat: string; levelUp: boolean; /** hit today's XP limit */ capped?: boolean }
/** A full-screen win moment (level up, new form, milestone, dream). Not persisted. */
export interface Celebration { title: string; sub: string; kind: 'level' | 'form' | 'milestone' | 'dream' }

interface YamiState {
  profile: Profile;
  lastJudgment: JudgmentOutcome | null;
  gain: Gain | null;
  celebration: Celebration | null;
  dismissCelebration(): void;
  report(questId: string, kind: ReportKind, units: number, now?: Date): void;
  addUsage(min: number, now?: Date): void;
  earnMinutes(min: number, now?: Date): number;
  openReserve(reason: string, now?: Date): void;
  setEnergy(energy: number, now?: Date): void;
  cycleGate(i: number, now?: Date): void;
  runJudgment(now?: Date): JudgmentOutcome | null;
  updateProtocol(patch: Partial<Protocol>): void;
  /** False when adding would pass MAX_QUESTS. Values are clamped to the economy limits. */
  upsertQuest(q: Quest): boolean;
  deleteQuest(id: string): void;
  renameStat(id: StatId, name: string): void;
  toggleStat(id: StatId): boolean;
  setPlayer(patch: Partial<Pick<Profile, 'name' | 'title'>>): void;
  finishOnboarding(now?: Date): void;
  /**
   * First-run setup: the player's own stat names (one per slot, blank = switched off; at least 3),
   * their first quests, and whether to track the 5 prayers (quest id 'salah'). False if under 3 names.
   */
  setupProfile(setup: { names: string[]; quests: Omit<Quest, 'id'>[]; prayers: boolean }): boolean;
  /** Add or remove the prayer quest (id 'salah'). False when adding would pass MAX_QUESTS. */
  setPrayers(on: boolean): boolean;
  setTutorialDone(done: boolean): void;
  addDream(d: Dream): boolean;
  updateDream(d: Dream): void;
  completeMilestone(dreamId: string, milestoneId: string, now?: Date): void;
  upsertReward(r: Reward): void;
  deleteReward(id: string): void;
  claimReward(id: string, now?: Date): boolean;
  addTask(t: Task): void;
  updateTask(t: Task): void;
  deleteTask(id: string): void;
  /** Complete banks the task's XP now (with the +XP toast); undo takes it back. */
  toggleTask(id: string, now?: Date): void;
  triggerFall(now?: Date): void;
  reset(): void;
  /** Back to LV 1 / Day 1 with 0 Shards, keeping your quests, dreams (un-done), to-dos, rewards and settings. */
  restartProgress(now?: Date): void;
  /** Replace the profile from a backup string. Returns false (and changes nothing) if it isn't a Yami backup. */
  importProfile(json: string): boolean;
}

export const useYami = create<YamiState>()(
  persist(
    (set, get) => {
      const patch = (fn: (p: Profile) => Profile) => set(s => ({ profile: fn(s.profile) }));
      return {
        profile: newProfile(),
        lastJudgment: null,
        gain: null,
        celebration: null,
        dismissCelebration() { set({ celebration: null }); },

        report(questId, kind, units, now = new Date()) {
          const key = todayKey(get().profile, now);
          const p = rollUsage(get().profile, key);
          const q = p.quests.find(x => x.id === questId);
          if (!q) return;
          const late = now > atOnDay(key, q.deadline, p.protocol.fajrAlarm);
          const prev = p.reports.find(r => r.questId === questId && r.dayKey === key);
          const r: Report = { questId, dayKey: key, kind, units, at: now.getTime(), late };
          const want = instantReward(p, q, r);
          // Bank the difference from any earlier report today (never double-counts), limited by the daily XP cap.
          const xpToday = p.usage.xpEarned ?? 0;
          const dXp = capGrant(xpToday, want.xp - (prev?.xp ?? 0));
          const xp = (prev?.xp ?? 0) + dXp;
          const shards = shardsForXp(verdictFor(q, r), xp);
          const dShards = shards - (prev?.shards ?? 0);
          const { stat, levelChange } = applyXp(p.stats[q.stat], dXp);
          const next: Profile = {
            ...p,
            stats: { ...p.stats, [q.stat]: stat },
            shards: Math.max(0, p.shards + dShards),
            usage: { ...p.usage, xpEarned: Math.max(0, xpToday + dXp) },
            reports: [...p.reports.filter(x => x !== prev), { ...r, xp, shards }],
          };
          const before = playerLevel(p);
          const after = playerLevel(next);
          const formBefore = formFor(before);
          const formAfter = formFor(after);
          set({
            profile: unlock(next, now.getTime()),
            gain: dXp || want.xp > (prev?.xp ?? 0)
              ? { id: now.getTime(), xp: dXp, shards: dShards, stat: p.stats[q.stat].name, levelUp: levelChange > 0, capped: dXp < want.xp - (prev?.xp ?? 0) }
              : get().gain,
            celebration: formAfter.tier > formBefore.tier
              ? { title: `New form: ${formAfter.name}`, sub: formAfter.upgrade, kind: 'form' }
              : after > before ? { title: `Level ${after}`, sub: `${p.stats[q.stat].name} grew stronger.`, kind: 'level' } : get().celebration,
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

        /** Tap a gate: pending -> on time -> late -> missed -> pending. Keeps the Salah quest report in sync. */
        cycleGate(i, now = new Date()) {
          const ORDER: GateMark[] = ['pending', 'ontime', 'late', 'miss'];
          const p0 = get().profile;
          const p = rollUsage(p0, todayKey(p0, now));
          const gates = [...(p.usage.gates ?? Array<GateMark>(5).fill('pending'))];
          gates[i] = ORDER[(ORDER.indexOf(gates[i]) + 1) % ORDER.length];
          set({ profile: { ...p, usage: { ...p.usage, gates } } });
          const prayed = gates.filter(g => g === 'ontime' || g === 'late').length;
          const marked = gates.filter(g => g !== 'pending').length;
          if (marked) get().report('salah', prayed ? 'done' : 'didnt', prayed, now);
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
          const before = get().profile;
          if (out) out = {
            ...out,
            newRecords: (Object.keys(p.records) as RecordId[]).filter(k => before.records[k] === undefined),
            levelBefore: playerLevel(before),
          };
          set({ profile: p, lastJudgment: out });
          return out;
        },

        updateProtocol(pp) { patch(p => ({ ...p, protocol: { ...p.protocol, ...pp } })); },
        upsertQuest(q0) {
          const p = get().profile;
          const q = sanitizeQuest(q0);
          const exists = p.quests.some(x => x.id === q.id);
          if (!exists && p.quests.length >= MAX_QUESTS) return false;
          set({ profile: { ...p, quests: exists ? p.quests.map(x => (x.id === q.id ? q : x)) : [...p.quests, q] } });
          return true;
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

        setupProfile({ names, quests, prayers }) {
          const clean = STAT_IDS.map((_, i) => (names[i] ?? '').trim().toUpperCase().slice(0, 10));
          const on = STAT_IDS.filter((_, i) => clean[i]);
          if (on.length < 3) return false;
          const p = get().profile;
          const stats = { ...p.stats };
          STAT_IDS.forEach((k, i) => { stats[k] = { ...stats[k], name: clean[i], enabled: !!clean[i] }; });
          const fix = (k: StatId) => (stats[k].enabled ? k : on[0]);
          const mine = quests.filter(q => q.title.trim()).map(q => sanitizeQuest({ ...q, id: uid(), title: q.title.trim(), stat: fix(q.stat) }));
          const all = [...(prayers ? [prayerQuest(on[0])] : []), ...mine].slice(0, MAX_QUESTS);
          set({ profile: { ...p, stats, quests: all } });
          return true;
        },
        setPrayers(on) {
          const p = get().profile;
          const has = p.quests.some(q => q.id === 'salah');
          if (on === has) return true;
          if (!on) { set({ profile: { ...p, quests: p.quests.filter(q => q.id !== 'salah') } }); return true; }
          if (p.quests.length >= MAX_QUESTS) return false;
          const stat = STAT_IDS.find(k => p.stats[k].enabled) ?? 'deen';
          set({ profile: { ...p, quests: [prayerQuest(stat), ...p.quests] } });
          return true;
        },
        setTutorialDone(done) { patch(p => ({ ...p, tutorialDone: done })); },

        addDream(d) {
          const r = addDreamRule(get().profile, d);
          if (r === 'too-many') return false;
          set({ profile: r });
          return true;
        },
        updateDream(d) { patch(p => ({ ...p, dreams: p.dreams.map(x => (x.id === d.id ? d : x)) })); },
        completeMilestone(dreamId, milestoneId, now = new Date()) {
          const p = get().profile;
          const next = milestoneRule(p, dreamId, milestoneId, now.getTime());
          if (next === p) return;
          const d = next.dreams.find(x => x.id === dreamId)!;
          const ms = d.milestones.find(m => m.id === milestoneId)!;
          set({
            profile: next,
            celebration: d.achievedAt
              ? { title: 'Dream achieved', sub: `${d.title}. +100 Shards and a new title.`, kind: 'dream' }
              : { title: 'Milestone cleared', sub: `${ms.title}. +100 XP, +20 Shards.`, kind: 'milestone' },
          });
        },
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

        addTask(t) { patch(p => ({ ...p, tasks: [...p.tasks, t] })); },
        updateTask(t) { patch(p => ({ ...p, tasks: p.tasks.map(x => (x.id === t.id ? t : x)) })); },
        deleteTask(id) { patch(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) })); },
        toggleTask(id, now = new Date()) {
          const key = todayKey(get().profile, now);
          const p = rollUsage(get().profile, key);
          const xpToday = p.usage.xpEarned ?? 0;
          const paidToday = p.tasks.filter(t => t.doneAt && (t.xpEarned ?? 0) > 0 && todayKey(p, new Date(t.doneAt)) === key).length;
          const r = toggleTaskRule(p, id, now.getTime(), xpToday, paidToday);
          if (!r) return;
          const completing = !p.tasks.find(t => t.id === id)?.doneAt;
          set({
            profile: { ...r.profile, usage: { ...r.profile.usage, xpEarned: Math.max(0, xpToday + r.xp) } },
            gain: { id: now.getTime(), xp: r.xp, shards: 0, stat: p.stats[r.stat].name, levelUp: r.levelChange > 0, capped: completing && r.xp < TASK_XP },
          });
        },

        triggerFall(now = new Date()) { patch(p => fall(p, now.getTime())); },
        reset() { set({ profile: newProfile(), lastJudgment: null, gain: null, celebration: null }); },
        restartProgress(now = new Date()) {
          const p = get().profile;
          const fresh = newProfile();
          set({
            profile: {
              ...fresh,
              name: p.name, onboarded: p.onboarded, tutorialDone: p.tutorialDone, protocol: p.protocol, quests: p.quests, rewards: p.rewards,
              stats: Object.fromEntries(Object.entries(p.stats).map(([k, st]) => [k, { ...st, level: 1, xp: 0 }])) as Profile['stats'],
              tasks: p.tasks.map(t => ({ ...t, doneAt: undefined, xpEarned: undefined })),
              dreams: p.dreams.map(d => ({ ...d, achievedAt: undefined, active: true, milestones: d.milestones.map(m => ({ ...m, doneAt: undefined })) })),
              startKey: todayKey(p, now),
            },
            lastJudgment: null, gain: null, celebration: null,
          });
        },
        importProfile(json) {
          try {
            const raw = JSON.parse(json);
            if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.quests)) return false;
            set({ profile: migrate(raw), lastJudgment: null });
            return true;
          } catch {
            return false;
          }
        },
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
