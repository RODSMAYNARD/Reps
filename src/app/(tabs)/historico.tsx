import { FlatList, Text } from 'react-native';
import { Card, Empty } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Historico() {
  const { workouts, exercises, deleteWorkout } = useStore();
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercício removido';

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={workouts}
      keyExtractor={(w) => w.id}
      ListEmptyComponent={<Empty text="Seus treinos finalizados aparecem aqui." />}
      renderItem={({ item }) => {
        const volume = item.entries.reduce((t, e) => t + e.sets.reduce((s, x) => s + x.reps * x.weight, 0), 0);
        return (
          <Card style={{ gap: 6 }}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {new Date(item.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Text>
            {item.entries.map((e) => (
              <Text key={e.exerciseId} style={{ color: colors.text }}>
                {nameOf(e.exerciseId)}: {e.sets.map((s) => `${s.reps}×${s.weight}kg`).join(' · ')}
              </Text>
            ))}
            <Text style={{ color: colors.muted }}>Volume total: {Math.round(volume)} kg</Text>
            <Text onPress={() => deleteWorkout(item.id)} style={{ color: colors.danger, alignSelf: 'flex-end', padding: 4 }}>
              excluir treino
            </Text>
          </Card>
        );
      }}
    />
  );
}
