import type { StatState } from './types';

export const xpToNext = (level: number) => (level <= 7 ? 100 : 100 + (level - 7) * 12);

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
