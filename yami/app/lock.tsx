import { useYami, todayKey } from '@/src/data/store';
import { frictionSec, phoneState } from '@/src/domain/budget';
import { Intrusion, LimitReached, Sealed } from '@/src/features/lock';
import { ModalScreen } from '@/src/ui/ModalScreen';
import { T } from '@/src/ui/Text';
import { useColors } from '@/src/ui/theme';
export default function Lock() {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const key = todayKey(p);
  const used = p.usage.dayKey === key ? p.usage.usedMin : p.corruptionCarryMin;
  const st = phoneState(used, p.protocol.capMin, p.usage.reserveUsedMin, p.protocol.reserveMin, p.usage.reserveOpen);
  return (
    <ModalScreen title={st === 'sealed' ? 'Sealed' : st === 'limit' ? 'Limit reached' : 'Intrusion'} kana="侵入">
      {st === 'sealed' ? <Sealed /> : st === 'limit' ? <LimitReached /> : <Intrusion delay={st === 'reserve' ? 30 : frictionSec(used, p.protocol.capMin) ?? 30} used={used} cap={p.protocol.capMin} />}
      <T style={{ fontSize: 12, color: colors.white3, textAlign: 'center' }}>
        Simulate mode. On Android the Shield opens this when a watched app launches (Plan 2).
      </T>
    </ModalScreen>
  );
}
