import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const STEPS = [
  { icon: 'play-circle-outline', t: '1. Start a workout', d: 'On the Workout tab, tap “Start Empty Workout” or pick a routine.' },
  { icon: 'add-circle-outline', t: '2. Add exercises', d: 'Search the library, select several at once, or create your own.' },
  { icon: 'checkmark-circle-outline', t: '3. Log your sets', d: 'Enter weight and reps, then check ✓. Rest starts automatically.' },
  { icon: 'save-outline', t: '4. Finish and save', d: 'Add a title, notes, and photos, then save to see it in your history.' },
  { icon: 'stats-chart-outline', t: '5. Track your progress', d: 'See charts, records, and stats on your profile.' },
] as const;

export default function Guide() {
  return (
    <Screen>
      <Header title="Getting Started" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {STEPS.map((s) => (
          <View key={s.t} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Ionicons name={s.icon} size={34} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{s.t}</Text><Text style={{ color: colors.muted }}>{s.d}</Text></View>
          </View>
        ))}
        <Btn title="View routine help" variant="secondary" onPress={() => router.push('/routines/help')} />
      </ScrollView>
    </Screen>
  );
}
