jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { act, render, screen } from '@testing-library/react-native';
import { useYami } from '../src/data/store';
import { THEME_IDS } from '../src/domain/types';
import { Aura, auraSpecs } from '../src/ui/Aura';

describe('aura', () => {
  test('more elements as the tier rises, the same layout every time', () => {
    for (const th of THEME_IDS) {
      expect(auraSpecs(th, 10).length).toBeGreaterThan(auraSpecs(th, 0).length);
      expect(auraSpecs(th, 5)).toEqual(auraSpecs(th, 5));
      expect(auraSpecs(th, 99).length).toBe(auraSpecs(th, 10).length);
    }
  });

  test('darkness is purple smoke, never ice blue', () => {
    const s = auraSpecs('darkness', 10);
    expect(s.some(x => x.kind === 'wisp')).toBe(true);
    for (const x of s) expect(x.color.toUpperCase()).not.toMatch(/8FDCFF|3FE0D0/);
  });

  test('each theme has its own motif', () => {
    const main = (th: (typeof THEME_IDS)[number]) => auraSpecs(th, 3).find(x => x.kind !== 'mote')?.kind;
    expect(THEME_IDS.map(main)).toEqual(['wisp', 'petal', 'ring', 'spark', 'leaf']);
  });

  test('renders behind the sprite for the active theme', async () => {
    useYami.getState().reset();
    await act(async () => { useYami.getState().updateProtocol({ theme: 'sakura' }); });
    await render(<Aura tier={4} width={180} height={240} />);
    expect(screen.getByTestId('aura')).toBeTruthy();
  });
});
