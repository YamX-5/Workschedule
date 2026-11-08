jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true } }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QuestRow } from '../src/features/QuestRow';
import { Radar } from '../src/ui/parts';
import { WeekChart, RecordList } from '../src/features/path';
import { JudgmentRules, QuestEditor, presetPreview } from '../src/features/protocol';
import { VerdictList } from '../src/features/VerdictList';
import { Intrusion, LimitReached, Sealed } from '../src/features/lock';
import { HoldButton, HOLD_MS } from '../src/ui/HoldButton';
import { useHoldTimer, HOLD_SEC } from '../src/features/useHoldTimer';
import { planReminders } from '../src/notify/plan';
import { seedQuests, newProfile } from '../src/domain/defaults';
import { useYami } from '../src/data/store';
import type { DaySummary } from '../src/domain/types';
import { Text } from 'react-native';

/** Count host nodes of a type in a rendered tree (SVG text is not queryable by text). */
const countHost = (n: unknown, type: string): number => {
  if (!n || typeof n !== 'object') return 0;
  if (Array.isArray(n)) return n.reduce((a, x) => a + countHost(x, type), 0);
  const o = n as { type?: string; children?: unknown };
  return (o.type === type ? 1 : 0) + countHost(o.children, type);
};

const perio = seedQuests().find(q => q.id === 'perio')!;
const day = (k: string, usedMin: number): DaySummary => ({ dayKey: k, usedMin, capMin: 120, cleared: 5, late: 0, confessed: 0, unreported: 0, xpGained: 0, xpLost: 0, shards: 0, salahOnTime: 5, rehabSets: 5, held: true });

