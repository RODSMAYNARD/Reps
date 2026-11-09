import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Dialog, Field, Header, Screen, TextLink } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function VerifyPhone() {
  const { showToast } = useStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [ask, setAsk] = useState(false);
  return (
    <Screen>
      <Header title="Verify phone" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ color: colors.muted }}>Enter your phone number. We&apos;ll text you a code.</Text>
        <Field label="Phone" keyboardType="phone-pad" placeholder="+55 11 99999-9999" value={phone} onChangeText={setPhone} />
        <Btn title="Send code" disabled={phone.replace(/\D/g, '').length < 10} onPress={() => setAsk(true)} testID="send-code" />
      </ScrollView>
      <Dialog visible={ask} title="Enter the verification code" onClose={() => setAsk(false)}
        actions={[{ label: 'Cancel', onPress: () => setAsk(false) }, { label: 'Continue', primary: true, onPress: () => { setAsk(false); showToast("SMS verification isn't available in this version yet."); router.back(); } }]}>
        <Field value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" />
        <TextLink title="Didn't get it? Send again" onPress={() => showToast("Resend isn't available in this version.")} />
      </Dialog>
    </Screen>
  );
}
