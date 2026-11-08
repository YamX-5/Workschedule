import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors, font, space, TAB_BAR_H } from '@/src/ui/tokens';
import { T } from '@/src/ui/Text';
import { tap } from '@/src/ui/motion';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; label: string }[] = [
  { name: 'index', label: 'Status' },
  { name: 'gates', label: 'Gates' },
  { name: 'path', label: 'Path' },
  { name: 'quest', label: 'Quest' },
  { name: 'logout', label: 'Log out' },
];

function Icon({ name, c }: { name: string; c: string }) {
  const p = { stroke: c, strokeWidth: 1.6, fill: 'none' } as const;
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {name === 'index' && <><Polygon points="11,2 20,7 20,15 11,20 2,15 2,7" {...p} /><Rect x="9" y="9" width="4" height="4" fill={c} transform="rotate(45 11 11)" /></>}
      {name === 'gates' && <><Line x1="3" y1="5" x2="19" y2="5" {...p} /><Line x1="5" y1="5" x2="5" y2="20" {...p} /><Line x1="17" y1="5" x2="17" y2="20" {...p} /><Rect x="9" y="10" width="4" height="10" {...p} /></>}
      {name === 'path' && <><Path d="M3 19 L8 12 L12 15 L19 4" {...p} /><Circle cx="19" cy="4" r="2" fill={c} /></>}
      {name === 'quest' && <><Path d="M8 3 v6 l4 3 v7" {...p} /><Circle cx="12" cy="12" r="1.8" fill={c} /><Line x1="5" y1="3" x2="5" y2="9" {...p} strokeDasharray="2 2" /></>}
      {name === 'logout' && <Path d="M15 4 a8 8 0 1 0 3 12 a6 6 0 1 1 -3 -12z" {...p} />}
    </Svg>
  );
}

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[s.bar, { bottom: ins.bottom + space.s3 }]} accessibilityRole="tablist">
      {state.routes.map((r, i) => {
        const on = state.index === i;
        const t = TABS.find(x => x.name === r.name);
        const c = on ? colors.black : colors.white3;
        return (
          <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t?.label}
            onPress={() => { tap(); if (!on) navigateToTab(r.key); }} style={[s.tab, on && s.on]}>
            <Icon name={r.name} c={c} />
            <T numberOfLines={1} style={[s.lbl, { color: c }]}>{t?.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={p => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.black } }}>
      {TABS.map(t => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />)}
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: space.s4, right: space.s4, height: TAB_BAR_H, flexDirection: 'row', padding: 6, gap: 4, backgroundColor: 'rgba(11,9,21,0.94)', borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  on: { backgroundColor: colors.white },
  lbl: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
});
