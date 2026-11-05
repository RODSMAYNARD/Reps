import { router } from 'expo-router';
import { View } from 'react-native';
import { ReorderList } from '../../components/ReorderList';
import { Btn, Header, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function ReorderWorkouts() {
  const st = useStore();
  const { trainer } = st;
  if (!trainer) return <Screen><Header title="Reorder Workouts" /></Screen>;
  const move = (from: number, to: number) => {
    const list = [...trainer.workouts];
    const [it] = list.splice(from, 1);
    list.splice(to, 0, it);
    st.saveTrainer({ ...trainer, workouts: list });
  };
  return (
    <Screen>
      <Header title="Reorder Workouts" />
      <View style={{ flex: 1 }}>
        <ReorderList items={trainer.workouts.map((w) => ({ key: w.uid, title: w.title + (w.uid === trainer.nextUid ? '  (next)' : ''), subtitle: w.exercises.map((e) => st.findExercise(e.exerciseId)?.name ?? '').join(', ') }))} onMove={move} />
        <View style={{ padding: 16 }}><Btn title="Done" onPress={() => router.back()} testID="reorder-done" /></View>
      </View>
    </Screen>
  );
}
