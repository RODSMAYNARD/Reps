import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { Btn, Field, Header, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Signup() {
  const { signUp } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = email.includes('@') && password.length >= 6;
  return (
    <Screen>
      <Header title="Create account" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Field label="Email" placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field label="Password" placeholder="At least 6 characters" secureTextEntry value={password} onChangeText={setPassword} />
          {!!msg && <Text style={{ color: msg.startsWith('Account created') ? colors.success : colors.danger }}>{msg}</Text>}
          <Btn title="Create account" disabled={!ok} loading={busy} onPress={async () => { setBusy(true); setMsg(await signUp(email.trim(), password)); setBusy(false); }} />
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>By creating an account you agree to the Terms of Use and Privacy Policy.</Text>
          <Btn title="I already have an account" variant="ghost" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
