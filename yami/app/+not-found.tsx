import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { useColors } from '@/src/ui/theme';

export default function NotFound() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', gap: space.s4, padding: space.s4 }}>
      <T v="display">Signal lost</T>
      <Button label="Back to status" onPress={() => router.replace('/')} />
    </View>
  );
}
