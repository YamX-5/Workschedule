import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Quest } from '@/src/domain/types';
import type { QuestResult, Verdict } from '@/src/domain/judgment';
import { T } from '@/src/ui/Text';
import { Row } from '@/src/ui/parts';
import { font, space } from '@/src/ui/tokens';
import { useColors } from '@/src/ui/theme';

const LABEL: Record<Verdict, string> = { cleared: 'CLEARED', confessed: 'CONFESSED', late: 'LATE', unreported: 'UNREPORTED' };
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function VerdictList({ results, quests, statName, reduceMotion }: {
  results: QuestResult[]; quests: Quest[]; statName: (s: QuestResult['stat']) => string; reduceMotion?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: space.s2 }}>
      {results.map((r, i) => (
        <Animated.View key={`${r.questId}${i}`} entering={reduceMotion ? undefined : FadeInDown.delay(i * 240).duration(280)}>
          <Row style={{ minHeight: 44, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.s2 }}>
            <T style={{ flex: 1 }} numberOfLines={1}>{quests.find(q => q.id === r.questId)?.title ?? r.questId}</T>
            <T style={{ fontFamily: font.textBold, fontSize: 11, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 3,
              color: r.verdict === 'cleared' ? colors.black : colors.white,
              backgroundColor: r.verdict === 'cleared' ? colors.blue : r.verdict === 'unreported' ? colors.purple : colors.glass }}>
              {LABEL[r.verdict]}
            </T>
            <T v="num" style={{ fontSize: 13, minWidth: 92, textAlign: 'right', color: r.xpDelta < 0 ? colors.purpleSoft : colors.white }}>
              {`${signed(r.xpDelta)} ${statName(r.stat)}`}
            </T>
          </Row>
        </Animated.View>
      ))}
    </View>
  );
}
