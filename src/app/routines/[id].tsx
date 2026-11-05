import { Ionicons } from '@expo/vector-icons';
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
  if (!r) return <Screen><Header title="Rotina" /></Screen>;
  const nameOf = (eid: string) => exercises.find((e) => e.id === eid)?.name ?? 'Exercício removido';
  return (
    <Screen>
      <Header title={r.title} right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} testID="routine-menu" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {!!r.notes && <Text style={{ color: colors.text }}>{r.notes}</Text>}
        {r.exercises.length === 0 && <Text style={{ color: colors.muted }}>Esta rotina ainda não tem exercícios.</Text>}
        {r.exercises.map((e, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="barbell-outline" size={22} color={colors.muted} /></View>
            <View style={{ flex: 1 }}>
              <Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.exerciseId } })} style={{ color: colors.primary, fontSize: 16 }}>{nameOf(e.exerciseId)}</Text>
              <Text style={{ color: colors.muted }}>{e.sets.length} séries · descanso {fmtRest(e.restSec).toLowerCase()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Btn title="Iniciar rotina" testID="routine-start" onPress={() => { if (active) return showToast('Termine ou descarte o treino atual primeiro.'); startWorkout({ routine: r }); router.push('/active'); }} />
      </View>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListRow icon="create-outline" label="Editar rotina" onPress={() => { setMenu(false); router.push({ pathname: '/routines/edit', params: { id: r.id } }); }} />
        <ListRow icon="copy-outline" label="Duplicar rotina" onPress={async () => { setMenu(false); await saveRoutine({ title: `${r.title} (cópia)`, notes: r.notes, exercises: r.exercises }); showToast('Rotina duplicada'); }} />
        <ListRow icon="trash-outline" label="Excluir rotina" danger last onPress={() => { setMenu(false); setDel(true); }} />
      </Sheet>
      <Dialog visible={del} title="Excluir rotina?" message="Essa ação não pode ser desfeita." onClose={() => setDel(false)} actions={[{ label: 'Cancelar' }, { label: 'Excluir', danger: true, onPress: async () => { setDel(false); await deleteRoutine(r.id); router.back(); } }]} />
    </Screen>
  );
}
