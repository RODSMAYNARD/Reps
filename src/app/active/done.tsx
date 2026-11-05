import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Btn, Screen } from '../../components/ui';
import { fmtDuration, fmtVolume, fmtWeight } from '../../lib/format';
import { dayKey, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

export default function WorkoutDone() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const { workouts, profile } = st;
  const w = workouts.find((x) => x.id === id);
  if (!w) return <Screen><View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Btn title="Done" onPress={() => router.dismissTo('/')} /></View></Screen>;

  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return d; });
  const trained = new Set(workouts.map((x) => dayKey(x.date)));
  const week = days.filter((d) => trained.has(dayKey(d))).length;
  const muscles = [...new Set(w.entries.map((e) => st.findExercise(e.exerciseId)?.muscle).filter(Boolean) as string[])];
  const top = (sets: { kg: number | null; reps: number | null }[]) => sets.reduce((b, s) => ((s.kg ?? 0) > (b.kg ?? 0) ? s : b), sets[0]);

  const text = [
    `${w.title} — ${ordinal(workouts.length)} workout on Reps`,
    `${fmtDuration(w.durationSec)} · ${fmtVolume(workoutVolume(w), profile.units)} · ${workoutSets(w)} sets`,
    ...w.entries.map((e) => `${e.sets.length} × ${st.findExercise(e.exerciseId)?.name ?? 'Exercise'}`),
  ].join('\n');
  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: 'share-outline', label: 'More', onPress: () => { Share.share({ message: text }).catch(() => {}); } },
    { icon: 'copy-outline', label: 'Copy Text', onPress: () => { Clipboard.setStringAsync(text).then(() => st.showToast('Copied!')).catch(() => {}); } },
    { icon: 'logo-twitter', label: 'X', onPress: () => { Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`).catch(() => {}); } },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} testID="workout-done">
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trophy" size={34} color={colors.success} />
          </View>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>Nice work!</Text>
          <Text style={{ fontSize: 16, color: colors.muted }}>This is your {ordinal(workouts.length)} workout</Text>
        </View>

        <View style={{ backgroundColor: colors.black, borderRadius: radius.lg, padding: 20, gap: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{w.title}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {days.map((d, k) => {
              const on = trained.has(dayKey(d));
              return (
                <View key={k} style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: '#9AA3B2', fontSize: 12 }}>{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</Text>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: on ? colors.primary : '#1E2430', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>You worked out <Text style={{ fontWeight: '800' }}>{week} {week === 1 ? 'time' : 'times'}</Text> in the last 7 days</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[['Duration', fmtDuration(w.durationSec)], ['Volume', fmtVolume(workoutVolume(w), profile.units)], ['Sets', String(workoutSets(w))]].map(([l, v]) => (
            <View key={l} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{l}</Text>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{v}</Text>
            </View>
          ))}
        </View>

        {muscles.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {muscles.map((m) => <View key={m} style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{m}</Text></View>)}
          </View>
        )}

        <View style={{ gap: 8 }}>
          {w.entries.map((e, k) => {
            const t = top(e.sets);
            return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 15 }} numberOfLines={1}>{e.sets.length} × {st.findExercise(e.exerciseId)?.name ?? 'Exercise'}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>{t.kg ? `${fmtWeight(t.kg, profile.units)} × ${t.reps}` : `${t.reps} reps`}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>Share workout</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
            {actions.map((a) => (
              <Pressable key={a.label} onPress={a.onPress} style={{ alignItems: 'center', gap: 6 }} testID={`share-${a.label}`}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={a.icon} size={24} color={colors.text} /></View>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Btn title="Done" onPress={() => router.dismissTo('/')} testID="done-btn" />
      </ScrollView>
    </Screen>
  );
}
