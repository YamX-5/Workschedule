import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { font, space } from './tokens';
import { useColors, type Palette } from './theme';
import { T } from './Text';
import { Press } from './Press';

type Variant = 'primary' | 'ghost' | 'outline' | 'seal' | 'dark' | 'danger';

/** Press scale 0.97 + light haptic on press-in (see Press). Min 44pt tall. */
export function Button({ label, onPress, variant = 'primary', disabled, style, icon, testID, small }: {
  label: string; onPress?: () => void; variant?: Variant; disabled?: boolean; style?: ViewStyle; icon?: ReactNode; testID?: string; small?: boolean;
}) {
  const v = variants(useColors())[variant];
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.base, small && s.small, v.box, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <T style={[s.label, small && { fontSize: 11 }, { color: v.color }]}>{label}</T>
    </Press>
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
