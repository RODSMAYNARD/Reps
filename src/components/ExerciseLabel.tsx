import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, Text, TextStyle, View } from 'react-native';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';
import { ExerciseThumb } from './ExerciseThumb';

/** Miniatura + nome do exercício; tocar em qualquer um abre o detalhe (resumo, histórico, como fazer, ranking). */
export function ExerciseLabel({ exerciseId, size = 40, prefix, nameStyle, right, numberOfLines }: { exerciseId: string; size?: number; prefix?: string; nameStyle?: TextStyle; right?: ReactNode; numberOfLines?: number }) {
  const { findExercise } = useStore();
  const ex = findExercise(exerciseId);
  const open = () => router.push({ pathname: '/exercises/[id]', params: { id: exerciseId } });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={open} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="exercise-label">
        <ExerciseThumb catalogId={ex?.catalogId} uri={ex?.assetUri} size={size} />
        <Text numberOfLines={numberOfLines} style={[{ flex: 1, color: colors.text, fontSize: 16 }, nameStyle]}>{prefix}{ex?.name ?? 'Removed exercise'}</Text>
      </Pressable>
      {right}
    </View>
  );
}
