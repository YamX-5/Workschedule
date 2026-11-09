jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { migrate } from '../src/data/migrate';
import { useYami } from '../src/data/store';
import { newProfile } from '../src/domain/defaults';
import { overdue, parseQuick, searchTasks, someday, tasksForDay, upcoming } from '../src/domain/tasks';
import type { Profile, Task } from '../src/domain/types';

const TODAY = '2026-11-09'; // a Monday
const S = () => useYami.getState();
beforeEach(() => S().reset());

describe('parseQuick', () => {
  const p = (s: string) => parseQuick(s, TODAY);
  test('tomorrow', () => expect(p('buy milk tomorrow')).toEqual({ title: 'buy milk', date: '2026-11-10', time: undefined }));
  test('today', () => expect(p('today gym')).toMatchObject({ title: 'gym', date: TODAY }));
  test('fri -> next Friday', () => expect(p('call mom fri')).toMatchObject({ title: 'call mom', date: '2026-11-13' }));
  test('friday, full name and "on"', () => expect(p('dentist on Friday')).toMatchObject({ title: 'dentist', date: '2026-11-13' }));
  test('weekday that is today stays today', () => expect(p('perio mon').date).toBe(TODAY));
  test('sun wraps to next week', () => expect(p('plan sun').date).toBe('2026-11-15'));
  test('at 5pm with no date means today', () => expect(p('call ali at 5pm')).toEqual({ title: 'call ali', date: TODAY, time: '17:00' }));
  test('12am and 12pm', () => { expect(p('x 12am').time).toBe('00:00'); expect(p('x 12pm').time).toBe('12:00'); });
  test('5:30pm', () => expect(p('run 5:30pm').time).toBe('17:30'));
  test('17:00', () => expect(p('review 17:00 tomorrow')).toEqual({ title: 'review', date: '2026-11-10', time: '17:00' }));
  test('at 9 is 24h', () => expect(p('lab at 9').time).toBe('09:00'));
  test('next week', () => expect(p('book flights next week')).toMatchObject({ title: 'book flights', date: '2026-11-16' }));
  test('plain text stays undated', () => expect(p('read 20 pages')).toEqual({ title: 'read 20 pages', date: undefined, time: undefined }));
  test('chip date is the fallback; words in the text win', () => {
    expect(parseQuick('gym at 5pm', TODAY, '2026-11-10')).toMatchObject({ date: '2026-11-10', time: '17:00' });
    expect(parseQuick('gym fri', TODAY, '2026-11-10').date).toBe('2026-11-13');
  });
  test('words containing day names are untouched', () => expect(p('fried rice').date).toBeUndefined());
});

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, xp: 10, ...extra });
const withTasks = (tasks: Task[]): Profile => ({ ...newProfile(), tasks });

describe('task queries', () => {
  const p = withTasks([
    task('late', { date: '2026-11-05' }),
    task('lateDone', { date: '2026-11-06', doneAt: 1 }),
    task('b', { date: TODAY, time: '18:00' }),
    task('a', { date: TODAY, time: '09:00', notes: 'bring the Perio book' }),
    task('tmr', { date: '2026-11-10' }),
    task('far', { date: '2026-11-23' }),
    task('tooFar', { date: '2026-11-24' }),
    task('inbox'),
  ]);
  test('tasksForDay sorts by time', () => expect(tasksForDay(p, TODAY).map(t => t.id)).toEqual(['a', 'b']));
  test('upcoming excludes today, includes day 14', () => expect(upcoming(p, TODAY, 14).map(t => t.id)).toEqual(['tmr', 'far']));
  test('overdue skips done', () => expect(overdue(p, TODAY).map(t => t.id)).toEqual(['late']));
  test('someday is undated', () => expect(someday(p).map(t => t.id)).toEqual(['inbox']));
  test('search covers notes, case-insensitive, grouped', () => {
    expect(searchTasks(p, 'PERIO', TODAY)).toEqual({ future: [p.tasks[3]], past: [] });
    const r = searchTasks(p, 'late', TODAY);
    expect(r.future).toEqual([]);
    expect(r.past.map(t => t.id)).toEqual(['lateDone', 'late']);
    expect(searchTasks(p, 'inb', TODAY).future.map(t => t.id)).toEqual(['inbox']);
    expect(searchTasks(p, '  ', TODAY)).toEqual({ future: [], past: [] });
  });
});

describe('store tasks', () => {
  test('toggleTask banks XP with a toast, then refunds it', () => {
    S().addTask(task('t1', { stat: 'mind', xp: 20 }));
    const before = S().profile.stats.mind;
    S().toggleTask('t1', new Date('2026-11-09T10:00:00'));
    expect(S().profile.stats.mind.xp).toBe(before.xp + 20);
    expect(S().profile.tasks[0].doneAt).toBe(new Date('2026-11-09T10:00:00').getTime());
    expect(S().gain).toMatchObject({ xp: 20, stat: 'MIND' });
    S().toggleTask('t1', new Date('2026-11-09T10:01:00'));
    expect(S().profile.stats.mind).toEqual(before);
    expect(S().profile.tasks[0].doneAt).toBeUndefined();
    expect(S().gain).toMatchObject({ xp: -20 });
  });
  test('default stat is craft', () => {
    S().addTask(task('t2'));
    S().toggleTask('t2');
    expect(S().profile.stats.craft.xp).toBe(10);
  });
  test('update and delete', () => {
    S().addTask(task('t3'));
    S().updateTask({ ...S().profile.tasks[0], title: 'renamed' });
    expect(S().profile.tasks[0].title).toBe('renamed');
    S().deleteTask('t3');
    expect(S().profile.tasks).toEqual([]);
  });
  test('migrate of an old profile without tasks gives []', () => {
    const old: Record<string, unknown> = { ...newProfile(), honor: 70 };
    delete old.tasks;
    const m = migrate(old);
    expect(m.tasks).toEqual([]);
    expect(m.honor).toBe(70);
  });
});
