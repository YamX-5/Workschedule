import { useState } from 'react';
import { View } from 'react-native';
import type { Preset, Quest, QuestType, StatId } from '@/src/domain/types';
import { STAT_IDS } from '@/src/domain/types';
import { Button } from '@/src/ui/Button';
import { Field } from '@/src/ui/ModalScreen';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';

const MULT: Record<Preset, number> = { mercy: 1, balanced: 1.5, ruthless: 2 };
const signedXp = (n: number) => (n === 0 ? '0 XP' : `−${n} XP`);

/** Plain-language preview of a preset for a quest worth `xp`. */
export function presetPreview(preset: Preset, xp = 20) {
  const unrep = Math.round(MULT[preset] * xp);
  const honest = preset === 'ruthless' ? Math.round(xp * 0.25) : 0;
  return `Unreported quest: −${unrep} XP · Honest miss: ${signedXp(honest)}, +2 Honor`;
}

export function JudgmentRules({ preset, onChange }: { preset: Preset; onChange: (p: Preset) => void }) {
  return (
    <View style={{ gap: space.s2 }}>
      <Segmented label="Judgment preset" value={preset} onChange={onChange}
        options={[{ v: 'mercy', label: 'Mercy' }, { v: 'balanced', label: 'Balanced' }, { v: 'ruthless', label: 'Ruthless' }]} />
      <T testID="preset-preview" style={{ fontSize: 13, color: colors.white2 }}>{presetPreview(preset)}</T>
    </View>
  );
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function QuestEditor({ quest, statName, onSave, onDelete, onCancel }: {
  quest: Quest; statName: (s: StatId) => string; onSave: (q: Quest) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const [q, setQ] = useState(quest);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const save = () => {
    if (!q.title.trim()) { setErr('Name the quest'); return; }
    if (!HHMM.test(q.deadline)) { setErr('Deadline must look like 21:00'); return; }
    onSave({ ...q, title: q.title.trim(), target: q.type === 'check' ? 1 : Math.max(1, q.target), xp: Math.max(1, q.xp) });
  };
  return (
    <View style={{ gap: space.s3, padding: space.s3, borderWidth: 1, borderColor: colors.blue2 }}>
      <Field label="Quest" value={q.title} onChangeText={title => { setQ({ ...q, title }); setErr(''); }} error={err === 'Name the quest' ? err : undefined} testID="qe-title" />
      <T v="label">Stat</T>
      <Segmented label="Stat" value={q.stat} onChange={stat => setQ({ ...q, stat })} options={STAT_IDS.map(k => ({ v: k, label: statName(k).slice(0, 5) }))} />
      <T v="label">Type</T>
      <Segmented<QuestType> label="Type" value={q.type} onChange={type => setQ({ ...q, type })} options={[{ v: 'check', label: 'Check' }, { v: 'count', label: 'Count' }, { v: 'timer', label: 'Timer' }]} />
      <Row style={{ gap: space.s3 }}>
        <Field label="XP" value={String(q.xp)} keyboardType="number-pad" onChangeText={t => setQ({ ...q, xp: parseInt(t, 10) || 0 })} />
        {q.type !== 'check' && <Field label={q.type === 'timer' ? 'Minutes' : 'Target'} value={String(q.target)} keyboardType="number-pad" onChangeText={t => setQ({ ...q, target: parseInt(t, 10) || 0 })} />}
        <Field label="Report by" value={q.deadline} onChangeText={deadline => { setQ({ ...q, deadline }); setErr(''); }} error={err.startsWith('Deadline') ? err : undefined} />
      </Row>
      <T v="label">Days</T>
      <Row style={{ gap: 4 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
          const on = q.days.includes(i);
          return <Button key={i} small variant={on ? 'seal' : 'ghost'} label={d} style={{ flex: 1, paddingHorizontal: 0 }}
            onPress={() => setQ({ ...q, days: on ? q.days.filter(x => x !== i) : [...q.days, i].sort() })} />;
        })}
      </Row>
      <Row>
        <Button small label="Save quest" onPress={save} testID="qe-save" style={{ flex: 1 }} />
        <Button small variant="ghost" label="Cancel" onPress={onCancel} />
      </Row>
      {onDelete && (confirmDel
        ? <Button small variant="danger" label="Confirm delete" onPress={onDelete} testID="qe-confirm-delete" />
        : <Button small variant="ghost" label="Delete quest" onPress={() => setConfirmDel(true)} testID="qe-delete" />)}
    </View>
  );
}
