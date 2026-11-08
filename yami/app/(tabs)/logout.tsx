import { useState } from 'react';
import { View } from 'react-native';
import { useYami, todayKey } from '@/src/data/store';
import { prayerTimes } from '@/src/prayer/prayer';
import { addDays } from '@/src/domain/time';
import { Row, Screen, Segmented } from '@/src/ui/parts';
import { Window } from '@/src/ui/Window';
import { HoldButton } from '@/src/ui/HoldButton';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';
import { fmtMin, fmtTime } from '@/src/ui/format';

export default function Logout() {
  const p = useYami(s => s.profile);
  const setEnergy = useYami(s => s.setEnergy);
  const addUsage = useYami(s => s.addUsage);
  const key = todayKey(p);
  const [salah, setSalah] = useState<'all' | 'some'>();
  const [phone, setPhone] = useState<'yes' | 'no'>();
  const [energy, setE] = useState<number>();
  const [done, setDone] = useState(p.usage.dayKey === key && p.usage.energy !== undefined);
  const answered = [salah, phone, energy].filter(x => x !== undefined).length;
  const fajr = prayerTimes(new Date(`${addDays(key, 1)}T12:00:00`), p.protocol.coords, p.protocol.calcMethod).fajr;
  const unreported = p.quests.filter(q => !p.reports.some(r => r.questId === q.id && r.dayKey === key)).length;

  const logOut = () => {
    // Honest phone answer: "No" means at least the cap was used, even without automatic tracking.
    const used = p.usage.dayKey === key ? p.usage.usedMin : 0;
    if (phone === 'no' && used < p.protocol.capMin) addUsage(p.protocol.capMin - used);
    setEnergy(energy!);
    setDone(true);
  };

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, minHeight: 120 }} />
        <Window title="Logged out" kana="ログアウト" meta={`wind-down ${p.protocol.windDown}`}>
          <T v="display" style={{ fontSize: 18, lineHeight: 28 }}>Sealed for the night.</T>
          <T style={{ color: colors.white2, marginTop: space.s2 }}>Wind-down {p.protocol.windDown} · Feeds locked until Fajr.</T>
          <T style={{ color: colors.white3, marginTop: space.s3, fontSize: 13 }}>
            Judgment at Fajr · {fmtTime(fajr)}. {unreported ? `${unreported} quest${unreported > 1 ? 's' : ''} still unreported. You can report until Fajr (late, half XP).` : 'Every quest is reported.'}
          </T>
          <T style={{ color: colors.white3, marginTop: space.s2, fontSize: 13 }}>Phone today: {fmtMin(p.usage.dayKey === key ? p.usage.usedMin : 0)}</T>
        </Window>
      </Screen>
    );
  }

  return (
    <Screen>
      <Window title="Log out" kana="ログアウト" meta={`wind-down ${p.protocol.windDown}`}>
        <View style={{ gap: space.s4 }}>
          <Q n={1} label="Salah today">
            <Segmented label="Salah today" value={salah} onChange={setSalah} options={[{ v: 'all', label: 'All 5' }, { v: 'some', label: 'Some missed' }]} />
          </Q>
          <Q n={2} label={`Phone under ${fmtMin(p.protocol.capMin)}`}>
            <Segmented label="Phone under cap" value={phone} onChange={setPhone} options={[{ v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }]} />
          </Q>
          <Q n={3} label="Energy">
            <Segmented label="Energy 1 to 5" value={energy} onChange={setE} options={[1, 2, 3, 4, 5].map(v => ({ v, label: String(v) }))} />
          </Q>
          <Row style={{ gap: space.s4, marginTop: space.s2 }}>
            <HoldButton testID="hold-logout" label={'LOG\nOUT'} disabled={answered < 3} onComplete={logOut} />
            <View style={{ flex: 1 }}>
              <T v="display" style={{ fontSize: 13, lineHeight: 18 }}>{answered < 3 ? `Answer ${3 - answered} more` : 'Ready'}</T>
              <T style={{ color: colors.white3, fontSize: 13, marginTop: 6 }}>Then press and hold the seal.</T>
            </View>
          </Row>
        </View>
      </Window>
    </Screen>
  );
}

function Q({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.s2 }}>
      <Row><T style={{ fontSize: 13, fontWeight: '600' }}>{label}</T><View style={{ flex: 1 }} /><T style={{ fontSize: 12, color: colors.white3 }}>{n} of 3</T></Row>
      {children}
    </View>
  );
}
