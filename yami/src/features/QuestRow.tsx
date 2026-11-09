import { StyleSheet, View } from 'react-native';
import type { Quest, Report } from '@/src/domain/types';
import { colors, font, space } from '@/src/ui/tokens';
import { T } from '@/src/ui/Text';
import { Button } from '@/src/ui/Button';

export function reportLabel(q: Quest, r?: Report): string | null {
  if (!r) return null;
  if (r.kind === 'didnt') return 'CONFESSED';
  if (r.units < q.target) return 'IN PROGRESS';
  return r.late ? 'LATE REPORT' : 'CLEARED';
}

export function QuestRow({ quest, report, dream, onDone, onDidnt }: {
  quest: Quest; report?: Report; dream?: string; onDone: () => void; onDidnt: () => void;
}) {
  const label = reportLabel(quest, report);
  const xp = quest.type === 'count' ? `+${quest.xp}×${quest.target}` : `+${quest.xp}`;
  return (
    <View style={s.row} testID={`quest-${quest.id}`}>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <T style={s.title}>{quest.title}</T>
        <View style={s.tags}>
          <T style={s.xp}>{xp} {quest.stat.toUpperCase()}</T>
          {quest.type === 'count' && <T style={s.n}>{report?.kind === 'done' ? report.units : 0}/{quest.target}</T>}
          {label && <T style={[s.state, label === 'CLEARED' && { backgroundColor: colors.blue, color: colors.black }]}>{label}</T>}
        </View>
        {dream ? <T style={s.dream} numberOfLines={1}>Toward: {dream}</T> : null}
      </View>
      <Button small variant="dark" label={quest.type === 'count' ? '+1' : 'Done'} onPress={onDone} testID={`done-${quest.id}`} style={s.b}
        disabled={report?.kind === 'done' && report.units >= quest.target} />
      <Button small variant="outline" label="Didn't" onPress={onDidnt} testID={`didnt-${quest.id}`} style={s.b} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.s3, borderTopWidth: 1, borderTopColor: colors.inkLine },
  title: { fontFamily: font.textSemi, fontSize: 15, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  xp: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 0.8, color: colors.white, backgroundColor: colors.purple, paddingHorizontal: 6, paddingVertical: 3 },
  n: { fontFamily: font.display, fontSize: 11, color: colors.ink, borderWidth: 1, borderColor: colors.inkLine, paddingHorizontal: 5, paddingVertical: 2 },
  state: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 0.8, color: colors.white, backgroundColor: colors.black, paddingHorizontal: 6, paddingVertical: 3 },
  dream: { fontFamily: font.text, fontSize: 13, color: colors.purple },
  b: { minWidth: 64 },
});
