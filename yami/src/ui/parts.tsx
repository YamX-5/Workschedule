// Small shared pieces: hero backdrop, screen shell, HUD, bars, segmented control, radar.
import { Children, isValidElement, useEffect, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { font, space, TAB_BAR_H } from './tokens';
import { T } from './Text';
import { EASE_IN_OUT, VALUE, enter } from './motion';
import { Press } from './Press';
import { useYami } from '../data/store';
import { themed, useColors, useTheme } from './theme';

/** Placeholder for the 3D world (Plan 3): the theme's deep tone as a horizon into the page colour, with a moon glow. */
export function HeroStage() {
  const { c: colors, id } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.black} />
            <Stop offset="0.55" stopColor={colors.purple} />
            <Stop offset="1" stopColor={colors.black} />
          </LinearGradient>
          <RadialGradient id="moon" cx="70%" cy="22%" r="30%">
            <Stop offset="0" stopColor={colors.glow} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sky)" />
        <Rect width="100%" height="100%" fill="url(#moon)" />
      </Svg>
      {id === 'sakura' && <Petals color={colors.blue} />}
    </View>
  );
}

/** A few faint cherry-blossom petals across the sakura backdrop. [x, y, rotation, scale] in a 360x800 box. */
const PETALS: [number, number, number, number][] = [[300, 70, 20, 1.3], [250, 150, -35, 0.9], [40, 230, 60, 1.1], [320, 380, 110, 0.8], [70, 520, -15, 1.2], [210, 640, 80, 0.9], [330, 760, 30, 1]];
function Petals({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 800" preserveAspectRatio="xMidYMin slice" style={StyleSheet.absoluteFill}>
      {PETALS.map(([x, y, r, k], i) => (
        <Path key={i} d="M0 -9 C6 -9 8 -2 0 9 C-8 -2 -6 -9 -1.5 -9 L0 -6 Z" fill={color} opacity={i % 2 ? 0.12 : 0.2}
          transform={'translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + k + ')'} />
      ))}
    </Svg>
  );
}

/** Screen shell: hero backdrop, HUD on top, scrollable content clear of the floating tab bar. */
export function Screen({ children, scroll = true, hud = true }: { children: ReactNode; scroll?: boolean; hud?: boolean }) {
  const colors = useColors();
  const ins = useSafeAreaInsets();
  const pad = { paddingTop: ins.top + space.s3, paddingBottom: ins.bottom + TAB_BAR_H + space.s6, paddingHorizontal: space.s4, gap: space.s4 };
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <HeroStage />
      {scroll ? (
        <ScrollView contentContainerStyle={pad} showsVerticalScrollIndicator={false}>{hud && <Hud />}<Stagger>{children}</Stagger></ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{hud && <Hud />}<Stagger>{children}</Stagger></View>
      )}
      {/* keep scrolled content from running under the clock and battery icons */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ins.top, backgroundColor: colors.black }} />
    </View>
  );
}

/** Panels rise in one after another when a screen mounts (once; re-renders do not replay it). */
export function Stagger({ children }: { children: ReactNode }) {
  // Web: Reanimated's web entering animations can leave panels stacked on top of each other, so web skips them.
  if (Platform.OS === 'web') return <>{children}</>;
  // Key by the child's own key, so a panel appearing or disappearing doesn't remount (and replay) its siblings.
  return <>{Children.toArray(children).map((ch, i) => (
    <Animated.View key={isValidElement(ch) && ch.key != null ? ch.key : i} entering={enter(i)}>{ch}</Animated.View>
  ))}</>;
}

export function Hud() {
  const s = useS();
  const p = useYami(st => st.profile);
  return (
    <View style={s.hud}>
      <View style={s.kj}><T style={s.kjT}>闇</T></View>
      <View style={{ gap: 4, flexShrink: 1 }}>
        <T v="display" style={{ fontSize: 14, letterSpacing: 4.5 }}>Yami</T>
        <T v="label" numberOfLines={1}>Day <T v="num" style={{ fontSize: 12 }}>{Math.min(p.day, 66)}</T> / 66</T>
      </View>
      <View style={{ flex: 1 }} />
      <Press accessibilityRole="button" accessibilityLabel={`Honor ${p.honor}`} style={s.honor} onPress={() => router.push('/path')}>
        <Shield />
        <T v="num" style={{ fontSize: 13 }}>{p.honor}</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Open protocol settings" style={s.ibtn} onPress={() => router.push('/protocol')}>
        <Gear />
      </Press>
    </View>
  );
}

