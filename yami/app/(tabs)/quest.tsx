import { useState } from 'react';
import { HOLD_SEC, EARN_PER_SET, useHoldTimer } from '@/src/features/useHoldTimer';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useYami, todayKey, EARN_CAP_MIN } from '@/src/data/store';
import { Bar, Row, Screen } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { font, space } from '@/src/ui/tokens';
import { success } from '@/src/ui/motion';
import { themed, useColors } from '@/src/ui/theme';

export default function Quest() {
  const colors = useColors();
  const s = useS();
  const p = useYami(s => s.profile);
  const report = useYami(s => s.report);
  const earn = useYami(s => s.earnMinutes);
  const key = todayKey(p);
  const q = p.quests.find(x => x.id === 'rehab');
  const target = q?.target ?? 5;
  const done = p.reports.find(r => r.questId === 'rehab' && r.dayKey === key && r.kind === 'done')?.units ?? 0;
  const earned = p.usage.dayKey === key ? p.usage.earnedMin : 0;
  const [msg, setMsg] = useState('');
  const timer = useHoldTimer(HOLD_SEC, () => {
    success();
    const sets = Math.min(target, done + 1);
    report('rehab', 'done', sets);
    const got = earn(EARN_PER_SET);
    setMsg(got ? `Set complete · +${got} min phone time earned` : 'Set complete · daily earn cap reached');
    timer.reset();
  });
  const R = 58, C = 2 * Math.PI * R;

  return (
    <Screen>
      <Window title="Body quest" kana="クエスト" tone="white" meta={`knee · day ${p.day}`}>
        <View style={s.row}>
          <View style={{ width: 132, height: 132 }}>
            <Svg width={132} height={132} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={66} cy={66} r={R} stroke={colors.inkLine} strokeWidth={8} fill="none" />
              <Circle cx={66} cy={66} r={R} stroke={colors.black} strokeWidth={8} fill="none" strokeDasharray={C} strokeDashoffset={C * (1 - timer.left / HOLD_SEC)} />
            </Svg>
            <View style={s.center}>
              <T testID="timer-num" style={s.num}>{timer.left}</T>
              <T style={s.secs}>SECONDS</T>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <T style={s.name}>Wall sit</T>
            <T style={s.sub}>Isometric · {HOLD_SEC}s hold</T>
            <Row><T style={s.k}>SET</T><View style={{ flex: 1 }} /><T style={s.v}>{Math.min(done + 1, target)} / {target}</T></Row>
            <Row style={{ gap: 4 }}>{Array.from({ length: target }, (_, i) => <View key={i} style={[s.pip, i < done && { backgroundColor: colors.black }]} />)}</Row>
            <Row><T style={s.k}>EARNED</T><View style={{ flex: 1 }} /><T style={s.v}>{earned} / {EARN_CAP_MIN}m</T></Row>
            <Bar value={earned / EARN_CAP_MIN} color={colors.blue} track={colors.inkLine} />
          </View>
        </View>
        <Row style={{ marginTop: space.s4 }}>
          <Button variant="dark" label={done >= target ? 'All sets done' : timer.running ? 'Pause' : timer.left < HOLD_SEC ? 'Resume' : 'Start'}
            disabled={done >= target} onPress={timer.running ? timer.pause : timer.start} style={{ flex: 1 }} testID="timer-start" />
          {timer.left < HOLD_SEC && !timer.running && <Button variant="outline" label="Reset" onPress={timer.reset} />}
        </Row>
        <T testID="reward" style={s.reward}>{msg}</T>
        <T style={s.disc}>Plan from your physio. Confirm with your doctor.</T>
      </Window>
    </Screen>
  );
}

const useS = themed(colors => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s4, flexWrap: 'wrap' },
  center: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: font.display, fontSize: 34, lineHeight: 42, color: colors.ink },
  secs: { fontFamily: font.textSemi, fontSize: 11, letterSpacing: 2, color: colors.ink2 },
  name: { fontFamily: font.display, fontSize: 15, color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  k: { fontFamily: font.textSemi, fontSize: 11, letterSpacing: 1.2, color: colors.ink2 },
  v: { fontFamily: font.display, fontSize: 13, color: colors.ink },
  pip: { flex: 1, height: 6, backgroundColor: colors.inkLine },
  reward: { minHeight: 20, marginTop: space.s3, textAlign: 'center', fontFamily: font.textSemi, fontSize: 13, color: colors.purple },
  disc: { marginTop: space.s2, textAlign: 'center', fontSize: 12, color: colors.ink2 },
}));
