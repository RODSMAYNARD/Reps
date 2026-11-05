import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Card, Header, Pill, Screen } from '../../components/ui';
import { Gear, Goal, Level, PlannedRoutine, generatePlan } from '../../lib/planner';
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
  const { exercises, saveRoutine, showToast } = useStore();
  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState<Level>('beginner');
  const [gear, setGear] = useState<Gear>('gym');
  const [seed, setSeed] = useState(1);
  const [plan, setPlan] = useState<{ name: string; routines: PlannedRoutine[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? '—';

  const make = (s: number) => { setSeed(s); setPlan(generatePlan({ goal, days, level, gear, seed: s }, exercises)); };
  const save = async () => {
    if (!plan) return;
    setBusy(true);
    for (const r of plan.routines) await saveRoutine({ title: `${plan.name} · ${r.title}`, notes: r.notes, exercises: r.exercises });
    setBusy(false);
    showToast(`Plano salvo: ${plan.routines.length} rotinas`);
    router.back();
  };

  return (
    <Screen>
      <Header title="Gerar plano de treino" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <Group title="Objetivo" value={goal} onChange={(v) => { setGoal(v); setPlan(null); }} items={[{ id: 'hypertrophy', label: 'Hipertrofia' }, { id: 'strength', label: 'Força' }, { id: 'fatloss', label: 'Emagrecimento' }]} />
        <Group title="Dias por semana" value={days} onChange={(v) => { setDays(v); setPlan(null); }} items={[2, 3, 4, 5, 6].map((d) => ({ id: d, label: `${d} dias` }))} />
        <Group title="Nível" value={level} onChange={(v) => { setLevel(v); setPlan(null); }} items={[{ id: 'beginner', label: 'Iniciante' }, { id: 'intermediate', label: 'Intermediário' }, { id: 'advanced', label: 'Avançado' }]} />
        <Group title="Equipamento" value={gear} onChange={(v) => { setGear(v); setPlan(null); }} items={[{ id: 'gym', label: 'Academia' }, { id: 'dumbbell', label: 'Só halteres' }, { id: 'body', label: 'Peso do corpo' }]} />
        <Btn title={plan ? 'Gerar outra variação' : 'Gerar plano'} icon="sparkles-outline" onPress={() => make(plan ? seed + 1 : 1)} testID="generate-plan" />
        {plan && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{plan.name}</Text>
            {plan.routines.map((r, i) => (
              <Card key={i} style={{ gap: 6 }} testID="plan-routine">
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{r.title}</Text>
                <Text style={{ color: colors.muted }}>{r.notes}</Text>
                {r.exercises.map((e) => <Text key={e.exerciseId} style={{ color: colors.text }}>• {nameOf(e.exerciseId)}</Text>)}
                {r.exercises.length === 0 && <Text style={{ color: colors.danger }}>Sem exercícios compatíveis. Cadastre exercícios ou mude o equipamento.</Text>}
              </Card>
            ))}
            <Btn title={`Salvar plano (${plan.routines.length} rotinas)`} loading={busy} onPress={save} testID="save-plan" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
