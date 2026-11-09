import { ExerciseThumb } from '../../components/ExerciseThumb';
import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '../../components/Text';
import { ExerciseFilterBar } from '../../components/ExerciseFilterBar';
import { Empty, Header, HeaderAction, Screen, SearchBar } from '../../components/ui';
import { filterExercises } from '../../lib/catalog';
import { fmtWeight } from '../../lib/format';
import { recordsMap } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Library() {
  const { allExercises, workouts, profile } = useStore();
  const [q, setQ] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [equip, setEquip] = useState<string[]>([]);
  const dq = useDeferredValue(q);
  const list = useMemo(() => filterExercises(allExercises, dq, muscles, equip), [allExercises, dq, muscles, equip]);
  const rmap = useMemo(() => recordsMap(workouts), [workouts]);
  return (
    <Screen>
      <Header title="Exercises" right={<HeaderAction label="Create" onPress={() => router.push('/exercises/create')} />} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search exercises" />
      <ExerciseFilterBar list={allExercises} q={dq} muscles={muscles} equipment={equip} onChange={(m, e) => { setMuscles(m); setEquip(e); }} />
      <FlatList
        data={list}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Empty text="No exercises found." />}
        renderItem={({ item }) => {
          const r = rmap.get(item.id);
          return (
            <Pressable onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <ExerciseThumb catalogId={item.catalogId} uri={item.assetUri} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{item.muscle} · {item.equipment}</Text>
              </View>
              {!!r?.heaviest && <Text style={{ color: colors.primary }}>{fmtWeight(r.heaviest, profile.units)}</Text>}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
