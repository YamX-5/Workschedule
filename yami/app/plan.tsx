import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useYami, todayKey } from '@/src/data/store';
import { addDays, ymd } from '@/src/domain/time';
import { overdue, searchTasks, someday, tasksForDay, upcoming, TASK_STAT } from '@/src/domain/tasks';
import { STAT_IDS, type StatId, type Task } from '@/src/domain/types';
import { addTaskEvent, calendarSupported, readEvents, removeEvent, requestCalendar, type CalEvent } from '@/src/calendar/calendar';
import { QuickAdd, TaskRow, fmtDay, validDate } from '@/src/features/plan';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';

const AHEAD = 14;
const pad = (n: number) => String(n).padStart(2, '0');
const evTime = (e: CalEvent) => (e.allDay ? 'all day' : `${pad(e.start.getHours())}:${pad(e.start.getMinutes())}`);

export default function PlanScreen() {
  const p = useYami(s => s.profile);
  const today = todayKey(p);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [showCal, setShowCal] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calMsg, setCalMsg] = useState('');

  useEffect(() => {
    if (!showCal) { setEvents([]); return; }
    let live = true;
    (async () => {
      if (!(await requestCalendar())) {
        setShowCal(false);
        setCalMsg('Calendar access was denied. Allow it in your phone settings to see your events here.');
        return;
      }
      const from = new Date(`${today}T00:00:00`);
      const evs = await readEvents(from, new Date(`${addDays(today, AHEAD + 1)}T00:00:00`)).catch(() => null);
      if (!live) return;
      if (evs) { setEvents(evs); setCalMsg(''); } else setCalMsg('Could not read the calendar.');
    })();
    return () => { live = false; };
  }, [showCal, today]);

  const evsOn = (key: string) => events.filter(e => ymd(e.start) === key);
  const query = q.trim().toLowerCase();

  const section = (title: string, tasks: Task[], evs: CalEvent[], opts: { showDate?: boolean; empty?: string } = {}) =>
    tasks.length || evs.length || opts.empty ? (
      <Window title={title} meta={tasks.length ? `${tasks.filter(t => t.doneAt).length} / ${tasks.length}` : undefined}>
        <View style={{ gap: space.s1 }}>
          {merge(tasks, evs).map(x => 'xp' in x
            ? editing?.id === x.id ? <Editor key={x.id} task={x} onClose={() => setEditing(null)} />
              : <TaskRow key={x.id} task={x} onEdit={setEditing} showDate={opts.showDate} />
            : <EventRow key={x.id} e={x} showDate={opts.showDate} />)}
          {!tasks.length && !evs.length ? <T style={{ fontSize: 12, color: colors.white3 }}>{opts.empty}</T> : null}
        </View>
      </Window>
    ) : null;

  return (
    <ModalScreen title="Plan" kana="予定">
      <Field label="Search" value={q} onChangeText={setQ} placeholder="Tasks and calendar events" returnKeyType="search" />

      {query ? (() => {
        const r = searchTasks(p, q, today);
        const evs = events.filter(e => e.title.toLowerCase().includes(query));
        return (
          <>
            {section('Coming up', r.future, evs, { showDate: true, empty: 'No matches.' })}
            {section('Past', r.past, [], { showDate: true })}
          </>
        );
      })() : (
        <>
          <Window title="Add">
            <QuickAdd />
          </Window>
          {section('Overdue', overdue(p, today), [], { showDate: true })}
          {section('Today', tasksForDay(p, today), evsOn(today), { empty: 'Nothing yet.' })}
          {section('Tomorrow', tasksForDay(p, addDays(today, 1)), evsOn(addDays(today, 1)))}
          {section(`Next ${AHEAD} days`, upcoming(p, addDays(today, 1), AHEAD - 1),
            events.filter(e => ymd(e.start) > addDays(today, 1)), { showDate: true })}
          {section('Someday', someday(p), [])}
        </>
      )}

      {calendarSupported ? (
        <Window title="Phone calendar">
          <View style={{ gap: space.s2 }}>
            <Button small variant={showCal ? 'seal' : 'ghost'} label={showCal ? 'Showing phone calendar' : 'Show phone calendar'} onPress={() => setShowCal(!showCal)} />
            <T style={{ fontSize: 12, color: colors.white3 }}>Read-only. Events from the next {AHEAD} days appear beside your tasks.</T>
            {calMsg ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{calMsg}</T> : null}
          </View>
        </Window>
      ) : null}
    </ModalScreen>
  );
}

