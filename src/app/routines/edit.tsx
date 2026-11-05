import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { Banner, Btn, Dialog, Header, HeaderAction, IconButton, ListRow, Screen, Sheet } from '../../components/ui';
import { SET_TYPES } from '../../lib/constants';
import { fmtRest, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { setPickHandler } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { RoutineExercise, SetRow } from '../../lib/types';

const RESTS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export default function EditRoutine() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { routines, exercises, profile, saveRoutine, showToast } = useStore();
  const existing = routines.find((r) => r.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [items, setItems] = useState<RoutineExercise[]>(existing?.exercises ?? []);
  const [hint, setHint] = useState(!existing);
  const [typeSheet, setTypeSheet] = useState<{ i: number; j: number } | null>(null);
  const [restSheet, setRestSheet] = useState<number | null>(null);
  const [cancelAsk, setCancelAsk] = useState(false);
  const u = profile.units;
  const nameOf = (eid: string) => exercises.find((e) => e.id === eid);
  const patchSet = (i: number, j: number, p: Partial<SetRow>) => setItems((l) => l.map((e, k) => (k === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, ...p } : s)) } : e)));
  const valid = title.trim().length > 0 && items.length > 0;
  const add = () => { setPickHandler((ids) => setItems((l) => [...l, ...ids.map((eid): RoutineExercise => ({ exerciseId: eid, notes: '', restSec: 90, sets: [{ type: 'normal', kg: null, reps: null }] }))])); router.push('/exercises/pick'); };
  const save = async () => { const r = await saveRoutine({ id: existing?.id, title, notes: existing?.notes ?? '', exercises: items }); if (r) { showToast('Routine saved'); router.back(); } };
  const dirty = !!title || items.length > 0;

  return (
    <Screen>
      <Header left="cancel" onLeft={() => (dirty && !existing ? setCancelAsk(true) : router.back())} title={existing ? 'Edit routine' : 'Create routine'} right={<HeaderAction label="Save" primary disabled={!valid} onPress={save} />} />
      {hint && <Banner text="You're creating a routine. Tap for help..." onPress={() => router.push('/routines/help')} onClose={() => setHint(false)} />}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TextInput value={title} onChangeText={setTitle} placeholder="Routine title" placeholderTextColor={colors.faint} style={{ fontSize: 22, fontWeight: '600', padding: 16, color: colors.text }} testID="routine-title" />
        {items.length === 0 && (
          <View style={{ alignItems: 'center', padding: 24, gap: 14 }}>
            <Ionicons name="barbell-outline" size={44} color={colors.faint} />
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Start by adding an exercise to your routine.</Text>
          </View>
        )}
        {items.map((e, i) => (
          <View key={i} style={{ paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, color: colors.primary, fontSize: 17, fontWeight: '600' }}>{nameOf(e.exerciseId)?.name ?? 'Removed exercise'}</Text>
              <IconButton name="trash-outline" color={colors.danger} onPress={() => setItems((l) => l.filter((_, k) => k !== i))} />
            </View>
            <TextInput value={e.notes} onChangeText={(t) => setItems((l) => l.map((x, k) => (k === i ? { ...x, notes: t } : x)))} placeholder="Routine notes" placeholderTextColor={colors.faint} style={{ paddingHorizontal: 16, paddingVertical: 8, color: colors.text }} />
            <Pressable onPress={() => setRestSheet(i)} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}><Ionicons name="timer-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>Rest: {fmtRest(e.restSec)}</Text></Pressable>
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 4 }}>
              <Text style={[hd, { width: 44 }]}>SET</Text>
              {nameOf(e.exerciseId)?.kind !== 'reps' && nameOf(e.exerciseId)?.kind !== 'duration' && <Text style={[hd, { flex: 1 }]}>{u.weight.toUpperCase()}</Text>}
              <Text style={[hd, { flex: 1 }]}>{nameOf(e.exerciseId)?.kind === 'duration' ? 'SEC' : 'REPS'}</Text>
            </View>
            {e.sets.map((s, j) => {
              const t = SET_TYPES.find((x) => x.type === s.type)!;
              const lb = s.type === 'normal' ? String(e.sets.slice(0, j + 1).filter((x) => x.type === 'normal').length) : t.badge;
              return (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: j % 2 ? colors.surface : colors.bg }}>
                  <Pressable onPress={() => setTypeSheet({ i, j })} style={{ width: 44, alignItems: 'center', paddingVertical: 10 }}><Text style={{ color: s.type === 'normal' ? colors.text : t.color, fontWeight: '700' }}>{lb}</Text></Pressable>
                  {nameOf(e.exerciseId)?.kind !== 'reps' && nameOf(e.exerciseId)?.kind !== 'duration' && <View style={{ flex: 1 }}><NumInput decimal value={s.kg == null ? null : Math.round(toDisplayWeight(s.kg, u) * 10) / 10} onChange={(v) => patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, u) })} /></View>}
                  <View style={{ flex: 1 }}><NumInput value={s.reps} onChange={(v) => patchSet(i, j, { reps: v })} /></View>
                </View>
              );
            })}
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Btn title="Add set" icon="add" variant="secondary" onPress={() => setItems((l) => l.map((x, k) => (k === i ? { ...x, sets: [...x.sets, { type: 'normal', kg: x.sets.at(-1)?.kg ?? null, reps: x.sets.at(-1)?.reps ?? null }] } : x)))} /></View>
          </View>
        ))}
        <View style={{ padding: 16 }}><Btn title="Add exercise" icon="add" onPress={add} testID="routine-add-exercise" /></View>
      </ScrollView>
      <Sheet visible={!!typeSheet} onClose={() => setTypeSheet(null)} title="Set type">
        {SET_TYPES.map((t) => <ListRow key={t.type} label={t.label} last onPress={() => { patchSet(typeSheet!.i, typeSheet!.j, { type: t.type }); setTypeSheet(null); }} />)}
        <ListRow icon="close" label="Remove set" danger last onPress={() => { const { i, j } = typeSheet!; setItems((l) => l.map((x, k) => (k === i ? { ...x, sets: x.sets.filter((_, n) => n !== j) } : x))); setTypeSheet(null); }} />
      </Sheet>
      <Sheet visible={restSheet !== null} onClose={() => setRestSheet(null)} title="Rest timer">
        <ScrollView style={{ maxHeight: 320 }}>{RESTS.map((sec) => <ListRow key={sec} label={sec ? fmtRest(sec) : 'Off'} last onPress={() => { setItems((l) => l.map((x, k) => (k === restSheet ? { ...x, restSec: sec } : x))); setRestSheet(null); }} />)}</ScrollView>
      </Sheet>
      <Dialog visible={cancelAsk} title="Discard routine?" message="What you've entered will be lost." onClose={() => setCancelAsk(false)} actions={[{ label: 'Keep editing' }, { label: 'Discard', danger: true, onPress: () => { setCancelAsk(false); router.back(); } }]} />
    </Screen>
  );
}
const hd = { color: colors.muted, fontSize: 12, textAlign: 'center' as const };
