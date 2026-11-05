import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { BarChart, Btn, Header, Screen, Section, TopTabs } from '../../components/ui';
import { MUSCLE_GROUPS } from '../../lib/constants';
import { fmtDuration, fmtVolume } from '../../lib/format';
import { dayKey, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { Workout } from '../../lib/types';

type Metric = 'workouts' | 'duration' | 'volume' | 'sets';
const inMonth = (ws: Workout[], y: number, m: number) => ws.filter((w) => { const d = new Date(w.date); return d.getFullYear() === y && d.getMonth() === m; });
const value = (ws: Workout[], k: Metric) => (k === 'workouts' ? ws.length : k === 'duration' ? ws.reduce((t, w) => t + w.durationSec, 0) : k === 'volume' ? ws.reduce((t, w) => t + workoutVolume(w), 0) : ws.reduce((t, w) => t + workoutSets(w), 0));

export function Delta({ now, prev, fmt = (v: number) => String(Math.round(v)) }: { now: number; prev: number; fmt?: (v: number) => string }) {
  const d = now - prev;
  if (!d) return null;
  return <Text style={{ color: d > 0 ? colors.success : colors.danger, fontSize: 13 }}>{d > 0 ? '↑' : '↓'} {fmt(Math.abs(d))}</Text>;
}

export default function MonthlyReport() {
  const params = useLocalSearchParams<{ month?: string }>();
  const st = useStore();
  const { workouts, profile } = st;
  const u = profile.units;
  const [cursor, setCursor] = useState(() => {
    const [y, m] = (params.month ?? '').split('-').map(Number);
    const d = y && m ? new Date(y, m - 1, 1) : new Date();
    d.setDate(1);
    return d;
  });
  const [metric, setMetric] = useState<Metric>('workouts');
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const prevDate = useMemo(() => new Date(y, m - 1, 1), [y, m]);
  const cur = useMemo(() => inMonth(workouts, y, m), [workouts, y, m]);
  const prev = useMemo(() => inMonth(workouts, prevDate.getFullYear(), prevDate.getMonth()), [workouts, prevDate]);
  const title = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shift = (n: number) => setCursor(new Date(y, m + n, 1));
  const isNow = y === new Date().getFullYear() && m === new Date().getMonth();

  const series = Array.from({ length: 12 }, (_, i) => { const d = new Date(y, m - 11 + i, 1); return { label: d.toLocaleDateString('en-US', { month: 'narrow' }), value: value(inMonth(workouts, d.getFullYear(), d.getMonth()), metric) / (metric === 'duration' ? 3600 : 1) }; });
  const fmtMetric = (k: Metric, v: number) => (k === 'duration' ? fmtDuration(v) : k === 'volume' ? fmtVolume(v, u) : String(Math.round(v)));

  const first = (cursor.getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const worked = new Set(cur.map((w) => dayKey(w.date)));

  const tally = (ws: Workout[]) => {
    const groups = new Map<string, number>(), muscles = new Map<string, number>(), ex = new Map<string, { name: string; n: number }>();
    ws.forEach((w) => w.entries.forEach((e) => {
      const x = st.findExercise(e.exerciseId);
      if (!x) return;
      groups.set(MUSCLE_GROUPS[x.muscle] ?? x.muscle, (groups.get(MUSCLE_GROUPS[x.muscle] ?? x.muscle) ?? 0) + e.sets.length);
      muscles.set(x.muscle, (muscles.get(x.muscle) ?? 0) + e.sets.length);
      ex.set(x.id, { name: x.name, n: (ex.get(x.id)?.n ?? 0) + 1 });
    }));
    return { groups, muscles, ex };
  };
  const tc = tally(cur), tp = tally(prev);
  const gNames = [...new Set([...tc.groups.keys(), ...tp.groups.keys()])];
  const gMax = Math.max(1, ...gNames.flatMap((g) => [tc.groups.get(g) ?? 0, tp.groups.get(g) ?? 0]));
  const topMuscles = [...tc.muscles].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mMax = Math.max(1, ...topMuscles.map((x) => x[1]));
  const topEx = [...tc.ex.values()].sort((a, b) => b.n - a.n).slice(0, 5);

  const text = [`${title} on Reps`, `${cur.length} workouts · ${fmtDuration(value(cur, 'duration'))} · ${fmtVolume(value(cur, 'volume'), u)} · ${value(cur, 'sets')} sets`, ...topEx.slice(0, 3).map((e) => `${e.name} — ${e.n}×`)].join('\n');

  const sum: { k: Metric; label: string }[] = [{ k: 'workouts', label: 'Workouts' }, { k: 'duration', label: 'Duration' }, { k: 'volume', label: 'Volume' }, { k: 'sets', label: 'Sets' }];
  return (
    <Screen>
      <Header title={`${cursor.toLocaleDateString('en-US', { month: 'long' })} Report`} />
      <ScrollView testID="monthly-report">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} onPress={() => shift(-1)} testID="report-prev" />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{title}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Text style={{ color: colors.muted }}>{cur.length} {cur.length === 1 ? 'workout' : 'workouts'}</Text><Delta now={cur.length} prev={prev.length} /></View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={isNow ? colors.faint : colors.text} onPress={() => !isNow && shift(1)} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <BarChart data={series} highlightLast />
          <TopTabs items={sum.map((s) => ({ id: s.k, label: s.label }))} value={metric} onChange={(v) => setMetric(v as Metric)} />
        </View>

        <Section title="Summary" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 }}>
          {sum.map((s) => (
            <View key={s.k} style={{ width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{s.label}</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{fmtMetric(s.k, value(cur, s.k))}</Text>
              <Delta now={value(cur, s.k)} prev={value(prev, s.k)} fmt={(v) => fmtMetric(s.k, v)} />
            </View>
          ))}
        </View>

        <Section title="Workout days" />
        <View style={{ paddingHorizontal: 8 }}>
          <View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted }}>{d}</Text>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((c, i) => { const on = c ? worked.has(dayKey(new Date(y, m, c))) : false; return (
              <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 5 }}>
                {c ? <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : 'transparent' }}><Text style={{ color: on ? '#fff' : colors.text, fontWeight: on ? '700' : '400' }}>{c}</Text></View> : null}
              </View>); })}
          </View>
        </View>

        <Section title="Muscle distribution" />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {gNames.length === 0 && <Text style={{ color: colors.muted }}>No workouts this month.</Text>}
          {gNames.map((g) => (
            <View key={g} style={{ gap: 3 }}>
              <Text style={{ color: colors.text }}>{g}</Text>
              <View style={{ height: 10, width: `${((tc.groups.get(g) ?? 0) / gMax) * 100}%`, minWidth: 3, backgroundColor: colors.primary, borderRadius: 3 }} />
              <View style={{ height: 6, width: `${((tp.groups.get(g) ?? 0) / gMax) * 100}%`, minWidth: 3, backgroundColor: colors.faint, borderRadius: 3 }} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: colors.faint, fontSize: 12 }}>● {prevDate.toLocaleDateString('en-US', { month: 'long' })}</Text>
            <Text style={{ color: colors.primary, fontSize: 12 }}>● {cursor.toLocaleDateString('en-US', { month: 'long' })}</Text>
          </View>
        </View>

        <Section title="Main muscle groups" />
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {topMuscles.map(([name, sets]) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 90, color: colors.text }} numberOfLines={1}>{name}</Text>
              <View style={{ flex: 1 }}><View style={{ height: 14, width: `${(sets / mMax) * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} /></View>
              <Text style={{ width: 30, textAlign: 'right', color: colors.muted }}>{sets}</Text>
            </View>
          ))}
        </View>

        <Section title="Top exercises" />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {topEx.length === 0 && <Text style={{ color: colors.muted }}>No exercises logged.</Text>}
          {topEx.map((e) => <View key={e.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{e.name}</Text><Text style={{ color: colors.muted }}>{e.n} {e.n === 1 ? 'time' : 'times'}</Text></View>)}
        </View>

        {cur.length > 0 && (
          <View style={{ padding: 16, gap: 10, marginTop: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Congrats on a great month!</Text>
            <Text style={{ color: colors.muted }}>Celebrate your achievements and motivate others by sharing your journey!</Text>
            <Btn title="Share" icon="share-outline" onPress={() => { Share.share({ message: text }).catch(() => {}); }} testID="report-share" />
            <Pressable onPress={() => { Clipboard.setStringAsync(text).then(() => st.showToast('Copied!')).catch(() => {}); }} style={{ alignItems: 'center', padding: 8 }}><Text style={{ color: colors.primary }}>Copy text</Text></Pressable>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}