export function Shield({ c, w = 18 }: { c?: string; w?: number }) {
  const colors = useColors();
  return <Svg width={w} height={w * 1.1} viewBox="0 0 20 22"><Polygon points="10,1 19,4 19,11 10,21 1,11 1,4" fill={c ?? colors.blue} /></Svg>;
}
function Gear() {
  const colors = useColors();
  return (
  <Svg width={20} height={20} viewBox="0 0 20 20">
    <Circle cx="10" cy="10" r="3" stroke={colors.white} strokeWidth="1.6" fill="none" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
      const r = (a * Math.PI) / 180;
      return <Line key={a} x1={10 + Math.cos(r) * 5.5} y1={10 + Math.sin(r) * 5.5} x2={10 + Math.cos(r) * 8.5} y2={10 + Math.sin(r) * 8.5} stroke={colors.white} strokeWidth="2" />;
    })}
  </Svg>
  );
}

/** A thin progress bar. value 0..1. Changes glide (ease-out scaleX from the left edge, transform only). */
export function Bar({ value, color, track, h = 4, style, marks }: {
  value: number; color?: string; track?: string; h?: number; style?: ViewStyle; marks?: number[];
}) {
  const colors = useColors();
  const v = Math.max(0, Math.min(1, value));
  const sx = useSharedValue(v);
  useEffect(() => { sx.set(withTiming(v, VALUE)); }, [v, sx]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.get() }] }));
  return (
    <View style={[{ height: h, backgroundColor: track ?? colors.line, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transformOrigin: 'left', backgroundColor: color ?? colors.blue }, fill]} />
      {marks?.map(m => <View key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m * 100}%`, width: 1, backgroundColor: colors.black }} />)}
    </View>
  );
}

/** Step dots: done and current steps fill (the Bar glide), the current one is longer. */
export function Dots({ n, i }: { n: number; i: number }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Step ${i + 1} of ${n}`} testID="dots">
      {Array.from({ length: n }, (_, k) => <Bar key={k} value={k <= i ? 1 : 0} h={3} color={colors.blue} style={{ width: k === i ? 28 : 14 }} />)}
    </View>
  );
}

/**
 * A slow breathing ring (accent outline, opacity 0 -> 0.9) around the one thing to do next, e.g. an empty
 * state's first button. The button itself never dims, so it can't read as disabled. Only on rare screens,
 * never on something seen many times a day. Still under reduced motion.
 */
export function Pulse({ children, on = true }: { children: ReactNode; on?: boolean }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const k = useSharedValue(0);
  useEffect(() => {
    if (!on || reduced) { k.set(0); return; }
    const half = { duration: 1100, easing: EASE_IN_OUT };
    k.set(withRepeat(withSequence(withTiming(0.9, half), withTiming(0, half)), -1));
    return () => cancelAnimation(k);
  }, [on, reduced, k]);
  const a = useAnimatedStyle(() => ({ opacity: k.get() }));
  return (
    <View>
      {children}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2, borderColor: colors.blue }, a]} />
    </View>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, light, label }: {
  options: { v: V; label: string }[]; value: V | undefined; onChange: (v: V) => void; light?: boolean; label?: string;
}) {
  const colors = useColors();
  const s = useS();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[s.seg, light && { backgroundColor: colors.inkLine, borderColor: colors.inkLine }]}>
      {options.map(o => {
        const on = o.v === value;
        return (
          <Press key={String(o.v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o.v)}
            style={[s.segB, on && { backgroundColor: light ? colors.black : colors.white }]}>
            <T style={{ fontFamily: font.textSemi, fontSize: 14, color: on ? (light ? colors.white : colors.black) : light ? colors.ink2 : colors.white2 }}>{o.label}</T>
          </Press>
        );
      })}
    </View>
  );
}

/** Radar of 3–5 stats: today (solid) vs yesterday (dashed). */
export function Radar({ stats, yesterday, size = 168 }: { stats: { name: string; level: number }[]; yesterday?: number[]; size?: number }) {
  const colors = useColors();
  const n = stats.length, c = size / 2, R = size / 2 - 30;
  const max = Math.max(10, ...stats.map(s => s.level), ...(yesterday ?? []));
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, (v / max) * R).join(',')).join(' ');
  return (
    <Svg width={size} height={size} testID="radar">
      {[0.33, 0.66, 1].map(k => <Polygon key={k} points={poly(stats.map(() => max * k))} fill="none" stroke={colors.line} strokeWidth={1} />)}
      {yesterday && <Polygon points={poly(yesterday)} fill="none" stroke={colors.purpleSoft} strokeDasharray="4 3" strokeWidth={1.5} />}
      <Polygon points={poly(stats.map(s => s.level))} fill={colors.blue3} stroke={colors.blue} strokeWidth={2} />
      {stats.map((s, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <SvgText key={s.name} x={x} y={y + 4} fill={colors.white2} fontSize={11} fontFamily={font.textSemi} textAnchor="middle">
            {`${s.name} ${s.level}`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }, style]}>{children}</View>;
}

const useS = themed(colors => ({
  hud: { flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 44 },
  kj: { width: 40, height: 40, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  kjT: { color: colors.black, fontSize: 24, fontFamily: font.textBold },
  honor: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.blue2, backgroundColor: colors.glass },
  ibtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.glass },
  seg: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  segB: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));
