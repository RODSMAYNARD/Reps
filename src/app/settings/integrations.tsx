import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Dialog, Header, Screen } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const ITEMS = [
  { id: 'strava', name: 'Strava', icon: 'bicycle', color: '#FC4C02', text: 'Quando conectado, seus treinos aparecem no feed do Strava. Você pode desconectar quando quiser.' },
  { id: 'health', name: 'Saúde / Health Connect', icon: 'heart', color: '#FF2D55', text: 'Sincronize peso e treinos com o app de saúde do seu aparelho.' },
] as const;

export default function Integrations() {
  const [dlg, setDlg] = useState(false);
  return (
    <Screen>
      <Header title="Integrações" />
      {ITEMS.map((i) => (
        <View key={i.id} style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: i.color, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={i.icon} size={26} color="#fff" /></View>
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{i.name}</Text>
            <Btn title="Conectar" variant="outline" style={{ minHeight: 40 }} onPress={() => setDlg(true)} />
          </View>
          <Text style={{ color: colors.muted }}>{i.text}</Text>
        </View>
      ))}
      <Dialog visible={dlg} title="Em breve" message="Integrações com serviços externos precisam de credenciais e serão ativadas na versão publicada." actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(false) }]} />
    </Screen>
  );
}
