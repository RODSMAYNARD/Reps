import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge, ExerciseLines } from '../../components/TrainerParts';
import { Header, IconButton, ListRow, Screen, Sheet } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { TrainerWorkout } from '../../lib/types';

export default function ProgramWorkouts() {
  const st = useStore();
  const { trainer } = st;
  const [menu, setMenu] = useState<TrainerWorkout | 'program' | null>(null);
  if (!trainer) return <Screen><Header title="Program workouts" /></Screen>;
  return (
    <Screen>
      <Header title="Program workouts" right={<IconButton name="ellipsis-horizontal" onPress={() => setMenu('program')} testID="program-menu" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
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
          : <ListRow icon="close" label="Skip Workout" danger last onPress={() => { const w = menu as TrainerWorkout; setMenu(null); st.skipTrainerWorkout(w.uid); }} />}
      </Sheet>
    </Screen>
  );
}
