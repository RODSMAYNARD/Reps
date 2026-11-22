import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Field, Header, Screen, TextLink } from '../../components/ui';
import { appleAvailable, googleAvailable, signInWithApple, signInWithGoogle } from '../../lib/socialAuth';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { SocialButton } from './index';

export default function Login() {
  const { signIn } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Header title="Log in" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Email" placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="login-email" />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} testID="login-password" />
          <TextLink title="Forgot password?" onPress={() => router.push('/forgot')} style={{ alignSelf: 'center', padding: 8 }} />
          {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
          <Btn title="Log in" testID="login-submit" disabled={!email.includes('@') || password.length < 6} loading={busy} onPress={async () => { setBusy(true); setMsg(await signIn(email.trim(), password)); setBusy(false); }} />
          {(appleAvailable || googleAvailable) && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Text style={{ color: colors.muted }}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              {appleAvailable && <SocialButton icon="logo-apple" label="Continue with Apple" onPress={async () => { const m = await signInWithApple(); if (m) setMsg(m); }} />}
              {googleAvailable && <SocialButton icon="logo-google" label="Continue with Google" onPress={async () => { const m = await signInWithGoogle(); if (m) setMsg(m); }} />}
            </>
          )}
          <TextLink title="Don't have an account? Sign up" onPress={() => router.replace('/signup')} style={{ padding: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
