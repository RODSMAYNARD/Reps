import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Avatar, Dialog, Header, IconButton, ListRow, Screen, Section, Sheet, Stat } from '../../../components/ui';
import { fmtDateTime, fmtDuration, fmtVolume, fmtWeight } from '../../../lib/format';
import { muscleDistribution, workoutSets, workoutVolume } from '../../../lib/stats';
import { useStore } from '../../../lib/store';
import { colors } from '../../../lib/theme';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, exercises, profile, startWorkout, active, saveRoutine, deleteWorkout, showToast } = useStore();
  const w = workouts.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [del, setDel] = useState(false);
  const [liked, setLiked] = useState(false);
  if (!w) return <Screen><Header title="Detalhe do treino" /></Screen>;
  const u = profile.units;
  const dist = muscleDistribution([w], exercises);
  const nameOf = (eid: string) => exercises.find((e) => e.id === eid)?.name ?? 'Exercício removido';
  const copy = () => { setMenu(false); if (active) return showToast('Termine ou descarte o treino atual primeiro.'); startWorkout({ entries: w.entries, title: w.title }); router.push('/active'); };
  const asRoutine = async () => { setMenu(false); const r = await saveRoutine({ title: w.title, notes: '', exercises: w.entries.map((e) => ({ exerciseId: e.exerciseId, notes: e.notes, restSec: e.restSec, sets: e.sets, superset: e.superset })) }); if (r) showToast('Salvo como rotina'); };
  return (
    <Screen>
      <Header title="Detalhe do treino" right={<>
        <IconButton name="share-outline" onPress={() => Share.share({ message: `${w.title} — ${fmtDuration(w.durationSec)}, ${fmtVolume(workoutVolume(w), u)} no Reps` })} />
        <IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} testID="detail-menu" />
      </>} />
      <ScrollView>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Avatar name={profile.displayName || profile.username} />
            <View><Text style={{ fontWeight: '600', color: colors.text }}>{profile.displayName || profile.username}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{fmtDateTime(w.date)}</Text></View>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{w.title}</Text>
          {!!w.description && <Text style={{ color: colors.text }}>{w.description}</Text>}
          <View style={{ flexDirection: 'row', gap: 28 }}><Stat label="Tempo" value={fmtDuration(w.durationSec)} /><Stat label="Volume" value={fmtVolume(workoutVolume(w), u)} /><Stat label="Séries" value={String(workoutSets(w))} /></View>
          <View style={{ flexDirection: 'row', gap: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setLiked(!liked)}><Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={24} color={liked ? colors.primary : colors.text} /></Pressable>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} onPress={() => showToast('Comentários chegam com o recurso social.')} />
          </View>
        </View>
        <Section title="Distribuição muscular" />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {(more ? dist : dist.slice(0, 3)).map((d) => (
            <View key={d.name} style={{ gap: 4 }}>
              <Text style={{ color: colors.text }}>{d.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ height: 14, width: `${Math.max(2, d.pct) * 0.8}%`, backgroundColor: colors.primary, borderRadius: 3 }} /><Text style={{ color: colors.muted }}>{d.pct}%</Text></View>
            </View>
          ))}
          {dist.length > 3 && <Text onPress={() => setMore(!more)} style={{ color: colors.primary }}>{more ? 'Mostrar menos' : 'Mostrar mais'}</Text>}
        </View>
        <Section title="Treino" />
        {w.entries.map((e, i) => (
          <View key={i} style={{ paddingBottom: 10 }}>
            {e.superset != null && <Text style={{ alignSelf: 'flex-start', marginLeft: 16, backgroundColor: colors.purple, color: '#fff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' }}>Superset</Text>}
            <Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.exerciseId } })} style={{ color: colors.primary, fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 6 }}>{nameOf(e.exerciseId)}</Text>
            {e.notes ? <Text style={{ paddingHorizontal: 16, color: colors.muted }}>{e.notes}</Text> : null}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16 }}><Text style={{ width: 50, color: colors.muted, fontSize: 12 }}>SÉRIE</Text><Text style={{ color: colors.muted, fontSize: 12 }}>PESO E REPS</Text></View>
            {e.sets.map((s, j) => <View key={j} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: j % 2 ? colors.surface : colors.bg }}><Text style={{ width: 50, fontWeight: '600', color: s.type === 'warmup' ? colors.warn : colors.text }}>{s.type === 'warmup' ? 'A' : s.type === 'failure' ? 'F' : s.type === 'drop' ? 'D' : e.sets.slice(0, j + 1).filter((x) => x.type === 'normal').length}</Text><Text style={{ color: colors.text }}>{fmtWeight(s.kg ?? 0, u)} × {s.reps} reps</Text></View>)}
          </View>
        ))}
      </ScrollView>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListRow icon="download-outline" label="Salvar como rotina" onPress={asRoutine} />
        <ListRow icon="copy-outline" label="Copiar treino" onPress={copy} />
        <ListRow icon="alert-circle-outline" label="Reportar treino" danger onPress={() => { setMenu(false); router.push({ pathname: '/feed/report', params: { id: w.id } }); }} />
        <ListRow icon="trash-outline" label="Excluir treino" danger last onPress={() => { setMenu(false); setDel(true); }} />
      </Sheet>
      <Dialog visible={del} title="Excluir treino?" message="Essa ação não pode ser desfeita." onClose={() => setDel(false)} actions={[{ label: 'Cancelar' }, { label: 'Excluir', danger: true, onPress: async () => { setDel(false); await deleteWorkout(w.id); router.back(); } }]} />
    </Screen>
  );
}
