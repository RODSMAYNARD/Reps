import { router } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Avatar, Btn, Card, Screen, SearchBar, Section } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function Friends() {
  const [q, setQ] = useState('');
  return (
    <Screen>
      <SearchBar value={q} onChangeText={setQ} placeholder="Buscar amigos" onBack={() => router.back()} />
      <Section title="Descoberta de contatos" />
      <View style={{ padding: 16 }}>
        <Card style={{ gap: 12, backgroundColor: colors.surface, borderWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>Verifique seu telefone para seus amigos encontrarem você no Reps</Text>
          <Btn title="Verificar" onPress={() => router.push('/feed/verify-phone')} testID="verify-phone" />
        </Card>
      </View>
      <Section title="Convide seus contatos" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <Avatar /><Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>Convidar um amigo</Text>
        <Text onPress={() => Share.share({ message: 'Venha treinar comigo no Reps!' })} style={{ color: colors.primary, fontSize: 16 }}>Convidar</Text>
      </View>
    </Screen>
  );
}
