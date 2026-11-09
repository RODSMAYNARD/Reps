import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Card, Header, Screen, Section, Stat } from '../../components/ui';
import { fmtDuration, fmtVolume } from '../../lib/format';
import { dayKey, muscleDistribution, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { locale } from '../../lib/i18n';

export const ADVANCED = [
  { type: 'sets', icon: 'git-compare-outline', title: 'Sets per muscle group', sub: 'Number of sets logged per muscle group.' },
  { type: 'chart', icon: 'pie-chart-outline', title: 'Muscle distribution (chart)', sub: 'Compare your current distribution with the previous one.' },
  { type: 'body', icon: 'body-outline', title: 'Muscle distribution (heat map)', sub: 'Weekly heat map of the muscles you trained.' },
  { type: 'main', icon: 'trophy-outline', title: 'Main exercises', sub: 'The exercises you do most.' },
  { type: 'leaderboard', icon: 'podium-outline', title: 'Leaderboard exercises', sub: 'Exercises eligible for the leaderboard.' },
  { type: 'monthly', icon: 'document-text-outline', title: 'Monthly report', sub: 'A summary of your workouts and stats this month.' },
] as const;

export default function Stats() {
  const { workouts, exercises, profile } = useStore();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; }), []);
  const [sel, setSel] = useState<string[]>(() => days.map((d) => dayKey(d)));
  const worked = new Set(workouts.map((w) => dayKey(w.date)));
  const inSel = workouts.filter((w) => sel.includes(dayKey(w.date)));
  const dist = muscleDistribution(inSel, exercises);
  const total = workouts.reduce((t, w) => t + w.durationSec, 0);
  return (
    <Screen>
      <Header title="Statistics" />
      <ScrollView>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>Muscles in the last 7 days</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {days.map((d) => { const k = dayKey(d); const on = sel.includes(k); return (
              <Pressable key={k} onPress={() => setSel(on ? sel.filter((x) => x !== k) : [...sel, k])} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: on ? colors.primary : colors.surface }}>
                <Text style={{ color: on ? '#fff' : colors.muted, fontSize: 11 }}>{d.toLocaleDateString(locale(), { weekday: 'narrow' }).toUpperCase()}</Text>
                <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>{d.getDate()}</Text>
                {worked.has(k) && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#fff' : colors.primary, marginTop: 2 }} />}
              </Pressable>); })}
          </View>
          {dist.length === 0 ? <Text style={{ color: colors.muted, textAlign: 'center', padding: 12 }}>No workouts on the selected days.</Text> : dist.map((d) => (
            <View key={d.name} style={{ gap: 4 }}><Text style={{ color: colors.text }}>{d.name}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ height: 12, width: `${Math.max(2, d.pct) * 0.85}%`, backgroundColor: colors.primary, borderRadius: 3 }} /><Text style={{ color: colors.muted }}>{d.pct}%</Text></View></View>
          ))}
        </View>
        <Section title="Overall summary" />
        <View style={{ padding: 16 }}><Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stat label="Workouts" value={String(workouts.length)} /><Stat label="Total time" value={fmtDuration(total)} /><Stat label="Volume" value={fmtVolume(workouts.reduce((t, w) => t + workoutVolume(w), 0), profile.units)} /><Stat label="Sets" value={String(workouts.reduce((t, w) => t + workoutSets(w), 0))} />
        </Card></View>
        <Section title="Advanced statistics" />
        {ADVANCED.map((a) => (
          <Pressable key={a.type} onPress={() => (a.type === 'monthly' ? router.push('/profile/report') : router.push({ pathname: '/profile/stats-detail', params: { type: a.type } }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
            <Ionicons name={a.icon as any} size={24} color={colors.text} />
            <View style={{ flex: 1 }}><Text style={{ fontSize: 16, color: colors.text }}>{a.title}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{a.sub}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
