import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Header, IconButton, Screen, Sheet, ListRow } from '../../components/ui';
import { CATEGORY_ROUTINES, PROGRAMS } from '../../lib/constants';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { RoutineExercise } from '../../lib/types';

export default function RoutinePreview() {
  const { src, id, idx } = useLocalSearchParams<{ src: string; id: string; idx: string }>();
  const { exercises, saveRoutine, routines, startWorkout, active, showToast } = useStore();
  const tpl = (src === 'program' ? PROGRAMS.find((p) => p.id === id)?.routines : CATEGORY_ROUTINES[id])?.[Number(idx)];
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const exs = (tpl?.exercises ?? []).flatMap((n) => exercises.find((e) => e.name === n) ?? []);
  const toRoutineExercises = (): RoutineExercise[] => exs.map((e) => ({ exerciseId: e.id, notes: '', restSec: 90, sets: [1, 2, 3].map(() => ({ type: 'normal' as const, kg: null, reps: 10 })) }));
  const saved = routines.some((r) => r.title === tpl?.title);
  const save = async () => { if (!tpl) return; const r = await saveRoutine({ title: tpl.title, notes: tpl.notes, exercises: toRoutineExercises() }); if (r) showToast('Rotina salva na sua biblioteca'); };
  return (
    <Screen>
      <Header title={tpl?.title ?? 'Rotina'} right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{tpl?.title}</Text>
        <Text style={{ color: colors.text }} numberOfLines={more ? undefined : 2}>{tpl?.notes}</Text>
        <Text onPress={() => setMore(!more)} style={{ color: colors.muted }}>{more ? 'ver menos' : 'ver mais'}</Text>
        {saved ? <Btn title="Salva na sua biblioteca" variant="secondary" disabled onPress={() => {}} /> : <Btn title="Salvar rotina" onPress={save} testID="save-routine" />}
        {exs.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: colors.purple, borderRadius: 2 }} />
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="barbell-outline" size={22} color={colors.muted} /></View>
            <View><Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.id } })} style={{ color: colors.primary, fontSize: 16 }}>{e.name}</Text><Text style={{ color: colors.muted }}>3 séries</Text></View>
          </View>
        ))}
      </ScrollView>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListRow icon="play-outline" label="Iniciar agora (sem salvar)" last onPress={() => { setMenu(false); if (active) return showToast('Termine ou descarte o treino atual primeiro.'); startWorkout({ routine: { id: '', title: tpl?.title ?? 'Treino', notes: '', exercises: toRoutineExercises() } }); router.push('/active'); }} />
      </Sheet>
    </Screen>
  );
}
