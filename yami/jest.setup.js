// ponytail: hand mock of the few Reanimated APIs Yami uses; the package's own mock crashes on SDK 58 (setCSSEventHandler).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const id = v => v;
  const chain = { delay: () => chain, duration: () => chain };
  const Animated = { View: RN.View, Text: RN.Text, createAnimatedComponent: c => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: v => ({ value: v }),
    useAnimatedStyle: fn => fn(),
    withTiming: id, withSpring: id, cancelAnimation: () => {},
    Easing: { bezier: () => id, linear: id },
    FadeInDown: chain,
  };
});
