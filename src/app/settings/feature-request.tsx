import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { Dialog, Header, HeaderAction, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function FeatureRequest() {
  const { sendFeedback } = useStore();
  const [text, setText] = useState('');
  const [thanks, setThanks] = useState(false);
  return (
    <Screen>
      <Header title="Feature Request" right={<HeaderAction label="Send" disabled={!text.trim()} onPress={async () => { if (await sendFeedback('feature', text)) setThanks(true); }} />} />
      <TextInput value={text} onChangeText={setText} multiline autoFocus placeholder="Send us your ideas or feature requests..." placeholderTextColor={colors.faint} style={{ flex: 1, padding: 16, fontSize: 16, color: colors.text, textAlignVertical: 'top' }} testID="feature-text" />
      <Pressable onPress={() => router.push('/settings/faq')} style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontSize: 16 }}>FAQ</Text><Text style={{ color: colors.muted }}>Get answers right away.</Text></View><Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
      </Pressable>
      <Dialog visible={thanks} message="Thanks for the suggestion! We will do our best to build it ❤" actions={[{ label: 'Ok', primary: true, onPress: () => { setThanks(false); router.back(); } }]} />
    </Screen>
  );
}
