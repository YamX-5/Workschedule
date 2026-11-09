jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useYami } from '../src/data/store';
import { seededProfile } from '../src/domain/defaults';
import { DreamDetail, DreamWizard, milestoneExamples, paceText, plusMonths } from '../src/features/dreams';

const S = () => useYami.getState();
beforeEach(() => { S().reset(); useYami.setState({ profile: seededProfile() }); });

test('the wizard asks one question per step and creates the dream with milestones, date and linked quests', async () => {
  await render(<DreamWizard />);
  expect(screen.getByTestId('dw-question').props.children).toBe('What do you want?');
  await fireEvent.press(screen.getByTestId('dw-next'));
  expect(screen.getByTestId('dw-error')).toBeTruthy(); // no title
  await fireEvent.changeText(screen.getByTestId('dw-title'), 'Run a 5K');
  await fireEvent.press(screen.getByTestId('dw-next'));
  expect(screen.getByTestId('dw-question').props.children).toBe('Why does it matter?');
  await fireEvent.changeText(screen.getByTestId('dw-why'), 'Keep up with my kids');
  await fireEvent.press(screen.getByTestId('dw-next'));
  await fireEvent.press(screen.getByTestId('dw-in-3')); // the "3 months" chip fills the date
  expect(screen.getByTestId('dw-due').props.value).toBe(plusMonths(3));
  await fireEvent.press(screen.getByTestId('dw-next'));
  expect(screen.getByTestId('dw-ms-0').props.placeholder).toBe('e.g. Run 1 km without stopping'); // example for the dream typed
  await fireEvent.changeText(screen.getByTestId('dw-ms-0'), 'Run 1 km');
  await fireEvent.press(screen.getByTestId('dw-next'));
  expect(screen.getByTestId('dw-error')).toBeTruthy(); // needs 2
  await fireEvent.changeText(screen.getByTestId('dw-ms-1'), 'Run 3 km');
  await fireEvent.press(screen.getByTestId('dw-next'));
  await fireEvent.press(screen.getByTestId('dw-link-rehab'));
  await fireEvent.press(screen.getByTestId('dw-new'));
  await fireEvent.changeText(screen.getByTestId('dw-new-quest'), 'Jog 20 minutes');
  await fireEvent.press(screen.getByTestId('dw-add-quest'));
  await fireEvent.press(screen.getByTestId('dw-next')); // Create dream

  const d = S().profile.dreams[0];
  expect(d).toMatchObject({ title: 'Run a 5K', why: 'Keep up with my kids', due: plusMonths(3), active: true });
  expect(d.milestones.map(m => m.title)).toEqual(['Run 1 km', 'Run 3 km']);
  expect(S().profile.quests.filter(q => q.dreamId === d.id).map(q => q.title)).toEqual(['Knee rehab', 'Jog 20 minutes']);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/dream', params: { id: d.id } });
});

test('detail shows progress, the next milestone, pace in words and the one-a-day rule before any tap', async () => {
  const made = new Date('2026-11-01T10:00:00').getTime();
  S().addDream({ id: 'd', title: 'Run a 5K', why: '', stat: 'body', createdAt: made, active: true,
    milestones: [{ id: 'a', title: 'Run 1 km', doneAt: made + 86400e3 }, { id: 'b', title: 'Run 3 km' }] });
  await render(<DreamDetail dream={S().profile.dreams[0]} onEdit={jest.fn()} />);
  expect(screen.getByTestId('dd-pct').props.children).toBe(50);
  expect(screen.getByTestId('dd-next').props.children).toBe('Next milestone: Run 3 km');
  expect(screen.getByTestId('dd-rule')).toBeTruthy();
  expect(screen.getByTestId('dd-pace').props.children).toMatch(/No target date/);
  await fireEvent.press(screen.getByTestId('dd-done-b'));
  await fireEvent.press(screen.getByTestId('dd-confirm-b'));
  expect(S().profile.dreams[0].achievedAt).toBeDefined();
});

test('plain-word helpers', () => {
  expect(milestoneExamples('Finish my app')[0]).toBe('Write down what version 1 is');
  expect(milestoneExamples('Something else')).toEqual(['The first small step', 'A real checkpoint', 'Halfway there', 'Something else, done']);
  expect(paceText(40, true, false)).toBe('40 days left. You are on pace.');
  expect(paceText(1, false, false)).toMatch(/^1 day left\. You are behind pace/);
  expect(paceText(-3, false, false)).toMatch(/^3 days past/);
  expect(plusMonths(12, new Date('2026-11-09T12:00:00'))).toBe('2027-11-09');
});
