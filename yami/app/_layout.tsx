import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import 'react-native-reanimated';
import { useYami } from '@/src/data/store';
import { syncReminders } from '@/src/notify/reminders';
import { colors } from '@/src/ui/tokens';
import { CelebrationOverlay, GainToast } from '@/src/features/Rewards';

export { ErrorBoundary } from 'expo-router';
export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fonts] = useFonts({ Michroma_400Regular, ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold });
  const [hydrated, setHydrated] = useState(useYami.persist.hasHydrated());

  useEffect(() => {
    const unsub = useYami.persist.onFinishHydration(() => setHydrated(true));
    if (useYami.persist.hasHydrated()) setHydrated(true); // finished before we subscribed
    return unsub;
  }, []);
  useEffect(() => { if (fonts && hydrated) SplashScreen.hideAsync().catch(() => {}); }, [fonts, hydrated]);

  // Onboarding gate + Judgment at Fajr on open and on every return to the foreground.
  useEffect(() => {
    if (!fonts || !hydrated) return;
    const check = () => {
      const s = useYami.getState();
      if (!s.profile.onboarded) { router.replace('/onboarding'); return; }
      const out = s.runJudgment();
      if (out && out.results.length) router.push('/judgment');
      syncReminders(useYami.getState().profile);
    };
    const t = setTimeout(check, 0);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') check(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [fonts, hydrated]);

  if (!fonts || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.black }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="judgment" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="lock" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="protocol" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dream" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shop" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
      </Stack>
      <GainToast />
      <CelebrationOverlay />
    </GestureHandlerRootView>
  );
}
