import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Field, Header, Screen } from '../../components/ui';
import { PRIVACY_URL, TERMS_URL } from '../../lib/constants';
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
          {/* links legais (a política de privacidade só aparece depois de publicada: PRIVACY_URL em lib/constants) */}
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
            By creating an account you agree to the <Text onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} style={{ color: colors.primary }}>Terms of Use</Text>
            {PRIVACY_URL ? ' and the ' : ''}
            {PRIVACY_URL ? <Text onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} style={{ color: colors.primary }}>Privacy Policy</Text> : null}
            .
          </Text>
          <Btn title="I already have an account" variant="ghost" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
