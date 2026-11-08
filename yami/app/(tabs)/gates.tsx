import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useYami, todayKey } from '@/src/data/store';
import { PRAYERS, PRAYER_AR, nextPrayer, prayerTimes } from '@/src/prayer/prayer';
import type { GateMark } from '@/src/domain/types';
import { Bar, Screen } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { T } from '@/src/ui/Text';
import { colors, font, space } from '@/src/ui/tokens';
import { fmtMin, fmtTime } from '@/src/ui/format';
import { tap } from '@/src/ui/motion';

const MARK: Record<GateMark, string> = { pending: '—', ontime: 'ON TIME', late: 'LATE', miss: 'MISSED' };

export default function Gates() {
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
        <T style={s.sub}>{cleared} of 5 gates cleared. Tap a gate to mark it: on time, late, missed.</T>
      </Window>

      <View style={s.grid}>
        {PRAYERS.map((n, i) => {
          const g = gates[i];
          const isNext = n === next.name && g === 'pending';
          return (
            <Pressable key={n} testID={`gate-${n}`} accessibilityRole="button" accessibilityLabel={`${n} ${MARK[g]}`}
              onPress={() => { tap(); cycle(i); }}
              style={[s.gate, g === 'ontime' && { backgroundColor: colors.white }, g === 'late' && { backgroundColor: colors.blue3 },
                g === 'miss' && { backgroundColor: colors.purple }, isNext && { borderColor: colors.blue, borderWidth: 2 }]}>
              <T style={[s.gAr, g === 'ontime' && { color: colors.black }]}>{PRAYER_AR[n]}</T>
              <T style={[s.gEn, g === 'ontime' && { color: colors.black }]}>{n.toUpperCase()}</T>
              <T v="num" style={[{ fontSize: 12 }, g === 'ontime' && { color: colors.ink2 }]}>{fmtTime(times[n])}</T>
              <T style={[s.gMark, g === 'ontime' && { color: colors.purple }]}>{isNext ? 'NEXT' : MARK[g]}</T>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  next: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s3 },
  nextT: { fontFamily: font.display, fontSize: 22, color: colors.ink },
  in: { fontFamily: font.text, fontSize: 15, color: colors.ink2, marginTop: 4 },
  ar: { fontSize: 28, fontWeight: '700', color: colors.purple },
  sub: { fontSize: 13, color: colors.ink2, marginTop: space.s2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  gate: { flexGrow: 1, flexBasis: '30%', minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.s2, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line },
  gAr: { fontSize: 18, fontWeight: '700', color: colors.white },
  gEn: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 1, color: colors.white2 },
  gMark: { fontFamily: font.textBold, fontSize: 11, letterSpacing: 0.8, color: colors.blue },
});