describe('QuestRow', () => {
  test('Done calls onDone', async () => {
    const onDone = jest.fn();
    await render(<QuestRow quest={perio} onDone={onDone} onDidnt={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('done-perio'));
    expect(onDone).toHaveBeenCalled();
  });
  test('didnt report shows CONFESSED', async () => {
    await render(<QuestRow quest={perio} report={{ questId: 'perio', dayKey: 'x', kind: 'didnt', units: 0, at: 0, late: false }} onDone={jest.fn()} onDidnt={jest.fn()} />);
    expect(screen.getByText('CONFESSED')).toBeTruthy();
  });
});

test('Radar with 3 stats renders 3 labels', async () => {
  await render(<Radar stats={[{ name: 'DEEN', level: 2 }, { name: 'BODY', level: 3 }, { name: 'MIND', level: 4 }]} />);
  expect(countHost(screen.toJSON(), 'RNSVGText')).toBe(3);
});

describe('Path', () => {
  test('WeekChart renders 7 bars and a labelled cap line', async () => {
    const h = Array.from({ length: 9 }, (_, i) => day(`2026-11-0${i + 1}`, 60 + i * 10));
    await render(<WeekChart history={h} capMin={120} />);
    expect(countHost(screen.toJSON(), 'RNSVGRect')).toBe(7);
    expect(countHost(screen.toJSON(), 'RNSVGText')).toBe(8); // cap label + 7 day labels
  });
  test('RecordList shows unlocked dates and locked rules', async () => {
    await render(<RecordList records={{ firstLight: new Date('2026-11-08T12:00:00').getTime() }} />);
    expect(screen.getByText(/Unlocked 8 Nov/)).toBeTruthy();
    expect(screen.getByText('Reach a 7-day streak')).toBeTruthy();
  });
});

describe('Protocol', () => {
  test('QuestEditor refuses an empty title', async () => {
    const onSave = jest.fn();
    await render(<QuestEditor quest={{ ...perio, title: '' }} statName={k => k} onSave={onSave} onCancel={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('qe-save'));
    expect(screen.getByText('Name the quest')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  test('delete needs a second tap', async () => {
    const onDelete = jest.fn();
    await render(<QuestEditor quest={perio} statName={k => k} onSave={jest.fn()} onDelete={onDelete} onCancel={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('qe-delete'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('qe-confirm-delete'));
    expect(onDelete).toHaveBeenCalled();
  });
  test('Ruthless preview for a 20-xp quest', async () => {
    expect(presetPreview('ruthless')).toBe('Unreported quest: −40 XP · Honest miss: −5 XP, +2 Honor');
    await render(<JudgmentRules preset="mercy" onChange={jest.fn()} />);
    expect(screen.getByTestId('preset-preview').props.children).toBe('Unreported quest: −20 XP · Honest miss: 0 XP, +2 Honor');
  });
});

test('VerdictList labels and signed XP', async () => {
  await render(<VerdictList reduceMotion quests={seedQuests()} statName={k => k.toUpperCase()}
    results={[{ questId: 'perio', verdict: 'cleared', xpDelta: 25, honorDelta: 0, stat: 'mind' }, { questId: 'rehab', verdict: 'unreported', xpDelta: -30, honorDelta: -5, stat: 'body' }]} />);
  expect(screen.getByText('CLEARED')).toBeTruthy();
  expect(screen.getByText('UNREPORTED')).toBeTruthy();
  expect(screen.getByText('+25 MIND')).toBeTruthy();
  expect(screen.getByText('−30 BODY')).toBeTruthy();
});

describe('Lock', () => {
  beforeEach(() => { jest.useFakeTimers(); useYami.getState().reset(); });
  afterEach(() => jest.useRealTimers());
  test('Intrusion hides SEAL IT until the delay passes', async () => {
    await render(<Intrusion delay={5} used={60} cap={120} />);
    expect(screen.queryByTestId('seal-it')).toBeNull();
    await act(async () => { jest.advanceTimersByTime(5200); });
    expect(screen.getByTestId('seal-it')).toBeTruthy();
  });
  test('LimitReached needs a reason', async () => {
    await render(<LimitReached />);
    await fireEvent.press(screen.getByTestId('open-reserve'));
    expect(useYami.getState().profile.usage.reserveOpen).toBe(false);
    await fireEvent.press(screen.getByText('Family'));
    await fireEvent.press(screen.getByTestId('open-reserve'));
    expect(useYami.getState().profile.usage.reserveOpen).toBe(true);
  });
  test('Sealed lists always-open apps and has no unlock', async () => {
    await render(<Sealed />);
    expect(screen.getByText('SEALED UNTIL FAJR')).toBeTruthy();
    ['Phone', 'Messages', 'Maps', 'Quran', 'Bank'].forEach(a => expect(screen.getByText(a)).toBeTruthy());
    expect(screen.queryByText(/unlock/i)).toBeNull();
  });
  test('HoldButton fires only after the full hold', async () => {
    const done = jest.fn();
    await render(<HoldButton label="LOG OUT" onComplete={done} testID="h" />);
    await fireEvent(screen.getByTestId('h'), 'pressIn');
    await act(async () => { jest.advanceTimersByTime(HOLD_MS - 100); });
    await fireEvent(screen.getByTestId('h'), 'pressOut');
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(done).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('h'), 'pressIn');
    await act(async () => { jest.advanceTimersByTime(HOLD_MS + 10); });
    expect(done).toHaveBeenCalledTimes(1);
  });
  test('rehab timer completes on elapsed time', async () => {
    const done = jest.fn();
    function Probe() { const t = useHoldTimer(HOLD_SEC, done); return <Text onPress={t.start} testID="t">{t.left}</Text>; }
    await render(<Probe />);
    await fireEvent.press(screen.getByTestId('t'));
    await act(async () => { jest.advanceTimersByTime(45_000 + 300); });
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('reminders', () => {
  const p = newProfile();
  test('lead 30, Perio deadline 23:00, unreported -> 22:30', async () => {
    const r = planReminders(p, new Date('2026-11-08T12:00:00'), '2026-11-08').find(x => x.id === 'q-perio')!;
    expect(r.at).toEqual(new Date('2026-11-08T22:30:00'));
    expect(r.title).toBe('SYSTEM · Report window closing');
  });
  test('reported quest gets none, past ones are skipped', async () => {
    const q = { ...p, reports: [{ questId: 'perio', dayKey: '2026-11-08', kind: 'done' as const, units: 1, at: 0, late: false }] };
    expect(planReminders(q, new Date('2026-11-08T12:00:00'), '2026-11-08').some(x => x.id === 'q-perio')).toBe(false);
    expect(planReminders(p, new Date('2026-11-08T22:45:00'), '2026-11-08').some(x => x.id === 'q-perio')).toBe(false);
  });
});
