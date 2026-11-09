// The player's character: a Blender turntable (blender/forms.py), 24 angles per form. Drag left/right to spin.
import { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, View } from 'react-native';
import { FORM_FRAMES } from './formFrames';

const PX_PER_FRAME = 10;

export function CharacterView({ tier, size = 120, spin = true }: { tier: number; size?: number; spin?: boolean }) {
  const frames = FORM_FRAMES[Math.max(0, Math.min(FORM_FRAMES.length - 1, tier))];
  const n = frames.length;
  const [i, setI] = useState(0);
  const start = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => spin && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => { start.current = i; },
    onPanResponderMove: (_, g) => setI((((start.current + Math.round(g.dx / PX_PER_FRAME)) % n) + n) % n),
    onPanResponderTerminationRequest: () => false,
  }), [spin, n, i]);
  const w = size;
  const h = size * (480 / 360);
  // All angles stay mounted and only the current one is visible, so spinning never flickers while images decode.
  return (
    <View style={{ width: w, height: h }} {...pan.panHandlers} accessibilityLabel={`Character, form ${tier}. Drag to spin.`} testID="character">
      {frames.map((src, k) => (
        <Image key={k} source={src} style={{ position: 'absolute', width: w, height: h, opacity: k === i ? 1 : 0 }} fadeDuration={0} />
      ))}
    </View>
  );
}
