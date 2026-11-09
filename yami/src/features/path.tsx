// Path components (spec §12.5): week chart, 66-day grid, records list.
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { DaySummary, RecordId } from '@/src/domain/types';
import { RECORD_TEXT } from '@/src/domain/progress';
import { weekday } from '@/src/domain/time';
import { T } from '@/src/ui/Text';
import { Row } from '@/src/ui/parts';
import { font, space } from '@/src/ui/tokens';
import { fmtDate } from '@/src/ui/format';
import { useColors } from '@/src/ui/theme';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Phone minutes per day for the last 7 judged days, with a cap line. */
export function WeekChart({ history, capMin, width = 300 }: { history: DaySummary[]; capMin: number; width?: number }) {
  const colors = useColors();
  const days = history.slice(-7);
  const H = 120, top = 14, base = H - 18;
  const max = Math.max(capMin * 1.25, ...days.map(d => d.usedMin), 1);
  const bw = width / 7;
  const y = (m: number) => base - (m / max) * (base - top);
  if (!days.length) return <T style={{ color: colors.white3, fontSize: 13 }}>Your first Judgment at Fajr starts this chart.</T>;
  return (
    <Svg width={width} height={H} testID="week-chart">
      {days.map((d, i) => (
        <Rect key={d.dayKey} testID="week-bar" x={i * bw + bw * 0.22} y={y(d.usedMin)} width={bw * 0.56} height={Math.max(1, base - y(d.usedMin))}
          fill={d.usedMin > capMin ? colors.purpleSoft : colors.blue} />
      ))}
      <Line x1={0} x2={width} y1={y(capMin)} y2={y(capMin)} stroke={colors.white} strokeDasharray="4 3" strokeWidth={1} />
      <SvgText x={width - 2} y={y(capMin) - 4} fill={colors.white2} fontSize={11} fontFamily={font.textSemi} textAnchor="end">{`cap ${capMin}m`}</SvgText>
      {days.map((d, i) => (
        <SvgText key={`l${d.dayKey}`} x={i * bw + bw / 2} y={H - 4} fill={d.held ? colors.white2 : colors.purpleSoft} fontSize={11} fontFamily={font.textSemi} textAnchor="middle">
          {DOW[weekday(d.dayKey)]}
        </SvgText>
      ))}
    </Svg>
  );
}

/** 66 cells: held (blue), failed (purple), today onward (empty). */
export function ArcGrid({ history }: { history: DaySummary[] }) {
  const colors = useColors();
  const last = history.slice(-66);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }} accessibilityLabel={`${last.filter(d => d.held).length} of 66 days held`}>
      {Array.from({ length: 66 }, (_, i) => {
        const d = last[i];
        return <View key={i} style={{ width: 12, height: 12, backgroundColor: d ? (d.held ? colors.blue : colors.purple) : colors.line }} />;
      })}
    </View>
  );
}

export function RecordList({ records }: { records: Partial<Record<RecordId, number>> }) {
  const colors = useColors();
  const ids = Object.keys(RECORD_TEXT) as RecordId[];
  return (
    <View style={{ gap: space.s3 }}>
      {ids.map(id => {
        const at = records[id];
        return (
          <Row key={id} style={{ opacity: at ? 1 : 0.62 }}>
            <View style={{ width: 10, height: 10, transform: [{ rotate: '45deg' }], backgroundColor: at ? colors.blue : 'transparent', borderWidth: 1, borderColor: colors.blue2 }} />
            <View style={{ flex: 1 }}>
              <T v="display" style={{ fontSize: 11 }}>{RECORD_TEXT[id].name}</T>
              <T style={{ fontSize: 13, color: colors.white3 }}>{at ? `Unlocked ${fmtDate(at)}` : RECORD_TEXT[id].rule}</T>
            </View>
          </Row>
        );
      })}
    </View>
  );
}
