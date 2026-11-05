import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { Btn, Card, Dialog, Header, IconButton, ListRow, Screen, Section, Sheet, Tile } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { Routine } from '../../lib/types';

export default function Treino() {
  const { routines, exercises, active, startWorkout, discardActive, deleteRoutine, saveRoutine, showToast } = useStore();
  const [menu, setMenu] = useState<Routine | null>(null);
  const [ask, setAsk] = useState<'replace' | null>(null);
  const [pending, setPending] = useState<Routine | null | undefined>(undefined);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? '—';

  const start = (r?: Routine | null) => {
    if (active) { setPending(r ?? null); setAsk('replace'); return; }
    startWorkout({ routine: r ?? null });
    router.push('/active');
  };

  return (
    <Screen>
      <Header title="Treino" left="none" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Início rápido</Text>
        <Pressable onPress={() => start(null)} testID="start-empty" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, padding: 16, borderRadius: radius.md }}>
          <Text style={{ fontSize: 22, color: colors.text }}>＋</Text><Text style={{ fontSize: 16, color: colors.text }}>Iniciar treino vazio</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 14 }}>Rotinas</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="clipboard-outline" label="Nova rotina" onPress={() => router.push('/routines/edit')} />
          <Tile icon="search-outline" label="Explorar rotinas" onPress={() => router.push('/routines/explore')} />
        </View>
        {routines.length > 0 && <Section title={`Minhas rotinas (${routines.length})`} />}
        {routines.map((r) => (
          <Card key={r.id} onPress={() => router.push({ pathname: '/routines/[id]', params: { id: r.id } })} style={{ gap: 6, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text, flex: 1 }}>{r.title}</Text>
              <IconButton name="ellipsis-horizontal" onPress={() => setMenu(r)} />
            </View>
            <Text style={{ color: colors.muted }} numberOfLines={2}>{r.exercises.map((e) => nameOf(e.exerciseId)).join(', ') || 'Sem exercícios'}</Text>
            <Btn title="Iniciar rotina" onPress={() => start(r)} style={{ minHeight: 40, marginTop: 4 }} />
          </Card>
        ))}
        <Pressable onPress={() => router.push('/settings/guide')} style={{ backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>Como começar</Text><Text style={{ fontSize: 20 }}>→</Text>
        </Pressable>
      </ScrollView>
      <ActiveBar />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        <ListRow icon="play-outline" label="Iniciar rotina" onPress={() => { const r = menu!; setMenu(null); start(r); }} />
        <ListRow icon="create-outline" label="Editar rotina" onPress={() => { const r = menu!; setMenu(null); router.push({ pathname: '/routines/edit', params: { id: r.id } }); }} />
        <ListRow icon="copy-outline" label="Duplicar rotina" onPress={async () => { const r = menu!; setMenu(null); await saveRoutine({ title: `${r.title} (cópia)`, notes: r.notes, exercises: r.exercises }); showToast('Rotina duplicada'); }} />
        <ListRow icon="trash-outline" label="Excluir rotina" danger last onPress={() => { const r = menu!; setMenu(null); deleteRoutine(r.id); showToast('Rotina excluída'); }} />
      </Sheet>
      <Dialog visible={ask === 'replace'} title="Já existe um treino em andamento" message="Quer descartar o treino atual e começar outro?" onClose={() => setAsk(null)}
        actions={[{ label: 'Voltar ao treino', onPress: () => { setAsk(null); router.push('/active'); } }, { label: 'Descartar e iniciar', danger: true, onPress: () => { discardActive(); startWorkout({ routine: pending ?? null }); setAsk(null); router.push('/active'); } }]} />
    </Screen>
  );
}
