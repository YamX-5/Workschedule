// Daily to-dos: the quick-add bar, a task row, and the compact card for the Status screen.
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useYami, todayKey, uid } from '@/src/data/store';
import { addDays } from '@/src/domain/time';
import { overdue, parseQuick, tasksForDay, TASK_STAT, TASK_XP } from '@/src/domain/tasks';
import { STAT_IDS, type Task } from '@/src/domain/types';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { font, space } from '@/src/ui/tokens';
import { themed, useColors } from '@/src/ui/theme';

export const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00`).getTime());

type When = 'today' | 'tomorrow' | 'someday' | 'pick';

/** One field + Add. Words in the text ("fri at 5pm") win over the chips. */
export function QuickAdd({ initial = 'today' }: { initial?: When }) {
  const colors = useColors();
  const s = useS();
  const p = useYami(s => s.profile);
  const today = todayKey(p);
  const [text, setText] = useState('');
  const [when, setWhen] = useState<When>(initial);
  const [picked, setPicked] = useState('');
  const chipDate = when === 'today' ? today : when === 'tomorrow' ? addDays(today, 1) : when === 'pick' && validDate(picked) ? picked : undefined;
  const parsed = parseQuick(text, today, chipDate);
  const { date } = parsed;

  const add = () => {
    if (!text.trim()) return;
    useYami.getState().addTask({ id: uid(), title: parsed.title, date, time: parsed.time, xp: TASK_XP, stat: STAT_IDS.find(k => p.stats[k].enabled) ?? TASK_STAT }); // first stat the player uses
    setText('');
  };

  return (
    <View style={{ gap: space.s2 }}>
      <Row>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" placeholder="Call Ali fri at 5pm"
          placeholderTextColor={colors.white3} style={s.input} accessibilityLabel="New task" testID="quick-add" />
        <Button small label="Add" onPress={add} disabled={!text.trim()} testID="quick-add-btn" />
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['today', 'tomorrow', 'someday', 'pick'] as When[]).map(w => (
          <Chip key={w} on={when === w} label={w === 'pick' ? 'Date' : w} onPress={() => setWhen(w)} />
        ))}
        {when === 'pick' ? (
          <TextInput value={picked} onChangeText={setPicked} placeholder="YYYY-MM-DD" maxLength={10} keyboardType="numbers-and-punctuation"
            placeholderTextColor={colors.white3} style={[s.input, s.date, picked && !validDate(picked) ? { borderColor: colors.purpleSoft } : null]} accessibilityLabel="Task date" />
        ) : null}
      </Row>
      {text.trim() ? (
        <T style={s.preview}>{`→ ${parsed.title} · ${date ? fmtDay(date) : 'Someday'}${parsed.time ? ` ${parsed.time}` : ''}`}</T>
      ) : null}
    </View>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const colors = useColors();
  const s = useS();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, on && { backgroundColor: colors.white }]}>
      <T style={[s.chipT, on && { color: colors.black }]}>{label}</T>
    </Pressable>
  );
}

/** Tap the box to complete (banks XP), long-press or "Edit" to edit. */
export function TaskRow({ task, onEdit, showDate }: { task: Task; onEdit?: (t: Task) => void; showDate?: boolean }) {
  const colors = useColors();
  const s = useS();
  const stats = useYami(s => s.profile.stats);
  const done = !!task.doneAt;
  const meta = [showDate && task.date ? fmtDay(task.date) : '', task.time ?? '', `+${task.xp} ${stats[task.stat ?? TASK_STAT].name}`, task.calendarEventId ? 'in calendar' : '']
    .filter(Boolean).join(' · ');
  return (
    <Pressable onLongPress={() => onEdit?.(task)} style={s.row} testID={`task-${task.id}`}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={task.title} hitSlop={8}
        onPress={() => useYami.getState().toggleTask(task.id)} style={[s.box, done && { backgroundColor: colors.blue }]} testID={`toggle-${task.id}`}>
        {done ? <T style={{ color: colors.black, fontSize: 14, fontFamily: font.textBold }}>✓</T> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2} style={{ color: done ? colors.white3 : colors.white, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</T>
        <T style={s.meta}>{meta}</T>
      </View>
      {onEdit ? <Button small variant="ghost" label="Edit" onPress={() => onEdit(task)} /> : null}
    </Pressable>
  );
}

/** Compact card for the Status screen: today's tasks, overdue count, quick add, link to the full plan. */
export function TodayPlanCard() {
  const colors = useColors();
  const s = useS();
  const p = useYami(s => s.profile);
  const today = todayKey(p);
  const list = tasksForDay(p, today);
  const late = overdue(p, today).length;
  return (
    <Window title="Today's plan" kana="予定" meta={list.length ? `${list.filter(t => t.doneAt).length} / ${list.length}` : undefined}>
      <View style={{ gap: space.s2 }}>
        {list.map(t => <TaskRow key={t.id} task={t} />)}
        {!list.length ? <T style={s.meta}>Nothing planned yet. Add one below.</T> : null}
        {late ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{late} overdue</T> : null}
        <QuickAdd />
        <Button small variant="ghost" label="Open plan" onPress={() => router.push('/plan')} />
      </View>
    </Window>
  );
}

const useS = themed(colors => ({
  input: { flex: 1, minHeight: 44, paddingHorizontal: space.s3, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.white, fontFamily: font.text, fontSize: 16 },
  date: { flex: 0, minWidth: 130 },
  chip: { minHeight: 36, paddingHorizontal: space.s3, justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  chipT: { fontFamily: font.textSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.white2 },
  preview: { fontSize: 12, color: colors.blue },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 48 },
  box: { width: 26, height: 26, borderWidth: 1.5, borderColor: colors.blue2, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 12, color: colors.white3 },
}));
