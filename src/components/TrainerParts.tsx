import { Pressable, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { TrainerWorkout } from '../lib/types';
import { useStore } from '../lib/store';
import { ExerciseThumb } from './ExerciseThumb';

export const repText = (e: { sets: number; repMin: number; repMax: number; kind: string }) =>
  e.kind === 'duration' ? `${Math.round(e.repMax / 60)} min` : `${e.sets} sets · ${e.repMin === e.repMax ? e.repMin : `${e.repMin}-${e.repMax}`} reps`;

export function Badge({ text }: { text: string }) {
  return <View style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: colors.primary, fontSize: 13 }}>{text}</Text></View>;
}

export function ExerciseLines({ w }: { w: TrainerWorkout }) {
  const st = useStore();
  return (
    <View style={{ gap: 14 }}>
      {w.exercises.map((e, i) => {
        const ex = st.findExercise(e.exerciseId);
        return (
          <View key={`${e.exerciseId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ExerciseThumb catalogId={ex?.catalogId} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17 }} numberOfLines={1}>{ex?.name ?? 'Exercise'}</Text>
              <Text style={{ color: colors.muted, fontSize: 15 }}>{repText(e)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function Check({ on }: { on: boolean }) {
  return on ? <Text style={{ color: colors.primary, fontSize: 24 }}>✓</Text> : null;
}

export function OptionRow({ label, sub, badge, on, onPress, right }: { label: string; sub?: string; badge?: string; on?: boolean; onPress: () => void; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }} testID={`opt-${label}`}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 19, color: colors.text }}>{label}</Text>
          {!!badge && <Badge text={badge} />}
        </View>
        {!!sub && <Text style={{ color: colors.muted, fontSize: 16 }}>{sub}</Text>}
      </View>
      {right ?? <Check on={!!on} />}
    </Pressable>
  );
}
