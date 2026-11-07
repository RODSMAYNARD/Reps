import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge, ExerciseLines } from '../../components/TrainerParts';
import { Btn, Dialog, Empty, Header, IconButton, ListRow, Screen, Sheet } from '../../components/ui';
import { dayKey, startOfWeek } from '../../lib/stats';
import { useGate } from '../../lib/gate';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { CYCLE_WEEKS } from '../../lib/trainer';

export default function TrainerHome() {
  const st = useStore();
  const allowed = useGate();
  useEffect(() => { allowed('trainer'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { trainer, workouts, active } = st;
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => void } | null>(null);
  const [replace, setReplace] = useState(false);
  if (!trainer)
    return (
      <Screen>
        <Header title="Trainer" />
        <Empty icon="sparkles-outline" text="Get a personalized program built around your goal, schedule and equipment." action={<Btn title="Create my program" onPress={() => router.push('/trainer/setup')} testID="trainer-create" />} />
      </Screen>
    );
  const freq = trainer.settings.frequency;
  const weekStart = startOfWeek();
  const thisWeek = workouts.filter((w) => w.fromTrainer && new Date(w.date) >= weekStart).length;
  const next = trainer.workouts.find((w) => w.uid === trainer.nextUid) ?? trainer.workouts[0];
  const totalWeeks = CYCLE_WEEKS + (trainer.settings.deload ? 1 : 0);
  const week = Math.min(totalWeeks, Math.floor(trainer.completed / freq) + 1);
  const go = () => { st.startTrainerWorkout(next.uid); router.push('/active'); };
  const start = () => (active ? setReplace(true) : go());
  void dayKey;
  return (
    <Screen>
      <Header title="Trainer" right={<IconButton name="options-outline" onPress={() => router.push('/trainer/workouts')} testID="trainer-options" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} testID="trainer-home">
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>Weekly workouts goal</Text>
            <Text style={{ fontSize: 28, fontWeight: '600', color: colors.text }}>{Math.min(thisWeek, freq)}/{freq}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: freq }, (_, i) => <View key={i} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: i < thisWeek ? colors.primary : colors.surfaceAlt }} />)}
          </View>
          <Btn title="Progress Report" icon="stats-chart-outline" variant="secondary" onPress={() => router.push('/profile/report')} testID="trainer-report" />
        </View>

        <Text style={{ color: colors.muted, fontSize: 18, marginTop: 6 }}>Next Workout</Text>
        {!!next && (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 14 }} testID="trainer-next">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>{next.title}</Text>
              <IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} testID="trainer-next-menu" />
            </View>
            <Text style={{ color: colors.muted, fontSize: 17 }}>{next.notes}</Text>
            <Btn title="Start Workout" onPress={start} testID="trainer-start" />
            <ExerciseLines w={next} />
          </View>
        )}

        <Text style={{ color: colors.muted, fontSize: 18, marginTop: 6 }}>Program</Text>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }} >
            <View style={{ flex: 1 }}>
              <Text onPress={() => router.push('/trainer/workouts')} style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>{trainer.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 17 }}>Cycle {trainer.cycle} ({totalWeeks}-Week Program)</Text>
            </View>
            <IconButton name="chevron-forward" onPress={() => router.push('/trainer/workouts')} />
          </View>
          <View style={{ height: 1, backgroundColor: colors.surface }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>Week</Text>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>{week}/{totalWeeks}</Text>
          </View>
          <View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginTop: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -16 }}>
              {Array.from({ length: totalWeeks }, (_, i) => <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bg, borderWidth: i + 1 === week ? 6 : 3, borderColor: i + 1 <= week ? colors.primary : colors.surfaceAlt }} />)}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>{Array.from({ length: totalWeeks }, (_, i) => <Text key={i} style={{ width: 28, textAlign: 'center', color: colors.muted, fontSize: 13 }}>W{i + 1}</Text>)}</View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 16 }}>You&apos;re on a {trainer.settings.variety} program. <Text style={{ color: colors.primary }} onPress={() => router.push('/trainer/science')}>Learn More</Text></Text>
        </View>
        <Badge text={`${trainer.workouts.length} workouts per cycle`} />
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={next?.title}>
        <ListRow icon="swap-vertical" label="Reorder Workouts" onPress={() => { setMenu(false); router.push('/trainer/reorder'); }} />
        <ListRow icon="close" label="Skip Workout" danger last onPress={() => { setMenu(false); setConfirm({ title: 'Skip this workout?', message: 'The program moves on to the next workout.', label: 'Skip', run: () => st.skipTrainerWorkout(next.uid) }); }} testID="trainer-skip" />
      </Sheet>
      <Dialog visible={replace} title="Replace current workout?" message="You already have a workout in progress. Starting this one discards it." onClose={() => setReplace(false)}
        actions={[{ label: 'Cancel' }, { label: 'Replace', danger: true, onPress: () => { setReplace(false); st.discardActive(); go(); } }]} />
      <Dialog visible={!!confirm} title={confirm?.title} message={confirm?.message} onClose={() => setConfirm(null)} actions={[{ label: 'Cancel' }, { label: confirm?.label ?? 'OK', danger: true, onPress: () => { const c = confirm; setConfirm(null); c?.run(); } }]} />
    </Screen>
  );
}
