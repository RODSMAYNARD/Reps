import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Badge, ExerciseLines } from '../../components/TrainerParts';
import { Dialog, Header, IconButton, ListRow, Screen, Sheet } from '../../components/ui';
import { useStore } from '../../lib/store';
import { VOLUME_MAX, VOLUME_MIN, volumeMin, weeklySets } from '../../lib/trainer';
import { colors, radius } from '../../lib/theme';
import { TrainerWorkout } from '../../lib/types';

export default function ProgramWorkouts() {
  const st = useStore();
  const { trainer } = st;
  const [menu, setMenu] = useState<TrainerWorkout | 'program' | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => void } | null>(null);
  if (!trainer) return <Screen><Header title="Program workouts" /></Screen>;
  return (
    <Screen>
      <Header title="Program workouts" right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu('program')} testID="program-menu" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 8 }} testID="volume-card">
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Weekly sets per muscle</Text>
          {[...weeklySets(trainer.workouts, st.findExercise)].sort((a, b) => b[1] - a[1]).map(([m, n]) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 84, color: colors.text }} numberOfLines={1}>{m}</Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt }}>
                <View style={{ width: `${Math.min(100, (n / 24) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: n < volumeMin(m) ? colors.warn : n > VOLUME_MAX ? colors.danger : colors.success }} />
              </View>
              <Text style={{ width: 28, textAlign: 'right', color: colors.muted }}>{n}</Text>
            </View>
          ))}
          <Text style={{ color: colors.muted, fontSize: 13 }}>Research points to about {VOLUME_MIN}-{VOLUME_MAX} hard sets per muscle per week for muscle growth. The Trainer balances your plan toward that range and raises the weight when you hit the top of the rep range on every set.</Text>
        </View>
        {trainer.workouts.map((w) => (
          <View key={w.uid} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 12 }} testID="program-workout">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '600', color: colors.text }}>{w.title}</Text>
              {w.uid === trainer.nextUid && <Badge text="Next Workout" />}
              <IconButton name="ellipsis-horizontal" onPress={() => setMenu(w)} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 17 }}>{w.notes}</Text>
            <ExerciseLines w={w} />
          </View>
        ))}
      </ScrollView>
      <Sheet visible={menu !== null} onClose={() => setMenu(null)} title={menu === 'program' ? 'Program workouts' : menu?.title}>
        <ListRow icon="swap-vertical" label="Reorder Workouts" onPress={() => { setMenu(null); router.push('/trainer/reorder'); }} />
        {menu === 'program'
          ? <ListRow icon="options-outline" label="Program Settings" last onPress={() => { setMenu(null); router.push('/trainer/settings'); }} testID="program-settings" />
          : <ListRow icon="close" label="Skip Workout" danger last onPress={() => { const w = menu as TrainerWorkout; setMenu(null); setConfirm({ title: 'Skip this workout?', message: 'The program moves on to the next workout.', label: 'Skip', run: () => st.skipTrainerWorkout(w.uid) }); }} />}
      </Sheet>
      <Dialog visible={!!confirm} title={confirm?.title} message={confirm?.message} onClose={() => setConfirm(null)} actions={[{ label: 'Cancel' }, { label: confirm?.label ?? 'OK', danger: true, onPress: () => { const c = confirm; setConfirm(null); c?.run(); } }]} />
    </Screen>
  );
}
