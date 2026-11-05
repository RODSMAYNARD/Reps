import { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, Empty, Input } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const confirm = (msg: string, onOk: () => void) =>
  Platform.OS === 'web'
    ? window.confirm(msg) && onOk()
    : Alert.alert(msg, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: onOk }]);

export default function Treino() {
  const { exercises, draft, addSet, removeSet, finishWorkout, discardDraft } = useStore();
  const [exId, setExId] = useState<string | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  const r = parseInt(reps, 10);
  const w = parseFloat(weight.replace(',', '.'));
  const valid = !!exId && r > 0 && w >= 0;

  const add = () => {
    if (!valid || !exId) return;
    addSet(exId, { reps: r, weight: w });
  };

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercício removido';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Nova série</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {exercises.map((e) => (
            <Chip key={e.id} label={e.name} active={exId === e.id} onPress={() => setExId(e.id)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Input style={{ flex: 1 }} placeholder="Repetições" keyboardType="number-pad" value={reps} onChangeText={setReps} />
          <Input style={{ flex: 1 }} placeholder="Carga (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        </View>
        <Button title="Adicionar série" onPress={add} disabled={!valid} />
      </Card>

      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Treino de hoje</Text>
      {!draft ? (
        <Empty text="Nenhuma série registrada ainda. Escolha um exercício e adicione a primeira." />
      ) : (
        <>
          {draft.entries.map((entry) => (
            <Card key={entry.exerciseId} style={{ gap: 6 }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{nameOf(entry.exerciseId)}</Text>
              {entry.sets.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text }}>
                    {i + 1}ª série · {s.reps} × {s.weight} kg
                  </Text>
                  <Text onPress={() => removeSet(entry.exerciseId, i)} style={{ color: colors.danger, padding: 6 }}>
                    remover
                  </Text>
                </View>
              ))}
            </Card>
          ))}
          <Button title="Finalizar treino" onPress={finishWorkout} />
          <Button title="Descartar treino" variant="danger" onPress={() => confirm('Descartar o treino de hoje?', discardDraft)} />
        </>
      )}
    </ScrollView>
  );
}
