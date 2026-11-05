import { router } from 'expo-router';
import { track } from '../../lib/analytics';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Btn, Header, Pill, Screen } from '../../components/ui';
import { CAT_BY_ID } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { DEFAULT_TRAINER, FOCUS, GOALS, LEVELS, PRESETS, SPLITS, bestSplit, generateProgram, presetIds } from '../../lib/trainer';
import { Exercise, TrainerSettings } from '../../lib/types';

function Group<T extends string | number | null>({ title, items, value, onChange }: { title: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 16 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items.map((i) => <Pill key={String(i.id)} label={i.label} active={value === i.id} onPress={() => onChange(i.id)} />)}</View>
    </View>
  );
}

export default function TrainerSetup() {
  const st = useStore();
  const [s, setS] = useState<TrainerSettings>({ ...DEFAULT_TRAINER, goal: 'strength', frequency: 5, split: 'pplul', preset: 'commercial', equipment: presetIds('commercial') });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<TrainerSettings>) => setS((d) => ({ ...d, ...p }));
  const setDays = (n: number) => set({ frequency: n, split: SPLITS.find((x) => x.id === s.split)!.days.includes(n) ? s.split : bestSplit(n) });
  const create = () => {
    setBusy(true);
    const enOf = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined);
    const name = `${st.profile.displayName || st.profile.username}'s Personalized Program`;
    st.saveTrainer(generateProgram(s, st.allExercises, enOf, 1, name));
    track('trainer_created', { split: s.split, goal: s.goal, days: s.frequency, level: s.level, duration: s.duration, preset: s.preset, focus: s.focus });
    setBusy(false);
    router.replace('/trainer');
  };
  return (
    <Screen>
      <Header title="Create your program" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} testID="trainer-setup">
        <Group title="Goal" value={s.goal} onChange={(v) => set({ goal: v })} items={GOALS.map((g) => ({ id: g.id, label: g.label }))} />
        <Group title="Days per week" value={s.frequency} onChange={setDays} items={[2, 3, 4, 5, 6].map((n) => ({ id: n, label: `${n} days` }))} />
        <Group title="Experience" value={s.level} onChange={(v) => set({ level: v })} items={LEVELS.map((l) => ({ id: l.id, label: `${l.label} (${l.sub})` }))} />
        <Group title="Where do you train?" value={s.preset} onChange={(v) => set({ preset: v, equipment: v === 'custom' ? [] : presetIds(v) })} items={PRESETS.filter((p) => p.id !== 'custom').map((p) => ({ id: p.id, label: p.label }))} />
        <Group title="Workout duration" value={s.duration} onChange={(v) => set({ duration: v })} items={[{ id: 40 as const, label: '40min' }, { id: 60 as const, label: '1h' }, { id: 80 as const, label: '1h 20min' }]} />
        <Group title="Focus muscle group (optional)" value={s.focus} onChange={(v) => set({ focus: v })} items={[{ id: null, label: 'Balanced' }, ...FOCUS.map((f) => ({ id: f as string | null, label: f }))]} />
        <Text style={{ color: colors.muted }}>You can fine-tune everything else later in Program Settings: equipment, rest timer, variety, cardio, excluded exercises and injuries.</Text>
        <Btn title="Create program" loading={busy} onPress={create} testID="trainer-create-go" />
      </ScrollView>
    </Screen>
  );
}
