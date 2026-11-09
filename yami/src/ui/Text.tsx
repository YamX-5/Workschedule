import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { font, size } from './tokens';
import { useColors, type Palette } from './theme';

type Variant = 'display' | 'label' | 'body' | 'num' | 'kana';
const V: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: size.sm, letterSpacing: 2, textTransform: 'uppercase' },
  label: { fontFamily: font.textSemi, fontSize: size.xs, letterSpacing: 1.4, textTransform: 'uppercase' },
  body: { fontFamily: font.text, fontSize: size.md, lineHeight: 21 },
  num: { fontFamily: font.display, fontSize: size.lg, fontVariant: ['tabular-nums'] },
  kana: { fontFamily: font.text, fontSize: size.xs, letterSpacing: 1 },
};
const TONE: Record<Variant, keyof Palette> = { display: 'white', label: 'white3', body: 'white', num: 'white', kana: 'blue' };

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  const c = useColors();
  return <RNText {...rest} style={[V[v], { color: c[TONE[v]] }, style]} />;
}