/** Tasks and events in one list, by date then time. Undated tasks last. */
function merge(tasks: Task[], evs: CalEvent[]): (Task | CalEvent)[] {
  const key = (x: Task | CalEvent) => ('xp' in x ? `${x.date ?? '9999'} ${x.time ?? '99'}` : `${ymd(x.start)} ${x.allDay ? '00' : evTime(x)}`);
  return [...tasks, ...evs].sort((a, b) => key(a).localeCompare(key(b)));
}

function EventRow({ e, showDate }: { e: CalEvent; showDate?: boolean }) {
  return (
    <Row style={{ minHeight: 44, gap: space.s3 }}>
      <View style={{ width: 26, alignItems: 'center' }}><View style={{ width: 4, height: 22, backgroundColor: colors.purpleSoft }} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2}>{e.title}</T>
        <T style={{ fontSize: 12, color: colors.white3 }}>{[showDate ? fmtDay(ymd(e.start)) : '', evTime(e), `calendar${e.calendar ? `: ${e.calendar}` : ''}`].filter(Boolean).join(' · ')}</T>
      </View>
    </Row>
  );
}

function Editor({ task, onClose }: { task: Task; onClose: () => void }) {
  const stats = useYami(s => s.profile.stats);
  const { updateTask, deleteTask } = useYami.getState();
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date ?? '');
  const [time, setTime] = useState(task.time ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [stat, setStat] = useState<StatId>(task.stat ?? TASK_STAT);
  const [xp, setXp] = useState(task.xp);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState('');
  const dateOk = !date || validDate(date);
  const timeOk = !time || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const current = (): Task | null => {
    if (!title.trim() || !dateOk || !timeOk) return null;
    return { ...task, title: title.trim(), date: date || undefined, time: time || undefined, notes: notes.trim() || undefined, stat, xp };
  };
  const save = () => { const t = current(); if (t) { updateTask(t); onClose(); } };
  const toCalendar = async () => {
    const t = current();
    if (!t?.date) { setMsg('Give it a date first.'); return; }
    if (!(await requestCalendar())) { setMsg('Calendar access was denied. Allow it in your phone settings.'); return; }
    const id = await addTaskEvent(t).catch(() => null);
    if (!id) { setMsg('Could not add it to the calendar.'); return; }
    updateTask({ ...t, calendarEventId: id });
    onClose();
  };
  const remove = async (alsoEvent: boolean) => {
    if (alsoEvent && task.calendarEventId) await removeEvent(task.calendarEventId).catch(() => {});
    deleteTask(task.id);
    onClose();
  };

  return (
    <View style={{ borderWidth: 1, borderColor: colors.blue2, padding: space.s3, marginVertical: space.s2 }}>
      <T v="label" style={{ color: colors.blue }}>Edit task</T>
      <View style={{ gap: space.s3, marginTop: space.s2 }}>
        <Field label="Task" value={title} onChangeText={setTitle} error={title.trim() ? undefined : 'Give it a name'} />
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" maxLength={10} keyboardType="numbers-and-punctuation"
            error={dateOk ? undefined : 'Use YYYY-MM-DD'} />
          <Field label="Time" value={time} onChangeText={setTime} placeholder="HH:MM" maxLength={5} keyboardType="numbers-and-punctuation"
            error={timeOk ? undefined : 'Use HH:MM'} />
        </Row>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        <T v="label">Stat it grows</T>
        <Segmented label="Stat" value={stat} onChange={setStat} options={STAT_IDS.map(k => ({ v: k, label: stats[k].name.slice(0, 5) }))} />
        <T v="label">XP</T>
        <Segmented label="XP" value={xp} onChange={setXp} options={[5, 10, 20, 40].map(v => ({ v, label: String(v) }))} />
        <Row>
          <Button small label="Save" onPress={save} style={{ flex: 1 }} />
          <Button small variant="ghost" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
        </Row>
        {calendarSupported && !task.calendarEventId ? <Button small variant="ghost" label="Add to calendar" onPress={toCalendar} /> : null}
        {confirmDelete ? (
          task.calendarEventId ? (
            <View style={{ gap: space.s2 }}>
              <T style={{ fontSize: 12, color: colors.white2 }}>This task is also in your phone calendar.</T>
              <Button small variant="danger" label="Delete and remove event" onPress={() => remove(true)} />
              <Button small variant="ghost" label="Delete, keep event" onPress={() => remove(false)} />
            </View>
          ) : <Button small variant="danger" label="Confirm delete" onPress={() => remove(false)} />
        ) : <Button small variant="ghost" label="Delete" onPress={() => setConfirmDelete(true)} />}
        {msg ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{msg}</T> : null}
      </View>
    </View>
  );
}
