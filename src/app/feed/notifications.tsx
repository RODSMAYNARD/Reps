import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function Notifications() {
  return (
    <Screen>
      <Header title="Notifications" />
      <View style={{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Ionicons name="sparkles-outline" size={26} color={colors.primary} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>Welcome to Reps</Text><Text style={{ color: colors.muted }}>Log your first workout to start tracking your progress.</Text></View>
      </View>
      <Text style={{ color: colors.muted, textAlign: 'center', padding: 32 }}>Likes, comments, and new followers will show up here.</Text>
    </Screen>
  );
}
