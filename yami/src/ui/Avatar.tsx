// In-app character, one cumulative layer per form tier. Placeholder for Blender renders (Plan 3):
// swap the body for a rendered PNG per tier and keep the same `tier` prop.
import Svg, { Circle, Defs, Ellipse, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from './tokens';

export function Avatar({ tier, size = 120 }: { tier: number; size?: number }) {
  const t = (n: number) => tier >= n;
  const supreme = t(10);
  const body = supreme ? colors.white : colors.purple;
  const lift = t(9) ? -6 : 0;
  return (
    <Svg width={size} height={size * 1.33} viewBox="0 0 120 160" accessibilityLabel={`Form tier ${tier}`}>
      <Defs>
        <RadialGradient id="aura" cx="50%" cy="45%" r="50%">
          <Stop offset="0" stopColor={colors.blue} stopOpacity={t(9) ? 0.45 : 0.18} />
          <Stop offset="1" stopColor={colors.blue} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {t(1) && <Ellipse cx="60" cy="72" rx="58" ry="74" fill="url(#aura)" />}
      {t(5) && <Circle cx="60" cy="38" r="26" stroke={colors.blue} strokeWidth="2" fill="none" opacity="0.8" />}
      {supreme && <Circle cx="60" cy="38" r="33" stroke={colors.purpleSoft} strokeWidth="1.5" fill="none" />}
      {t(8) && (
        <G opacity={supreme ? 1 : 0.85}>
          <Path d="M44 66 C20 50 6 70 4 100 C16 88 28 84 44 84 Z" fill={colors.blue3} stroke={colors.blue} strokeWidth="1.2" />
          <Path d="M76 66 C100 50 114 70 116 100 C104 88 92 84 76 84 Z" fill={colors.blue3} stroke={colors.blue} strokeWidth="1.2" />
        </G>
      )}
      <G transform={`translate(0 ${lift})`}>
        {/* body */}
        <Rect x="46" y="58" width="28" height="44" fill={body} />
        <Rect x="47" y="102" width="11" height="40" fill={body} />
        <Rect x="62" y="102" width="11" height="40" fill={body} />
        <Rect x="36" y="60" width="9" height="38" fill={body} />
        <Rect x="75" y="60" width="9" height="38" fill={body} />
        <Rect x="49" y="30" width="22" height="24" fill={body} />
        {t(3) && !supreme && <Path d="M45 54 L60 22 L75 54 L75 104 L45 104 Z" fill={colors.black} opacity="0.55" />}
        {t(3) && !supreme && <Path d="M46 34 L60 20 L74 34 L74 50 L46 50 Z" fill={colors.black} opacity="0.9" />}
        {t(1) && <Rect x="53" y="40" width="5" height="3" fill={colors.blue} />}
        {t(1) && <Rect x="62" y="40" width="5" height="3" fill={colors.blue} />}
        {t(2) && <Polygon points="60,68 66,76 60,84 54,76" fill={colors.blue} />}
        {t(4) && <Rect x="32" y="56" width="16" height="9" fill={colors.purpleSoft} />}
        {t(4) && <Rect x="72" y="56" width="16" height="9" fill={colors.purpleSoft} />}
        {t(7) && <Polygon points="48,24 52,14 56,22 60,10 64,22 68,14 72,24" fill={colors.blue} />}
      </G>
      {t(6) && [[18, 46], [102, 52], [24, 118], [96, 122]].map(([x, y]) => (
        <Polygon key={`${x}`} points={`${x},${y - 5} ${x + 4},${y} ${x},${y + 5} ${x - 4},${y}`} fill={colors.blue} />
      ))}
      <Ellipse cx="60" cy="150" rx={t(9) ? 22 : 26} ry="3" fill={colors.blue} opacity={t(9) ? 0.25 : 0.4} />
    </Svg>
  );
}
