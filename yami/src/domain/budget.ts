// Limit -> Reserve -> Sealed (spec §11). Friction tiers from Plan 1 Global Constraints.
import type { AppCategory, Window } from './types';
import { hhmmToMin } from './time';

export type PhoneState = 'open' | 'limit' | 'reserve' | 'sealed';

export function frictionSec(usedMin: number, capMin: number): 5 | 15 | 30 | null {
  if (usedMin >= capMin) return null;
  if (usedMin < capMin - 30) return 5;
  if (usedMin < capMin - 15) return 15;
  return 30;
}

export function phoneState(usedMin: number, capMin: number, reserveUsedMin: number, reserveMin: number, reserveOpen: boolean): PhoneState {
  if (usedMin < capMin) return 'open';
  if (reserveMin <= 0 || reserveUsedMin >= reserveMin) return 'sealed';
  return reserveOpen ? 'reserve' : 'limit';
}

export const minutesLeft = (usedMin: number, capMin: number) => Math.max(0, capMin - usedMin);

export function inWindow(now: Date, windows: Window[]): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  return windows.some(w => m >= hhmmToMin(w.from) && m < hhmmToMin(w.to));
}

export type OpenReason = 'always' | 'work-window' | 'outside-window' | 'watched-open' | 'needs-reserve' | 'sealed';

export function canOpen(_app: string, category: AppCategory, state: PhoneState, now: Date, workWindows: Window[]): { allowed: boolean; reason: OpenReason } {
  if (category === 'always') return { allowed: true, reason: 'always' };
  if (category === 'work') return inWindow(now, workWindows) ? { allowed: true, reason: 'work-window' } : { allowed: false, reason: 'outside-window' };
  if (state === 'open' || state === 'reserve') return { allowed: true, reason: 'watched-open' };
  if (state === 'limit') return { allowed: false, reason: 'needs-reserve' };
  return { allowed: false, reason: 'sealed' };
}
