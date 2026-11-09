import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { ActiveBar } from '../../components/ActiveBar';
import { Btn, Card, Dialog, Header, IconButton, ListRow, Screen, Section, Sheet, Tile } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { Routine } from '../../lib/types';

export default function Treino() {
  const { trainer, routines, exercises, active, startWorkout, discardActive, deleteRoutine, saveRoutine, showToast } = useStore();
  const [menu, setMenu] = useState<Routine | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => void } | null>(null);
  const [ask, setAsk] = useState<'replace' | null>(null);
  const [pending, setPending] = useState<Routine | null | undefined>(undefined);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? '—';

  const start = (r?: Routine | null) => {
    if (active) { setPending(r ?? null); setAsk('replace'); return; }
    startWorkout({ routine: r ?? null });
    router.push('/active');
  };

  return (
    <Screen edges={['top']}>
      <Header title="Workout" left="none" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Pressable onPress={() => router.navigate('/plano')} testID="open-trainer" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.black, padding: 16, borderRadius: radius.md, marginBottom: 6 }}>
          <Ionicons name="sparkles" size={26} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Trainer</Text>
            <Text style={{ color: '#C9CFD8' }}>{trainer ? `Next: ${trainer.workouts.find((w) => w.uid === trainer.nextUid)?.title ?? trainer.workouts[0]?.title}` : 'Your personalized program'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Quick Start</Text>
        <Pressable onPress={() => start(null)} testID="start-empty" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, padding: 16, borderRadius: radius.md }}>
          <Text style={{ fontSize: 22, color: colors.text }}>＋</Text><Text style={{ fontSize: 16, color: colors.text }}>Start Empty Workout</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 14 }}>Routines</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="clipboard-outline" label="New Routine" onPress={() => router.push('/routines/edit')} />
          <Tile icon="search-outline" label="Explore Routines" onPress={() => router.push('/routines/explore')} />
        </View>
        <Pressable onPress={() => router.push('/routines/generate')} testID="open-generate" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.md }}>
          <Text style={{ fontSize: 20 }}>✨</Text><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Generate workout plan</Text><Text style={{ color: colors.muted }}>Pick a goal, days and equipment</Text></View>
        </Pressable>
        {routines.length > 0 && <Section title={`My routines (${routines.length})`} />}
        {routines.map((r) => (
          <Card key={r.id} onPress={() => router.push({ pathname: '/routines/[id]', params: { id: r.id } })} style={{ gap: 6, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text, flex: 1 }}>{r.title}</Text>
              <IconButton name="ellipsis-horizontal" onPress={() => setMenu(r)} />
            </View>
            <Text style={{ color: colors.muted }} numberOfLines={2}>{r.exercises.map((e) => nameOf(e.exerciseId)).join(', ') || 'No exercises'}</Text>
            <Btn title="Start Routine" onPress={() => start(r)} style={{ minHeight: 40, marginTop: 4 }} />
          </Card>
        ))}
        <Pressable onPress={() => router.push('/settings/guide')} style={{ backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>How to get started</Text><Text style={{ fontSize: 20 }}>→</Text>
        </Pressable>
      </ScrollView>
      <ActiveBar />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        <ListRow icon="play-outline" label="Start Routine" onPress={() => { const r = menu!; setMenu(null); start(r); }} />
        <ListRow icon="create-outline" label="Edit Routine" onPress={() => { const r = menu!; setMenu(null); router.push({ pathname: '/routines/edit', params: { id: r.id } }); }} />
        <ListRow icon="copy-outline" label="Duplicate Routine" onPress={async () => { const r = menu!; setMenu(null); await saveRoutine({ title: `${r.title} (copy)`, notes: r.notes, exercises: r.exercises }); showToast('Routine duplicated'); }} />
        <ListRow icon="trash-outline" label="Delete Routine" danger last onPress={() => { const r = menu!; setMenu(null); setConfirm({ title: 'Delete routine?', message: `"${r.title}" will be deleted. This can't be undone.`, label: 'Delete', run: () => { deleteRoutine(r.id); showToast('Routine deleted'); } }); }} />
      </Sheet>
      <Dialog visible={ask === 'replace'} title="A workout is already in progress" message="Discard the current workout and start a new one?" onClose={() => setAsk(null)}
        actions={[{ label: 'Back to workout', onPress: () => { setAsk(null); router.push('/active'); } }, { label: 'Discard and start', danger: true, onPress: () => { discardActive(); startWorkout({ routine: pending ?? null }); setAsk(null); router.push('/active'); } }]} />
      <Dialog visible={!!confirm} title={confirm?.title} message={confirm?.message} onClose={() => setConfirm(null)} actions={[{ label: 'Cancel' }, { label: confirm?.label ?? 'OK', danger: true, onPress: () => { const c = confirm; setConfirm(null); c?.run(); } }]} />
    </Screen>
  );
}
