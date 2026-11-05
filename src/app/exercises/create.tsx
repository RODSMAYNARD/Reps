import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Field, Header, HeaderAction, Pill, Screen, Section } from '../../components/ui';
import { EQUIPMENT, MUSCLES } from '../../lib/constants';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { ExerciseKind } from '../../lib/types';

const KINDS: { id: ExerciseKind; label: string }[] = [{ id: 'weight_reps', label: 'Weight & reps' }, { id: 'reps', label: 'Reps only' }, { id: 'duration', label: 'Duration' }];

export default function CreateExercise() {
  const { addExercise, showToast } = useStore();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [kind, setKind] = useState<ExerciseKind>('weight_reps');
  const save = async () => { const e = await addExercise({ name, muscle, equipment, kind }); if (e) { showToast('Exercise created'); router.back(); } };
  return (
    <Screen>
      <Header left="cancel" title="Create exercise" right={<HeaderAction label="Save" primary disabled={!name.trim()} onPress={save} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 6 }}>
        <Field label="Exercise name" value={name} onChangeText={setName} placeholder="e.g. One-arm row" testID="ex-name" />
        <Section title="Primary muscle group" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MUSCLES.map((m) => <Pill key={m} label={m} active={muscle === m} onPress={() => setMuscle(m)} />)}</View>
        <Section title="Equipment" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{EQUIPMENT.map((m) => <Pill key={m} label={m} active={equipment === m} onPress={() => setEquipment(m)} />)}</View>
        <Section title="Tracking type" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{KINDS.map((k) => <Pill key={k.id} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />)}</View>
        <Text style={{ color: colors.muted, marginTop: 12 }}>Exercises you create show up in the library and can be used in workouts and routines.</Text>
      </ScrollView>
    </Screen>
  );
}
