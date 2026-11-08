import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

export const spring = { damping: 18, stiffness: 220 } as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setRm).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRm);
    return () => sub.remove();
  }, []);
  return rm;
}

// Haptics are fire-and-forget; they no-op on most web browsers.
export const tap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const warn = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); };
