import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { HeroStage, Row } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';

const STEPS = [
  { title: 'You have been chosen.', body: 'Your days become quests. Your phone time becomes Corruption. The System is watching, and it keeps score.' },
  { title: 'Report every quest. Honesty beats perfection.', body: 'Done or didn’t, say it. A confession costs nothing. Silence costs XP and Honor, and levels can drop.' },
  { title: 'Set your protocol.', body: 'Your phone cap, your quests, your rules. Then name a Dream: the long goal your days point at.' },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const finish = useYami(s => s.finishOnboarding);
  const done = () => { finish(); router.replace('/'); router.push('/protocol'); };
  const step = STEPS[i];
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, justifyContent: 'center', padding: space.s4 }}>
      <HeroStage />
      <Window title="System" kana="システム" meta={`${i + 1} / ${STEPS.length}`} key={i}>
        <T v="display" style={{ fontSize: 22, lineHeight: 32 }} testID="onb-title">{step.title}</T>
        <T style={{ color: colors.white2, marginTop: space.s3 }}>{step.body}</T>
        <Row style={{ gap: 4, marginTop: space.s4 }}>
          {STEPS.map((_, k) => <View key={k} style={{ width: 20, height: 3, backgroundColor: k === i ? colors.blue : colors.line }} />)}
        </Row>
        <Row style={{ marginTop: space.s5, justifyContent: 'space-between' }}>
          <Button small variant="ghost" label="Skip intro" onPress={done} />
          <Button label={i === STEPS.length - 1 ? 'Begin' : 'Continue'} testID="onb-next" onPress={() => (i === STEPS.length - 1 ? done() : setI(i + 1))} />
        </Row>
      </Window>
    </View>
  );
}
