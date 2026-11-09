// A living aura behind the character sprite: a few soft shapes per theme, looping on the UI thread.
// Transform + opacity only, one shared value per element, no React renders per frame. Reduced motion = still.
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from './theme';
import type { ThemeId } from '../domain/types';

type Kind = 'wisp' | 'petal' | 'ring' | 'spark' | 'leaf' | 'mote';
interface Spec { kind: Kind; x: number; y: number; s: number; dur: number; phase: number; color: string; drift: number }

// Aura colours live here, not in theme.ts: they match the rendered sprites (blender/forms.py THEMES).
const LOOK: Record<ThemeId, { main: Kind; colors: string[]; motes: string }> = {
  darkness: { main: 'wisp', colors: ['#2A1252', '#3B1A72', '#6B3BD9'], motes: '#B48CFF' },
  sakura: { main: 'petal', colors: ['#F7C6D6', '#F29BB7', '#E8578A'], motes: '#B8336A' },
  abyss: { main: 'ring', colors: ['#0B3442', '#14808C'], motes: '#3FE0D0' },
  ember: { main: 'spark', colors: ['#FFB347', '#FFD38A', '#E0662A'], motes: '#FFB347' },
  jade: { main: 'leaf', colors: ['#25875A', '#3FBF85', '#6FE3A8'], motes: '#C2F7DC' },
};

/** Deterministic 0..1 noise so the layout is stable between renders. */
const rand = (i: number, k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** 10 elements at tier 0, 22 at tier 10; a third of them are small motes. */
export function auraSpecs(theme: ThemeId, tier: number): Spec[] {
  const look = LOOK[theme];
  const t = Math.max(0, Math.min(10, tier));
  const n = 10 + Math.round(t * 1.2);
  return Array.from({ length: n }, (_, i) => {
    const mote = i % 3 === 2;
    const kind: Kind = mote ? 'mote' : look.main;
    const ring = kind === 'ring';
    return {
      kind,
      x: ring ? 0.5 : 0.12 + rand(i, 1) * 0.76,
      y: ring ? 0.78 - (i % 3) * 0.04 : 0.25 + rand(i, 2) * 0.7,
      s: mote ? 3 + rand(i, 3) * 3 : ring ? 0.55 + (i % 4) * 0.12 : 1 + rand(i, 3) * 1.2,
      dur: (kind === 'spark' ? 1800 : kind === 'wisp' ? 4200 : ring ? 9000 : 5200) * (0.75 + rand(i, 4) * 0.5),
      phase: rand(i, 5),
      color: mote ? look.motes : look.colors[i % look.colors.length],
      drift: rand(i, 6) * 2 - 1,
    };
  });
}

export function Aura({ tier, width, height }: { tier: number; width: number; height: number }) {
  const theme = useTheme().id;
  const reduced = useReducedMotion();
  const specs = auraSpecs(theme, tier);
  const strength = 0.45 + Math.min(10, Math.max(0, tier)) * 0.055;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width, height }} testID="aura">
      {specs.map((s, i) => <Particle key={`${theme}-${i}`} spec={s} w={width} h={height} strength={strength} still={reduced} />)}
    </View>
  );
}

function Particle({ spec, w, h, strength, still }: { spec: Spec; w: number; h: number; strength: number; still: boolean }) {
  const p = useSharedValue(spec.phase);
  useEffect(() => {
    if (still) return;
    p.set(withRepeat(withTiming(spec.phase + 1, { duration: spec.dur, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [still]); // eslint-disable-line react-hooks/exhaustive-deps

  const { kind, s, drift } = spec;
  const unit = w / 36; // shapes scale with the sprite
  const size = kind === 'wisp' ? unit * 5 * s : kind === 'ring' ? w * s : kind === 'spark' ? unit * 0.35 : kind === 'mote' ? s * unit * 0.22 : unit * 1.3 * s;
  const base: ViewStyle = {
    position: 'absolute',
    left: spec.x * w - size / 2,
    top: spec.y * h - size / 2,
    width: size,
    height: kind === 'spark' ? size * 4 : kind === 'leaf' ? size * 1.7 : kind === 'petal' ? size * 1.3 : size,
    backgroundColor: kind === 'ring' ? 'transparent' : spec.color,
    borderRadius: kind === 'leaf' ? size : kind === 'petal' ? size * 0.6 : size / 2,
    ...(kind === 'leaf' ? { borderTopLeftRadius: 0, borderBottomRightRadius: 0 } : null),
    ...(kind === 'petal' ? { borderTopRightRadius: size * 0.1 } : null),
    ...(kind === 'ring' ? { borderWidth: Math.max(1, unit * 0.25), borderColor: spec.color, borderTopColor: 'transparent' } : null),
  };

  const style = useAnimatedStyle(() => {
    const q = p.get() % 1;
    const life = Math.sin(Math.PI * q); // fade in and out over one loop
    switch (kind) {
      case 'wisp': // purple smoke: rises, swells, trembles
        return { opacity: life * 0.42 * strength, transform: [{ translateX: Math.sin(q * 6.283 * 3) * unit * 0.6 + drift * unit * q }, { translateY: -q * h * 0.32 }, { scale: 0.6 + q * 0.9 }] };
      case 'petal': // drifts down and across, tumbling
        return { opacity: life * 0.9 * strength, transform: [{ translateX: drift * w * 0.25 * q + Math.sin(q * 6.283 * 2) * unit }, { translateY: (q - 0.5) * h * 0.4 }, { rotate: `${(drift * 360 + 200) * q}deg` }] };
      case 'ring': // slow dark vortex: turning, breathing ellipse
        return { opacity: (0.35 + 0.25 * Math.sin(q * 6.283)) * strength, transform: [{ scaleY: 0.28 }, { rotate: `${q * 360 * (drift > 0 ? 1 : -1)}deg` }, { scale: 0.9 + 0.12 * Math.sin(q * 6.283) }] };
      case 'spark': // fast rise, slight sway
        return { opacity: life * strength, transform: [{ translateX: drift * unit * 2 * q }, { translateY: -q * h * 0.45 }] };
      case 'leaf': // floats sideways with a lazy flutter
        return { opacity: life * 0.8 * strength, transform: [{ translateX: drift * w * 0.3 * q }, { translateY: -q * h * 0.12 + Math.sin(q * 6.283 * 2) * unit }, { rotate: `${Math.sin(q * 6.283) * 50 + drift * 90}deg` }] };
      default: // mote: rising point of light
        return { opacity: life * strength, transform: [{ translateY: -q * h * 0.3 }, { translateX: Math.sin(q * 6.283) * unit * 0.5 }] };
    }
  });
  return <Animated.View style={[base, style]} />;
}
