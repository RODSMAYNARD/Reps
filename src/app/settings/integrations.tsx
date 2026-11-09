import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Dialog, Header, Screen } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const ITEMS = [
  { id: 'strava', name: 'Strava', icon: 'bicycle', color: '#FC4C02', text: 'When connected, your workouts appear in your Strava feed. You can disconnect at any time.' },
  { id: 'health', name: 'Health / Health Connect', icon: 'heart', color: '#FF2D55', text: 'Sync weight and workouts with your device\'s health app.' },
] as const;

export default function Integrations() {
  const [dlg, setDlg] = useState(false);
  return (
    <Screen>
      <Header title="Integrations" />
      {ITEMS.map((i) => (
        <View key={i.id} style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: i.color, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={i.icon} size={26} color="#fff" /></View>
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{i.name}</Text>
            <Btn title="Connect" variant="outline" style={{ minHeight: 40 }} onPress={() => setDlg(true)} />
          </View>
          <Text style={{ color: colors.muted }}>{i.text}</Text>
        </View>
      ))}
      <Dialog visible={dlg} title="Coming soon" message="Integrations with external services require credentials and will be enabled in the published version." actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(false) }]} />
    </Screen>
  );
}
