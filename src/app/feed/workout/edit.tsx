import { Ionicons } from '@expo/vector-icons';
import { track } from '../../../lib/analytics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../../components/NumInput';
import { Btn, Dialog, Header, HeaderAction, Screen, Sheet, ListRow } from '../../../components/ui';
import { fmtDuration, fromDisplayWeight, toDisplayWeight } from '../../../lib/format';
import { useStore } from '../../../lib/store';
import { colors, radius } from '../../../lib/theme';
import { SavedEntry, Workout } from '../../../lib/types';

const VIS: { id: Workout['visibility']; label: string }[] = [{ id: 'everyone', label: 'Everyone' }, { id: 'followers', label: 'Followers' }, { id: 'private', label: 'Only me' }];

export default function EditWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const w = st.workouts.find((x) => x.id === id);
  const u = st.profile.units;
  const [title, setTitle] = useState(w?.title ?? '');
  const [desc, setDesc] = useState(w?.description ?? '');
  const [place, setPlace] = useState(w?.location ?? '');
  const [vis, setVis] = useState<Workout['visibility']>(w?.visibility ?? 'everyone');
  const [date, setDate] = useState(w?.date ?? new Date().toISOString());
  const [minutes, setMinutes] = useState<number | null>(Math.round((w?.durationSec ?? 0) / 60));
  const [entries, setEntries] = useState<SavedEntry[]>(() => (w?.entries ?? []).map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })));
  const [visSheet, setVisSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ask, setAsk] = useState(false);
  if (!w) return <Screen><Header title="Edit Workout" /></Screen>;
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { setDirty(true); fn(v); };
  const patchSet = (i: number, j: number, p: Partial<SavedEntry['sets'][number]>) => { setDirty(true); setEntries((l) => l.map((e, k) => (k === i ? { ...e, sets: e.sets.map((x, n) => (n === j ? { ...x, ...p } : x)) } : e))); };
  const addSet = (i: number) => { setDirty(true); setEntries((l) => l.map((e, k) => (k === i ? { ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { type: 'normal' as const, kg: null, reps: null }), type: 'normal' as const }] } : e))); };
  const delSet = (i: number, j: number) => { setDirty(true); setEntries((l) => l.map((e, k) => (k === i ? { ...e, sets: e.sets.filter((_, n) => n !== j) } : e))); };
  const delEx = (i: number) => { setDirty(true); setEntries((l) => l.filter((_, k) => k !== i)); };
  const save = async () => {
    setBusy(true);
    const ok = await st.updateWorkout(w.id, { title: title.trim(), description: desc, date, visibility: vis, location: place.trim() || null, durationSec: Math.max(0, (minutes ?? 0) * 60), entries });
    setBusy(false);
    if (ok) { track('workout_edited'); st.showToast('Workout updated'); router.back(); }
  };
  const days = Array.from({ length: 15 }, (_, d) => { const x = new Date(); x.setDate(x.getDate() - d); return x; });
  const t0 = new Date(w.date);
  const withDay = (d: Date) => { const x = new Date(d); x.setHours(t0.getHours(), t0.getMinutes(), 0, 0); return x.toISOString(); };
  const sameDay = (a: string, b: Date) => new Date(a).toDateString() === b.toDateString();
  const label = new Date(date).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const exName = (eid: string) => st.findExercise(eid)?.name ?? 'Exercise';

  return (
    <Screen>
      <Header title="Edit Workout" onLeft={() => (dirty ? setAsk(true) : router.back())} right={<HeaderAction label="Save" primary onPress={save} disabled={busy} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" testID="edit-workout">
        <TextInput value={title} onChangeText={touch(setTitle)} placeholder="Workout title" placeholderTextColor={colors.faint} style={{ fontSize: 26, fontWeight: '700', color: colors.text, paddingVertical: 8 }} testID="edit-title" />
        <TextInput value={desc} onChangeText={touch(setDesc)} multiline placeholder="How did your workout go? Share some notes here..." placeholderTextColor={colors.faint} style={{ minHeight: 60, fontSize: 17, color: colors.text, textAlignVertical: 'top', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surface }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
          <Text style={{ color: colors.muted, flex: 1 }}>Duration (min)</Text>
          <View style={{ width: 90, backgroundColor: colors.surface, borderRadius: radius.sm }}><NumInput value={minutes} onChange={touch(setMinutes)} testID="edit-minutes" /></View>
          <Text style={{ color: colors.muted }}>{fmtDuration((minutes ?? 0) * 60)}</Text>
        </View>
        <Pressable onPress={() => setDateSheet(true)} style={row} testID="edit-date"><Ionicons name="calendar-outline" size={26} color={colors.text} /><Text style={lbl}>Date</Text><Text style={{ color: colors.muted }}>{label}</Text><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>
        <View style={row}><Ionicons name="location-outline" size={26} color={colors.text} /><TextInput value={place} onChangeText={touch(setPlace)} placeholder="Add location" placeholderTextColor={colors.muted} style={{ flex: 1, fontSize: 18, color: colors.text }} testID="edit-location" />{!!place && <Ionicons name="close" size={22} color={colors.muted} onPress={() => { setDirty(true); setPlace(''); }} />}</View>
        <Pressable onPress={() => setVisSheet(true)} style={row}><Ionicons name="eye-outline" size={26} color={colors.text} /><Text style={lbl}>Visibility</Text><Text style={{ color: colors.muted }}>{VIS.find((v) => v.id === vis)!.label}</Text><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>

        {entries.map((e, i) => (
          <View key={`${e.exerciseId}-${i}`} style={{ marginTop: 20 }} testID="edit-entry">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: colors.primary, fontSize: 17, fontWeight: '600' }}>{exName(e.exerciseId)}</Text>
              <Ionicons name="trash-outline" size={22} color={colors.danger} onPress={() => delEx(i)} />
            </View>
            {e.sets.map((x, j) => (
              <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Text style={{ width: 34, textAlign: 'center', fontWeight: '700', color: x.type === 'warmup' ? colors.warn : colors.text }}>{x.type === 'warmup' ? 'W' : x.type === 'failure' ? 'F' : x.type === 'drop' ? 'D' : e.sets.slice(0, j + 1).filter((y) => y.type === 'normal').length}</Text>
                <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}><NumInput decimal value={x.kg == null ? null : Math.round(toDisplayWeight(x.kg, u) * 10) / 10} onChange={(v) => patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, u) })} testID="edit-kg" /></View>
                <Text style={{ color: colors.muted }}>{u.weight}</Text>
                <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}><NumInput value={x.reps} onChange={(v) => patchSet(i, j, { reps: v })} testID="edit-reps" /></View>
                <Text style={{ color: colors.muted }}>reps</Text>
                <Ionicons name="close-circle-outline" size={24} color={colors.faint} onPress={() => delSet(i, j)} />
              </View>
            ))}
            <Btn title="Add Set" icon="add" variant="secondary" onPress={() => addSet(i)} style={{ marginTop: 6, minHeight: 40 }} />
          </View>
        ))}
      </ScrollView>
      <Sheet visible={visSheet} onClose={() => setVisSheet(false)} title="Who can see this">
        {VIS.map((v, i) => <ListRow key={v.id} label={v.label} last={i === VIS.length - 1} right={vis === v.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDirty(true); setVis(v.id); setVisSheet(false); }} />)}
      </Sheet>
      <Sheet visible={dateSheet} onClose={() => setDateSheet(false)} title="Date">
        <ScrollView style={{ maxHeight: 360 }}>
          {days.map((d, i) => <ListRow key={i} label={i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} last right={sameDay(date, d) ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDirty(true); setDate(withDay(d)); setDateSheet(false); }} />)}
        </ScrollView>
      </Sheet>
      <Dialog visible={ask} title="Discard changes?" message="Your edits to this workout won't be saved." onClose={() => setAsk(false)}
        actions={[{ label: 'Keep editing' }, { label: 'Discard', danger: true, onPress: () => { setAsk(false); router.back(); } }]} />
    </Screen>
  );
}
const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.surface };
const lbl = { flex: 1, fontSize: 18, color: colors.text };
