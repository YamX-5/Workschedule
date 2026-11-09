// Instant feedback: a "+XP" pop after every report and a full-screen moment for big wins.
import { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useYami } from '@/src/data/store';
import { formFor } from '@/src/domain/forms';
import { playerLevel } from '@/src/domain/progress';
import { T } from '@/src/ui/Text';
import { Button } from '@/src/ui/Button';
import { font, space } from '@/src/ui/tokens';
import { EASE_OUT, success } from '@/src/ui/motion';
import { CharacterView } from '@/src/ui/CharacterView';
import { themed, useColors } from '@/src/ui/theme';

const GAIN_MS = 1800;

// Toast drops in from just above (8px, from 0.95) and leaves faster than it came. Overlay card settles on a spring.
const TOAST_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -8 }, { scale: 0.95 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_OUT },
}).duration(220);
const OUT = FadeOut.duration(150);
const CARD_IN = ZoomIn.springify().duration(400).dampingRatio(0.85).withInitialValues({ transform: [{ scale: 0.95 }] });

export function GainToast() {
  const colors = useColors();
  const s = useS();
  const gain = useYami(st => st.gain);
  const ins = useSafeAreaInsets();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!gain) return;
    setShown(gain.id);
    const t = setTimeout(() => setShown(null), GAIN_MS);
    return () => clearTimeout(t);
  }, [gain]);
  if (!gain || shown !== gain.id) return null;
  const up = gain.xp > 0;
  return (
    <Animated.View key={gain.id} entering={TOAST_IN} exiting={OUT} pointerEvents="none"
      style={[s.toast, { top: ins.top + space.s2 }, !up && { borderColor: colors.purpleSoft }]} testID="gain-toast">
      <T style={[s.xp, !up && { color: colors.purpleSoft }]}>{up ? '+' : ''}{gain.xp} XP</T>
      <T style={s.stat}>{gain.stat}</T>
      {gain.shards ? <T style={s.shards}>{gain.shards > 0 ? '+' : ''}{gain.shards} ◆</T> : null}
      {gain.levelUp && <T style={s.lvl}>LEVEL UP</T>}
      {gain.capped && <T style={s.shards}>DAILY LIMIT</T>}
    </Animated.View>
  );
}

export function CelebrationOverlay() {
  const s = useS();
  const c = useYami(st => st.celebration);
  const level = useYami(st => playerLevel(st.profile));
  const dismiss = useYami(st => st.dismissCelebration);
  // Before paint, so the haptic lands in the same frame the overlay appears.
  useLayoutEffect(() => { if (c) success(); }, [c]);
  if (!c) return null;
  const big = c.kind === 'form' || c.kind === 'dream';
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={OUT} style={s.overlay} testID="celebration">
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close" />
      <Animated.View entering={CARD_IN} style={s.card}>
        <T style={s.kicker}>{KICKER[c.kind]}</T>
        {big && <CharacterView tier={formFor(level).tier} size={150} />}
        <T style={s.title}>{c.title}</T>
        <T style={s.sub}>{c.sub}</T>
        <Button label="Continue" onPress={dismiss} style={{ alignSelf: 'stretch', marginTop: space.s3 }} />
      </Animated.View>
    </Animated.View>
  );
}

const KICKER = { level: 'Level up', form: 'Evolution', milestone: 'Dream progress', dream: 'Dream achieved' } as const;

const useS = themed(colors => ({
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: space.s4, paddingVertical: space.s2, backgroundColor: colors.black, borderWidth: 1, borderColor: colors.blue, zIndex: 50 },
  xp: { fontFamily: font.display, fontSize: 15, color: colors.blue },
  stat: { fontFamily: font.textBold, fontSize: 12, letterSpacing: 1, color: colors.white },
  shards: { fontFamily: font.textBold, fontSize: 12, color: colors.purpleSoft },
  lvl: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 1, color: colors.black, backgroundColor: colors.blue, paddingHorizontal: 6, paddingVertical: 2 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space.s5, zIndex: 60 },
  card: { alignSelf: 'stretch', alignItems: 'center', gap: space.s2, padding: space.s5, backgroundColor: colors.black, borderWidth: 1, borderColor: colors.blue2 },
  kicker: { fontFamily: font.textBold, fontSize: 12, letterSpacing: 2, color: colors.blue, textTransform: 'uppercase' },
  title: { fontFamily: font.display, fontSize: 22, color: colors.white, textAlign: 'center' },
  sub: { fontFamily: font.text, fontSize: 15, color: colors.white2, textAlign: 'center' },
}));
