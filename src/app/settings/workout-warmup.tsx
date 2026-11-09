import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { NumInput } from '../../components/NumInput';
import { Btn, Header, ListRow, Screen, Sheet, Toggle } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { DEFAULT_WARMUP } from '../../lib/types';

const PLATE = [10, 5, 2.5, 1.25, 0.5];
const DUMB = [5, 2.5, 2, 1, 0.5];
const kgLabel = (v: number) => `${v} kg`;

export default function WarmupSettings() {
  const { wprefs: p, setWprefs } = useStore();
  const [method, setMethod] = useState(false);
  const [pick, setPick] = useState<'plate' | 'dumb' | null>(null);
  const f = p.warmupFormula;
  const setF = (rows: typeof f) => setWprefs({ warmupFormula: rows });
  return (
    <Screen>
      <Header title="Warm-up Calculator" />
      <ScrollView testID="warmup-settings">
        <Text style={{ color: colors.muted, fontSize: 16, padding: 16 }}>Use the warm-up calculator to quickly add percentage-based warm-up sets to exercises.</Text>
        <Toggle label="Warm-up Calculator" subtitle="When active, tap the three dots next to an exercise and choose “Add warm-up sets”." value={p.warmupCalc} onChange={(v) => setWprefs({ warmupCalc: v })} />
        <ListRow label="Warmup Method" detail={f.map((r) => `${r.pct}%×${r.reps}`).join(' · ')} onPress={() => setMethod(true)} testID="warmup-method" />
        <ListRow label="Plate Rounding" detail={kgLabel(p.plateRounding)} subtitle="Preferred plate weight increments for your warm-up calculations." onPress={() => setPick('plate')} />
        <ListRow label="Dumbbell Rounding" detail={kgLabel(p.dumbbellRounding)} subtitle="Preferred dumbbell weight increments for your warm-up calculations." onPress={() => setPick('dumb')} last />
      </ScrollView>

      <Sheet visible={method} onClose={() => setMethod(false)} title="Warmup Method">
        <View style={{ backgroundColor: colors.bg, borderRadius: 12, overflow: 'hidden' }}>
          <Text style={{ textAlign: 'center', color: colors.muted, paddingVertical: 8 }}>Formula (% of your working weight × reps)</Text>
          {f.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.surface }}>
              <Text style={{ width: 40, color: colors.warn, fontWeight: '800', fontSize: 20 }}>W</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 70 }}><NumInput value={r.pct} onChange={(v) => setF(f.map((x, k) => (k === i ? { ...x, pct: Math.max(1, Math.min(100, v ?? 1)) } : x)))} style={{ color: colors.primary, fontSize: 20 }} /></View>
                <Text style={{ color: colors.primary, fontSize: 20 }}>% ×</Text>
                <View style={{ width: 60 }}><NumInput value={r.reps} onChange={(v) => setF(f.map((x, k) => (k === i ? { ...x, reps: Math.max(1, v ?? 1) } : x)))} style={{ color: colors.primary, fontSize: 20 }} /></View>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Btn title="Remove Set" icon="remove" variant="secondary" style={{ flex: 1 }} disabled={f.length <= 1} onPress={() => setF(f.slice(0, -1))} />
          <Btn title="Add Set" icon="add" variant="secondary" style={{ flex: 1 }} disabled={f.length >= 6} onPress={() => setF([...f, { pct: Math.min(100, (f.at(-1)?.pct ?? 60) + 10), reps: 3 }])} />
        </View>
        <Btn title="Done" onPress={() => setMethod(false)} style={{ marginTop: 10 }} />
        <Btn title="Reset to Default" variant="secondary" onPress={() => setF(DEFAULT_WARMUP)} style={{ marginTop: 10 }} />
      </Sheet>

      <Sheet visible={pick !== null} onClose={() => setPick(null)} title={pick === 'plate' ? 'Plate Rounding' : 'Dumbbell Rounding'}>
        {(pick === 'plate' ? PLATE : DUMB).map((v, i, a) => {
          const def = pick === 'plate' ? 5 : 1;
          const cur = pick === 'plate' ? p.plateRounding : p.dumbbellRounding;
          return <ListRow key={v} label={`${kgLabel(v)}${v === def ? ' (default)' : ''}`} last={i === a.length - 1} right={cur === v ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : undefined}
            onPress={() => { setWprefs(pick === 'plate' ? { plateRounding: v } : { dumbbellRounding: v }); setPick(null); }} />;
        })}
      </Sheet>
    </Screen>
  );
}
