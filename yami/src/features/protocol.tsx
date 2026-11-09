import { useState } from 'react';
import { View } from 'react-native';
import type { Preset, Quest, QuestType, StatId } from '@/src/domain/types';
import { STAT_IDS } from '@/src/domain/types';
import { COUNT_MAX, DAILY_XP_CAP, TIMER_MAX_MIN, XP_TIERS, XP_TIER_NAMES, sanitizeQuest, toTier } from '@/src/domain/economy';
import { Button } from '@/src/ui/Button';
import { Field } from '@/src/ui/ModalScreen';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { useColors } from '@/src/ui/theme';

const MULT: Record<Preset, number> = { mercy: 1, balanced: 1.5, ruthless: 2 };
const signedXp = (n: number) => (n === 0 ? '0 XP' : `−${n} XP`);

/** Plain-language preview of a preset for a quest worth `xp`. */
export function presetPreview(preset: Preset, xp = 20) {
  const unrep = Math.round(MULT[preset] * xp);
  const honest = preset === 'ruthless' ? Math.round(xp * 0.25) : 0;
  return `Unreported quest: −${unrep} XP · Honest miss: ${signedXp(honest)}, +2 Honor`;
}

export function JudgmentRules({ preset, onChange }: { preset: Preset; onChange: (p: Preset) => void }) {
  const colors = useColors();
  return (
    <View style={{ gap: space.s2 }}>
      <Segmented label="Judgment preset" value={preset} onChange={onChange}
        options={[{ v: 'mercy', label: 'Mercy' }, { v: 'balanced', label: 'Balanced' }, { v: 'ruthless', label: 'Ruthless' }]} />
      <T testID="preset-preview" style={{ fontSize: 13, color: colors.white2 }}>{presetPreview(preset)}</T>
    </View>
  );
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TYPE_HELP: Record<QuestType, string> = {
  check: 'Check: one tap on Done and it is cleared. For things you either did or did not do.',
  count: 'Count: tap +1 each time you do one (1/5, 2/5...). XP is paid per unit, so 3 of 5 still earns 3 units. Cleared at the target.',
  timer: 'Timer: do it for the set minutes, then tap Done. Knee rehab has its own hold timer in the Quest tab.',
};

export function QuestEditor({ quest, statName, stats = STAT_IDS, onSave, onDelete, onCancel }: {
  quest: Quest; statName: (s: StatId) => string; stats?: StatId[]; onSave: (q: Quest) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const colors = useColors();
  const [q, setQ] = useState(quest);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const save = () => {
    if (!q.title.trim()) { setErr('Name the quest'); return; }
    if (!HHMM.test(q.deadline)) { setErr('Deadline must look like 21:00'); return; }
    onSave(sanitizeQuest({ ...q, title: q.title.trim() }));
  };
  return (
    <View style={{ gap: space.s3, padding: space.s3, borderWidth: 1, borderColor: colors.blue2 }}>
      <Field label="Quest" value={q.title} placeholder="e.g. Read 10 pages" onChangeText={title => { setQ({ ...q, title }); setErr(''); }} error={err === 'Name the quest' ? err : undefined} testID="qe-title" />
      <T v="label">Stat</T>
      <Segmented label="Stat" value={q.stat} onChange={stat => setQ({ ...q, stat })} options={stats.map(k => ({ v: k, label: statName(k).slice(0, 6) }))} />
      <T style={{ fontSize: 12, color: colors.white2 }}>The stat this quest levels up. Rename or switch off stats in the Stats section.</T>
      <T v="label">Type</T>
      <Segmented<QuestType> label="Type" value={q.type} onChange={type => setQ({ ...q, type })} options={[{ v: 'check', label: 'Check' }, { v: 'count', label: 'Count' }, { v: 'timer', label: 'Timer' }]} />
      <T testID="qe-type-help" style={{ fontSize: 12, color: colors.white2 }}>{TYPE_HELP[q.type]}</T>
      <Row style={{ gap: space.s3 }}>
        {q.type !== 'check' && <Field label={q.type === 'timer' ? `Minutes (max ${TIMER_MAX_MIN})` : `Target (max ${COUNT_MAX})`} value={String(q.target)} keyboardType="number-pad" maxLength={3} onChangeText={t => setQ({ ...q, target: parseInt(t, 10) || 0 })} />}
        <Field label="Report by" value={q.deadline} onChangeText={deadline => { setQ({ ...q, deadline }); setErr(''); }} error={err.startsWith('Deadline') ? err : undefined} />
      </Row>
      <T v="label">Difficulty</T>
      <Segmented<number> label="Difficulty" value={toTier(q.xp)} onChange={xp => setQ({ ...q, xp })} options={XP_TIERS.map((v, i) => ({ v, label: `${XP_TIER_NAMES[i]} ${v}` }))} />
      <T style={{ fontSize: 12, color: colors.white2 }}>XP for clearing it in a day{q.type === 'count' ? ', split across the units' : ''}. You can earn at most {DAILY_XP_CAP} XP a day in total.</T>
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
