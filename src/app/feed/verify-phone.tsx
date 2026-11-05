import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
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
      <Header title="Verificar telefone" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ color: colors.muted }}>Informe seu número com DDD. Enviaremos um código por SMS.</Text>
        <Field label="Telefone" keyboardType="phone-pad" placeholder="+55 11 99999-9999" value={phone} onChangeText={setPhone} />
        <Btn title="Enviar código" disabled={phone.replace(/\D/g, '').length < 10} onPress={() => setAsk(true)} testID="send-code" />
      </ScrollView>
      <Dialog visible={ask} title="Digite o código de verificação" onClose={() => setAsk(false)}
        actions={[{ label: 'Cancelar', onPress: () => setAsk(false) }, { label: 'Continuar', primary: true, onPress: () => { setAsk(false); showToast('Verificação por SMS ainda não está ativa nesta versão.'); router.back(); } }]}>
        <Field value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" />
        <TextLink title="Não recebeu? Pedir de novo" onPress={() => showToast('Reenvio indisponível nesta versão.')} />
      </Dialog>
    </Screen>
  );
}
