import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Field, Header, HeaderAction, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function Contact() {
  const { sendFeedback } = useStore();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [thanks, setThanks] = useState(false);
  return (
    <Screen>
      <Header title="Fale com a gente" right={<HeaderAction label="Enviar" disabled={!body.trim()} onPress={async () => { await sendFeedback('contact', `${subject}\n${body}`); setThanks(true); }} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Field label="Assunto" value={subject} onChangeText={setSubject} />
        <Field label="Mensagem" multiline value={body} onChangeText={setBody} />
      </ScrollView>
      <Dialog visible={thanks} message="Mensagem enviada. Responderemos em breve." actions={[{ label: 'Ok', primary: true, onPress: () => { setThanks(false); router.back(); } }]} />
    </Screen>
  );
}
