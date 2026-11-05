import { router } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Avatar, Btn, Card, Screen, SearchBar, Section } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function Friends() {
  const [q, setQ] = useState('');
  return (
    <Screen>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search friends" onBack={() => router.back()} />
      <Section title="Contact discovery" />
      <View style={{ padding: 16 }}>
        <Card style={{ gap: 12, backgroundColor: colors.surface, borderWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>Verify your phone so your friends can find you on Reps</Text>
          <Btn title="Verify" onPress={() => router.push('/feed/verify-phone')} testID="verify-phone" />
        </Card>
      </View>
      <Section title="Invite your contacts" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <Avatar /><Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>Invite a friend</Text>
        <Text onPress={() => Share.share({ message: 'Come train with me on Reps!' })} style={{ color: colors.primary, fontSize: 16 }}>Invite</Text>
      </View>
    </Screen>
  );
}
