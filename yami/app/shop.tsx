import { useState } from 'react';
import { View } from 'react-native';
import { useYami, uid } from '@/src/data/store';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { fmtDate } from '@/src/ui/format';
import { success } from '@/src/ui/motion';
import { useColors } from '@/src/ui/theme';

export default function Shop() {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const { upsertReward, deleteReward, claimReward } = useYami.getState();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const c = parseInt(cost, 10);
    if (!title.trim()) { setErr('Name the reward'); return; }
    if (!(c > 0)) { setErr('Set a price above 0'); return; }
    upsertReward({ id: uid(), title: title.trim(), cost: c });
    setTitle(''); setCost(''); setErr('');
  };
  const name = (id: string) => p.rewards.find(r => r.id === id)?.title ?? 'Removed reward';

  return (
    <ModalScreen title="Reward shop" kana="店" right={<T v="num" style={{ fontSize: 15 }}>{p.shards} ◆</T>}>
      <Window title="Your rewards" meta="you set the prices">
        <View style={{ gap: space.s3 }}>
          {p.rewards.length === 0 && <T style={{ fontSize: 13, color: colors.white3 }}>Write real rewards you want. Cleared quests pay Shards (XP ÷ 10).</T>}
          {p.rewards.map(r => (
            <Row key={r.id} style={{ minHeight: 48 }}>
              <View style={{ flex: 1 }}>
                <T>{r.title}</T>
                <T v="num" style={{ fontSize: 12, color: colors.blue }}>{r.cost} ◆</T>
              </View>
              <Button small variant="seal" label="Claim" testID={`claim-${r.id}`} disabled={p.shards < r.cost} onPress={() => { if (claimReward(r.id)) success(); }} />
              <Button small variant="ghost" label="Remove" onPress={() => deleteReward(r.id)} />
            </Row>
          ))}
        </View>
      </Window>
      <Window title="Add reward">
        <View style={{ gap: space.s3 }}>
          <Field label="Reward" value={title} onChangeText={setTitle} placeholder="New basketball shoes" />
          <Field label="Price in Shards" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder="600" />
          {err ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{err}</T> : null}
          <Button label="Add" onPress={add} />
        </View>
      </Window>
      {p.claims.length > 0 && (
        <Window title="Claimed">
          <View style={{ gap: space.s2 }}>
            {[...p.claims].reverse().map(c => (
              <Row key={`${c.rewardId}${c.at}`}><T style={{ flex: 1 }}>{name(c.rewardId)}</T><T style={{ fontSize: 12, color: colors.white3 }}>{fmtDate(c.at)} · {c.cost} ◆</T></Row>
            ))}
          </View>
        </Window>
      )}
    </ModalScreen>
  );
}
