import { dayKey, addDays } from '../src/domain/time';
import { newProfile, defaultProtocol } from '../src/domain/defaults';
import { frictionSec, phoneState, minutesLeft, canOpen } from '../src/domain/budget';
import { applyXp, xpToNext } from '../src/domain/xp';
import { judgeDay } from '../src/domain/judgment';
import { fall } from '../src/domain/fall';
import {
  playerLevel, rankFor, shardsFor, nextStreak, dayHolds, checkRecords,
  completeMilestone, claimReward, addDream,
} from '../src/domain/progress';
import type { DaySummary, Profile, Report } from '../src/domain/types';

// ---------------- Task 2: time + defaults ----------------
describe('time', () => {
  const fajr = (d: string) => new Date(`${d}T05:41:00`);
  test('after Fajr belongs to today', () => expect(dayKey(new Date('2026-11-08T13:00:00'), fajr('2026-11-08'))).toBe('2026-11-08'));
  test('01:30 belongs to the previous day', () => expect(dayKey(new Date('2026-11-09T01:30:00'), fajr('2026-11-09'))).toBe('2026-11-08'));
  test('exactly at Fajr starts the new day', () => expect(dayKey(new Date('2026-11-09T05:41:00'), fajr('2026-11-09'))).toBe('2026-11-09'));
  test('newProfile has 5 seeded quests and honor 50', () => { const p = newProfile(); expect(p.quests).toHaveLength(5); expect(p.honor).toBe(50); expect(p.schemaVersion).toBe(1); });
  test('defaultProtocol uses spec values', () => expect(defaultProtocol()).toMatchObject({ capMin: 120, reserveMin: 30, windDown: '22:30', sleepTarget: '23:00', fajrAlarm: '05:30', preset: 'balanced' }));
  test('addDays crosses months', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'));
});

// ---------------- Task 3: budget ----------------
describe('budget', () => {
  test('tiers at cap 120', () => { expect(frictionSec(60, 120)).toBe(5); expect(frictionSec(90, 120)).toBe(15); expect(frictionSec(105, 120)).toBe(30); expect(frictionSec(120, 120)).toBeNull(); });
  test('cap lowered below used goes straight to limit', () => expect(phoneState(100, 60, 0, 30, false)).toBe('limit'));
  test('reserve open and draining', () => expect(phoneState(120, 120, 10, 30, true)).toBe('reserve'));
  test('reserve exhausted seals', () => expect(phoneState(130, 120, 30, 30, true)).toBe('sealed'));
  test('reserve of 0 seals immediately at cap', () => expect(phoneState(120, 120, 0, 0, false)).toBe('sealed'));
  test('minutesLeft never negative', () => expect(minutesLeft(150, 120)).toBe(0));
  test('always-open apps open even when sealed', () => expect(canOpen('Phone', 'always', 'sealed', new Date('2026-11-08T23:30'), []).allowed).toBe(true));
  test('work app only inside a window', () => {
    const w = [{ from: '13:00', to: '13:20' }];
    expect(canOpen('Meta Business Suite', 'work', 'sealed', new Date('2026-11-08T13:10'), w)).toEqual({ allowed: true, reason: 'work-window' });
    expect(canOpen('Meta Business Suite', 'work', 'open', new Date('2026-11-08T14:00'), w)).toEqual({ allowed: false, reason: 'outside-window' });
  });
  test('watched app sealed', () => expect(canOpen('Instagram', 'watched', 'sealed', new Date(), []).reason).toBe('sealed'));
});

// ---------------- Task 4: xp ----------------
describe('xp', () => {
  const s = (level: number, xp: number) => ({ level, xp, enabled: true, name: 'BODY' });
  test('gain within level', () => expect(applyXp(s(3, 40), 20)).toEqual({ stat: s(3, 60), levelChange: 0 }));
  test('level up with overflow', () => expect(applyXp(s(3, 180), 30)).toEqual({ stat: s(4, 20), levelChange: 1 }));
  test('LEVEL LOST borrows from previous level', () => expect(applyXp(s(3, 18), -30)).toEqual({ stat: s(2, 133), levelChange: -1 }));
  test('floor at level 1 xp 0', () => expect(applyXp(s(1, 10), -50)).toEqual({ stat: s(1, 0), levelChange: 0 }));
  test('xpToNext curve', () => { expect(xpToNext(1)).toBe(100); expect(xpToNext(2)).toBe(145); expect(xpToNext(20)).toBe(955); });
});

// ---------------- Task 5: judgment ----------------
const D = '2026-11-08'; // a Sunday; seeded quests are daily
const rep = (questId: string, kind: 'done' | 'didnt', units = 1, late = false, key = D): Report => ({ questId, dayKey: key, kind, units, at: 0, late });
const withReports = (reports: Report[], patch: Partial<Profile> = {}): Profile => ({ ...newProfile(), reports, ...patch });
const resultOf = (p: Profile, id: string) => judgeDay(p, D).results.find(r => r.questId === id)!;

describe('judgment', () => {
  test('cleared count quest', () => expect(resultOf(withReports([rep('rehab', 'done', 5)]), 'rehab')).toMatchObject({ xpDelta: 100, verdict: 'cleared' }));
  test('confessed, balanced', () => expect(resultOf(withReports([rep('perio', 'didnt', 0)]), 'perio')).toMatchObject({ xpDelta: 0, honorDelta: 2 }));
  test('confessed, ruthless', () => {
    const p = withReports([rep('perio', 'didnt', 0)]); p.protocol = { ...p.protocol, preset: 'ruthless' };
    expect(resultOf(p, 'perio')).toMatchObject({ xpDelta: -6, honorDelta: 2 });
  });
  test('late report', () => expect(resultOf(withReports([rep('perio', 'done', 1, true)]), 'perio')).toMatchObject({ xpDelta: 13, honorDelta: 0 }));
  test('unreported, balanced', () => {
    const out = judgeDay(withReports([]), D);
    expect(out.results.find(r => r.questId === 'rehab')).toMatchObject({ xpDelta: -30, honorDelta: -5 });
    expect(out.profile.corruptionCarryMin).toBe(50); // 5 quests unreported x 10
  });
  test('mercy / ruthless unreported', () => {
    const m = withReports([]); m.protocol = { ...m.protocol, preset: 'mercy' };
    const r = withReports([]); r.protocol = { ...r.protocol, preset: 'ruthless' };
    expect(resultOf(m, 'rehab').xpDelta).toBe(-20);
    expect(resultOf(r, 'rehab').xpDelta).toBe(-40);
  });
  test('never miss twice', () => {
    const p = withReports([rep('rehab', 'didnt', 0, false, '2026-11-07')], { judgedDays: ['2026-11-07'] });
    const out = judgeDay(p, D);
    expect(out.debuffsAdded).toContain('body');
    expect(out.profile.debuffs).toContainEqual({ stat: 'body', dayKey: '2026-11-09' });
  });
  test('Fractured', () => expect(resultOf(withReports([rep('rehab', 'done', 5)], { debuffs: [{ stat: 'body', dayKey: D }] }), 'rehab').xpDelta).toBe(80));
  test('honor clamp', () => {
    const p = withReports([rep('perio', 'didnt', 0), rep('ship', 'didnt', 0), rep('salah', 'done', 5), rep('rehab', 'done', 5), rep('sleep', 'done')], { honor: 99 });
    expect(judgeDay(p, D).profile.honor).toBe(100);
    const q = withReports([rep('perio', 'done'), rep('ship', 'done'), rep('salah', 'done', 5), rep('sleep', 'done')], { honor: 3 });
    expect(judgeDay(q, D).profile.honor).toBe(0);
  });
  test('idempotent', () => {
    const first = judgeDay(withReports([]), D).profile;
    const second = judgeDay(first, D);
    expect(second.results).toEqual([]);
    expect(second.profile).toBe(first);
  });
  test('deleted quest', () => {
    const p = withReports([rep('perio', 'done')]); p.quests = p.quests.filter(q => q.id !== 'perio');
    expect(judgeDay(p, D).results.find(r => r.questId === 'perio')).toBeUndefined();
  });
  test('edited quest', () => {
    const p = withReports([rep('perio', 'done')]); p.quests = p.quests.map(q => (q.id === 'perio' ? { ...q, xp: 50 } : q));
    expect(resultOf(p, 'perio').xpDelta).toBe(50);
  });
});

// ---------------- Task 6: fall ----------------
test('FALL keeps honor and scars', () => {
  const p = { ...newProfile(), day: 12, honor: 72 };
  p.stats = { ...p.stats, body: { ...p.stats.body, level: 4, xp: 30 } };
  const f = fall(p, 1000);
  expect(f.day).toBe(1);
  expect(f.honor).toBe(72);
  expect(f.fallRecord).toEqual([{ day: 12, at: 1000 }]);
  expect(f.scars).toBe(1);
  expect(f.quests).toEqual(p.quests);
  Object.values(f.stats).forEach(s => expect(s).toMatchObject({ level: 1, xp: 0 }));
});

// ---------------- Task 6b: progression ----------------
const day = (patch: Partial<DaySummary> = {}): DaySummary => ({
  dayKey: D, usedMin: 60, capMin: 120, cleared: 5, late: 0, confessed: 0, unreported: 0,
  xpGained: 0, xpLost: 0, shards: 0, salahOnTime: 5, rehabSets: 5, held: true, ...patch,
});

describe('progression', () => {
  test('player level and rank', () => {
    const p = newProfile();
    ([['deen', 7], ['body', 3], ['mind', 9], ['craft', 11], ['rest', 5]] as const).forEach(([k, l]) => { p.stats[k] = { ...p.stats[k], level: l }; });
    expect(playerLevel(p)).toBe(35);
    expect(rankFor(35)).toBe('D');
    expect(rankFor(14)).toBe('E');
    expect(rankFor(99)).toBe('A');
    expect(rankFor(100)).toBe('S');
  });
  test('shards', () => {
    expect(shardsFor({ questId: 'x', verdict: 'cleared', xpDelta: 100, honorDelta: 0, stat: 'body' })).toBe(10);
    expect(shardsFor({ questId: 'x', verdict: 'late', xpDelta: 13, honorDelta: 0, stat: 'mind' })).toBe(0);
    expect(shardsFor({ questId: 'x', verdict: 'confessed', xpDelta: 0, honorDelta: 2, stat: 'mind' })).toBe(0);
  });
  test('streak bends then breaks', () => {
    let s = { current: 0, best: 0, bent: false };
    s = nextStreak(s, true); s = nextStreak(s, true);
    expect(s.current).toBe(2);
    s = nextStreak(s, false);
    expect(s).toEqual({ current: 2, best: 2, bent: true });
    s = nextStreak(s, true);
    expect(s).toEqual({ current: 3, best: 3, bent: false });
    s = nextStreak(nextStreak(s, false), false);
    expect(s).toEqual({ current: 0, best: 3, bent: false });
  });
  test('day holds at 60%', () => {
    expect(dayHolds(day({ cleared: 3, confessed: 2 }), 30)).toBe(true);
    expect(dayHolds(day({ cleared: 2, confessed: 3 }), 30)).toBe(false);
    expect(dayHolds(day({ usedMin: 151 }), 30)).toBe(false);
  });
  test('records unlock once', () => {
    const p = { ...newProfile(), history: [day()] };
    expect(checkRecords(p)).toContain('firstLight');
    expect(checkRecords({ ...p, records: { firstLight: 1 } })).not.toContain('firstLight');
    const seven = { ...newProfile(), history: Array.from({ length: 7 }, () => day()), streak: { current: 7, best: 7, bent: false } };
    expect(checkRecords(seven)).toEqual(expect.arrayContaining(['sevenUnbroken', 'underCap', 'fiveGates']));
  });
  test('judgment feeds history, streak and shards', () => {
    const p = withReports([rep('salah', 'done', 5), rep('rehab', 'done', 5), rep('perio', 'done'), rep('ship', 'didnt', 0), rep('sleep', 'done')]);
    const out = judgeDay(p, D, 42).profile;
    expect(out.history).toHaveLength(1);
    expect(out.history[0]).toMatchObject({ cleared: 4, confessed: 1, held: true, rehabSets: 5, salahOnTime: 5 });
    expect(out.streak.current).toBe(1);
    expect(out.shards).toBe(7 + 10 + 2 + 3); // salah 75, rehab 100, perio 25, sleep 30
    expect(out.records.firstLight).toBe(42);
  });
  const dream = { id: 'd1', title: 'Athletic again', why: 'Play without pain', stat: 'body' as const, createdAt: 0, active: true,
    milestones: [{ id: 'm1', title: 'Wall sit 5x45s pain-free' }, { id: 'm2', title: 'Full game, no pain' }] };
  test('milestone and dream achieved', () => {
    let p = addDream(newProfile(), dream) as Profile;
    p = completeMilestone(p, 'd1', 'm1', 5);
    expect(p.stats.body).toMatchObject({ level: 2, xp: 0 });
    expect(p.shards).toBe(20);
    expect(p.dreams[0].achievedAt).toBeUndefined();
    p = completeMilestone(p, 'd1', 'm2', 6);
    expect(p.dreams[0].achievedAt).toBe(6);
    expect(p.shards).toBe(140);
    expect(p.records.dreamer).toBe(6);
    expect(p.titles).toContain('Athletic again');
    expect(completeMilestone(p, 'd1', 'm2', 7)).toBe(p); // no double pay
  });
  test('reward shop refuses when short', () => {
    const p = { ...newProfile(), shards: 100, rewards: [{ id: 'r', title: 'Shoes', cost: 600 }] };
    expect(claimReward(p, 'r', 1)).toBe('not-enough');
    const rich = claimReward({ ...p, shards: 700 }, 'r', 1) as Profile;
    expect(rich.shards).toBe(100);
    expect(rich.claims).toEqual([{ rewardId: 'r', at: 1, cost: 600 }]);
  });
  test('max 3 active dreams', () => {
    let p: Profile = newProfile();
    for (let i = 0; i < 3; i++) p = addDream(p, { ...dream, id: `d${i}` }) as Profile;
    expect(addDream(p, { ...dream, id: 'd4' })).toBe('too-many');
    expect(addDream(p, { ...dream, id: 'd5', active: false })).not.toBe('too-many');
  });
});
