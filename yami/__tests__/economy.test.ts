import { useYami } from '../src/data/store';
import { migrate } from '../src/data/migrate';
import { newProfile } from '../src/domain/defaults';
import { applyXp } from '../src/domain/xp';
import { playerLevel, milestoneBlock } from '../src/domain/progress';
import { DAILY_XP_CAP, MAX_QUESTS, TASK_XP, TASKS_REWARDED_PER_DAY, sanitizeQuest } from '../src/domain/economy';
import type { Quest, StatId } from '../src/domain/types';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const S = () => useYami.getState();
beforeEach(() => S().reset());
const NOON = new Date('2026-11-08T12:00:00');
const q = (id: string, xp: number, extra: Partial<Quest> = {}): Quest =>
  ({ id, title: id, stat: 'mind', xp, type: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00', ...extra });

describe('economy limits', () => {
  test('a typed-in huge XP value is clamped to the Epic tier', () => {
    expect(sanitizeQuest(q('x', 99999999)).xp).toBe(50);
    expect(sanitizeQuest(q('x', 99999999, { type: 'count', target: 5000 })).target).toBe(20);
    S().upsertQuest(q('hack', 1e12));
    expect(S().profile.quests.find(x => x.id === 'hack')!.xp).toBe(50);
  });
  test('an old saved profile with absurd quest XP is clamped on load', () => {
    const old = { ...newProfile(), quests: [q('a', 9e15)] };
    expect(migrate(JSON.parse(JSON.stringify(old))).quests[0].xp).toBe(50);
  });
  test('no more than MAX_QUESTS quests', () => {
    for (let i = 0; i < 20; i++) S().upsertQuest(q(`q${i}`, 20));
    expect(S().profile.quests.length).toBe(MAX_QUESTS);
  });
  test('daily XP cap: 20 epic quests in one day pay at most the cap', () => {
    S().profile.quests.forEach(x => S().deleteQuest(x.id));
    for (let i = 0; i < MAX_QUESTS; i++) S().upsertQuest(q(`e${i}`, 50, { stat: (['deen', 'body', 'mind', 'craft', 'rest'] as StatId[])[i % 5] }));
    S().profile.quests.forEach(x => S().report(x.id, 'done', 1, NOON));
    const banked = S().profile.reports.reduce((a, r) => a + (r.xp ?? 0), 0);
    expect(banked).toBe(DAILY_XP_CAP);
    expect(S().profile.usage.xpEarned).toBe(DAILY_XP_CAP);
    expect(S().gain?.capped).toBe(true);
  });
  test('Judgment does not top up XP that the cap withheld', () => {
    S().runJudgment(NOON);
    S().profile.quests.forEach(x => S().deleteQuest(x.id));
    for (let i = 0; i < MAX_QUESTS; i++) S().upsertQuest(q(`e${i}`, 50));
    S().profile.quests.forEach(x => S().report(x.id, 'done', 1, NOON));
    const mind = S().profile.stats.mind;
    S().runJudgment(new Date('2026-11-09T09:00:00'));
    expect(S().profile.stats.mind).toEqual(mind);
  });
  test(`only ${TASKS_REWARDED_PER_DAY} to-dos a day pay XP`, () => {
    for (let i = 0; i < 9; i++) S().addTask({ id: `t${i}`, title: `t${i}`, xp: TASK_XP, stat: 'craft' });
    for (let i = 0; i < 9; i++) S().toggleTask(`t${i}`, NOON);
    const paid = S().profile.tasks.reduce((a, t) => a + (t.xpEarned ?? 0), 0);
    expect(paid).toBe(TASK_XP * TASKS_REWARDED_PER_DAY);
  });
  test('milestones: not on the day the dream was made, and one a day', () => {
    const day1 = new Date('2026-11-08T10:00:00').getTime();
    const p = { ...newProfile(), dreams: [{ id: 'd', title: 'D', why: '', stat: 'body' as const, createdAt: day1, active: true,
      milestones: [{ id: 'a', title: 'a' }, { id: 'b', title: 'b' }] as { id: string; title: string; doneAt?: number }[] }] };
    expect(milestoneBlock(p, 'd', day1 + 3600e3)).toMatch(/tomorrow/);
    const day2 = day1 + 86400e3;
    expect(milestoneBlock(p, 'd', day2)).toBeNull();
    p.dreams[0].milestones[0] = { ...p.dreams[0].milestones[0], doneAt: day2 };
    expect(milestoneBlock(p, 'd', day2 + 60e3)).toMatch(/One milestone a day/);
  });
  test('restart progress: LV back to the start, setup kept', () => {
    S().upsertQuest(q('mine', 35));
    useYami.setState(s => ({ profile: { ...s.profile, shards: 9e15, stats: { ...s.profile.stats, mind: applyXp(s.profile.stats.mind, 50000).stat } } }));
    S().restartProgress(NOON);
    expect(playerLevel(S().profile)).toBe(5);
    expect(S().profile.shards).toBe(0);
    expect(S().profile.quests.some(x => x.id === 'mine')).toBe(true);
  });
});

/** The hard ceiling: even earning the full daily cap every single day, spread perfectly, LV 100 takes this many days. */
test('at the daily cap ceiling, LV 100 still takes 5+ months', () => {
  let p = newProfile();
  const ids: StatId[] = ['deen', 'body', 'mind', 'craft', 'rest'];
  let day = 0;
  while (playerLevel(p) < 100 && day < 1000) {
    day++;
    const stats = { ...p.stats };
    ids.forEach(k => { stats[k] = applyXp(stats[k], DAILY_XP_CAP / 5).stat; });
    p = { ...p, stats };
  }
  expect(day).toBeGreaterThanOrEqual(150);
});
