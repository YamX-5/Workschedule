import type { StatState } from './types';

/** Each level costs 45 XP more than the last. Tuned so player LV 100 (Supreme) takes ~6 months of
 *  perfect days and ~9 months at a realistic 75%; see the pace test in __tests__/forms.test.ts. */
export const XP_STEP = 45;
export const xpToNext = (level: number) => 100 + XP_STEP * (level - 1);

/** Levels carry overflow upward and can drop (LEVEL LOST). Floor: level 1, xp 0. */
export function applyXp(s: StatState, delta: number): { stat: StatState; levelChange: number } {
  let level = s.level;
  let xp = s.xp + delta;
  while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++; }
  while (xp < 0) {
    if (level === 1) { xp = 0; break; }
    level--;
    xp += xpToNext(level);
  }
  return { stat: { ...s, level, xp }, levelChange: level - s.level };
}
