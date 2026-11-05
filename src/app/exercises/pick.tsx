import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { ExerciseFilterBar } from '../../components/ExerciseFilterBar';
import { Btn, Empty, Header, HeaderAction, Screen, SearchBar } from '../../components/ui';
import { filterExercises } from '../../lib/catalog';
import { resolvePick } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function PickExercise() {
  const { single } = useLocalSearchParams<{ single?: string }>();
  const { allExercises } = useStore();
  const [q, setQ] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [equip, setEquip] = useState<string[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const dq = useDeferredValue(q);
  const list = useMemo(() => filterExercises(allExercises, dq, muscles, equip), [allExercises, dq, muscles, equip]);
  const toggle = (id: string) => (single ? setSel([id]) : setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  const done = () => { resolvePick(sel); router.back(); };
  return (
    <Screen>
      <Header left="cancel" title="Add exercise" right={<HeaderAction label="Create" onPress={() => router.push('/exercises/create')} />} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search exercises" />
      <ExerciseFilterBar list={allExercises} q={dq} muscles={muscles} equipment={equip} onChange={(m, e) => { setMuscles(m); setEquip(e); }} />
      <Text style={{ color: colors.muted, paddingHorizontal: 16, paddingBottom: 6, fontSize: 12 }}>{list.length} exercises</Text>
      <FlatList
        data={list}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Empty text="No exercises found." action={<Btn title="Create exercise" variant="secondary" onPress={() => router.push('/exercises/create')} />} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggle(item.id)} testID="pick-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: sel.includes(item.id) ? colors.primarySoft : colors.bg }}>
            <ExerciseThumb catalogId={item.catalogId} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{item.muscle} · {item.equipment}</Text>
            </View>
            {sel.includes(item.id) && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
          </Pressable>
        )}
      />
      <View style={{ padding: 16 }}><Btn title={sel.length ? `Add ${sel.length} exercise(s)` : 'Select exercises'} disabled={!sel.length} testID="pick-confirm" onPress={done} /></View>
    </Screen>
  );
}
