import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/ui/Button';
import { T } from '@/src/ui/Text';
import { colors, space } from '@/src/ui/tokens';

export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', gap: space.s4, padding: space.s4 }}>
      <T v="display">Signal lost</T>
      <Button label="Back to status" onPress={() => router.replace('/')} />
    </View>
  );
}
