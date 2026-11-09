jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { migrate } from '../src/data/migrate';
import { useYami } from '../src/data/store';
import { seededProfile } from '../src/domain/defaults';
import Onboarding from '../app/onboarding';

const S = () => useYami.getState();
beforeEach(() => S().reset());

describe('blank slate', () => {
  test('an existing saved profile is untouched by migrate (quests, stat names, switches)', () => {
    const mine = { ...seededProfile(), onboarded: true };
    mine.stats = { ...mine.stats, rest: { ...mine.stats.rest, enabled: false, name: 'SLEEP' } };
    const raw = JSON.parse(JSON.stringify(mine));
    delete raw.tutorialDone; // saved before the tutorial existed
    const out = migrate(raw);
    expect(out.quests).toEqual(mine.quests);
    expect(out.stats).toEqual(mine.stats);
    expect(out.onboarded).toBe(true);
    expect(out.tutorialDone).toBe(false);
  });

  test('setupProfile names the stats entered, switches off blank slots, and saves the quests', () => {
    expect(S().setupProfile({ names: ['faith', 'Body', '', '', ''], quests: [], prayers: false })).toBe(false);
    const ok = S().setupProfile({
      names: ['faith', 'Body', ' mind ', '', 'Rest'],
      quests: [
        { title: 'Read 10 pages', stat: 'mind', xp: 35, type: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00' },
        { title: '   ', stat: 'body', xp: 20, type: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00' },
        { title: 'Pushups', stat: 'craft', xp: 99, type: 'count', target: 3, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00' },
      ],
      prayers: false,
    });
    expect(ok).toBe(true);
    const p = S().profile;
    expect(Object.values(p.stats).map(s => [s.name, s.enabled])).toEqual([['FAITH', true], ['BODY', true], ['MIND', true], ['', false], ['REST', true]]);
    expect(p.quests.map(q => [q.title, q.stat, q.xp])).toEqual([['Read 10 pages', 'mind', 35], ['Pushups', 'deen', 50]]); // blank dropped, off stat moved, XP to a tier
    expect(p.quests.some(q => q.id === 'salah')).toBe(false);
  });

  test('the prayer toggle creates the quest with id salah, and can remove it', () => {
    S().setupProfile({ names: ['Faith', 'Body', 'Mind', '', ''], quests: [], prayers: true });
    expect(S().profile.quests).toEqual([expect.objectContaining({ id: 'salah', type: 'count', target: 5, stat: 'deen' })]);
    S().cycleGate(0, new Date('2026-11-08T12:00:00'));
    expect(S().profile.reports[0]).toMatchObject({ questId: 'salah', units: 1 });
    expect(S().setPrayers(false)).toBe(true);
    expect(S().profile.quests).toEqual([]);
    expect(S().setPrayers(true)).toBe(true);
    expect(S().profile.quests[0].id).toBe('salah');
  });
});

describe('onboarding screen', () => {
  test('creates the stats and quests the player typed, then opens Status', async () => {
    await render(<Onboarding />);
    await fireEvent.press(screen.getByTestId('onb-next')); // welcome
    await fireEvent.press(screen.getByTestId('onb-next')); // honesty
    await fireEvent.changeText(screen.getByTestId('onb-stat-0'), 'Faith');
    await fireEvent.changeText(screen.getByTestId('onb-stat-1'), 'Body');
    await fireEvent.press(screen.getByTestId('onb-next'));
    expect(screen.getByTestId('onb-error')).toBeTruthy(); // only 2 named
    await fireEvent.changeText(screen.getByTestId('onb-stat-2'), 'Mind');
    await fireEvent.press(screen.getByTestId('onb-next'));
    await fireEvent.press(screen.getByTestId('onb-next'));
    expect(screen.getByTestId('onb-error')).toBeTruthy(); // no quest yet
    await fireEvent.changeText(screen.getByTestId('onb-quest-0'), 'Walk 30 minutes');
    await fireEvent.press(screen.getByTestId('onb-prayers'));
    await fireEvent.press(screen.getByTestId('onb-next'));
    await fireEvent.press(screen.getByTestId('onb-next')); // "Later" on the dream step
    const p = S().profile;
    expect(p.onboarded).toBe(true);
    expect([p.stats.deen.name, p.stats.body.name, p.stats.mind.name, p.stats.craft.enabled]).toEqual(['FAITH', 'BODY', 'MIND', false]);
    expect(p.quests.map(q => q.title)).toEqual(['Salah', 'Walk 30 minutes']);
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
