import { ExerciseThumb } from '../../components/ExerciseThumb';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Header, IconButton, Screen, Sheet, ListRow } from '../../components/ui';
import { CAT_BY_EN, catKey } from '../../lib/catalog';
import { CATEGORY_ROUTINES, PROGRAMS } from '../../lib/constants';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { RoutineExercise } from '../../lib/types';

export default function RoutinePreview() {
  const { src, id, idx } = useLocalSearchParams<{ src: string; id: string; idx: string }>();
  const { ensureExercises, saveRoutine, routines, startWorkout, active, showToast } = useStore();
  const tpl = (src === 'program' ? PROGRAMS.find((p) => p.id === id)?.routines : CATEGORY_ROUTINES[id])?.[Number(idx)];
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const exs = (tpl?.exercises ?? []).flatMap((n) => CAT_BY_EN.get(n) ?? []);
  const toRoutineExercises = async (): Promise<RoutineExercise[]> => {
    const ids = await ensureExercises(exs.map(catKey));
    return ids.map((id, i) => ({ exerciseId: id, notes: '', restSec: exs[i].k === 'duration' ? 0 : 90, sets: [1, 2, 3].map(() => ({ type: 'normal' as const, kg: null, reps: exs[i].k === 'duration' ? 30 : 10 })) }));
  };
  const saved = routines.some((r) => r.title === tpl?.title);
  const save = async () => { if (!tpl) return; const r = await saveRoutine({ title: tpl.title, notes: tpl.notes, exercises: await toRoutineExercises() }); if (r) showToast('Routine saved to your library'); };
  return (
    <Screen>
      <Header title={tpl?.title ?? 'Routine'} right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{tpl?.title}</Text>
        <Text style={{ color: colors.text }} numberOfLines={more ? undefined : 2}>{tpl?.notes}</Text>
        <Text onPress={() => setMore(!more)} style={{ color: colors.muted }}>{more ? 'show less' : 'show more'}</Text>
        {saved ? <Btn title="Saved to your library" variant="secondary" disabled onPress={() => {}} /> : <Btn title="Save routine" onPress={save} testID="save-routine" />}
        {exs.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: colors.purple, borderRadius: 2 }} />
            <ExerciseThumb catalogId={e.id} />
            <View><Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: catKey(e) } })} style={{ color: colors.primary, fontSize: 16 }}>{e.n}</Text><Text style={{ color: colors.muted }}>3 sets</Text></View>
          </View>
        ))}
      </ScrollView>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListRow icon="play-outline" label="Start now (without saving)" last onPress={async () => { setMenu(false); if (active) return showToast('Finish or discard your current workout first.'); startWorkout({ routine: { id: '', title: tpl?.title ?? 'Workout', notes: '', exercises: await toRoutineExercises() } }); router.push('/active'); }} />
      </Sheet>
    </Screen>
  );
}
