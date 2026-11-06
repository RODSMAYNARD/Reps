import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ExerciseLabel } from '../../components/ExerciseLabel';
import { BarChart, Card, Empty, Header, PillRow, Screen, Stat } from '../../components/ui';
import { MUSCLES } from '../../lib/constants';
import { fmtDuration, fmtVolume, fmtWeight } from '../../lib/format';
import { muscleDistribution, records, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { ADVANCED } from './stats';

export default function StatsDetail() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { workouts, exercises, profile } = useStore();
  const [range, setRange] = useState('30');
  const [nowTs] = useState(() => Date.now());
  const meta = ADVANCED.find((a) => a.type === type);
  const u = profile.units;
  const cur = muscleDistribution(workouts, exercises, Number(range), nowTs);
  const prev = useMemo(() => {
    const n = Number(range);
    const from = nowTs - 2 * n * 86400000, to = nowTs - n * 86400000;
    return muscleDistribution(workouts.filter((w) => { const t = new Date(w.date).getTime(); return t >= from && t < to; }), exercises);
  }, [workouts, exercises, range, nowTs]);
  const rangePills = <PillRow value={range} onChange={setRange} items={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '3 months' }, { id: '365', label: '1 year' }]} />;

  const mainEx = exercises.map((e) => ({ e, n: workouts.reduce((t, w) => t + (w.entries.find((x) => x.exerciseId === e.id)?.sets.length ?? 0), 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const month = workouts.filter((w) => new Date(w.date).getMonth() === new Date().getMonth() && new Date(w.date).getFullYear() === new Date().getFullYear());
  const heat = (name: string) => { const v = cur.find((d) => d.name === name)?.pct ?? 0; return v; };

  return (
    <Screen>
      <Header title={meta?.title ?? 'Statistics'} />
      <ScrollView>
        {type === 'sets' && (<View>{rangePills}<View style={{ padding: 16, gap: 12 }}>{cur.length === 0 && <Empty text="No sets in this period." />}{cur.map((d) => (
          <View key={d.name} style={{ gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text }}>{d.name}</Text><Text style={{ color: colors.muted }}>{d.sets} sets</Text></View><View style={{ height: 12, width: `${Math.max(3, d.pct)}%`, backgroundColor: colors.primary, borderRadius: 3 }} /></View>))}</View></View>)}
        {type === 'chart' && (<View>{rangePills}<View style={{ padding: 16, gap: 14 }}>
          <Text style={{ color: colors.muted }}>Current period (blue) vs. previous period (gray)</Text>
          {cur.length === 0 && prev.length === 0 && <Empty text="No data in this period." />}
          {[...new Set([...cur, ...prev].map((d) => d.name))].map((n) => (
            <View key={n} style={{ gap: 3 }}><Text style={{ color: colors.text }}>{n}</Text>
              <View style={{ height: 10, width: `${Math.max(2, cur.find((d) => d.name === n)?.pct ?? 0)}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
              <View style={{ height: 10, width: `${Math.max(2, prev.find((d) => d.name === n)?.pct ?? 0)}%`, backgroundColor: colors.surfaceAlt, borderRadius: 3 }} /></View>))}
        </View></View>)}
        {type === 'body' && (<View>{rangePills}<View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'].map((g) => { const v = heat(g); return (
            <View key={g} style={{ width: '31%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: `rgba(10,132,255,${0.08 + (v / 100) * 0.92})`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', color: v > 40 ? '#fff' : colors.text }}>{g}</Text><Text style={{ color: v > 40 ? '#fff' : colors.muted }}>{v}%</Text></View>); })}
        </View><Text style={{ color: colors.muted, padding: 16 }}>Darker means more sets for that group ({MUSCLES.length} muscles grouped into 6 regions).</Text></View>)}
        {type === 'main' && (<View>{mainEx.length === 0 && <Empty text="Complete workouts to see your most frequent exercises." />}{mainEx.map(({ e, n }, i) => <View key={e.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={e.id} prefix={`${i + 1}. `} right={<Text style={{ color: colors.muted }}>{n} sets</Text>} /></View>)}</View>)}
        {type === 'leaderboard' && (<View>{exercises.filter((e) => e.kind === 'weight_reps').map((e) => { const r = records(workouts, e.id); return <View key={e.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={e.id} right={<Text style={{ color: colors.muted }}>{r.best1rm ? fmtWeight(r.best1rm, u) : '—'}</Text>} /></View>; })}</View>)}
        {type === 'monthly' && (
          <View style={{ padding: 16, gap: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Stat label="Workouts" value={String(month.length)} /><Stat label="Duration" value={fmtDuration(month.reduce((t, w) => t + w.durationSec, 0))} /><Stat label="Volume" value={fmtVolume(month.reduce((t, w) => t + workoutVolume(w), 0), u)} /><Stat label="Sets" value={String(month.reduce((t, w) => t + workoutSets(w), 0))} /></Card>
            <BarChart data={Array.from({ length: 4 }, (_, i) => ({ label: `W${i + 1}`, value: month.filter((w) => Math.floor((new Date(w.date).getDate() - 1) / 7) === i).length }))} />
            {month.length === 0 && <Empty text="No workouts this month yet." />}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
