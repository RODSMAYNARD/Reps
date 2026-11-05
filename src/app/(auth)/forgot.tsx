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
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Header title="Reset password" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <Text style={{ color: colors.muted }}>Enter your email and we will send you a link to create a new password.</Text>
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
        <Btn title="Send link" disabled={!email.includes('@')} loading={busy} onPress={async () => { setBusy(true); setMsg(null); const e = await resetPassword(email.trim()); setBusy(false); setMsg(e); if (!e) setSent(true); }} />
      </ScrollView>
      <Dialog visible={sent} title="Check your email" message="If an account exists with that email, the link is on its way." actions={[{ label: 'Ok', primary: true, onPress: () => { setSent(false); router.back(); } }]} />
    </Screen>
  );
}
