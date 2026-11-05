import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Dialog, Header, HeaderAction, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Report() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { sendFeedback } = useStore();
  const [text, setText] = useState('');
  const [thanks, setThanks] = useState(false);
  return (
    <Screen>
      <Header title="Reportar" right={<HeaderAction label="Enviar" disabled={!text.trim()} onPress={async () => { await sendFeedback('report', text, id); setThanks(true); }} />} />
      <TextInput value={text} onChangeText={setText} multiline autoFocus placeholder="Conte o que há de errado com este treino..." placeholderTextColor={colors.faint} style={{ flex: 1, padding: 16, fontSize: 16, color: colors.text, textAlignVertical: 'top' }} />
      <Dialog visible={thanks} message="Obrigado pelo relato, vamos analisar." actions={[{ label: 'Ok', primary: true, onPress: () => { setThanks(false); router.back(); } }]} />
    </Screen>
  );
}
