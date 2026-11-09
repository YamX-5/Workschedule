import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { font, space } from './tokens';
import { useColors, type Palette } from './theme';
import { T } from './Text';
import { spring, tap } from './motion';

type Variant = 'primary' | 'ghost' | 'outline' | 'seal' | 'dark' | 'danger';
const AP = Animated.createAnimatedComponent(Pressable);

/** Press scale 0.97, light haptic. Min 44pt tall. */
export function Button({ label, onPress, variant = 'primary', disabled, style, icon, testID, small }: {
  label: string; onPress?: () => void; variant?: Variant; disabled?: boolean; style?: ViewStyle; icon?: ReactNode; testID?: string; small?: boolean;
}) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const v = variants(useColors())[variant];
  return (
    <AP
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => { sc.value = withSpring(0.97, spring); }}
      onPressOut={() => { sc.value = withSpring(1, spring); }}
      onPress={() => { tap(); onPress?.(); }}
      style={[s.base, small && s.small, v.box, disabled && { opacity: 0.4 }, a, style]}
    >
      {icon}
      <T style={[s.label, small && { fontSize: 11 }, { color: v.color }]}>{label}</T>
    </AP>
  );
}

const variants = (c: Palette): Record<Variant, { box: ViewStyle; color: string }> => ({
  primary: { box: { backgroundColor: c.white }, color: c.black },
  dark: { box: { backgroundColor: c.black }, color: c.white },
  ghost: { box: { borderWidth: 1, borderColor: c.blue2 }, color: c.white },
  outline: { box: { borderWidth: 1, borderColor: c.inkEdge }, color: c.ink },
  seal: { box: { backgroundColor: c.blue }, color: c.black },
  danger: { box: { backgroundColor: c.purple, borderWidth: 1, borderColor: c.purpleSoft }, color: c.white },
});

const s = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: space.s4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s2 },
  small: { minHeight: 44, paddingHorizontal: space.s3 },
  label: { fontFamily: font.display, fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase' },
});
