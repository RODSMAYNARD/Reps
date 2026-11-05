import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, Text, View } from 'react-native';
import { Header, ListRow, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function About() {
  return (
    <Screen>
      <Header title="Sobre" />
      <View style={{ alignItems: 'center', padding: 28, gap: 6 }}>
        <Ionicons name="barbell" size={56} color={colors.primary} />
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>Reps</Text>
        <Text style={{ color: colors.muted }}>Versão {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
      <ListRow label="Termos de uso" onPress={() => Linking.openURL('https://example.com/termos')} />
      <ListRow label="Política de privacidade" onPress={() => Linking.openURL('https://example.com/privacidade')} last />
    </Screen>
  );
}
