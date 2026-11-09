import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { playerLevel, rankFor } from '@/src/domain/progress';
import { formFor, nextForm } from '@/src/domain/forms';
import { CharacterView } from '@/src/ui/CharacterView';
import { ArcGrid, RecordList, WeekChart } from '@/src/features/path';
import { Bar, Row, Screen } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { font, space } from '@/src/ui/tokens';
import { fmtMin } from '@/src/ui/format';
import { tap } from '@/src/ui/motion';
import { themed, useColors } from '@/src/ui/theme';


export default function Path() {
  const colors = useColors();
  const s = useS();
  const p = useYami(s => s.profile);
  const { width } = useWindowDimensions();
  const lvl = playerLevel(p);
  const rank = rankFor(lvl);
  const form = formFor(lvl), next = nextForm(lvl), best = formFor(p.bestLevel);
  const week = p.history.slice(-7);
  const avg = week.length ? week.reduce((a, d) => a + d.usedMin, 0) / week.length : 0;
  const gained = week.reduce((a, d) => a + d.xpGained, 0), lost = week.reduce((a, d) => a + d.xpLost, 0);
  const active = p.dreams.filter(d => d.active && !d.achievedAt);
  const achieved = p.dreams.filter(d => d.achievedAt);
  const chartW = Math.min(width, 560) - space.s4 * 4;

  return (
    <Screen>
      <Window title="Player" kana="プレイヤー" meta={p.title}>
        <View style={{ alignItems: 'center' }}>
          <CharacterView tier={form.tier} size={190} />
          <T style={{ fontSize: 11, color: colors.white3, letterSpacing: 1 }}>DRAG TO SPIN</T>
        </View>
        <Row style={{ gap: space.s4, marginTop: space.s3 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Row><View style={s.rank}><T style={s.rankT}>{rank}</T></View><T v="label">Rank</T></Row>
            <T v="display" style={{ fontSize: 15 }}>{form.name}</T>
            <T style={{ fontSize: 13, color: colors.white2 }}>{p.name} · LV {lvl}</T>
            <Bar value={next ? (lvl - form.minLevel) / 10 : 1} />
            <T style={{ fontSize: 13, color: colors.white3 }}>
              {next ? `LV ${next.minLevel}: ${next.name}. ${next.upgrade}` : 'The end of the path.'}
            </T>
            {best.tier > form.tier && <T style={{ fontSize: 12, color: colors.purpleSoft }}>Best form reached: {best.name}. Win it back.</T>}
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

const useS = themed(colors => ({
  rank: { width: 32, height: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  rankT: { fontFamily: font.display, fontSize: 16, color: colors.black },
  dream: { gap: 6, paddingVertical: space.s3, borderTopWidth: 1, borderTopColor: colors.line },
  tag: { fontFamily: font.textBold, fontSize: 11, color: colors.black, backgroundColor: colors.blue, paddingHorizontal: 6, paddingVertical: 2 },
}));
