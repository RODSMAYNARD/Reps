import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '../../components/Text';
import { Avatar, Btn, Header, Screen, SearchBar } from '../../components/ui';
import { DEMO_ATHLETES } from '../../lib/constants';
import { colors } from '../../lib/theme';

export default function Discover() {
  const [q, setQ] = useState('');
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const list = DEMO_ATHLETES.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen>
      <Header title="Discover athletes" />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search athletes" />
      <Text style={{ color: colors.muted, paddingHorizontal: 16, paddingBottom: 8 }}>Sample profiles. The full social experience is coming in a future update.</Text>
      <FlatList data={list} keyExtractor={(a) => a.id} renderItem={({ item }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <Avatar name={item.name} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text><Text style={{ color: colors.muted }}>{item.tag}</Text></View>
          <Btn title={follow[item.id] ? 'Following' : 'Follow'} variant={follow[item.id] ? 'secondary' : 'primary'} style={{ minHeight: 38 }} onPress={() => setFollow({ ...follow, [item.id]: !follow[item.id] })} />
        </View>
      )} />
    </Screen>
  );
}
