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
