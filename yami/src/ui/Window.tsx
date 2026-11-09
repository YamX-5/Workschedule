import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { space } from './tokens';
import { themed, useColors } from './theme';
import { T } from './Text';

/** HUD frame with corner brackets. Its entrance is staggered by the Screen / ModalScreen that holds it (motion.enter). */
export function Window({ title, kana, meta, tone = 'glass', children, style }: {
  title?: string; kana?: string; meta?: ReactNode; tone?: 'glass' | 'white'; children: ReactNode; style?: ViewStyle;
}) {
  const colors = useColors();
  const s = useS();
  const light = tone === 'white';
  return (
    <View testID="window" style={[s.win, light ? s.light : s.glass, style]}>
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
    </View>
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
