import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS, tap } from './motion';

const AP = Animated.createAnimatedComponent(Pressable);

/** Pressable that dips to 0.97 on press-in (with a light haptic in the same frame) and springs back on release. */
export function Press({ style, onPressIn, onPressOut, haptic = true, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: boolean }) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.get() }] }));
  return (
    <AP {...rest} style={[style, a]}
      onPressIn={e => { if (haptic) tap(); sc.set(withTiming(0.97, PRESS)); onPressIn?.(e); }}
      onPressOut={e => { sc.set(withTiming(1, PRESS)); onPressOut?.(e); }} />
  );
}
