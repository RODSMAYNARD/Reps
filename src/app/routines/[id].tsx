import { ExerciseThumb } from '../../components/ExerciseThumb';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Dialog, Header, IconButton, ListRow, Screen, Sheet } from '../../components/ui';
import { fmtRest } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function RoutineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, exercises, startWorkout, active, deleteRoutine, saveRoutine, showToast } = useStore();
  const r = routines.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  if (!r) return <Screen><Header title="Routine" /></Screen>;
  const nameOf = (eid: string) => exercises.find((e) => e.id === eid)?.name ?? 'Removed exercise';
  return (
    <Screen>
      <Header title={r.title} right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} testID="routine-menu" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {!!r.notes && <Text style={{ color: colors.text }}>{r.notes}</Text>}
        {r.exercises.length === 0 && <Text style={{ color: colors.muted }}>This routine has no exercises yet.</Text>}
        {r.exercises.map((e, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ExerciseThumb catalogId={exercises.find((x) => x.id === e.exerciseId)?.catalogId} />
            <View style={{ flex: 1 }}>
              <Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.exerciseId } })} style={{ color: colors.primary, fontSize: 16 }}>{nameOf(e.exerciseId)}</Text>
              <Text style={{ color: colors.muted }}>{e.sets.length} sets · rest {fmtRest(e.restSec).toLowerCase()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Btn title="Start routine" testID="routine-start" onPress={() => { if (active) return showToast('Finish or discard your current workout first.'); startWorkout({ routine: r }); router.push('/active'); }} />
      </View>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListRow icon="create-outline" label="Edit routine" onPress={() => { setMenu(false); router.push({ pathname: '/routines/edit', params: { id: r.id } }); }} />
        <ListRow icon="copy-outline" label="Duplicate routine" onPress={async () => { setMenu(false); await saveRoutine({ title: `${r.title} (copy)`, notes: r.notes, exercises: r.exercises }); showToast('Routine duplicated'); }} />
        <ListRow icon="trash-outline" label="Delete routine" danger last onPress={() => { setMenu(false); setDel(true); }} />
      </Sheet>
      <Dialog visible={del} title="Delete routine?" message="This can't be undone." onClose={() => setDel(false)} actions={[{ label: 'Cancel' }, { label: 'Delete', danger: true, onPress: async () => { setDel(false); await deleteRoutine(r.id); router.back(); } }]} />
    </Screen>
  );
}
