jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { migrate } from '../src/data/migrate';
import { newProfile } from '../src/domain/defaults';
import { THEME_IDS } from '../src/domain/types';
import { useYami } from '../src/data/store';
import { THEMES, type Palette } from '../src/ui/theme';
import { Screen } from '../src/ui/parts';
import { T } from '../src/ui/Text';

describe('theme', () => {
  beforeEach(() => useYami.getState().reset());

  test('an old profile with no theme migrates to darkness; junk is replaced', () => {
    const old = newProfile() as unknown as { protocol: Record<string, unknown> };
    delete old.protocol.theme;
    expect(migrate(old).protocol.theme).toBe('darkness');
    expect(migrate({ ...old, protocol: { ...old.protocol, theme: 'neon' } }).protocol.theme).toBe('darkness');
    expect(migrate({ ...old, protocol: { ...old.protocol, theme: 'jade' } }).protocol.theme).toBe('jade');
  });

  test('switching theme is saved in the store and written to storage', async () => {
    await act(async () => { useYami.getState().updateProtocol({ theme: 'sakura' }); });
    expect(useYami.getState().profile.protocol.theme).toBe('sakura');
    const saved = await AsyncStorage.getItem('yami.profile.v1');
    expect(saved).toContain('"theme":"sakura"');
  });

  test('a rendered screen paints the active theme background', async () => {
    const hasBg = (n: unknown, bg: string): boolean => {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some(x => hasBg(x, bg));
      const o = n as { props?: { style?: unknown }; children?: unknown };
      const st = [o.props?.style].flat(Infinity) as ({ backgroundColor?: string } | undefined)[];
      return st.some(x => x?.backgroundColor === bg) || hasBg(o.children, bg);
    };
    await act(async () => { useYami.getState().updateProtocol({ theme: 'sakura' }); });
    await render(<Screen hud={false}><T>hi</T></Screen>);
    expect(hasBg(screen.toJSON(), THEMES.sakura.c.black)).toBe(true);
    expect(hasBg(screen.toJSON(), THEMES.darkness.c.black)).toBe(false);
    await act(async () => { useYami.getState().updateProtocol({ theme: 'ember' }); });
    expect(hasBg(screen.toJSON(), THEMES.ember.c.black)).toBe(true);
  }, 60_000); // first render of the SVG backdrop is slow on a loaded machine

  // WCAG 2.x relative luminance / contrast, alpha colours blended over what they sit on.
  const rgb = (c: string, under = [0, 0, 0]): number[] => {
    if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    const [r, g, b, a = 1] = c.slice(c.indexOf('(') + 1, -1).split(',').map(Number);
    return [r, g, b].map((v, i) => v * a + under[i] * (1 - a));
  };
  const lum = (x: number[]) => x.map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (fg: string, bg: string, page?: string) => {
    const b = rgb(bg, page ? rgb(page) : undefined), f = rgb(fg, b);
    const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // [foreground role, background role]: every pairing the screens use for body text.
  const PAIRS: [keyof Palette, keyof Palette][] = [
    ['white', 'black'], ['white2', 'black'], ['white3', 'black'], ['blue', 'black'], ['purpleSoft', 'black'],
    ['white', 'glass'], ['white3', 'glass'], ['blue', 'glass'], ['purpleSoft', 'glass'],
    ['black', 'white'], ['black', 'blue'], ['ink', 'white'], ['ink2', 'white'], ['purple', 'white'], ['white', 'purple'],
  ];
  test('darkness is purple: no ice-blue left in any role', () => {
    const vals = Object.values(THEMES.darkness.c).join(' ').toUpperCase();
    expect(vals).not.toContain('8FDCFF');
    expect(vals).not.toContain('143,220,255'); // the same blue as an rgba() tint
    expect(THEMES.darkness.c.blue).toBe('#9B5CFF');
  });

  test.each(THEME_IDS)('%s palette passes WCAG AA (4.5:1) for body text', id => {
    const c = THEMES[id].c;
    const fails = PAIRS.map(([f, b]) => [f, b, ratio(c[f], c[b], c.black)] as const).filter(([, , r]) => r < 4.5);
    expect(fails).toEqual([]);
  });
});
