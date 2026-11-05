import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const STEPS = [
  { icon: 'play-circle-outline', t: '1. Comece um treino', d: 'Na aba Treino, toque em “Iniciar treino vazio” ou escolha uma rotina.' },
  { icon: 'add-circle-outline', t: '2. Adicione exercícios', d: 'Busque na biblioteca, selecione vários de uma vez ou crie o seu.' },
  { icon: 'checkmark-circle-outline', t: '3. Registre as séries', d: 'Preencha peso e repetições e marque ✓. O descanso começa sozinho.' },
  { icon: 'save-outline', t: '4. Finalize e salve', d: 'Dê um título, adicione notas e fotos e salve para ver no seu histórico.' },
  { icon: 'stats-chart-outline', t: '5. Acompanhe a evolução', d: 'Veja gráficos, recordes e estatísticas no seu perfil.' },
] as const;

export default function Guide() {
  return (
    <Screen>
      <Header title="Guia de início" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {STEPS.map((s) => (
          <View key={s.t} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Ionicons name={s.icon} size={34} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{s.t}</Text><Text style={{ color: colors.muted }}>{s.d}</Text></View>
          </View>
        ))}
        <Btn title="Ver ajuda de rotinas" variant="secondary" onPress={() => router.push('/routines/help')} />
      </ScrollView>
    </Screen>
  );
}
