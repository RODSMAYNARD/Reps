import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Field, Header, HeaderAction, Pill, Screen, Section } from '../../components/ui';
import { EQUIPMENT, MUSCLES } from '../../lib/constants';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { ExerciseKind } from '../../lib/types';

const KINDS: { id: ExerciseKind; label: string }[] = [{ id: 'weight_reps', label: 'Peso e repetições' }, { id: 'reps', label: 'Só repetições' }, { id: 'duration', label: 'Duração' }];

export default function CreateExercise() {
  const { addExercise, showToast } = useStore();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Peito');
  const [equipment, setEquipment] = useState('Barra');
  const [kind, setKind] = useState<ExerciseKind>('weight_reps');
  const save = async () => { const e = await addExercise({ name, muscle, equipment, kind }); if (e) { showToast('Exercício criado'); router.back(); } };
  return (
    <Screen>
      <Header left="cancel" title="Criar exercício" right={<HeaderAction label="Salvar" primary disabled={!name.trim()} onPress={save} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 6 }}>
        <Field label="Nome do exercício" value={name} onChangeText={setName} placeholder="Ex.: Remada unilateral" testID="ex-name" />
        <Section title="Grupo muscular principal" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MUSCLES.map((m) => <Pill key={m} label={m} active={muscle === m} onPress={() => setMuscle(m)} />)}</View>
        <Section title="Equipamento" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{EQUIPMENT.map((m) => <Pill key={m} label={m} active={equipment === m} onPress={() => setEquipment(m)} />)}</View>
        <Section title="Tipo de registro" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{KINDS.map((k) => <Pill key={k.id} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />)}</View>
        <Text style={{ color: colors.muted, marginTop: 12 }}>Exercícios criados por você aparecem na biblioteca e podem ser usados em treinos e rotinas.</Text>
      </ScrollView>
    </Screen>
  );
}
