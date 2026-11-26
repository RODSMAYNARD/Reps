import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { PlainText, Text } from '../../components/Text';
import { MuscleRadar, radarSets } from '../../components/MuscleRadar';
import { ExerciseLabel } from '../../components/ExerciseLabel';
import { BarChart, Card, Dialog, Empty, Header, IconButton, ListRow, PillRow, Screen, Sheet, Stat } from '../../components/ui';
import { MUSCLES } from '../../lib/constants';
import { fmtDuration, fmtVolume, fmtWeight, toDisplayWeight } from '../../lib/format';
import { canonId, exerciseOf, muscleDistribution, recordsMap, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { ADVANCED } from './stats';
import { locale } from '../../lib/i18n';

export default function StatsDetail() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { workouts, exercises, profile } = useStore();
  const [range, setRange] = useState('30');
  const [nowTs] = useState(() => Date.now());
  const meta = ADVANCED.find((a) => a.type === type);
  const u = profile.units;
  const cur = muscleDistribution(workouts, exercises, Number(range), nowTs);
  // treinos do período atual e do anterior (mesmo tamanho), para o radar e os cartões
  const inRange = (back: number) => { const n = Number(range); const to = nowTs - back * n * 864e5, from = to - n * 864e5; return workouts.filter((w) => { const t = new Date(w.date).getTime(); return t >= from && t < to; }); };
  const curW = inRange(0), prevW = inRange(1);
  const sum = (list: typeof workouts, f: (w: (typeof workouts)[number]) => number) => list.reduce((a, w) => a + f(w), 0);
  const kgShort = (kg: number) => { const v = Math.abs(toDisplayWeight(kg, u)); return `${v >= 10000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString(locale())} ${u.weight}`; };
  const [rangeOpen, setRangeOpen] = useState(false);
  const [help, setHelp] = useState(false);
  // recordes de todos os exercícios numa passada só (antes era um `records()` por linha, cada um refazendo o mapa inteiro)
  const rmap = useMemo(() => (type === 'leaderboard' ? recordsMap(workouts) : null), [type, workouts, exercises]); // eslint-disable-line react-hooks/exhaustive-deps -- `exercises` muda o tipo/id canônico que recordsMap lê pelo lookup do store
  const rangePills = <PillRow value={range} onChange={setRange} items={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '3 months' }, { id: '365', label: '1 year' }]} />;

  // séries por exercício numa passada só; soma todas as entradas (o exercício pode aparecer 2x) e junta o `cat:<id>` de treinos na fila
  const mainCount = new Map<string, number>();
  if (type === 'main') workouts.forEach((w) => w.entries.forEach((x) => { const k = canonId(x.exerciseId); mainCount.set(k, (mainCount.get(k) ?? 0) + x.sets.length); }));
  const mainEx = [...mainCount].flatMap(([k, n]) => { const e = exerciseOf(k) ?? exercises.find((x) => x.id === k); return e && n > 0 ? [{ e, n }] : []; }).sort((a, b) => b.n - a.n);
  const month = workouts.filter((w) => new Date(w.date).getMonth() === new Date().getMonth() && new Date(w.date).getFullYear() === new Date().getFullYear());
  const heat = (name: string) => { const v = cur.find((d) => d.name === name)?.pct ?? 0; return v; };

  return (
    <Screen>
      <Header title={type === 'chart' ? 'Muscle distribution' : meta?.title ?? 'Statistics'} right={type === 'chart' ? <IconButton name="help-circle-outline" onPress={() => setHelp(true)} testID="radar-help" /> : undefined} />
      <ScrollView>
        {type === 'sets' && (<View>{rangePills}<View style={{ padding: 16, gap: 12 }}>{cur.length === 0 && <Empty text="No sets in this period." />}{cur.map((d) => (
          <View key={d.name} style={{ gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text }}>{d.name}</Text><Text style={{ color: colors.muted }}>{d.sets} sets</Text></View><View style={{ height: 12, width: `${Math.max(3, d.pct)}%`, backgroundColor: colors.primary, borderRadius: 3 }} /></View>))}</View></View>)}
        {type === 'chart' && (
          // Distribuição muscular em radar (como no Hevy, 2026-11-23): período atual (azul) x o anterior de mesmo tamanho (cinza)
          <View style={{ padding: 16, gap: 18 }}>
            <Pressable onPress={() => setRangeOpen(true)} testID="radar-range" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{RADAR_RANGES.find((r) => r.id === range)?.label ?? 'Last 30 days'}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.text} />
            </Pressable>
            <MuscleRadar cur={radarSets(curW)} prev={radarSets(prevW)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <DeltaCard label="Workouts" value={String(curW.length)} diff={curW.length - prevW.length} fmt={(v) => String(v)} />
              <DeltaCard label="Duration" value={fmtDuration(sum(curW, (w) => w.durationSec)).replace(/ \d+s$/, '')} diff={sum(curW, (w) => w.durationSec) - sum(prevW, (w) => w.durationSec)} fmt={(v) => fmtDuration(v).replace(/ \d+s$/, '')} />
              <DeltaCard label="Volume" value={kgShort(sum(curW, workoutVolume))} diff={sum(curW, workoutVolume) - sum(prevW, workoutVolume)} fmt={kgShort} />
              <DeltaCard label="Sets" value={String(sum(curW, workoutSets))} diff={sum(curW, workoutSets) - sum(prevW, workoutSets)} fmt={(v) => String(v)} />
            </View>
          </View>
        )}
        {type === 'body' && (<View>{rangePills}<View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'].map((g) => { const v = heat(g); return (
            <View key={g} style={{ width: '31%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: `rgba(10,132,255,${0.08 + (v / 100) * 0.92})`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', color: v > 40 ? '#fff' : colors.text }}>{g}</Text><Text style={{ color: v > 40 ? '#fff' : colors.muted }}>{v}%</Text></View>); })}
        </View><Text style={{ color: colors.muted, padding: 16 }}>Darker means more sets for that group ({MUSCLES.length} muscles grouped into 6 regions).</Text></View>)}
        {type === 'main' && (<View>{mainEx.length === 0 && <Empty text="Complete workouts to see your most frequent exercises." />}{mainEx.map(({ e, n }, i) => <View key={e.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={e.id} prefix={`${i + 1}. `} right={<Text style={{ color: colors.muted }}>{n} sets</Text>} /></View>)}</View>)}
        {type === 'leaderboard' && (<View>{exercises.filter((e) => e.kind === 'weight_reps').map((e) => { const r = rmap?.get(e.id); return <View key={e.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={e.id} right={<Text style={{ color: colors.muted }}>{r?.best1rm ? fmtWeight(r.best1rm, u) : '—'}</Text>} /></View>; })}</View>)}
        {type === 'monthly' && (
          <View style={{ padding: 16, gap: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{new Date().toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</Text>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Stat label="Workouts" value={String(month.length)} /><Stat label="Duration" value={fmtDuration(month.reduce((t, w) => t + w.durationSec, 0))} /><Stat label="Volume" value={fmtVolume(month.reduce((t, w) => t + workoutVolume(w), 0), u)} /><Stat label="Sets" value={String(month.reduce((t, w) => t + workoutSets(w), 0))} /></Card>
            {/* 5 faixas de 7 dias: os dias 29–31 caem na W5 */}
            <BarChart data={Array.from({ length: 5 }, (_, i) => ({ label: `W${i + 1}`, value: month.filter((w) => Math.floor((new Date(w.date).getDate() - 1) / 7) === i).length }))} />
            {month.length === 0 && <Empty text="No workouts this month yet." />}
          </View>
        )}
      </ScrollView>
      <Sheet visible={rangeOpen} onClose={() => setRangeOpen(false)} title="Period">
        {RADAR_RANGES.map((r, k) => (
          <ListRow key={r.id} label={r.label} last={k === RADAR_RANGES.length - 1} testID={`radar-range-${r.id}`}
            right={range === r.id ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : <View />}
            onPress={() => { setRange(r.id); setRangeOpen(false); }} />
        ))}
      </Sheet>
      <Dialog visible={help} onClose={() => setHelp(false)} message="Muscle group distribution compares the number of completed sets of exercises that work each muscle group. It counts both primary and secondary muscles. Warm-up sets are included."
        actions={[{ label: 'OK', primary: true, onPress: () => setHelp(false) }]} />
    </Screen>
  );
}

const RADAR_RANGES = [{ id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 3 months' }, { id: '365', label: 'Last 12 months' }];

/** Cartão com o número do período e a diferença para o anterior (seta verde subindo, vermelha descendo). */
function DeltaCard({ label, value, diff, fmt }: { label: string; value: string; diff: number; fmt: (v: number) => string }) {
  const up = diff > 0, same = Math.round(diff) === 0;
  return (
    <View style={{ width: '48%', flexGrow: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 4 }}>
      <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{value}</Text>
      {!same && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={14} color={up ? colors.success : colors.danger} />
          <PlainText style={{ fontSize: 14, color: up ? colors.success : colors.danger }}>{fmt(Math.abs(diff))}</PlainText>
        </View>
      )}
    </View>
  );
}
