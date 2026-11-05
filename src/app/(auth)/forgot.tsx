import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Btn, Dialog, Field, Header, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Forgot() {
  const { resetPassword } = useStore();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <Screen>
      <Header title="Recuperar senha" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <Text style={{ color: colors.muted }}>Informe seu e-mail e enviaremos um link para criar uma nova senha.</Text>
        <Field label="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
        <Btn title="Enviar link" disabled={!email.includes('@')} onPress={async () => { const e = await resetPassword(email.trim()); setMsg(e); if (!e) setSent(true); }} />
      </ScrollView>
      <Dialog visible={sent} title="Verifique seu e-mail" message="Se existir uma conta com esse e-mail, o link já está a caminho." actions={[{ label: 'Ok', primary: true, onPress: () => { setSent(false); router.back(); } }]} />
    </Screen>
  );
}
