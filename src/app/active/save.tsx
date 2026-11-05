import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Dialog, Header, HeaderAction, ListRow, Screen, Sheet, Stat } from '../../components/ui';
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
    const w = await st.finishActive({ title: title.trim() || 'Workout', description: desc, visibility: vis, date: when.toISOString(), durationSec: dur });
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

  return (
    <Screen>
      <Header title="Save Workout" right={<HeaderAction label="Save" primary onPress={onSave} disabled={busy} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Workout title" placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 22, fontWeight: '700', color: colors.text }} testID="save-title" />
          {!!title && <Ionicons name="close-circle" size={22} color={colors.faint} onPress={() => setTitle('')} />}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stat label="Duration" value={fmtDuration(dur)} color={colors.primary} />
          <Stat label="Volume" value={fmtVolume(done.reduce((t, s) => t + setVolume(s), 0), profile.units)} />
          <Stat label="Sets" value={String(done.length)} />
        </View>
        <Pressable onPress={() => setWhenSheet(true)}><Text style={{ color: colors.muted, fontSize: 13 }}>When</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{when.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></Pressable>
        <Pressable onPress={pickPhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 12 }} /> : (
            <View style={{ width: 96, height: 96, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={30} color={colors.primary} /></View>
          )}
          <Text style={{ color: colors.text, fontSize: 16 }}>{photo ? 'Change photo' : 'Add a photo / video'}</Text>
        </Pressable>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Description</Text>
          <TextInput value={desc} onChangeText={setDesc} multiline placeholder="How did your workout go? Share some notes here..." placeholderTextColor={colors.faint} style={{ minHeight: 70, fontSize: 16, color: colors.text, textAlignVertical: 'top' }} />
        </View>
        <ListRow label="Visibility" detail={VIS.find((v) => v.id === vis)!.label} onPress={() => setVisSheet(true)} />
        <Btn title="Discard Workout" variant="ghost" onPress={() => setDiscard(true)} style={{ borderWidth: 0 }} />
      </ScrollView>
      <Sheet visible={visSheet} onClose={() => setVisSheet(false)} title="Who can see this">
        {VIS.map((v) => <ListRow key={v.id} label={v.label} last right={vis === v.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setVis(v.id); setVisSheet(false); }} />)}
      </Sheet>
      <Sheet visible={whenSheet} onClose={() => setWhenSheet(false)} title="When was the workout?">
        {[0, 1, 2, 3, 7].map((d) => <ListRow key={d} label={d === 0 ? 'Now' : d === 1 ? 'Yesterday' : `${d} days ago`} last right={daysAgo === d ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDaysAgo(d); setWhenSheet(false); }} />)}
      </Sheet>
      <Dialog visible={updAsk} title="Update routine?" message={`Your weights or reps differ from "${routine?.title ?? ''}". Keep the routine as it is, or update it with this workout?`} onClose={() => setUpdAsk(false)}
        actions={[{ label: 'Keep routine', onPress: () => { setUpdAsk(false); save(false); } }, { label: 'Update routine', primary: true, onPress: () => { setUpdAsk(false); save(true); } }]} />
      <Dialog visible={discard} title="Discard workout?" message="This workout won't be saved." onClose={() => setDiscard(false)}
        actions={[{ label: 'Cancel' }, { label: 'Discard', danger: true, onPress: () => { setDiscard(false); st.discardActive(); router.dismissTo('/'); } }]} />
    </Screen>
  );
}
