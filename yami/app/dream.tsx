import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useYami, uid } from '@/src/data/store';
import { STAT_IDS, type Dream, type StatId } from '@/src/domain/types';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';
import { fmtDate } from '@/src/ui/format';

export default function DreamScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const p = useYami(s => s.profile);
  const { addDream, updateDream, completeMilestone, upsertQuest } = useYami.getState();
  const existing = p.dreams.find(d => d.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [why, setWhy] = useState(existing?.why ?? '');
  const [stat, setStat] = useState<StatId>(existing?.stat ?? 'body');
  const [steps, setSteps] = useState<string[]>(existing ? [] : ['', '', '']);
  const [linked, setLinked] = useState<string[]>(p.quests.filter(q => q.dreamId && q.dreamId === id).map(q => q.id));
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const save = () => {
    if (!title.trim()) { setErr('Name the dream'); return; }
    const newSteps = steps.map(t => t.trim()).filter(Boolean).map(t => ({ id: uid(), title: t }));
    const d: Dream = existing
      ? { ...existing, title: title.trim(), why: why.trim(), stat, milestones: [...existing.milestones, ...newSteps] }
      : { id: uid(), title: title.trim(), why: why.trim(), stat, milestones: newSteps, createdAt: Date.now(), active: true };
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
