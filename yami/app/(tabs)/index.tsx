import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useYami, todayKey } from '@/src/data/store';
import { frictionSec, minutesLeft, phoneState } from '@/src/domain/budget';
import { playerLevel, rankFor } from '@/src/domain/progress';
import { xpToNext } from '@/src/domain/xp';
import { weekday } from '@/src/domain/time';
import { STAT_IDS } from '@/src/domain/types';
import { QuestRow } from '@/src/features/QuestRow';
import { Bar, Radar, Row, Screen, Shield } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';
import { success } from '@/src/ui/motion';
import { fmtMin } from '@/src/ui/format';

export default function Status() {
  const p = useYami(s => s.profile);
  const report = useYami(s => s.report);
  const addUsage = useYami(s => s.addUsage);
  const key = todayKey(p);
  const used = p.usage.dayKey === key ? p.usage.usedMin : p.corruptionCarryMin;
  const cap = p.protocol.capMin;
  const state = phoneState(used, cap, p.usage.reserveUsedMin, p.protocol.reserveMin, p.usage.reserveOpen);
  const fr = frictionSec(used, cap);
  const quests = p.quests.filter(q => q.days.includes(weekday(key)));
  const reportOf = (id: string) => p.reports.find(r => r.questId === id && r.dayKey === key);
  const open = quests.filter(q => !reportOf(q.id)).length;
  const enabled = STAT_IDS.filter(k => p.stats[k].enabled);
  const lvl = playerLevel(p);
  const dreamTitle = (id?: string) => p.dreams.find(d => d.id === id)?.title;

  return (
    <Screen>
      <Window title="Corruption" kana="侵食" meta={`${Math.round((used / cap) * 100)}%`}>
        <Row style={{ alignItems: 'baseline' }}>
          <T v="num">{fmtMin(used)}</T>
          <T v="body" style={{ color: colors.white3 }}>of {fmtMin(cap)}</T>
        </Row>
        <Bar value={used / cap} color={colors.purpleSoft} h={6} style={{ marginTop: space.s3 }} marks={[(cap - 30) / cap, (cap - 15) / cap]} />
        <T v="body" style={s.sub}>
          {state === 'open' ? `${fmtMin(minutesLeft(used, cap))} left · urge delay ${fr}s` : state === 'limit' ? 'Cap reached. Reserve needs a reason.' : state === 'reserve' ? 'Reserve draining.' : 'Sealed until Fajr.'}
        </T>
        <Row style={{ marginTop: space.s3 }}>
          <Button small variant="ghost" label="Log +15m" onPress={() => addUsage(15)} style={{ flex: 1 }} />
          <Button small variant="danger" label="Urge" onPress={() => router.push('/lock')} style={{ flex: 1 }} />
        </Row>
      </Window>

      <Window title="Daily quests" kana="クエスト" tone="white" meta={open ? `${open} unreported` : 'all reported'}>
        {quests.map(q => (
          <QuestRow key={q.id} quest={q} report={reportOf(q.id)} dream={dreamTitle(q.dreamId)}
            onDone={() => { success(); report(q.id, 'done', q.target); }}
            onDidnt={() => report(q.id, 'didnt', 0)} />
        ))}
        <T style={s.hint}>Honesty beats perfection. A confession costs nothing; silence costs XP and Honor.</T>
      </Window>

      <Window title="Stats" kana="能力値" meta={`LV ${lvl} · RANK ${rankFor(lvl)}`}>
        <View style={s.stats}>
          <Radar stats={enabled.map(k => ({ name: p.stats[k].name, level: p.stats[k].level }))} />
          <View style={{ flex: 1, minWidth: 140, gap: space.s3 }}>
            {enabled.map(k => {
              const st = p.stats[k];
              const debuffed = p.debuffs.some(d => d.stat === k && d.dayKey === key);
              return (
                <View key={k} style={{ gap: 6 }}>
                  <Row>
                    <T v="display" style={{ fontSize: 11 }}>{st.name}</T>
                    {debuffed && <T style={s.debuff}>FRACTURED −20%</T>}
                    <View style={{ flex: 1 }} />
                    <T v="label">LV <T v="num" style={{ fontSize: 14 }}>{st.level}</T></T>
                  </Row>
                  <Bar value={st.xp / xpToNext(st.level)} />
                </View>
              );
            })}
          </View>
        </View>
        <Row style={{ marginTop: space.s4 }}>
          <Shield w={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row><T v="display" style={{ fontSize: 11 }}>Honor</T><View style={{ flex: 1 }} /><T v="num" style={{ fontSize: 14 }}>{p.honor} / 100</T></Row>
            <Bar value={p.honor / 100} color={colors.white} />
          </View>
        </Row>
      </Window>
    </Screen>
  );
}

const s = StyleSheet.create({
  sub: { marginTop: space.s2, fontSize: 13, color: colors.white3 },
  hint: { marginTop: space.s3, fontSize: 12, color: colors.ink2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space.s4 },
  debuff: { fontSize: 11, color: colors.purpleSoft, fontWeight: '700' },
});
