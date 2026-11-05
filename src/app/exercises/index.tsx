import { ExerciseThumb } from '../../components/ExerciseThumb';
import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Empty, Header, IconButton, PillRow, Screen, SearchBar } from '../../components/ui';
import { searchExercises } from '../../lib/catalog';
import { EQUIPMENT, MUSCLES } from '../../lib/constants';
import { fmtWeight } from '../../lib/format';
import { records } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Library() {
  const { allExercises, workouts, profile } = useStore();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [equip, setEquip] = useState('all');
  const dq = useDeferredValue(q);
  const list = useMemo(() => searchExercises(allExercises, dq, muscle, equip), [allExercises, dq, muscle, equip]);
  return (
    <Screen>
      <Header title="Exercises" right={<IconButton name="add" size={28} onPress={() => router.push('/exercises/create')} testID="create-exercise" />} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search exercises" />
      <PillRow value={muscle} onChange={setMuscle} items={[{ id: 'all', label: 'All' }, ...MUSCLES.map((m) => ({ id: m, label: m }))]} />
      <PillRow value={equip} onChange={setEquip} items={[{ id: 'all', label: 'All equipment' }, ...EQUIPMENT.map((m) => ({ id: m, label: m }))]} />
      <FlatList
        data={list}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Empty text="No exercises found." />}
        renderItem={({ item }) => {
          const r = records(workouts, item.id);
          return (
            <Pressable onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <ExerciseThumb catalogId={item.catalogId} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{item.muscle} · {item.equipment}</Text>
              </View>
              {r.heaviest > 0 && <Text style={{ color: colors.primary }}>{fmtWeight(r.heaviest, profile.units)}</Text>}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
