import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { playerLevel, rankFor } from '@/src/domain/progress';
import { ArcGrid, RecordList, WeekChart } from '@/src/features/path';
import { Bar, Row, Screen } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { colors, font, space } from '@/src/ui/tokens';
import { fmtMin } from '@/src/ui/format';
import { tap } from '@/src/ui/motion';

const RANK_NEXT: Record<string, number> = { E: 15, D: 30, C: 50, B: 80, A: 120, S: 120 };

export default function Path() {
  const p = useYami(s => s.profile);
  const { width } = useWindowDimensions();
  const lvl = playerLevel(p);
  const rank = rankFor(lvl);
  const week = p.history.slice(-7);
  const avg = week.length ? week.reduce((a, d) => a + d.usedMin, 0) / week.length : 0;
  const gained = week.reduce((a, d) => a + d.xpGained, 0), lost = week.reduce((a, d) => a + d.xpLost, 0);
  const active = p.dreams.filter(d => d.active && !d.achievedAt);
  const achieved = p.dreams.filter(d => d.achievedAt);
  const chartW = Math.min(width, 560) - space.s4 * 4;

  return (
    <Screen>
      <Window title="Player" kana="プレイヤー" meta={p.title}>
        <Row style={{ gap: space.s4 }}>
          <View style={s.rank}><T style={s.rankT}>{rank}</T></View>
          <View style={{ flex: 1, gap: 6 }}>
            <T v="display" style={{ fontSize: 16 }}>{p.name} · LV {lvl}</T>
            <Bar value={rank === 'S' ? 1 : lvl / RANK_NEXT[rank]} />
            <T style={{ fontSize: 13, color: colors.white3 }}>{rank === 'S' ? 'Highest rank.' : `${RANK_NEXT[rank] - lvl} levels to rank up`}</T>
          </View>
        </Row>
        <Row style={{ marginTop: space.s4, justifyContent: 'space-between' }}>
          <Stat k="Shards" v={p.shards} />
          <Stat k="Streak" v={`${p.streak.current}${p.streak.bent ? '*' : ''}`} />
          <Stat k="Best" v={p.streak.best} />
          <Stat k="Honor" v={p.honor} />
        </Row>
        {p.streak.bent && <T style={{ fontSize: 12, color: colors.purpleSoft, marginTop: space.s2 }}>* Bent: one day missed. Hold today or it breaks.</T>}
        <Button variant="ghost" small label="Reward shop" onPress={() => router.push('/shop')} style={{ marginTop: space.s3 }} />
      </Window>

      <Window title="Dreams" kana="夢" meta={`${active.length} / 3 active`}>
        {active.length === 0 && <T style={{ color: colors.white3, fontSize: 13 }}>A Dream is the long goal your daily quests point at. Add up to 3.</T>}
        {active.map(d => {
          const done = d.milestones.filter(m => m.doneAt).length;
          return (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => { tap(); router.push({ pathname: '/dream', params: { id: d.id } }); }} style={s.dream}>
              <Row><T v="display" style={{ fontSize: 12, flex: 1 }}>{d.title}</T><T style={s.tag}>{p.stats[d.stat].name}</T></Row>
              {d.why ? <T style={{ fontSize: 13, color: colors.white3 }} numberOfLines={1}>{d.why}</T> : null}
              <Bar value={d.milestones.length ? done / d.milestones.length : 0} />
              <T style={{ fontSize: 12, color: colors.white2 }}>{done} of {d.milestones.length} milestones</T>
            </Pressable>
          );
        })}
        {achieved.length > 0 && <T style={{ fontSize: 12, color: colors.blue, marginTop: space.s2 }}>Achieved: {achieved.map(d => d.title).join(' · ')}</T>}
        <Button small variant="primary" label="New dream" disabled={active.length >= 3} onPress={() => router.push('/dream')} style={{ marginTop: space.s3 }} />
      </Window>

      <Window title="This week" kana="週" meta={week.length ? `avg ${fmtMin(avg)}/day` : undefined}>
        <WeekChart history={p.history} capMin={p.protocol.capMin} width={chartW} />
        {week.length > 0 && (
          <Row style={{ marginTop: space.s3, justifyContent: 'space-between' }}>
            <Stat k="Held" v={`${week.filter(d => d.held).length}/${week.length}`} />
            <Stat k="XP +" v={gained} />
            <Stat k="XP −" v={lost} />
            <Stat k="Shards" v={week.reduce((a, d) => a + d.shards, 0)} />
          </Row>
        )}
      </Window>

      <Window title="66-day arc" kana="道" meta={`${p.history.filter(d => d.held).length} held`}>
        <ArcGrid history={p.history} />
      </Window>

      <Window title="Records" kana="記録" meta={`${Object.keys(p.records).length} / 8`}>
        <RecordList records={p.records} />
      </Window>
    </Screen>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, minWidth: 56 }}>
      <T v="num" style={{ fontSize: 16 }}>{v}</T>
      <T v="label">{k}</T>
    </View>
  );
}

const s = StyleSheet.create({
  rank: { width: 64, height: 64, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  rankT: { fontFamily: font.display, fontSize: 30, color: colors.black },
  dream: { gap: 6, paddingVertical: space.s3, borderTopWidth: 1, borderTopColor: colors.line },
  tag: { fontFamily: font.textBold, fontSize: 11, color: colors.black, backgroundColor: colors.blue, paddingHorizontal: 6, paddingVertical: 2 },
});
