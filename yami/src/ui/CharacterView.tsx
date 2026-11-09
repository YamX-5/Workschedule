// The player's character: a Blender turntable (blender/forms.py), 24 angles per form.
// Drag to spin (UI thread: a shared value picks the visible frame), it coasts after a flick and idles in a slow turn.
// A themed, animated Aura sits behind the sprite.
import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDecay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import * as F from './formFrames';
import type { ThemeId } from '../domain/types';
import { useTheme } from './theme';
import { Aura } from './Aura';

const PX_PER_FRAME = 10;
const IDLE_MS_PER_TURN = 14000;

/** Per-theme turntables once blender/forms.py emits THEME_FRAMES; the single darkness set until then. */
const framesFor = (theme: ThemeId): number[][] =>
  (F as { THEME_FRAMES?: Partial<Record<ThemeId, number[][]>> }).THEME_FRAMES?.[theme] ?? F.FORM_FRAMES;

export function CharacterView({ tier, size = 120, spin = true }: { tier: number; size?: number; spin?: boolean }) {
  const all = framesFor(useTheme().id);
  const frames = all[Math.max(0, Math.min(all.length - 1, tier))];
  const n = frames.length;
  const reduced = useReducedMotion();
  const angle = useSharedValue(0); // in frames; any real number, wrapped when picking a frame
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);

  const idle = () => {
    'worklet';
    if (reduced) return;
    angle.set(withRepeat(withTiming(angle.get() + n, { duration: IDLE_MS_PER_TURN, easing: Easing.linear }), -1, false));
  };
  useEffect(() => { idle(); return () => cancelAnimation(angle); }, [reduced, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = usePanGesture({
    enabled: spin,
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    // Finger down stops the idle turn; a touch that never becomes a drag hands back to it in onFinalize.
    onBegin: () => { cancelAnimation(angle); start.set(angle.get()); },
    onActivate: () => { dragging.set(true); },
    onUpdate: e => { angle.set(start.get() + e.translationX / PX_PER_FRAME); },
    onDeactivate: e => {
      if (reduced) return;
      angle.set(withDecay({ velocity: e.velocityX / PX_PER_FRAME, deceleration: 0.996 }, done => { if (done) idle(); }));
    },
    onFinalize: () => { if (dragging.get()) dragging.set(false); else idle(); },
  });

  const w = size;
  const h = size * (480 / 360);
  // All angles stay mounted; only the current one is opaque, so spinning never flickers while images decode.
  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: w, height: h }} accessibilityLabel={`Character, form ${tier}. Drag to spin.`} testID="character">
        <Aura tier={tier} width={w} height={h} />
        {frames.map((src, k) => <Frame key={k} k={k} n={n} angle={angle} src={src} w={w} h={h} />)}
      </View>
    </GestureDetector>
  );
}

function Frame({ k, n, angle, src, w, h }: { k: number; n: number; angle: SharedValue<number>; src: number; w: number; h: number }) {
  const a = useAnimatedStyle(() => ({ opacity: ((Math.round(angle.get()) % n) + n) % n === k ? 1 : 0 }));
  return <Animated.View style={[{ position: 'absolute', width: w, height: h }, a]}><Image source={src} style={{ width: w, height: h }} fadeDuration={0} /></Animated.View>;
}
