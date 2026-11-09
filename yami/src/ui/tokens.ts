// Yami design tokens. Colours live in ./theme (five themes, same roles); read them with useColors() so a theme switch re-renders.
import { THEMES } from './theme';

/** @deprecated Static darkness palette, kept so older code compiles. Use useColors() / themed() instead. */
export const colors = THEMES.darkness.c;

export const font = {
  display: 'Michroma_400Regular',
  text: 'ChakraPetch_500Medium',
  textSemi: 'ChakraPetch_600SemiBold',
  textBold: 'ChakraPetch_700Bold',
} as const;

export const size = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 34, hero: 56 } as const;
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32 } as const;

export const TAB_BAR_H = 64;
