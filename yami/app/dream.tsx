import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useYami, uid } from '@/src/data/store';
import { STAT_IDS, type Dream, type StatId } from '@/src/domain/types';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Bar, Row, Segmented } from '@/src/ui/parts';
import { CLEARS_PER_STEP, dreamProgress } from '@/src/domain/progress';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { fmtDate } from '@/src/ui/format';
import { useColors } from '@/src/ui/theme';

export default function DreamScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const p = useYami(s => s.profile);
  const { addDream, updateDream, completeMilestone, upsertQuest } = useYami.getState();
  const existing = p.dreams.find(d => d.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [why, setWhy] = useState(existing?.why ?? '');
  const [due, setDue] = useState(existing?.due ?? '');
  const dueOk = !due || (/^\d{4}-\d{2}-\d{2}$/.test(due) && !isNaN(new Date(`${due}T12:00:00`).getTime()));
  const [stat, setStat] = useState<StatId>(existing?.stat ?? 'body');
  const [steps, setSteps] = useState<string[]>(existing ? [] : ['', '', '']);
  const [linked, setLinked] = useState<string[]>(p.quests.filter(q => q.dreamId && q.dreamId === id).map(q => q.id));
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const save = () => {
    if (!title.trim()) { setErr('Name the dream'); return; }
    if (!dueOk) return;
    const newSteps = steps.map(t => t.trim()).filter(Boolean).map(t => ({ id: uid(), title: t }));
    const base = { title: title.trim(), why: why.trim(), stat, due: due || undefined };
    const d: Dream = existing
      ? { ...existing, ...base, milestones: [...existing.milestones, ...newSteps] }
      : { id: uid(), ...base, milestones: newSteps, createdAt: Date.now(), active: true };
    if (!d.milestones.length) { setErr('Add at least one milestone'); return; }
    if (existing) updateDream(d);
    else if (!addDream(d)) { setErr('3 dreams are already active. Finish or pause one first.'); return; }
    p.quests.forEach(q => {
      const want = linked.includes(q.id);
      if (want && q.dreamId !== d.id) upsertQuest({ ...q, dreamId: d.id });
      if (!want && q.dreamId === d.id) upsertQuest({ ...q, dreamId: undefined });
    });
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Dream' : 'New dream'} kana="夢" right={<Button small label="Save" onPress={save} />}>
      <Window title="The dream">
        <View style={{ gap: space.s3 }}>
          <Field label="Dream" value={title} onChangeText={t => { setTitle(t); setErr(''); }} placeholder="Athletic again" error={err && !title.trim() ? err : undefined} />
          <Field label="Why it matters" value={why} onChangeText={setWhy} placeholder="Play a full game with no knee pain" />
          <Field label="Target date (optional)" value={due} onChangeText={setDue} placeholder="2027-06-01" maxLength={10}
            keyboardType="numbers-and-punctuation" error={dueOk ? undefined : 'Use YYYY-MM-DD, like 2027-06-01'} />
          <T v="label">Stat it grows</T>
          <Segmented label="Stat" value={stat} onChange={setStat} options={STAT_IDS.map(k => ({ v: k, label: p.stats[k].name.slice(0, 5) }))} />
        </View>
      </Window>

      {existing && (
        <Window title="Milestones" meta={`${existing.milestones.filter(m => m.doneAt).length} / ${existing.milestones.length}`}>
          <View style={{ gap: space.s2 }}>
            {existing.milestones.map(m => (
              <Row key={m.id} style={{ minHeight: 44 }}>
                <View style={{ width: 12, height: 12, backgroundColor: m.doneAt ? colors.blue : 'transparent', borderWidth: 1, borderColor: colors.blue2 }} />
                <T style={{ flex: 1, color: m.doneAt ? colors.white3 : colors.white }}>{m.title}</T>
                {m.doneAt ? <T style={{ fontSize: 12, color: colors.blue }}>{fmtDate(m.doneAt)}</T>
                  : confirm === m.id ? <Button small variant="seal" label="Confirm" onPress={() => { completeMilestone(existing.id, m.id); setConfirm(null); }} />
                  : <Button small variant="ghost" label="Done" onPress={() => setConfirm(m.id)} />}
              </Row>
            ))}
            {(() => {
              const pr = dreamProgress(p, existing);
              return (
                <View style={{ gap: 6, marginTop: space.s2 }}>
                  <Bar value={pr.value} color={colors.blue} h={6} />
                  <T style={{ fontSize: 12, color: colors.white2 }}>
                    {Math.round(pr.value * 100)}% · {pr.clears}/{CLEARS_PER_STEP} linked quest clears toward the next milestone
                    {pr.daysLeft !== undefined ? ` · ${pr.daysLeft >= 0 ? `${pr.daysLeft} days left` : `${-pr.daysLeft} days over`}, ${pr.onPace ? 'on pace' : 'behind pace'}` : ''}
                  </T>
                </View>
              );
            })()}
            <T style={{ fontSize: 12, color: colors.white3 }}>Each milestone: +100 XP to {p.stats[existing.stat].name}, +20 Shards. The last one: +100 Shards and a title.</T>
          </View>
        </Window>
      )}

      <Window title={existing ? 'Add milestones' : 'Milestones'}>
        <View style={{ gap: space.s2 }}>
          {steps.map((t, i) => (
            <Field key={i} label={`Step ${i + 1}`} value={t} onChangeText={v => { const n = [...steps]; n[i] = v; setSteps(n); setErr(''); }} placeholder={i === 0 ? 'Wall sit 5×45s with no pain' : ''} />
          ))}
          <Button small variant="ghost" label="Add step" onPress={() => setSteps([...steps, ''])} />
          {err && title.trim() ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{err}</T> : null}
        </View>
      </Window>

      <Window title="Daily quests toward it">
        <View style={{ gap: space.s2 }}>
          {p.quests.map(q => {
            const on = linked.includes(q.id);
            return <Button key={q.id} small variant={on ? 'seal' : 'ghost'} label={q.title} onPress={() => setLinked(on ? linked.filter(x => x !== q.id) : [...linked, q.id])} />;
          })}
        </View>
      </Window>
    </ModalScreen>
  );
}
