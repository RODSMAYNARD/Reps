import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Btn, Dialog, Field, Header, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

/** Recuperar senha em 2 passos, sem depender de deep link: 1) e-mail → recebe um código de 6 dígitos; 2) código + nova senha. */
export default function Forgot() {
  const { resetPassword, completePasswordReset, showToast } = useStore();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); setMsg(null); const e = await resetPassword(email.trim()); setBusy(false); if (e) setMsg(e); else { setStep(2); showToast('Code sent. Check your email.'); } };
  const finish = async () => {
    setBusy(true); setMsg(null);
    const e = await completePasswordReset(email.trim(), code, password);
    setBusy(false);
    if (e) setMsg(/expired|invalid/i.test(e) ? 'That code is invalid or expired. Request a new one.' : e); else setDone(true);
  };
  return (
    <Screen>
      <Header title="Reset password" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Text style={{ color: colors.muted }}>Enter your email and we will send you a 6-digit code to create a new password.</Text>
            <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
            <Btn title="Send code" disabled={!email.includes('@')} loading={busy} onPress={send} testID="forgot-send" />
          </>
        ) : (
          <>
            <Text style={{ color: colors.muted }}>We sent a code to {email.trim()}. Enter it below with your new password.</Text>
            <Field label="Code" keyboardType="number-pad" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))} />
            <Field label="New password" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
            {!!msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
            <Btn title="Save new password" disabled={code.length < 6 || password.length < 6} loading={busy} onPress={finish} testID="forgot-finish" />
            <Text onPress={send} style={{ color: colors.primary, textAlign: 'center' }}>Send a new code</Text>
          </>
        )}
      </ScrollView>
      <Dialog visible={done} title="Password updated" message="You are signed in with your new password." actions={[{ label: 'Ok', primary: true, onPress: () => { setDone(false); router.dismissAll?.(); } }]} />
    </Screen>
  );
}
