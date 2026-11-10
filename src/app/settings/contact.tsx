import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { Dialog, Field, Header, HeaderAction, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function Contact() {
  const { sendFeedback } = useStore();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [thanks, setThanks] = useState(false);
  return (
    <Screen>
      <Header title="Contact Us" right={<HeaderAction label="Send" disabled={!body.trim()} onPress={async () => { if (await sendFeedback('contact', `${subject}\n${body}`)) setThanks(true); }} />} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Subject" value={subject} onChangeText={setSubject} />
          <Field label="Message" multiline value={body} onChangeText={setBody} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Dialog visible={thanks} message="Message sent. We will get back to you soon." actions={[{ label: 'Ok', primary: true, onPress: () => { setThanks(false); router.back(); } }]} />
    </Screen>
  );
}
