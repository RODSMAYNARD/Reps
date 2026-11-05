import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Empty, Header, IconButton, LineChart, ListRow, PillRow, Screen, Section, Sheet } from '../../components/ui';
import { MEASURE_FIELDS } from '../../lib/constants';
import { fmtBody, fmtDate, toDisplayBody, toDisplayWeight } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const RANGES = [{ id: '30', label: 'Last month' }, { id: '90', label: 'Last 3 months' }, { id: '365', label: 'Last year' }, { id: '0', label: 'All' }];

export default function Measures() {
  const { measurements, profile } = useStore();
  const [field, setField] = useState('weight');
  const [range, setRange] = useState('90');
  const [sheet, setSheet] = useState(false);
  const [nowTs] = useState(() => Date.now());
  const u = profile.units;
  const def = MEASURE_FIELDS.find((f) => f.key === field)!;
  const conv = (v: number) => (def.unit === 'weight' ? toDisplayWeight(v, u) : def.unit === 'body' ? toDisplayBody(v, u) : v);
  const unit = def.unit === 'weight' ? u.weight : def.unit === 'body' ? u.body : '%';
  const from = Number(range) ? nowTs - Number(range) * 86400000 : 0;
  const rows = measurements.filter((m) => m.values[field] != null && new Date(m.date).getTime() >= from);
  const series = rows.slice().reverse().map((m) => ({ label: fmtDate(m.date, { day: '2-digit', month: '2-digit' }), value: Math.round(conv(m.values[field]) * 10) / 10 }));
  const photos = measurements.filter((m) => m.photoUri);
  const last = rows[0];
  return (
    <Screen>
      <Header title="Measurements" right={<IconButton name="add" size={28} onPress={() => router.push('/profile/log-measures')} testID="add-measure" />} />
      <ScrollView>
        {photos.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}><Text style={{ color: colors.muted }}>Progress photos</Text><Text onPress={() => router.push('/profile/progress-photos')} style={{ color: colors.primary }}>See all</Text></View>
            <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>{photos.slice(0, 6).map((m) => <Image key={m.id} source={{ uri: m.photoUri! }} style={{ width: 90, height: 120, borderRadius: 12 }} />)}</ScrollView>
          </View>
        )}
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{last ? `${Math.round(conv(last.values[field]) * 10) / 10} ${unit}` : '—'} <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '400' }}>{last ? fmtDate(last.date, { day: '2-digit', month: 'short' }) : ''}</Text></Text>
            <Pressable onPress={() => setSheet(true)} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Text style={{ color: colors.primary }}>{RANGES.find((r) => r.id === range)!.label}</Text><Ionicons name="chevron-down" size={16} color={colors.primary} /></Pressable>
          </View>
          <LineChart data={series} unit={` ${unit}`} />
        </View>
        <PillRow value={field} onChange={setField} items={MEASURE_FIELDS.map((f) => ({ id: f.key, label: f.label }))} />
        <Section title="History" />
        {rows.length === 0 && <Empty icon="body-outline" text="No entries yet. Tap + to log your measurements." />}
        {rows.map((m) => (
          <ListRow key={m.id} label={fmtDate(m.date, { day: '2-digit', month: 'short', year: 'numeric' })} last
            right={<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{m.photoUri ? <Ionicons name="camera-outline" size={20} color={colors.muted} /> : null}<Text style={{ fontSize: 16, color: colors.text }}>{def.unit === 'body' ? fmtBody(m.values[field], u) : `${Math.round(conv(m.values[field]) * 10) / 10} ${unit}`}</Text></View>}
            onPress={() => router.push({ pathname: '/profile/log-measures', params: { id: m.id } })} />
        ))}
      </ScrollView>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Period">
        {RANGES.map((r) => <ListRow key={r.id} label={r.label} last right={range === r.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setRange(r.id); setSheet(false); }} />)}
      </Sheet>
    </Screen>
  );
}
