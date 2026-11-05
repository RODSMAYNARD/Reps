import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { fmtClock } from '../lib/format';
import { elapsedSec, useNow, useStore } from '../lib/store';
import { colors } from '../lib/theme';

export function ActiveBar() {
  const { active } = useStore();
  const now = useNow(1000, !!active);
  if (!active) return null;
  return (
    <Pressable onPress={() => router.push('/active')} testID="active-bar" style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name="barbell" size={20} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Workout in progress</Text>
        <Text style={{ color: '#E6F2FF', fontSize: 12 }}>{active.title} · {fmtClock(elapsedSec(active, now))}</Text>
      </View>
      <Ionicons name="chevron-up" size={20} color="#fff" />
    </Pressable>
  );
}
