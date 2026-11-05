import { Ionicons } from '@expo/vector-icons';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Btn, Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const TIERS = [['1–10 clientes', 'R$ 49,90'], ['11–25 clientes', 'R$ 99,90'], ['26–50 clientes', 'R$ 179,90'], ['51–100 clientes', 'R$ 299,90']];

export default function Coach() {
  return (
    <Screen>
      <Header title="Reps Coach" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, height: 150, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="people" size={64} color={colors.primary} /></View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Para personal trainers</Text>
        <Text style={{ color: colors.muted }}>Uma ferramenta para treinadores montarem programas, acompanharem o progresso dos alunos e fazerem o negócio crescer.</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Monte programas de treino</Text>
        <Text style={{ color: colors.muted }}>Criar planos sob medida fica simples com a mesma interface que você já conhece.</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Preços transparentes</Text>
        {TIERS.map(([a, b], i) => <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: i % 2 ? colors.bg : colors.surface }}><Text style={{ color: colors.text }}>{a}</Text><Text style={{ color: colors.text }}>{b}/mês</Text></View>)}
        <Btn title="Começar" onPress={() => Linking.openURL('mailto:rodrigo.maynard@gmail.com?subject=Reps Coach')} />
      </ScrollView>
    </Screen>
  );
}
