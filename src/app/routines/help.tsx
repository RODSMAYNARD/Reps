import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const STEPS = [
  { icon: 'clipboard-outline', text: 'Routines are reusable and save time: plan your workout before you hit the gym.' },
  { icon: 'create-outline', text: 'Enter your planned weight and reps, or leave them blank and fill them in during the workout.' },
  { icon: 'timer-outline', text: 'Set an automatic rest timer between sets for each exercise.' },
] as const;

export default function RoutineHelp() {
  return (
    <Screen>
      <Header title="Routine help" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        {STEPS.map((s) => (
          <View key={s.text} style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, color: colors.text }}>{s.text}</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, height: 120, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={s.icon} size={52} color={colors.primary} /></View>
          </View>
        ))}
        <View style={{ alignItems: 'center', gap: 8 }}><Ionicons name="checkmark-circle" size={44} color={colors.success} /><Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Finish creating your routine</Text></View>
        <Btn title="Back" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
