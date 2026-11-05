import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Dialog, Header, HeaderAction, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { fmtDuration, fmtVolume } from '../../lib/format';
import { setVolume } from '../../lib/stats';
import { elapsedSec, useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { Workout } from '../../lib/types';

const VIS: { id: Workout['visibility']; label: string }[] = [{ id: 'everyone', label: 'Everyone' }, { id: 'followers', label: 'Followers' }, { id: 'private', label: 'Only me' }];

export default function SaveWorkout() {
  const st = useStore();
  const { active, profile } = st;
  const [title, setTitle] = useState(active?.title ?? 'Workout');
  const [desc, setDesc] = useState('');
  const [vis, setVis] = useState<Workout['visibility']>('everyone');
  const [visSheet, setVisSheet] = useState(false);
  const [whenSheet, setWhenSheet] = useState(false);
  const [daysAgo, setDaysAgo] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updAsk, setUpdAsk] = useState(false);
  const [place, setPlace] = useState(() => st.workouts.find((w) => w.location)?.location ?? '');
  const [locAsk, setLocAsk] = useState(false);
  const [locDraft, setLocDraft] = useState('');
  const [nowTs] = useState(() => Date.now());
  if (!active) return null;
  const done = active.entries.flatMap((e) => e.sets.filter((s) => s.done));
  const dur = elapsedSec(active);
  const when = new Date(nowTs - daysAgo * 86400000);

  const keyOf = (id: string) => { const c = st.findExercise(id)?.catalogId; return c ? `cat:${c}` : id; };
  const routine = active.fromRoutineId ? st.routines.find((r) => r.id === active.fromRoutineId) ?? null : null;
  const performed = active.entries.filter((e) => !e.hidden).map((e) => ({ key: keyOf(e.exerciseId), sets: e.sets.filter((x) => x.done).map(({ done: _d, ...x }) => x) })).filter((e) => e.sets.length > 0);
  const sameSets = (a: { kg: number | null; reps: number | null }[], b: { kg: number | null; reps: number | null }[]) => a.length === b.length && a.every((x, k) => (x.kg ?? 0) === (b[k].kg ?? 0) && (x.reps ?? 0) === (b[k].reps ?? 0));
  const changed = !!routine && performed.some((p) => { const r = routine.exercises.find((x) => keyOf(x.exerciseId) === p.key); return !r || !sameSets(r.sets, p.sets); });

  const save = async (updateRoutine = false) => {
    setBusy(true);
    const w = await st.finishActive({ title: title.trim() || 'Workout', description: desc, visibility: vis, date: when.toISOString(), durationSec: dur, location: place.trim() || null });
    if (w && updateRoutine && routine) {
      const exercises = routine.exercises.map((r) => { const p = performed.find((x) => x.key === keyOf(r.exerciseId)); return p ? { ...r, sets: p.sets } : r; });
      performed.filter((p) => !routine.exercises.some((r) => keyOf(r.exerciseId) === p.key)).forEach((p) => {
        const en = w.entries.find((e) => keyOf(e.exerciseId) === p.key);
        if (en) exercises.push({ exerciseId: en.exerciseId, notes: '', restSec: en.restSec, sets: p.sets });
      });
      await st.saveRoutine({ ...routine, exercises });
    }
    setBusy(false);
    if (w) { st.showToast('Workout saved!'); router.replace({ pathname: '/active/done', params: { id: w.id } }); }
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
          <Stat label="Volume" value={fmtVolume(done.reduce((t, x) => t + setVolume(x), 0), profile.units)} />
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
          <Text style={{ color: colors.muted, fontSize: 16 }}>{when.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
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
      <Sheet visible={whenSheet} onClose={() => setWhenSheet(false)} title="When was the workout?">
        {[0, 1, 2, 3, 7].map((d) => <ListRow key={d} label={d === 0 ? 'Now' : d === 1 ? 'Yesterday' : `${d} days ago`} last right={daysAgo === d ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDaysAgo(d); setWhenSheet(false); }} />)}
      </Sheet>
      <Dialog visible={locAsk} title="Location" onClose={() => setLocAsk(false)}
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
