import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Button, Card, Empty, Input } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Exercicios() {
  const { exercises, addExercise, removeExercise } = useStore();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={exercises}
      keyExtractor={(e) => e.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <Card style={{ gap: 10, marginBottom: 6 }}>
          <Input placeholder="Nome do exercício" value={name} onChangeText={setName} />
          <Input placeholder="Grupo muscular" value={muscle} onChangeText={setMuscle} />
          <Button
            title="Adicionar exercício"
            disabled={!name.trim()}
            onPress={() => {
              addExercise(name, muscle);
              setName('');
              setMuscle('');
            }}
          />
        </Card>
      }
      ListEmptyComponent={<Empty text="Nenhum exercício cadastrado." />}
      renderItem={({ item }) => (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{item.name}</Text>
            {!!item.muscle && <Text style={{ color: colors.muted }}>{item.muscle}</Text>}
          </View>
          <Text onPress={() => removeExercise(item.id)} style={{ color: colors.danger, padding: 6 }}>
            excluir
          </Text>
        </Card>
      )}
    />
  );
}
