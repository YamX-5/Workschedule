import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useYami, todayKey } from '@/src/data/store';
import { PRAYERS, PRAYER_AR, nextPrayer, prayerTimes } from '@/src/prayer/prayer';
import type { GateMark } from '@/src/domain/types';
import { Bar, Screen } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { T } from '@/src/ui/Text';
import { font, space } from '@/src/ui/tokens';
import { fmtMin, fmtTime } from '@/src/ui/format';
import { tap } from '@/src/ui/motion';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { themed, useColors } from '@/src/ui/theme';

const MARK: Record<GateMark, string> = { pending: '—', ontime: 'ON TIME', late: 'LATE', miss: 'MISSED' };

export default function Gates() {
  const colors = useColors();
  const s = useS();
  const p = useYami(s => s.profile);
  const cycle = useYami(s => s.cycleGate);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const key = todayKey(p, now);
  const times = prayerTimes(new Date(`${key}T12:00:00`), p.protocol.coords, p.protocol.calcMethod);
  const next = nextPrayer(now, times);
  const gates = p.usage.dayKey === key && p.usage.gates ? p.usage.gates : Array<GateMark>(5).fill('pending');
  const cleared = gates.filter(g => g === 'ontime' || g === 'late').length;
  const mins = Math.max(0, Math.round((next.at.getTime() - now.getTime()) / 60000));

  return (
    <Screen>
      <Window title="Gates of salah" kana="ゲート" tone="white" meta={`${fmtTime(now)} · ${p.protocol.city}`}>
        <View style={s.next}>
          <View style={{ flex: 1 }}>
            <T style={s.nextT}>Next: <T style={[s.nextT, { color: colors.purple }]}>{next.name[0].toUpperCase() + next.name.slice(1)}</T></T>
            <T style={s.in}>in {fmtMin(mins)} · {fmtTime(next.at)}</T>
          </View>
          <T style={s.ar}>{PRAYER_AR[next.name]}</T>
        </View>
        <Bar value={cleared / 5} color={colors.black} track={colors.inkLine} h={6} style={{ marginTop: space.s3 }} />
        <T style={s.sub}>{cleared} of 5 gates open. Tap a portal to mark it: on time, late, missed. Each prayer pays XP instantly.</T>
      </Window>

      <View style={s.grid}>
        {PRAYERS.map((n, i) => {
          const g = gates[i];
          const isNext = n === next.name && g === 'pending';
          return (
            <Pressable key={n} testID={`gate-${n}`} accessibilityRole="button" accessibilityLabel={`${n} ${MARK[g]}`}
              onPress={() => { tap(); cycle(i); }}
              style={s.gate}>
              <View style={s.portalBox}>
                <Portal mark={g} next={isNext} id={n} />
                <T style={[s.gAr, g === 'ontime' && { color: colors.black }]}>{PRAYER_AR[n]}</T>
              </View>
              <T style={s.gEn}>{n.toUpperCase()}</T>
              <T v="num" style={{ fontSize: 12 }}>{fmtTime(times[n])}</T>
              <T style={[s.gMark, g === 'miss' && { color: colors.purpleSoft }]}>{isNext ? 'NEXT' : MARK[g]}</T>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const ARCH = 'M6 118 L6 46 A38 38 0 0 1 82 46 L82 118 Z';
const INNER = 'M14 112 L14 47 A30 30 0 0 1 74 47 L74 112 Z';

/** A gate drawn as a portal: dark and sealed until prayed, glowing open when prayed on time. */
function Portal({ mark, next, id }: { mark: GateMark; next: boolean; id: string }) {
  const colors = useColors();
  const open = mark === 'ontime' || mark === 'late';
  const core = mark === 'ontime' ? colors.blue : mark === 'late' ? colors.purpleSoft : colors.purple;
  const rim = mark === 'miss' ? colors.line : next ? colors.blue : open ? core : colors.blue2;
  return (
    <Svg width={88} height={122} viewBox="0 0 88 122" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`pg-${id}`} cx="50%" cy="58%" r="60%">
          <Stop offset="0" stopColor={core} stopOpacity={open ? 1 : 0.35} />
          <Stop offset="0.55" stopColor={core} stopOpacity={open ? 0.45 : 0.12} />
          <Stop offset="1" stopColor={colors.black} stopOpacity={0.9} />
        </RadialGradient>
      </Defs>
      {open && <Path d={ARCH} fill={core} opacity={0.18} transform="translate(44 64) scale(1.08) translate(-44 -64)" />}
      <Path d={ARCH} fill={colors.black} stroke={rim} strokeWidth={next || open ? 2.5 : 1.5} />
      <Path d={INNER} fill={mark === 'miss' ? colors.black : `url(#pg-${id})`} stroke={rim} strokeWidth={0.8} opacity={0.95} />
      {open && [0, 1, 2].map(k => (
        <Ellipse key={k} cx={44} cy={72} rx={22 - k * 7} ry={30 - k * 9} stroke={colors.white} strokeWidth={0.8} fill="none" opacity={0.5 - k * 0.12} />
      ))}
      {mark === 'miss' && <Path d="M24 60 L64 104 M64 60 L24 104" stroke={colors.purpleSoft} strokeWidth={1.5} opacity={0.6} />}
    </Svg>
  );
}

const useS = themed(colors => ({
  portalBox: { width: 88, height: 122, alignItems: 'center', justifyContent: 'center', paddingTop: 18 },
  next: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s3 },
  nextT: { fontFamily: font.display, fontSize: 22, color: colors.ink },
  in: { fontFamily: font.text, fontSize: 15, color: colors.ink2, marginTop: 4 },
  ar: { fontSize: 28, fontWeight: '700', color: colors.purple },
  sub: { fontSize: 13, color: colors.ink2, marginTop: space.s2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  gate: { flexGrow: 1, flexBasis: '30%', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.s3, paddingHorizontal: space.s2, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line },
  gAr: { fontSize: 18, fontWeight: '700', color: colors.white },
  gEn: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 1, color: colors.white2 },
  gMark: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 0.8, color: colors.blue },
}));
