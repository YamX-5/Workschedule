import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { font, space } from './tokens';
import { T } from './Text';
import { tap } from './motion';
import { themed, useColors, useTheme } from './theme';

export function ModalScreen({ title, kana, right, children }: { title: string; kana?: string; right?: ReactNode; children: ReactNode }) {
  const colors = useColors();
  const s = useS();
  const ins = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.black }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.head, { paddingTop: ins.top + space.s2 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={s.back} onPress={() => { tap(); router.canGoBack() ? router.back() : router.replace('/'); }}>
          <Svg width={20} height={20} viewBox="0 0 20 20"><Path d="M12 4 L6 10 L12 16" stroke={colors.white} strokeWidth={2} fill="none" /></Svg>
        </Pressable>
        <T v="display" style={{ fontSize: 14, letterSpacing: 3 }}>{title}</T>
        {kana ? <T v="kana">{kana}</T> : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <ScrollView contentContainerStyle={{ padding: space.s4, paddingBottom: ins.bottom + space.s6, gap: space.s4 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, error, ...rest }: TextInputProps & { label: string; error?: string }) {
  const { c: colors, dark } = useTheme();
  const s = useS();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T v="label">{label}</T>
      <TextInput placeholderTextColor={colors.white3} keyboardAppearance={dark ? 'dark' : 'light'} {...rest} style={[s.input, error ? { borderColor: colors.purpleSoft } : null]} accessibilityLabel={label} />
      {error ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{error}</T> : null}
    </View>
  );
}

const useS = themed(colors => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingHorizontal: space.s4, paddingBottom: space.s3, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.blue2 },
  input: { minHeight: 48, paddingHorizontal: space.s3, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.white, fontFamily: font.text, fontSize: 16 },
}));
