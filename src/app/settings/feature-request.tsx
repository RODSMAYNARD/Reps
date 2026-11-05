import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Dialog, Header, HeaderAction, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function FeatureRequest() {
  const { sendFeedback } = useStore();
  const [text, setText] = useState('');
  const [thanks, setThanks] = useState(false);
  return (
    <Screen>
      <Header title="Sugerir funcionalidade" right={<HeaderAction label="Enviar" disabled={!text.trim()} onPress={async () => { await sendFeedback('feature', text); setThanks(true); }} />} />
      <TextInput value={text} onChangeText={setText} multiline autoFocus placeholder="Envie suas ideias ou pedidos de funcionalidade..." placeholderTextColor={colors.faint} style={{ flex: 1, padding: 16, fontSize: 16, color: colors.text, textAlignVertical: 'top' }} testID="feature-text" />
      <Pressable onPress={() => router.push('/settings/faq')} style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontSize: 16 }}>Perguntas frequentes</Text><Text style={{ color: colors.muted }}>Tire sua dúvida na hora.</Text></View><Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
      </Pressable>
      <Dialog visible={thanks} message="Obrigado pela sugestão! Vamos fazer o possível para construí-la ❤" actions={[{ label: 'Ok', primary: true, onPress: () => { setThanks(false); router.back(); } }]} />
    </Screen>
  );
}
