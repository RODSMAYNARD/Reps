import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, Chip, Empty } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Progresso() {
  const { exercises, workouts } = useStore();
  const [exId, setExId] = useState<string | null>(exercises[0]?.id ?? null);

  // Maior carga do exercício em cada treino, do mais antigo para o mais recente.
  const points = useMemo(() => {
    if (!exId) return [];
    return workouts
      .slice()
      .reverse()
      .flatMap((w) => {
        const entry = w.entries.find((e) => e.exerciseId === exId);
        if (!entry) return [];
        return [{ date: w.date, best: Math.max(...entry.sets.map((s) => s.weight)) }];
      })
      .slice(-12);
  }, [exId, workouts]);

  const max = Math.max(1, ...points.map((p) => p.best));
  const record = points.length ? Math.max(...points.map((p) => p.best)) : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {exercises.map((e) => (
          <Chip key={e.id} label={e.name} active={exId === e.id} onPress={() => setExId(e.id)} />
        ))}
      </ScrollView>

      {points.length === 0 ? (
        <Empty text="Finalize treinos com esse exercício para ver sua evolução." />
      ) : (
        <Card style={{ gap: 12 }}>
          <Text style={{ color: colors.muted }}>Maior carga por treino · recorde: {record} kg</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 6 }}>
            {points.map((p, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ color: colors.text, fontSize: 10, marginBottom: 2 }}>{p.best}</Text>
                <View style={{ width: '100%', height: `${(p.best / max) * 80}%`, backgroundColor: colors.accent, borderRadius: 6 }} />
                <Text style={{ color: colors.muted, fontSize: 9, marginTop: 4 }}>
                  {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
