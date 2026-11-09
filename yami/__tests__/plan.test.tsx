jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true } }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { TodayPlanCard } from '../src/features/plan';
import { useYami } from '../src/data/store';

beforeEach(() => useYami.getState().reset());

test('quick add puts a task on today and the checkbox banks XP', async () => {
  await render(<TodayPlanCard />);
  await fireEvent.changeText(screen.getByTestId('quick-add'), 'call Ali at 5pm');
  await fireEvent.press(screen.getByTestId('quick-add-btn'));
  const t = useYami.getState().profile.tasks[0];
  expect(t).toMatchObject({ title: 'call Ali', time: '17:00', xp: 5 });
  expect(screen.getByText('call Ali')).toBeTruthy();
  await fireEvent.press(screen.getByTestId(`toggle-${t.id}`));
  expect(useYami.getState().profile.tasks[0].doneAt).toBeDefined();
  const st = useYami.getState().profile; // to-dos grow the first stat the player uses
  expect(st.stats[st.tasks[0].stat!].xp).toBe(5);
});
