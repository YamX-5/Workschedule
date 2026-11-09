import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useYami } from '@/src/data/store';
import { STAT_IDS, type StatId } from '@/src/domain/types';
import { Dots, HeroStage, Row } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { Field } from '@/src/ui/ModalScreen';
import { enter } from '@/src/ui/motion';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { useColors } from '@/src/ui/theme';
import { QuestDraftEditor, blankDraft, type Draft } from '@/src/features/setup';

type Step = 'welcome' | 'honesty' | 'stats' | 'quests' | 'dream';
const SETUP: Step[] = ['welcome', 'honesty', 'stats', 'quests', 'dream'];
const STAT_EXAMPLES = ['e.g. Faith', 'e.g. Body', 'e.g. Mind', 'e.g. Craft', 'e.g. Rest'];
const QUEST_EXAMPLES = ['e.g. Read 10 pages', 'e.g. Walk 30 minutes', 'e.g. Asleep by 23:00'];
const MAX_FIRST_QUESTS = 3;

const COPY: Record<Step, { title: string; body: string }> = {
  welcome: { title: 'You have been chosen.', body: 'Your days become quests. Report them honestly, earn XP, and grow the stats you choose. Setup takes about a minute.' },
  honesty: { title: 'Honesty beats perfection.', body: 'Every day, say Done or Didn’t for each quest. A confession costs nothing. Silence costs XP and Honor, and levels can drop.' },
  stats: { title: 'What do you want to grow?', body: 'Name 3 to 5 stats. Every quest levels one of them up. Leave a slot empty to skip it. You can rename them later.' },
  quests: { title: 'Your first quests', body: 'Things you want to do every day. Start with 1 to 3. You can add more and change them any time in Protocol.' },
  dream: { title: 'Got a big goal?', body: 'A Dream is a long goal, like running a 5K or finishing a book. Your daily quests push it forward. Add one now, or later from Status.' },
};

export default function Onboarding() {
  const colors = useColors();
  const ins = useSafeAreaInsets();
  const st = useYami.getState();
  // A replayed intro on a set-up profile never overwrites its stats or quests.
  const [steps] = useState<Step[]>(() => (useYami.getState().profile.onboarded ? ['welcome', 'honesty'] : SETUP));
  const [i, setI] = useState(0);
  const [names, setNames] = useState<string[]>(['', '', '', '', '']);
  const [drafts, setDrafts] = useState<Draft[]>([blankDraft('deen')]);
  const [prayers, setPrayers] = useState(false);
  const [err, setErr] = useState('');
  const step = steps[i];
  const named = STAT_IDS.filter((_, k) => names[k].trim());
  const statName = (k: StatId) => names[STAT_IDS.indexOf(k)].trim().toUpperCase();

  const finish = (dream: boolean) => {
    if (!useYami.getState().profile.onboarded) st.setupProfile({ names, quests: drafts, prayers });
    st.finishOnboarding();
    router.replace('/');
    if (dream) router.push('/dream');
  };
  const next = () => {
    if (step === 'stats' && named.length < 3) { setErr('Name at least 3 stats.'); return; }
    if (step === 'quests' && !prayers && !drafts.some(d => d.title.trim())) { setErr('Add at least one quest, or track the prayers.'); return; }
    setErr('');
    if (i === steps.length - 1) finish(false); else setI(i + 1);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.black }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroStage />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.s4, paddingTop: ins.top + space.s4, paddingBottom: ins.bottom + space.s5 }}>
        <Animated.View key={step} entering={enter(0)}>
          <Window title="System" kana="システム" meta={<Dots n={steps.length} i={i} />}>
            <T v="display" style={{ fontSize: 20, lineHeight: 30 }} testID="onb-title">{COPY[step].title}</T>
            <T style={{ color: colors.white2, marginTop: space.s3 }}>{COPY[step].body}</T>

            {step === 'stats' && (
              <View style={{ gap: space.s3, marginTop: space.s4 }}>
                {STAT_IDS.map((k, n) => (
                  <Field key={k} label={`Stat ${n + 1}${n < 3 ? '' : ' (optional)'}`} value={names[n]} placeholder={STAT_EXAMPLES[n]} maxLength={10}
                    autoCapitalize="characters" testID={`onb-stat-${n}`}
                    onChangeText={t => { const x = [...names]; x[n] = t; setNames(x); setErr(''); }} />
                ))}
                <T style={{ fontSize: 12, color: colors.white3 }}>{named.length} of 5 named</T>
              </View>
            )}

            {step === 'quests' && (
              <View style={{ gap: space.s4, marginTop: space.s4 }}>
                <Row style={{ padding: space.s3, borderWidth: 1, borderColor: prayers ? colors.blue : colors.line }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontWeight: '600' }}>Track the 5 daily prayers</T>
                    <T style={{ fontSize: 12, color: colors.white3 }}>Adds a Salah quest. Mark each prayer on the Gates tab.</T>
                  </View>
                  <Button small variant={prayers ? 'seal' : 'ghost'} label={prayers ? 'On' : 'Off'} testID="onb-prayers"
                    onPress={() => { setPrayers(!prayers); setErr(''); }} />
                </Row>
                {drafts.map((d, n) => (
                  <View key={n} style={{ gap: space.s2, paddingTop: n ? space.s4 : 0, borderTopWidth: n ? 1 : 0, borderTopColor: colors.line }}>
                    <Row>
                      <T v="label" style={{ flex: 1 }}>Quest {n + 1}</T>
                      {n > 0 && <Button small variant="ghost" label="Remove" onPress={() => setDrafts(drafts.filter((_, k) => k !== n))} />}
                    </Row>
                    <QuestDraftEditor draft={d} stats={named} statName={statName} placeholder={QUEST_EXAMPLES[n]} testID={`onb-quest-${n}`}
                      onChange={nd => { const x = [...drafts]; x[n] = nd; setDrafts(x); setErr(''); }} />
                  </View>
                ))}
                {drafts.length < MAX_FIRST_QUESTS && (
                  <Button small variant="ghost" label="Add another quest" testID="onb-add-quest" onPress={() => setDrafts([...drafts, blankDraft(named[0])])} />
                )}
              </View>
            )}

            {err ? <T style={{ fontSize: 13, color: colors.purpleSoft, marginTop: space.s3 }} testID="onb-error">{err}</T> : null}

            {step === 'dream' ? (
              <View style={{ gap: space.s2, marginTop: space.s5 }}>
                <Button label="Create a dream" testID="onb-dream" onPress={() => finish(true)} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Button small variant="ghost" label="Back" onPress={() => setI(i - 1)} />
                  <Button small variant="ghost" label="Later" testID="onb-next" onPress={() => finish(false)} />
                </Row>
              </View>
            ) : (
              <Row style={{ marginTop: space.s5, justifyContent: 'space-between' }}>
                {i > 0 ? <Button small variant="ghost" label="Back" onPress={() => { setErr(''); setI(i - 1); }} /> : <View />}
                <Button label={i === steps.length - 1 ? 'Begin' : 'Next'} testID="onb-next" onPress={next} />
              </Row>
            )}
          </Window>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
