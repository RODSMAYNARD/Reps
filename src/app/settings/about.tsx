import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, View } from 'react-native';
import { Text } from '../../components/Text';
import { Header, ListRow, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function About() {
  return (
    <Screen>
      <Header title="About" />
      <View style={{ alignItems: 'center', padding: 28, gap: 6 }}>
        <Ionicons name="barbell" size={56} color={colors.primary} />
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>Reps</Text>
        <Text style={{ color: colors.muted }}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
      <ListRow label="Terms of Use" onPress={() => Linking.openURL('https://example.com/termos')} />
      <ListRow label="Privacy Policy" onPress={() => Linking.openURL('https://example.com/privacidade')} last />
    </Screen>
  );
}
