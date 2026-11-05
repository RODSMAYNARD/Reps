import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';
import { fmtDuration, fmtVolume } from '../lib/format';
import { workoutVolume } from '../lib/stats';
import { useStore } from '../lib/store';
import { Dialog, ListRow, Sheet } from './ui';

/** Menu ⋯ de um treino salvo: compartilhar, salvar como rotina, copiar, editar e apagar (com confirmação). */
export function WorkoutMenu({ id, onClose, extra, onDeleted }: { id: string | null; onClose: () => void; extra?: React.ReactNode; onDeleted?: () => void }) {
  const st = useStore();
  const [delId, setDelId] = useState<string | null>(null);
  const w = st.workouts.find((x) => x.id === id);
  const share = () => { if (!w) return; onClose(); Share.share({ message: `${w.title} — ${fmtDuration(w.durationSec)}, ${fmtVolume(workoutVolume(w), st.profile.units)} on Reps` }).catch(() => {}); };
  const asRoutine = async () => {
    if (!w) return;
    onClose();
    const r = await st.saveRoutine({ title: w.title, notes: '', exercises: w.entries.map((e) => ({ exerciseId: e.exerciseId, notes: e.notes, restSec: e.restSec, sets: e.sets, superset: e.superset })) });
    if (r) st.showToast('Saved as routine');
  };
  const copy = () => {
    if (!w) return;
    onClose();
    if (st.active) return st.showToast('Finish or discard your current workout first.');
    st.startWorkout({ entries: w.entries, title: w.title });
    router.push('/active');
  };
  const edit = () => { if (!w) return; onClose(); router.push({ pathname: '/feed/workout/edit', params: { id: w.id } }); };
  return (
    <>
      <Sheet visible={!!w} onClose={onClose}>
        <ListRow icon="share-outline" label="Share Workout" onPress={share} testID="wm-share" />
        <ListRow icon="download-outline" label="Save as Routine" onPress={asRoutine} testID="wm-routine" />
        <ListRow icon="copy-outline" label="Copy Workout" onPress={copy} testID="wm-copy" />
        <ListRow icon="create-outline" label="Edit Workout" onPress={edit} testID="wm-edit" />
        {extra}
        <ListRow icon="close" label="Delete Workout" danger last onPress={() => { setDelId(w?.id ?? null); onClose(); }} testID="wm-delete" />
      </Sheet>
      <Dialog visible={!!delId} title="Delete workout?" message="This workout and its sets are removed for good." onClose={() => setDelId(null)}
        actions={[{ label: 'Cancel', onPress: () => setDelId(null) }, { label: 'Delete', danger: true, onPress: () => { const x = delId!; setDelId(null); st.deleteWorkout(x); st.showToast('Workout deleted'); onDeleted?.(); } }]} />
    </>
  );
}
