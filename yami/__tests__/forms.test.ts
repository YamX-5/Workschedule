import { newProfile } from '../src/domain/defaults';
import { judgeDay } from '../src/domain/judgment';
import { addDays } from '../src/domain/time';
import { playerLevel } from '../src/domain/progress';
import { FORMS, formFor, nextForm } from '../src/domain/forms';
import type { Profile } from '../src/domain/types';

test('a form every 10 levels, Supreme at 100', () => {
  expect(FORMS).toHaveLength(11);
  expect(formFor(5).name).toBe('Dormant');
  expect(formFor(10).name).toBe('Awakened');
  expect(formFor(59).tier).toBe(5);
  expect(formFor(100).name).toBe('The Chosen One');
  expect(formFor(140).name).toBe('The Chosen One');
  expect(nextForm(35)?.minLevel).toBe(40);
  expect(nextForm(100)).toBeNull();
});

/** Plays the 5 seed quests from day 1, clearing a fixed share of days, and returns the day LV 100 is reached. */
function daysTo100(clearEvery: (day: number) => boolean): number {
  let p: Profile = newProfile();
  let key = '2026-11-08';
  for (let day = 1; day <= 800; day++) {
    if (clearEvery(day)) {
      p = { ...p, reports: p.quests.map(q => ({ questId: q.id, dayKey: key, kind: 'done' as const, units: q.target, at: 0, late: false })) };
    } else {
      p = { ...p, reports: p.quests.map(q => ({ questId: q.id, dayKey: key, kind: 'didnt' as const, units: 0, at: 0, late: false })) };
    }
    p = judgeDay(p, key).profile;
    p = { ...p, reports: [] };
    if (playerLevel(p) >= 100) return day;
    key = addDays(key, 1);
  }
  return Infinity;
}

test('pace: perfect days reach Supreme in about 6 months', () => {
  const d = daysTo100(() => true);
  expect(d).toBeGreaterThanOrEqual(150);
  expect(d).toBeLessThanOrEqual(220);
});

test('pace: clearing 3 days in 4 (honest misses) takes 7 to 12 months', () => {
  const d = daysTo100(day => day % 4 !== 0);
  expect(d).toBeGreaterThanOrEqual(210);
  expect(d).toBeLessThanOrEqual(365);
});
