import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { font } from './tokens';
import { T } from './Text';
import { success, tap } from './motion';
import { themed } from './theme';

export const HOLD_MS = 1200;

/** Fires only after HOLD_MS of continuous press. */
export function HoldButton({ label, onComplete, disabled, testID }: { label: string; onComplete: () => void; disabled?: boolean; testID?: string }) {
  const s = useS();
  const prog = useSharedValue(0);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + prog.value * 0.6 }], opacity: prog.value }));
  const cancel = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
    cancelAnimation(prog);
    prog.value = withTiming(0, { duration: 200 });
  };
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Press and hold to ${label}`} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        tap();
        prog.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
        t.current = setTimeout(() => { t.current = null; success(); onComplete(); }, HOLD_MS);
      }}
      onPressOut={cancel}
      style={[s.ring, disabled && { opacity: 0.35 }]}>
      <Animated.View style={[s.fill, a]} />
      <View style={s.core}><T style={s.lbl}>{label}</T></View>
    </Pressable>
  );
}

const useS = themed(colors => ({
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.blue2, alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: colors.blue },
  core: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  lbl: { fontFamily: font.display, fontSize: 10, letterSpacing: 1.5, color: colors.black, textAlign: 'center' },
}));
