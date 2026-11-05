import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
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
      <Header title="Criar conta" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Field label="E-mail" placeholder="voce@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field label="Senha" placeholder="Mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} />
          {!!msg && <Text style={{ color: msg.startsWith('Conta criada') ? colors.success : colors.danger }}>{msg}</Text>}
          <Btn title="Criar conta" disabled={!ok} loading={busy} onPress={async () => { setBusy(true); setMsg(await signUp(email.trim(), password)); setBusy(false); }} />
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade.</Text>
          <Btn title="Já tenho conta" variant="ghost" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
