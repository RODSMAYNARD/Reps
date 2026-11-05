import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Btn, Dialog, Field, Header, Screen, TextLink } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { SocialButton } from './index';

export default function Login() {
  const { signIn } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [soon, setSoon] = useState(false);
  return (
    <Screen>
      <Header title="Log in" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Email" placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="login-email" />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} testID="login-password" />
          <TextLink title="Forgot password?" onPress={() => router.push('/forgot')} style={{ alignSelf: 'center', padding: 8 }} />
          {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
          <Btn title="Log in" testID="login-submit" disabled={!email.includes('@') || password.length < 6} loading={busy} onPress={async () => { setBusy(true); setMsg(await signIn(email.trim(), password)); setBusy(false); }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Text style={{ color: colors.muted }}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <SocialButton icon="logo-apple" label="Log in with Apple" onPress={() => setSoon(true)} />
          <SocialButton icon="logo-google" label="Log in with Google" onPress={() => setSoon(true)} color="#DB4437" />
          <SocialButton icon="logo-facebook" label="Log in with Facebook" onPress={() => setSoon(true)} color="#1877F2" />
          <TextLink title="Don't have an account? Sign up" onPress={() => router.replace('/signup')} style={{ padding: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Dialog visible={soon} title="Coming soon" message="This login needs native setup and will be enabled in the published version. Use email and password." actions={[{ label: 'Ok', primary: true, onPress: () => setSoon(false) }]} />
    </Screen>
  );
}
