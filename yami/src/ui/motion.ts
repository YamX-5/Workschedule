import { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const spring = { damping: 18, stiffness: 220 } as const;
/** Strong ease-out for UI (enter, value changes). Never ease-in on UI. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** On-screen movement and loops (ease-in-out). */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** Press feedback: fast, felt on press-in. */
export const PRESS = { duration: 120, easing: EASE_OUT } as const;
/** Value changes (bars, chips): short ease-out. */
export const VALUE = { duration: 420, easing: EASE_OUT } as const;

/** Panel entrance on screen mount: 8px rise + fade, staggered 50ms. Reanimated skips it under reduced motion. */
export const enter = (i: number) =>
  FadeInDown.duration(260).delay(Math.min(i, 6) * 50).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });

/** System reduced-motion setting (synchronous, no state). */
export const useReduceMotion = useReducedMotion;

// Haptics are fire-and-forget; they no-op on most web browsers.
export const tap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const warn = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); };
