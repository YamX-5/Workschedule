// Yami design tokens. Palette is exactly 4 hues (Plan 1 Global Constraints) plus alpha variants.
export const colors = {
  white: '#F2F0F7',
  black: '#030308',
  purple: '#2A1252',
  purpleHi: '#6B3BD9',
  blue: '#8FDCFF',
  // alpha / tonal variants of the same 4 hues
  white2: 'rgba(242,240,247,0.78)',
  white3: 'rgba(242,240,247,0.6)',
  line: 'rgba(242,240,247,0.14)',
  glass: 'rgba(11,9,21,0.82)',
  ink: '#030308',
  ink2: 'rgba(3,3,8,0.66)',
  inkLine: 'rgba(3,3,8,0.12)',
  blue2: 'rgba(143,220,255,0.55)',
  blue3: 'rgba(143,220,255,0.18)',
  purpleSoft: '#9B78F2',
} as const;

export const font = {
  display: 'Michroma_400Regular',
  text: 'ChakraPetch_500Medium',
  textSemi: 'ChakraPetch_600SemiBold',
  textBold: 'ChakraPetch_700Bold',
} as const;

export const size = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 34, hero: 56 } as const;
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32 } as const;

export const TAB_BAR_H = 64;
