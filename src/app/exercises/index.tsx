import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Empty, Header, IconButton, PillRow, Screen, SearchBar } from '../../components/ui';
import { MUSCLES } from '../../lib/constants';
import { fmtWeight } from '../../lib/format';
import { records } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Library() {
  const { exercises, workouts, profile } = useStore();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const list = useMemo(() => exercises.filter((e) => (muscle === 'all' || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [exercises, q, muscle]);
  return (
    <Screen>
      <Header title="Exercícios" right={<IconButton name="add" size={28} onPress={() => router.push('/exercises/create')} testID="create-exercise" />} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Buscar exercício" />
      <PillRow value={muscle} onChange={setMuscle} items={[{ id: 'all', label: 'Todos' }, ...MUSCLES.map((m) => ({ id: m, label: m }))]} />
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Empty text="Nenhum exercício encontrado." />}
        renderItem={({ item }) => {
          const r = records(workouts, item.id);
          return (
            <Pressable onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="barbell-outline" size={22} color={colors.muted} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{item.muscle}</Text>
              </View>
              {r.heaviest > 0 && <Text style={{ color: colors.primary }}>{fmtWeight(r.heaviest, profile.units)}</Text>}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
