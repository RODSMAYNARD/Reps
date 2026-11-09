import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { ExerciseLabel } from '../../components/ExerciseLabel';
import { Btn, Card, Header, Pill, Screen } from '../../components/ui';
import { CAT_BY_ID } from '../../lib/catalog';
import { Gear, Goal, Level, PlannedRoutine, generatePlan } from '../../lib/planner';
import { useGate } from '../../lib/gate';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

function Group<T extends string | number>({ title, items, value, onChange }: { title: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.muted }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items.map((i) => <Pill key={String(i.id)} label={i.label} active={value === i.id} onPress={() => onChange(i.id)} />)}</View>
    </View>
  );
}

export default function GeneratePlan() {
  const allowed = useGate();
  useEffect(() => { allowed('generate'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { allExercises: exercises, saveRoutine, showToast } = useStore();
  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState<Level>('beginner');
  const [gear, setGear] = useState<Gear>('gym');
  const [seed, setSeed] = useState(1);
  const [plan, setPlan] = useState<{ name: string; routines: PlannedRoutine[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const make = (s: number) => { setSeed(s); setPlan(generatePlan({ goal, days, level, gear, seed: s }, exercises, (e) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined))); };
  const save = async () => {
    if (!plan) return;
    setBusy(true);
    for (const r of plan.routines) await saveRoutine({ title: `${plan.name} · ${r.title}`, notes: r.notes, exercises: r.exercises });
    setBusy(false);
    showToast(`Plan saved: ${plan.routines.length} routines`);
    router.back();
  };

  return (
    <Screen>
      <Header title="Generate workout plan" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <Group title="Goal" value={goal} onChange={(v) => { setGoal(v); setPlan(null); }} items={[{ id: 'hypertrophy', label: 'Hypertrophy' }, { id: 'strength', label: 'Strength' }, { id: 'fatloss', label: 'Fat loss' }]} />
        <Group title="Days per week" value={days} onChange={(v) => { setDays(v); setPlan(null); }} items={[2, 3, 4, 5, 6].map((d) => ({ id: d, label: `${d} days` }))} />
        <Group title="Level" value={level} onChange={(v) => { setLevel(v); setPlan(null); }} items={[{ id: 'beginner', label: 'Beginner' }, { id: 'intermediate', label: 'Intermediate' }, { id: 'advanced', label: 'Advanced' }]} />
        <Group title="Equipment" value={gear} onChange={(v) => { setGear(v); setPlan(null); }} items={[{ id: 'gym', label: 'Gym' }, { id: 'dumbbell', label: 'Dumbbells only' }, { id: 'body', label: 'Body weight' }]} />
        <Btn title={plan ? 'Generate another variation' : 'Generate plan'} icon="sparkles-outline" onPress={() => make(plan ? seed + 1 : 1)} testID="generate-plan" />
        {plan && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{plan.name}</Text>
            {plan.routines.map((r, i) => (
              <Card key={i} style={{ gap: 6 }} testID="plan-routine">
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{r.title}</Text>
                <Text style={{ color: colors.muted }}>{r.notes}</Text>
                {r.exercises.map((e) => <ExerciseLabel key={e.exerciseId} exerciseId={e.exerciseId} size={36} nameStyle={{ fontSize: 15 }} numberOfLines={1} />)}
                {r.exercises.length === 0 && <Text style={{ color: colors.danger }}>No matching exercises. Add exercises or change your equipment.</Text>}
              </Card>
            ))}
            <Btn title={`Save plan (${plan.routines.length} routines)`} loading={busy} onPress={save} testID="save-plan" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
