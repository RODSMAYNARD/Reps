import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Btn, Empty, Header, HeaderAction, PillRow, Screen, SearchBar } from '../../components/ui';
import { searchExercises } from '../../lib/catalog';
import { EQUIPMENT, MUSCLES } from '../../lib/constants';
import { resolvePick } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function PickExercise() {
  const { single } = useLocalSearchParams<{ single?: string }>();
  const { allExercises, ensureExercises } = useStore();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [equip, setEquip] = useState('all');
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const list = useMemo(() => searchExercises(allExercises, q, muscle, equip), [allExercises, q, muscle, equip]);
  const toggle = (id: string) => (single ? setSel([id]) : setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  const done = async () => { setBusy(true); const real = await ensureExercises(sel); setBusy(false); resolvePick(real); router.back(); };
  return (
    <Screen>
      <Header left="cancel" title="Add exercise" right={<HeaderAction label="Create" onPress={() => router.push('/exercises/create')} />} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search exercises" />
      <PillRow value={muscle} onChange={setMuscle} items={[{ id: 'all', label: 'All muscles' }, ...MUSCLES.map((m) => ({ id: m, label: m }))]} />
      <PillRow value={equip} onChange={setEquip} items={[{ id: 'all', label: 'All equipment' }, ...EQUIPMENT.map((m) => ({ id: m, label: m }))]} />
      <Text style={{ color: colors.muted, paddingHorizontal: 16, paddingBottom: 6, fontSize: 12 }}>{list.length} exercises</Text>
      <FlatList
        data={list}
        initialNumToRender={20}
        windowSize={7}
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
      <View style={{ padding: 16 }}><Btn title={sel.length ? `Add ${sel.length} exercise(s)` : 'Select exercises'} disabled={!sel.length} loading={busy} testID="pick-confirm" onPress={done} /></View>
    </Screen>
  );
}
