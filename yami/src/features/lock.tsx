import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useYami } from '@/src/data/store';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';
import { fmtMin } from '@/src/ui/format';
import { success } from '@/src/ui/motion';

export const ALWAYS_OPEN = ['Phone', 'Messages', 'Maps', 'Quran', 'Bank'];
const REASONS = ['Work message', 'Family', 'Navigation', 'Payment', 'Other need'];
const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function Intrusion({ delay, used, cap }: { delay: number; used: number; cap: number }) {
  const addUsage = useYami(s => s.addUsage);
  const [left, setLeft] = useState(delay);
  useEffect(() => {
    const end = Date.now() + delay * 1000;
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 200);
    return () => clearInterval(t);
  }, [delay]);
  return (
    <Window title="Watched app opened" meta={`${fmtMin(used)} / ${fmtMin(cap)}`}>
      <T v="display" style={{ fontSize: 22, lineHeight: 32 }}>{left > 0 ? 'Breathe.' : 'Your call.'}</T>
      <T style={{ color: colors.white2, marginTop: space.s2 }}>{left > 0 ? `${left}s` : 'The urge passes faster than the feed does.'}</T>
      <View style={{ gap: space.s3, marginTop: space.s5 }}>
        {left === 0 && <Button variant="seal" label="Seal it" testID="seal-it" onPress={() => { success(); close(); }} />}
        {left === 0 && <Button variant="ghost" small label="open anyway (+5 min)" onPress={() => { addUsage(5); close(); }} />}
      </View>
    </Window>
  );
}

export function LimitReached() {
  const p = useYami(s => s.profile);
  const openReserve = useYami(s => s.openReserve);
  const [reason, setReason] = useState<string>();
  return (
    <Window title="Limit reached" meta={`Reserve ${p.protocol.reserveMin} min`}>
      <T style={{ color: colors.white2 }}>Your cap is spent. The Necessity Reserve opens only with a reason, and every reason is logged.</T>
      <View style={{ gap: space.s2, marginTop: space.s4 }}>
        {REASONS.map(r => <Button key={r} small variant={reason === r ? 'seal' : 'ghost'} label={r} onPress={() => setReason(r)} />)}
      </View>
      <Button label="Open reserve" testID="open-reserve" disabled={!reason} style={{ marginTop: space.s4 }} onPress={() => { openReserve(reason!); close(); }} />
      <Button variant="ghost" label="Seal it" style={{ marginTop: space.s2 }} onPress={close} />
    </Window>
  );
}

export function Sealed() {
  return (
    <Window title="Sealed until Fajr" tone="white">
      <T v="display" style={{ color: colors.ink, fontSize: 18, lineHeight: 28 }}>SEALED UNTIL FAJR</T>
      <T style={{ color: colors.ink2, marginTop: space.s2 }}>Still open:</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.s2 }}>
        {ALWAYS_OPEN.map(a => <T key={a} style={{ borderWidth: 1, borderColor: colors.inkLine, paddingHorizontal: 10, paddingVertical: 6, color: colors.ink }}>{a}</T>)}
      </View>
      <T style={{ color: colors.ink2, marginTop: space.s4, fontSize: 13 }}>
        Uninstalling Yami triggers a FALL: level, streak and stats return to Day 1. Your scars and Honor record remain.
      </T>
    </Window>
  );
}
