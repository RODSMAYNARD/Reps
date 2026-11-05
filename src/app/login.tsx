import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button, Input } from '../components/ui';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';

export default function Login() {
  const { signIn, signUp } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: typeof signIn) => {
    setBusy(true);
    setMsg(await fn(email.trim(), password));
    setBusy(false);
  };
  const ok = email.includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
      <Text style={{ color: colors.accent, fontSize: 40, fontWeight: '800' }}>Reps</Text>
      <Text style={{ color: colors.muted, marginBottom: 10 }}>Registre seus treinos e acompanhe sua evolução.</Text>
      <Input placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Input placeholder="Senha (mínimo 6 caracteres)" secureTextEntry value={password} onChangeText={setPassword} />
      {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
      <View style={{ gap: 10 }}>
        <Button title="Entrar" onPress={() => run(signIn)} disabled={!ok || busy} />
        <Button title="Criar conta" variant="ghost" onPress={() => run(signUp)} disabled={!ok || busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
