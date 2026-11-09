// First-run coach marks: one small card per core idea, pointing at the tab it lives on. Replayable from Protocol.
import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { DAILY_XP_CAP } from '@/src/domain/economy';
import type { Profile } from '@/src/domain/types';
import { Button } from '@/src/ui/Button';
import { Dots, Row } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { EASE_OUT } from '@/src/ui/motion';
import { fmtMin } from '@/src/ui/format';
import { space, TAB_BAR_H } from '@/src/ui/tokens';
import { themed, useColors } from '@/src/ui/theme';

/** Tab order in the bar (see app/(tabs)/_layout.tsx). */
const TAB_COUNT = 5;
type Route = '/' | '/gates' | '/path';
const TAB_OF: Record<Route, number> = { '/': 0, '/gates': 1, '/path': 2 };
/** Where the card sits: above a tab with a caret, under the Corruption panel, or centred. */
type Place = 'tab' | 'corruption' | 'center';
export interface CoachStep { id: string; title: string; body: string; route: Route; place: Place }
// ponytail: fixed offset under the HUD + Corruption panel (~200pt tall); measure it with onLayout if that panel changes.
const UNDER_CORRUPTION = 286;

export function tutorialSteps(p: Profile): CoachStep[] {
  const prayers = p.quests.some(q => q.id === 'salah');
  return [
    { id: 'quests', route: '/', place: 'tab', title: 'Quests', body: `Your daily quests live here on Status. Tap Done, or +1 on counted ones, and the XP lands right away. You can earn up to ${DAILY_XP_CAP} XP a day.` },
    ...(prayers ? [{ id: 'gates', route: '/gates' as Route, place: 'tab' as Place, title: 'Gates', body: 'Mark each prayer on time, late or missed. Every mark reports to your Salah quest.' }] : []),
    { id: 'dreams', route: '/', place: 'tab', title: 'Dreams', body: 'A Dream is a long goal. Link quests to it and each clear fills the bar toward the next milestone. Add one from the Dreams card on Status.' },
    { id: 'path', route: '/path', place: 'tab', title: 'Path', body: 'Your character evolves every 10 levels. Path shows your form, streak, records and the reward shop.' },
    { id: 'judgment', route: '/', place: 'center', title: 'Judgment at Fajr', body: 'Every morning at Fajr, yesterday is judged. Unreported quests cost XP and Honor. An honest Didn’t costs nothing. Honesty beats perfection.' },
    { id: 'phone', route: '/', place: 'corruption', title: 'The phone cap', body: `Corruption counts your time on watched apps against a daily cap of ${fmtMin(p.protocol.capMin)}. Log time with +15m, and tap Urge when you feel the pull.` },
  ];
}

// Calm entrance: 8px rise + fade, ease-out, under 250ms. Reanimated skips it under reduced motion.
const CARD_IN = FadeInDown.duration(220).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });

export function Tutorial() {
  const colors = useColors();
  const s = useS();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const p = useYami(st => st.profile);
  const [i, setI] = useState(0);
  if (!p.onboarded || p.tutorialDone) return null;
  const steps = tutorialSteps(p);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  const close = () => { useYami.getState().setTutorialDone(true); setI(0); router.navigate('/'); };
  const go = (n: number) => { setI(n); if (steps[n].route !== step.route) router.navigate(steps[n].route); };

  // Tab bar geometry mirrors app/(tabs)/_layout.tsx: inset s4, padding 6, gap 4.
  const barBottom = ins.bottom + space.s3;
  const tabW = (width - space.s4 * 2 - 12 - 4 * (TAB_COUNT - 1)) / TAB_COUNT;
  const tab = TAB_OF[step.route];
  const tabLeft = space.s4 + 6 + tab * (tabW + 4);
  const cardBottom = barBottom + TAB_BAR_H + 14;

  return (
    <View style={StyleSheet.absoluteFill} testID="tutorial">
      <View style={[StyleSheet.absoluteFill, s.scrim]} />
      {step.place === 'tab' && <View pointerEvents="none" style={[s.ring, { left: tabLeft - 3, width: tabW + 6, bottom: barBottom + 3, height: TAB_BAR_H - 6 }]} />}
      <Animated.View key={step.id} entering={Platform.OS === 'web' ? undefined : CARD_IN}
        style={[s.card, step.place === 'tab' ? { bottom: cardBottom } : step.place === 'corruption' ? { top: ins.top + UNDER_CORRUPTION } : { top: '30%' }]} accessibilityViewIsModal>
        <Row>
          <T v="label" style={{ color: colors.blue, flex: 1 }}>Tutorial · {i + 1} / {steps.length}</T>
          <Dots n={steps.length} i={i} />
        </Row>
        <T v="display" style={{ fontSize: 16, marginTop: space.s3 }} testID="tut-title">{step.title}</T>
        <T style={{ color: colors.white2, marginTop: space.s2 }}>{step.body}</T>
        <Row style={{ marginTop: space.s4, justifyContent: 'space-between' }}>
          {last ? <View /> : <Button small variant="ghost" label="Skip" testID="tut-skip" onPress={close} />}
          <Row>
            {i > 0 && <Button small variant="ghost" label="Back" onPress={() => go(i - 1)} />}
            <Button small label={last ? 'Got it' : 'Next'} testID="tut-next" onPress={() => (last ? close() : go(i + 1))} />
          </Row>
        </Row>
        {step.place === 'tab' && <View pointerEvents="none" style={[s.caret, { left: tabLeft + tabW / 2 - space.s4 - 8 }]} />}
        {step.place === 'corruption' && <View pointerEvents="none" style={s.caretUp} />}
      </Animated.View>
    </View>
  );
}

const useS = themed(colors => ({
  scrim: { backgroundColor: colors.scrim, opacity: 0.7 },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.blue },
  card: { position: 'absolute', left: space.s4, right: space.s4, padding: space.s4, backgroundColor: colors.bar, borderWidth: 1, borderColor: colors.blue2 },
  caretUp: { position: 'absolute', top: -8, left: '50%', marginLeft: -7, width: 14, height: 14, backgroundColor: colors.bar, borderLeftWidth: 1, borderTopWidth: 1, borderColor: colors.blue2, transform: [{ rotate: '45deg' }] },
  caret: { position: 'absolute', bottom: -8, width: 14, height: 14, backgroundColor: colors.bar, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.blue2, transform: [{ rotate: '45deg' }] },
}));
