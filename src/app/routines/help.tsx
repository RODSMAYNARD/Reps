import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Header, Screen } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const STEPS = [
  { icon: 'clipboard-outline', text: 'Rotinas são reutilizáveis e poupam tempo: você planeja o treino antes de ir à academia.' },
  { icon: 'create-outline', text: 'Informe a carga e as repetições planejadas, ou deixe em branco e preencha durante o treino.' },
  { icon: 'timer-outline', text: 'Defina um cronômetro de descanso automático entre as séries de cada exercício.' },
] as const;

export default function RoutineHelp() {
  return (
    <Screen>
      <Header title="Ajuda de rotinas" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        {STEPS.map((s) => (
          <View key={s.text} style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, color: colors.text }}>{s.text}</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, height: 120, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={s.icon} size={52} color={colors.primary} /></View>
          </View>
        ))}
        <View style={{ alignItems: 'center', gap: 8 }}><Ionicons name="checkmark-circle" size={44} color={colors.success} /><Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Termine de criar sua rotina</Text></View>
        <Btn title="Voltar" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
