import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { tr } from '../lib/i18n';
import { startOfWeek, weekStreak } from '../lib/stats';
import { useStore } from '../lib/store';
import { colors, radius } from '../lib/theme';

/** Sequência compacta (uma linha): "N semanas seguidas · M esta semana". Toque abre o calendário. Usada no Social e na H2. */
export function StreakRow({ style, testID = 'streak-row' }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  const { workouts } = useStore();
  const streak = weekStreak(workouts);
  if (streak <= 0) return null;
  const thisWeek = workouts.filter((w) => new Date(w.date).getTime() >= startOfWeek().getTime()).length;
  return (
    <Pressable onPress={() => router.push('/profile/calendar')} testID={testID}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface }, style]}>
      <Ionicons name="flame" size={18} color={colors.danger} />
      {/* uma linha só, que quebra em telas estreitas em vez de cortar */}
      <Text style={{ flex: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>
        {streak} {tr(streak === 1 ? 'week streak' : 'weeks in a row')}
        <Text style={{ color: colors.muted, fontWeight: '400' }}>{` · ${thisWeek} ${tr('this week')}`}</Text>
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}
