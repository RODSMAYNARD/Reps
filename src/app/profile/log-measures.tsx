import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { Dialog, Header, HeaderAction, ListRow, Screen, Section, Sheet } from '../../components/ui';
import { MEASURE_FIELDS } from '../../lib/constants';
import { fromDisplayBody, fromDisplayWeight, toDisplayBody, toDisplayWeight } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function LogMeasures() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { measurements, profile, saveMeasurement, deleteMeasurement, showToast } = useStore();
  const existing = measurements.find((m) => m.id === id);
  const u = profile.units;
  const toDisp = (key: string, v: number | undefined) => (v == null ? null : Math.round((MEASURE_FIELDS.find((f) => f.key === key)!.unit === 'weight' ? toDisplayWeight(v, u) : MEASURE_FIELDS.find((f) => f.key === key)!.unit === 'body' ? toDisplayBody(v, u) : v) * 10) / 10);
  const [vals, setVals] = useState<Record<string, number | null>>(() => Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, toDisp(f.key, existing?.values[f.key] ?? (f.key === 'weight' && !existing ? profile.weightKg ?? undefined : undefined))])));
  const [photo, setPhoto] = useState<string | null>(existing?.photoUri ?? null);
  const [daysAgo, setDaysAgo] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [del, setDel] = useState(false);
  const [nowTs] = useState(() => Date.now());
  const date = existing ? new Date(existing.date + 'T12:00:00') : new Date(nowTs - daysAgo * 86400000);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const any = Object.values(vals).some((v) => v != null) || !!photo;

  const save = async () => {
    const values: Record<string, number> = {};
    MEASURE_FIELDS.forEach((f) => { const v = vals[f.key]; if (v != null) values[f.key] = f.unit === 'weight' ? fromDisplayWeight(v, u) : f.unit === 'body' ? fromDisplayBody(v, u) : v; });
    if (!(await saveMeasurement({ id: existing?.id, date: iso, values, photoUri: photo }))) return;
    if (values.weight) await syncWeight(values.weight);
    showToast('Measurements saved'); router.back();
  };
  const syncWeight = async (kg: number) => { if (!existing) await saveProfileWeight(kg); };
  const { saveProfile } = useStore();
  const saveProfileWeight = (kg: number) => saveProfile({ weightKg: kg });
  const pick = async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }); if (!r.canceled) setPhoto(r.assets[0].uri); };

  return (
    <Screen>
      <Header left="cancel" title="Log Measurements" right={<HeaderAction label="Save" disabled={!any} onPress={save} />} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <ListRow label="Date" detail={date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })} onPress={existing ? undefined : () => setSheet(true)} last />
        <Section title="Progress photo" />
        <View style={{ paddingHorizontal: 16 }}>
          {photo ? (
            <View><Image source={{ uri: photo }} style={{ width: 120, height: 160, borderRadius: 12 }} /><Pressable onPress={() => setPhoto(null)} style={{ position: 'absolute', left: 6, top: 6, backgroundColor: '#000a', borderRadius: 12 }}><Ionicons name="close" size={20} color="#fff" /></Pressable></View>
          ) : (
            <Pressable onPress={pick} style={{ width: 120, height: 160, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name="camera-outline" size={28} color={colors.primary} /><Text style={{ color: colors.primary }}>Add</Text></Pressable>
          )}
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>The photo is saved on this device only.</Text>
        </View>
        <Section title="Measurements" />
        {MEASURE_FIELDS.map((f) => {
          const unit = f.unit === 'weight' ? u.weight : f.unit === 'body' ? u.body : '%';
          return (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{f.label} ({unit})</Text>
              <View style={{ width: 110 }}><NumInput decimal placeholder="-" value={vals[f.key]} onChange={(v) => setVals({ ...vals, [f.key]: v })} style={{ textAlign: 'right' }} /></View>
            </View>
          );
        })}
        {existing && <Text onPress={() => setDel(true)} style={{ color: colors.danger, textAlign: 'center', padding: 24 }}>Delete entry</Text>}
        <TextInput style={{ height: 0 }} />
      </ScrollView>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Entry date">
        {[0, 1, 2, 3, 7, 14, 30].map((d) => <ListRow key={d} label={d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`} last right={daysAgo === d ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDaysAgo(d); setSheet(false); }} />)}
      </Sheet>
      <Dialog visible={del} title="Delete entry?" message="This can't be undone." onClose={() => setDel(false)} actions={[{ label: 'Cancel' }, { label: 'Delete', danger: true, onPress: async () => { setDel(false); if (await deleteMeasurement(existing!.id)) router.back(); } }]} />
    </Screen>
  );
}
