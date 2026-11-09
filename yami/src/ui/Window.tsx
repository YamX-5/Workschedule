import { useEffect, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { space } from './tokens';
import { themed, useColors } from './theme';
import { T } from './Text';
import { useReduceMotion } from './motion';

/** HUD frame with corner brackets. Opens line-then-expand (scaleY), instant under reduce-motion. */
export function Window({ title, kana, meta, tone = 'glass', children, style }: {
  title?: string; kana?: string; meta?: ReactNode; tone?: 'glass' | 'white'; children: ReactNode; style?: ViewStyle;
}) {
  const colors = useColors();
  const s = useS();
  const rm = useReduceMotion();
  const open = useSharedValue(rm ? 1 : 0.02);
  useEffect(() => {
    open.value = rm ? 1 : withTiming(1, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [rm, open]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: open.value }], opacity: 0.4 + open.value * 0.6 }));
  const light = tone === 'white';
  return (
    <Animated.View testID="window" style={[s.win, light ? s.light : s.glass, a, style]}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {title ? (
        <View style={s.head}>
          <T v="display" style={[s.title, light && { color: colors.ink }]}>{title}</T>
          {kana ? <T v="kana" style={light ? { color: colors.purple } : undefined}>{kana}</T> : null}
          <View style={{ flex: 1 }} />
          {typeof meta === 'string' ? <T v="body" style={[s.meta, light && { color: colors.ink2 }]}>{meta}</T> : meta}
        </View>
      ) : null}
      {children}
    </Animated.View>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = useS();
  const top = pos[0] === 't', left = pos[1] === 'l';
  return (
    <View pointerEvents="none" style={[s.corner, {
      [top ? 'top' : 'bottom']: -1, [left ? 'left' : 'right']: -1,
      [top ? 'borderTopWidth' : 'borderBottomWidth']: 2, [left ? 'borderLeftWidth' : 'borderRightWidth']: 2,
    }]} />
  );
}

const useS = themed(colors => ({
  win: { padding: space.s4, borderWidth: 1 },
  glass: { backgroundColor: colors.glass, borderColor: colors.line },
  light: { backgroundColor: colors.white, borderColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2, marginBottom: space.s3 },
  title: { fontSize: 12 },
  meta: { fontSize: 13, color: colors.white3 },
  corner: { position: 'absolute', width: 14, height: 14, borderColor: colors.blue },
}));
