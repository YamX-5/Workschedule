// Themes. Every palette has the same roles as the original darkness tokens, so `c.white` always means
// "main foreground" and `c.black` "page background", even on the light sakura theme where they invert.
import { StyleSheet } from 'react-native';
import { useYami } from '../data/store';
import { THEME_IDS, type ThemeId } from '../domain/types';

const a = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/** fg: text + primary fills; bg: page; deep: tonal panel/tag colour that contrasts with fg; accent; soft: secondary accent (losses, errors). */
function palette(fg: string, bg: string, deep: string, accent: string, soft: string, glass: string, bar: string, glow = fg) {
  return {
    white: fg, black: bg, purple: deep, purpleHi: accent, blue: accent, purpleSoft: soft,
    white2: a(fg, 0.78), white3: a(fg, 0.62), line: a(fg, 0.14), glass,
    // ink = foreground on the inverse ("tone=white") panel, which is painted in fg.
    ink: bg, ink2: a(bg, 0.7), inkLine: a(bg, 0.14), inkEdge: a(bg, 0.34),
    blue2: a(accent, 0.55), blue3: a(accent, 0.18),
    field: a(bg, 0.6), bar, scrim: a(bg, 0.9), glow,
  };
}
export type Palette = ReturnType<typeof palette>;
export interface Theme { id: ThemeId; name: string; dark: boolean; c: Palette }

export const THEMES: Record<ThemeId, Theme> = {
  darkness: { id: 'darkness', name: 'Darkness', dark: true, c: { ...palette('#F2F0F7', '#030308', '#2A1252', '#8FDCFF', '#9B78F2', 'rgba(11,9,21,0.82)', '#0B0915'), purpleHi: '#6B3BD9', white3: 'rgba(242,240,247,0.6)', ink2: 'rgba(3,3,8,0.66)', inkLine: 'rgba(3,3,8,0.12)', inkEdge: 'rgba(3,3,8,0.32)' } },
  sakura: { id: 'sakura', name: 'Sakura', dark: false, c: palette('#2B1B22', '#FFF5F8', '#F7C6D6', '#B8336A', '#8A3FA0', 'rgba(255,255,255,0.78)', '#FFFFFF', '#FFFFFF') },
  abyss: { id: 'abyss', name: 'Abyss', dark: true, c: palette('#E6F5F6', '#02090F', '#0B3A4C', '#3FE0D0', '#82A8FF', 'rgba(5,20,30,0.84)', '#061620') },
  ember: { id: 'ember', name: 'Ember', dark: true, c: palette('#F8EEE2', '#0A0604', '#4A2410', '#FFB347', '#FF8266', 'rgba(24,14,8,0.84)', '#170E08') },
  jade: { id: 'jade', name: 'Jade', dark: true, c: palette('#E8F5EE', '#04100B', '#0E3D2A', '#6FE3A8', '#B9A6FF', 'rgba(8,27,19,0.84)', '#0A1E16') },
};

export const themeOf = (id: unknown): Theme => THEMES[THEME_IDS.includes(id as ThemeId) ? (id as ThemeId) : 'darkness'];
export const useTheme = () => useYami(s => themeOf(s.profile.protocol.theme));
export const useColors = () => useTheme().c;

/** StyleSheet whose colours follow the active theme. One sheet is built per palette and cached. */
type Styles = Parameters<typeof StyleSheet.create>[0];
export function themed<T extends Styles>(make: (colors: Palette) => T & Styles) {
  const cache = new Map<Palette, Readonly<T>>();
  return (): Readonly<T> => {
    const c = useColors();
    const hit = cache.get(c);
    if (hit) return hit;
    const s = StyleSheet.create(make(c));
    cache.set(c, s);
    return s;
  };
}
