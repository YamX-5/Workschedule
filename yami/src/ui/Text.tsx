import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, font, size } from './tokens';

type Variant = 'display' | 'label' | 'body' | 'num' | 'kana';
const V: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: size.sm, letterSpacing: 2, textTransform: 'uppercase', color: colors.white },
  label: { fontFamily: font.textSemi, fontSize: size.xs, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.white3 },
  body: { fontFamily: font.text, fontSize: size.md, color: colors.white, lineHeight: 21 },
  num: { fontFamily: font.display, fontSize: size.lg, color: colors.white, fontVariant: ['tabular-nums'] },
  kana: { fontFamily: font.text, fontSize: size.xs, color: colors.blue, letterSpacing: 1 },
};

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <RNText {...rest} style={[V[v], style]} />;
}
