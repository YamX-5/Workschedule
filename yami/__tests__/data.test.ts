jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { migrate } from '../src/data/migrate';
import { useYami, todayKey, EARN_CAP_MIN } from '../src/data/store';
import { newProfile } from '../src/domain/defaults';
import { prayerTimes, nextPrayer } from '../src/prayer/prayer';

const S = () => useYami.getState();
beforeEach(() => S().reset());

describe('migrate', () => {
  test('null -> fresh profile', () => expect(migrate(null)).toEqual(newProfile()));
  test('partial keeps known values and fills the rest', () => {
    const p = migrate({ schemaVersion: 1, honor: 80 });
    expect(p.honor).toBe(80);
    expect(p.quests).toHaveLength(5);
    expect(p.streak).toEqual({ current: 0, best: 0, bent: false });
  });
  test('garbage does not throw', () => { expect(() => migrate('garbage')).not.toThrow(); expect(migrate(42).honor).toBe(50); });
  test('wrong types fall back to defaults', () => expect(migrate({ honor: 'lots', quests: 'none' }).honor).toBe(50));
});

describe('store', () => {
  test('toggleStat refuses below 3 enabled', () => {
    expect(S().toggleStat('deen')).toBe(true);
    expect(S().toggleStat('body')).toBe(true);
    expect(S().toggleStat('mind')).toBe(false);
    expect(S().profile.stats.mind.enabled).toBe(true);
  });
  test('report after the deadline is late', () => {
    S().report('rehab', 'done', 5, new Date('2026-11-08T22:00:00')); // rehab deadline 21:00
    expect(S().profile.reports[0]).toMatchObject({ questId: 'rehab', late: true, dayKey: '2026-11-08' });
    S().report('perio', 'done', 1, new Date('2026-11-08T20:00:00'));
    expect(S().profile.reports.find(r => r.questId === 'perio')!.late).toBe(false);
  });
  test('reporting twice replaces the earlier report', () => {
    S().report('perio', 'didnt', 0, new Date('2026-11-08T12:00:00'));
    S().report('perio', 'done', 1, new Date('2026-11-08T13:00:00'));
    expect(S().profile.reports).toHaveLength(1);
  });
  test('01:30 reports count for the previous day', () => {
    S().report('sleep', 'done', 1, new Date('2026-11-09T01:30:00'));
    expect(S().profile.reports[0].dayKey).toBe('2026-11-08');
  });
  test('earned minutes cap at 30 a day', () => {
    const now = new Date('2026-11-08T12:00:00');
    S().addUsage(90, now);
    expect(S().earnMinutes(10, now)).toBe(10);
    expect(S().earnMinutes(25, now)).toBe(EARN_CAP_MIN - 10);
    expect(S().earnMinutes(10, now)).toBe(0);
    expect(S().profile.usage.usedMin).toBe(60);
  });
  test('first open sets startKey and judges nothing', () => {
    expect(S().runJudgment(new Date('2026-11-08T12:00:00'))).toBeNull();
    expect(S().profile.startKey).toBe('2026-11-08');
  });
  test('next morning judges yesterday once, and carries corruption', () => {
    S().runJudgment(new Date('2026-11-08T12:00:00'));
    S().report('perio', 'done', 1, new Date('2026-11-08T12:00:00'));
    const out = S().runJudgment(new Date('2026-11-09T09:00:00'));
    expect(out!.results).toHaveLength(5);
    expect(S().profile.judgedDays).toEqual(['2026-11-08']);
    expect(S().profile.usage).toMatchObject({ dayKey: '2026-11-09', usedMin: 40 }); // 4 unreported x 10
    expect(S().runJudgment(new Date('2026-11-09T10:00:00'))).toBeNull();
  });
  test('a long gap judges only the last 3 days', () => {
    S().runJudgment(new Date('2026-11-01T12:00:00'));
    S().runJudgment(new Date('2026-11-09T09:00:00'));
    expect(S().profile.history.map(h => h.dayKey)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(S().profile.judgedDays).toHaveLength(8);
  });
  test('claimReward refuses when short', () => {
    S().upsertReward({ id: 'r', title: 'Cinema', cost: 250 });
    expect(S().claimReward('r')).toBe(false);
  });
  test('todayKey before Fajr is yesterday', () => expect(todayKey(S().profile, new Date('2026-11-09T03:00:00'))).toBe('2026-11-08'));
});

describe('prayer', () => {
  const t = prayerTimes(new Date('2026-11-08T12:00:00'), { lat: 31.95, lng: 35.93 }, 'MuslimWorldLeague');
  test('order and date', () => {
    expect(t.fajr < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha).toBe(true);
    Object.values(t).forEach(d => expect(d.getDate()).toBe(8));
  });
  test('next prayer at 13:00 is asr', () => expect(nextPrayer(new Date('2026-11-08T13:00:00'), t).name).toBe('asr'));
});
