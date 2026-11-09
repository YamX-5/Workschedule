// Small quest form used by first-run setup and the dream wizard: title, stat, type, difficulty. Days/deadline use defaults.
import { View } from 'react-native';
import type { Quest, QuestType, StatId } from '@/src/domain/types';
import { COUNT_MAX, TIMER_MAX_MIN, XP_TIERS, XP_TIER_NAMES, toTier } from '@/src/domain/economy';
import { Field } from '@/src/ui/ModalScreen';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { useColors } from '@/src/ui/theme';

export type Draft = Omit<Quest, 'id'>;
export const blankDraft = (stat: StatId): Draft =>
  ({ title: '', stat, xp: XP_TIERS[1], type: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00' });

const TYPE_LINE: Record<QuestType, string> = {
  check: 'Done or not. One tap clears it.',
  count: 'Tap +1 each time, up to a target. Each one pays part of the XP.',
  timer: 'Do it for a set number of minutes, then tap Done.',
};

export function QuestDraftEditor({ draft, onChange, stats, statName, placeholder, testID }: {
  draft: Draft; onChange: (d: Draft) => void; stats: StatId[]; statName: (k: StatId) => string; placeholder: string; testID?: string;
}) {
  const colors = useColors();
  const stat = stats.includes(draft.stat) ? draft.stat : stats[0];
  return (
    <View style={{ gap: space.s2 }}>
      <Field label="Quest" value={draft.title} placeholder={placeholder} maxLength={40} testID={testID}
        onChangeText={title => onChange({ ...draft, title })} />
      <T v="label">Levels up</T>
      <Segmented label="Stat" value={stat} onChange={s => onChange({ ...draft, stat: s })} options={stats.map(k => ({ v: k, label: statName(k).slice(0, 6) }))} />
      <T v="label">Type</T>
      <Segmented<QuestType> label="Type" value={draft.type}
        onChange={type => onChange({ ...draft, type, target: type === 'check' ? 1 : type === 'count' ? 3 : 30 })}
        options={[{ v: 'check', label: 'Check' }, { v: 'count', label: 'Count' }, { v: 'timer', label: 'Timer' }]} />
      <T style={{ fontSize: 12, color: colors.white2 }}>{TYPE_LINE[draft.type]}</T>
      {draft.type !== 'check' && (
        <Row>
          <Field label={draft.type === 'timer' ? `Minutes (max ${TIMER_MAX_MIN})` : `Times a day (max ${COUNT_MAX})`} value={draft.target ? String(draft.target) : ''}
            keyboardType="number-pad" maxLength={3} onChangeText={t => onChange({ ...draft, target: parseInt(t, 10) || 0 })} />
        </Row>
      )}
      <T v="label">Difficulty</T>
      <Segmented<number> label="Difficulty" value={toTier(draft.xp)} onChange={xp => onChange({ ...draft, xp })}
        options={XP_TIERS.map((v, i) => ({ v, label: XP_TIER_NAMES[i] }))} />
      <T style={{ fontSize: 12, color: colors.white2 }}>Clearing it pays {toTier(draft.xp)} XP a day.</T>
    </View>
  );
}
