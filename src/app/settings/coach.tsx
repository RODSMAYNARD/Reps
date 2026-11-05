import { Ionicons } from '@expo/vector-icons';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Btn, Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const TIERS = [['1–10 clients', '$25.00'], ['11–25 clients', '$50.00'], ['26–50 clients', '$90.00'], ['51–100 clients', '$160.00']];

export default function Coach() {
  return (
    <Screen>
      <Header title="Reps Coach" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, height: 150, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="people" size={64} color={colors.primary} /></View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>For personal trainers</Text>
        <Text style={{ color: colors.muted }}>A tool for trainers to build programs, track client progress, and grow their business.</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Build workout programs</Text>
        <Text style={{ color: colors.muted }}>Creating custom plans is simple with the same interface you already know.</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Transparent pricing</Text>
        {TIERS.map(([a, b], i) => <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: i % 2 ? colors.bg : colors.surface }}><Text style={{ color: colors.text }}>{a}</Text><Text style={{ color: colors.text }}>{b}/month</Text></View>)}
        <Btn title="Get started" onPress={() => Linking.openURL('mailto:rodrigo.maynard@gmail.com?subject=Reps Coach')} />
      </ScrollView>
    </Screen>
  );
}
