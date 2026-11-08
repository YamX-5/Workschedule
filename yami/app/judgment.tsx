import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { RECORD_TEXT, playerLevel, rankFor } from '@/src/domain/progress';
import type { StatId } from '@/src/domain/types';
import { VerdictList } from '@/src/features/VerdictList';
import { formFor } from '@/src/domain/forms';
import { Avatar } from '@/src/ui/Avatar';
import { ModalScreen } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';
import { success, useReduceMotion, warn } from '@/src/ui/motion';

export default function Judgment() {
  const out = useYami(s => s.lastJudgment);
  const p = useYami(s => s.profile);
  const rm = useReduceMotion();
  const lost = out ? Object.values(out.levelChanges).some(v => (v ?? 0) < 0) : false;
  useEffect(() => { if (out) (lost ? warn : success)(); }, [out, lost]);

  if (!out) {
    return <ModalScreen title="Judgment"><T style={{ color: colors.white3 }}>No judgment pending. It runs at Fajr.</T></ModalScreen>;
  }
  const xp = out.results.reduce((a, r) => a + r.xpDelta, 0);
  const honor = out.results.reduce((a, r) => a + r.honorDelta, 0);
  const lvl = playerLevel(p);
  const rankBefore = rankFor(out.levelBefore ?? lvl), rankNow = rankFor(lvl);
  const s = out.summary;
  const formBefore = formFor(out.levelBefore ?? lvl), formNow = formFor(lvl);

  return (
    <ModalScreen title="Judgment at Fajr" kana="審判">
      <Window title="Verdicts" meta={s ? s.dayKey : undefined}>
        <VerdictList results={out.results} quests={p.quests} statName={k => p.stats[k].name} reduceMotion={rm} />
        <Row style={{ marginTop: space.s4, justifyContent: 'space-between' }}>
          <Tally k="XP" v={xp} />
          <Tally k="Honor" v={honor} />
          <Tally k="Shards" v={s?.shards ?? 0} />
        </Row>
      </Window>

      {(Object.keys(out.levelChanges).length > 0 || rankBefore !== rankNow) && (
        <Window title={lost ? 'Level lost' : 'Level up'} tone={lost ? 'glass' : 'white'}>
          {(Object.entries(out.levelChanges) as [StatId, number][]).map(([k, v]) => (
            <T key={k} v="display" style={{ fontSize: 15, lineHeight: 26, color: lost && v < 0 ? colors.purpleSoft : lost ? colors.white : colors.ink }}>
              {p.stats[k].name} {v > 0 ? '▲' : '▼'} LV {p.stats[k].level}
            </T>
          ))}
          {rankBefore !== rankNow && <T v="display" style={{ fontSize: 18, marginTop: space.s2, color: lost ? colors.white : colors.purple }}>Rank {rankBefore} → {rankNow}</T>}
        </Window>
      )}

      {formBefore.tier !== formNow.tier && (
        <Window title={formNow.tier > formBefore.tier ? 'Form upgrade' : 'Form lost'} tone={formNow.tier > formBefore.tier ? 'white' : 'glass'}>
          <View style={{ alignItems: 'center', gap: space.s2 }}>
            <Avatar tier={formNow.tier} size={140} />
            <T v="display" style={{ fontSize: 18, color: formNow.tier > formBefore.tier ? colors.ink : colors.white }}>{formNow.name}</T>
            <T style={{ fontSize: 13, color: formNow.tier > formBefore.tier ? colors.ink2 : colors.white3, textAlign: 'center' }}>
              {formNow.tier > formBefore.tier ? formNow.upgrade : `Dropped from ${formBefore.name}. Climb back to LV ${formBefore.minLevel}.`}
            </T>
          </View>
        </Window>
      )}

      <Window title="Streak" meta={s?.held ? 'day held' : 'day failed'}>
        <T v="num">{p.streak.current} days{p.streak.bent ? ' · bent' : ''}</T>
        <T style={{ fontSize: 13, color: colors.white3, marginTop: 6 }}>
          {p.streak.bent ? 'One miss bends the streak. Hold today and it straightens.' : s?.held ? 'Never miss twice.' : 'Two misses in a row broke it. Day one again; your best stays.'}
        </T>
        {out.debuffsAdded.length > 0 && (
          <T style={{ marginTop: space.s2, color: colors.purpleSoft, fontSize: 13 }}>
            Fractured today: {out.debuffsAdded.map(k => p.stats[k].name).join(', ')} earn −20% XP (missed twice in a row).
          </T>
        )}
      </Window>

      {out.newRecords && out.newRecords.length > 0 && (
        <Window title="Record unlocked" tone="white">
          {out.newRecords.map(id => <T key={id} v="display" style={{ color: colors.ink, fontSize: 14, lineHeight: 24 }}>{RECORD_TEXT[id].name}</T>)}
        </Window>
      )}

      <View style={{ gap: space.s2 }}>
        <Button variant="seal" label={`Begin day ${Math.min(p.day, 66)}`} onPress={() => router.replace('/')} testID="begin-day" />
      </View>
    </ModalScreen>
  );
}

function Tally({ k, v }: { k: string; v: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <T v="num" style={{ color: v < 0 ? colors.purpleSoft : colors.white }}>{v >= 0 ? `+${v}` : `−${Math.abs(v)}`}</T>
      <T v="label">{k}</T>
    </View>
  );
}
