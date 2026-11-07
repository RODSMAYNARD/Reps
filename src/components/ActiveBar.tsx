import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtDuration } from '../lib/format';
import { elapsedSec, useNow, useStore } from '../lib/store';
import { colors, radius } from '../lib/theme';
import { Dialog } from './ui';

/** Cartão flutuante do treino em andamento: contador, exercício atual, retomar e descartar. */
export function ActiveBar() {
  const st = useStore();
  const { active } = st;
  const now = useNow(1000, !!active);
  const [ask, setAsk] = useState(false);
  if (!active) return null;
  const shown = active.entries.filter((e) => !e.hidden);
  const cur = shown.find((e) => e.sets.some((s) => !s.done)) ?? shown.at(-1);
  const name = cur ? st.findExercise(cur.exerciseId)?.name : undefined;
  const open = () => router.push('/active');
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
      <Pressable onPress={open} testID="active-bar" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6, borderWidth: 1, borderColor: colors.border }}>
        <Pressable onPress={open} hitSlop={6} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }} testID="active-bar-open">
          <Ionicons name="chevron-up" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success }} />
            <Text style={{ fontSize: 18, color: colors.text }}><Text style={{ fontWeight: '700' }}>Workout </Text>{fmtDuration(elapsedSec(active, now))}</Text>
          </View>
          {!!name && <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 16 }}>{name}</Text>}
        </View>
        <Pressable onPress={() => setAsk(true)} hitSlop={6} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }} testID="active-bar-discard">
          <Ionicons name="trash-outline" size={24} color={colors.danger} />
        </Pressable>
      </Pressable>
      <Dialog visible={ask} message="Are you sure you want to discard the workout in progress?" onClose={() => setAsk(false)}
        actions={[{ label: 'Discard Workout', danger: true, onPress: () => { setAsk(false); st.discardActive(); } }, { label: 'Cancel', onPress: () => setAsk(false) }]} />
    </View>
  );
}
