import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { Dialog, Header, HeaderAction, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { StartTimeWheels } from '../../components/WheelPicker';
import { fmtDuration, fmtStartTime, fmtVolume } from '../../lib/format';
import { setVolume } from '../../lib/stats';
import { elapsedSec, useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { SetRow, Workout } from '../../lib/types';

const VIS: { id: Workout['visibility']; label: string }[] = [{ id: 'everyone', label: 'Everyone' }, { id: 'followers', label: 'Followers' }, { id: 'private', label: 'Only me' }];

export default function SaveWorkout() {
  const st = useStore();
  const { active, profile } = st;
  const [title, setTitle] = useState(active?.title ?? 'Workout');
  const [desc, setDesc] = useState('');
  const [vis, setVis] = useState<Workout['visibility']>('everyone');
  const [visSheet, setVisSheet] = useState(false);
  const [whenSheet, setWhenSheet] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updAsk, setUpdAsk] = useState(false);
  const [place, setPlace] = useState(() => st.workouts.find((w) => w.location)?.location ?? '');
  const [locAsk, setLocAsk] = useState(false);
  const [locDraft, setLocDraft] = useState('');
  if (!active) return null;
  // exercícios escondidos só neste treino não contam (nem vão no treino salvo)
  const shown = active.entries.filter((e) => !e.hidden);
  const done = shown.flatMap((e) => e.sets.filter((s) => s.done));
  const volume = shown.reduce((t, e) => { const k = st.findExercise(e.exerciseId)?.kind; return t + e.sets.reduce((a, s) => a + (s.done ? setVolume(s, k) : 0), 0); }, 0);
  const dur = elapsedSec(active);
  const when = new Date(active.dateAt ?? active.startedAt);

  const keyOf = (id: string) => { const c = st.findExercise(id)?.catalogId; return c ? `cat:${c}` : id; };
  const routine = active.fromRoutineId ? st.routines.find((r) => r.id === active.fromRoutineId) ?? null : null;
  // a troca (Swap) vale só para este treino: o exercício trocado fica fora da comparação e da atualização (a rotina segue com o original, sem ganhar o substituto)
  const performed = shown.filter((e) => !e.swappedFrom).map((e) => ({ id: e.exerciseId, key: keyOf(e.exerciseId), restSec: e.restSec, unit: e.unit, sets: e.sets.filter((x) => x.done).map(({ done: _d, typed: _t, ...x }): SetRow => x) })).filter((e) => e.sets.length > 0);
  const sameSets = (a: SetRow[], b: SetRow[]) => a.length === b.length && a.every((x, k) => (x.kg ?? 0) === (b[k].kg ?? 0) && (x.reps ?? 0) === (b[k].reps ?? 0) && (x.seconds ?? 0) === (b[k].seconds ?? 0) && (x.distM ?? 0) === (b[k].distM ?? 0));
  const changed = !!routine && performed.some((p) => { const r = routine.exercises.find((x) => keyOf(x.exerciseId) === p.key); return !r || !sameSets(r.sets, p.sets); });

  const save = async (updateRoutine = false) => {
    setBusy(true);
    const w = await st.finishActive({ title: title.trim() || 'Workout', description: desc, visibility: vis, date: when.toISOString(), durationSec: dur, location: place.trim() || null });
    if (w && updateRoutine && routine) {
      // chaves calculadas ANTES de salvar; exercício novo entra com o id do próprio treino (um `cat:<id>` serve: o saveRoutine acha o exercício criado ao salvar)
      const exercises = routine.exercises.map((r) => { const p = performed.find((x) => x.key === keyOf(r.exerciseId)); return p ? { ...r, sets: p.sets } : r; });
      performed.filter((p) => !routine.exercises.some((r) => keyOf(r.exerciseId) === p.key)).forEach((p) => exercises.push({ exerciseId: p.id, notes: '', restSec: p.restSec, unit: p.unit, sets: p.sets }));
      await st.saveRoutine({ ...routine, exercises });
    }
    setBusy(false);
    if (w) { st.showToast('Workout saved!'); router.replace({ pathname: '/active/done', params: photo ? { id: w.id, photo } : { id: w.id } }); }
  };
  const onSave = () => (changed ? setUpdAsk(true) : save());
  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surface };
  return (
    <Screen>
      <Header title="Save Workout" right={<HeaderAction label="Save" primary onPress={onSave} disabled={busy} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Workout title" placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 28, fontWeight: '700', color: colors.text }} testID="save-title" />
          {!!title && <Pressable onPress={() => setTitle('')} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={20} color={colors.text} /></Pressable>}
        </View>
        <TextInput value={desc} onChangeText={setDesc} multiline placeholder="How did your workout go? Share some notes here..." placeholderTextColor={colors.faint} style={{ minHeight: 84, fontSize: 19, color: colors.text, textAlignVertical: 'top', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surface }} testID="save-desc" />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
          <Stat label="Duration" value={fmtDuration(dur)} color={colors.primary} />
          <Stat label="Volume" value={fmtVolume(volume, profile.units)} />
          <Stat label="Sets" value={String(done.length)} />
        </View>

        <Pressable onPress={pickPhoto} testID="save-photo" style={{ marginVertical: 18, height: 130, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Ionicons name="image-outline" size={30} color={colors.text} /><Text style={{ fontSize: 19, color: colors.text }}>Add a photo / video</Text></View>
          )}
        </Pressable>
        {!!photo && <Pressable onPress={() => setPhoto(null)} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 }}><Text style={{ color: colors.danger }}>Remove photo</Text></Pressable>}

        <Pressable onPress={() => setWhenSheet(true)} style={row} testID="save-date">
          <Ionicons name="calendar-outline" size={28} color={colors.text} />
          <Text style={{ flex: 1, fontSize: 19, color: colors.text }}>Date</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>{fmtStartTime(when)}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => { setLocDraft(place); setLocAsk(true); }} style={row} testID="save-location">
          <Ionicons name="location-outline" size={28} color={colors.text} />
          <Text style={{ flex: 1, fontSize: 19, color: place ? colors.text : colors.muted }} numberOfLines={1}>{place || 'Add location'}</Text>
          {place ? <Ionicons name="close" size={24} color={colors.muted} onPress={() => setPlace('')} /> : <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
        </Pressable>
        <Pressable onPress={() => setVisSheet(true)} style={row} testID="save-visibility">
          <Ionicons name="eye-outline" size={28} color={colors.text} />
          <Text style={{ flex: 1, fontSize: 19, color: colors.text }}>Visibility</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>{VIS.find((v) => v.id === vis)!.label}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => setDiscard(true)} style={{ alignItems: 'center', paddingVertical: 22 }} testID="save-discard"><Text style={{ color: colors.danger, fontSize: 19 }}>Discard Workout</Text></Pressable>
      </ScrollView>
      <Sheet visible={visSheet} onClose={() => setVisSheet(false)} title="Who can see this">
        {VIS.map((v) => <ListRow key={v.id} label={v.label} last right={vis === v.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setVis(v.id); setVisSheet(false); }} />)}
      </Sheet>
      <Sheet visible={whenSheet} onClose={() => setWhenSheet(false)} title="Date">
        <StartTimeWheels value={when} onChange={(d) => st.setStartTime(d.toISOString())} />
      </Sheet>
      <Dialog visible={locAsk} title="Location" hasInput onClose={() => setLocAsk(false)}
        actions={[{ label: 'Cancel', onPress: () => setLocAsk(false) }, { label: 'Save', primary: true, onPress: () => { setPlace(locDraft.trim()); setLocAsk(false); } }]}>
        <TextInput value={locDraft} onChangeText={setLocDraft} autoFocus placeholder="Gym or place name" placeholderTextColor={colors.faint} style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text }} testID="location-input" />
      </Dialog>
      <Dialog visible={updAsk} title="Update routine?" message={`Your weights or reps differ from "${routine?.title ?? ''}". Keep the routine as it is, or update it with this workout?`} onClose={() => setUpdAsk(false)}
        actions={[{ label: 'Keep routine', onPress: () => { setUpdAsk(false); save(false); } }, { label: 'Update routine', primary: true, onPress: () => { setUpdAsk(false); save(true); } }]} />
      <Dialog visible={discard} title="Discard workout?" message="This workout won't be saved." onClose={() => setDiscard(false)}
        actions={[{ label: 'Cancel' }, { label: 'Discard', danger: true, onPress: () => { setDiscard(false); st.discardActive(); router.dismissTo('/'); } }]} />
    </Screen>
  );
}
