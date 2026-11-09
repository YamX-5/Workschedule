// expo-calendar is native-only; tests never touch a real calendar.
jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  CalendarAccessLevel: { OWNER: 'owner' },
  SourceType: { LOCAL: 'local' },
  requestCalendarPermissions: jest.fn(async () => ({ status: 'denied' })),
  getCalendars: jest.fn(async () => []),
  listEvents: jest.fn(async () => []),
  getDefaultCalendarSync: jest.fn(() => ({ id: 'default', createEvent: async () => ({ id: 'event-1' }) })),
  createCalendar: jest.fn(async () => ({ id: 'yami', createEvent: async () => ({ id: 'event-1' }) })),
  ExpoCalendarEvent: { get: jest.fn(async () => ({ delete: async () => {} })) },
}));

// ponytail: hand mock of the few Reanimated APIs Yami uses; the package's own mock crashes on SDK 58 (setCSSEventHandler).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const id = v => v;
  // Layout-animation builders: every config method returns the same chainable object.
  const chain = {};
  ['delay', 'duration', 'easing', 'springify', 'dampingRatio', 'withInitialValues', 'reduceMotion'].forEach(k => { chain[k] = () => chain; });
  const Animated = { View: RN.View, Text: RN.Text, createAnimatedComponent: c => c };
  const sv = v => { const o = { value: v, get: () => o.value, set: x => { o.value = typeof x === 'function' ? x(o.value) : x; } }; return o; };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: sv,
    useAnimatedStyle: fn => fn(),
    useReducedMotion: () => false,
    withTiming: id, withSpring: id, withDecay: () => 0, withRepeat: id, withSequence: (...a) => a[a.length - 1],
    cancelAnimation: () => {},
    Easing: { bezier: () => id, linear: id },
    FadeIn: chain, FadeOut: chain, FadeInDown: chain, FadeInUp: chain, ZoomIn: chain,
    Keyframe: class { duration() { return this; } },
  };
});
