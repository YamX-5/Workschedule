import { useEffect, useRef, useState } from 'react';

export const HOLD_SEC = 45;
export const EARN_PER_SET = 10;

/** Counts down on elapsed wall time, so a backgrounded app never "loses" seconds. */
export function useHoldTimer(sec: number, onComplete: () => void) {
  const [left, setLeft] = useState(sec);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const cb = useRef(onComplete);
  cb.current = onComplete;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      // Stop this interval right away: the next tick can land before React re-runs the effect.
      if (l === 0) { clearInterval(t); setRunning(false); cb.current(); }
    }, 200);
    return () => clearInterval(t);
  }, [running]);
  return {
    left, running,
    start: () => { endAt.current = Date.now() + left * 1000; setRunning(true); },
    pause: () => setRunning(false),
    reset: () => { setRunning(false); setLeft(sec); },
  };
}
