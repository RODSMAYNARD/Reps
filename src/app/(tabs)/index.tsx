import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { WorkoutCard } from '../../components/WorkoutCard';
import { Avatar, Btn, Dialog, IconButton, Screen, Sheet } from '../../components/ui';
import { DEMO_ATHLETES as ATHLETES } from '../../lib/constants';
import { weekStreak } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

export default function Home() {
  const { workouts, deleteWorkout, startWorkout, showToast } = useStore();
  const [feed, setFeed] = useState<'home' | 'mine'>('home');
  const [menu, setMenu] = useState(false);
  const [watch, setWatch] = useState(true);
  const [watchDlg, setWatchDlg] = useState(false);
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState<string | null>(null);
  const streak = weekStreak(workouts);
  const list = workouts;

  const header = (
    <View>
      {watch && (
        <View style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, alignItems: 'center' }}>
          <Ionicons name="watch-outline" size={64} color={colors.text} />
          <Text style={{ fontWeight: '700', fontSize: 16, alignSelf: 'flex-start', color: colors.text }}>Sincronize com seu relógio</Text>
          <Text style={{ color: colors.muted, alignSelf: 'flex-start' }}>Registre seus treinos direto no pulso.</Text>
          <Btn title="Conectar relógio" onPress={() => setWatchDlg(true)} style={{ alignSelf: 'stretch' }} />
          <Btn title="Dispensar" variant="secondary" onPress={() => setWatch(false)} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      {streak > 0 && (
        <View style={{ margin: 16, borderRadius: radius.lg, backgroundColor: '#FDEDED', padding: 20, gap: 4 }}>
          <Ionicons name="flame" size={44} color={colors.danger} />
          <Text style={{ fontSize: 56, fontWeight: '800', color: colors.text }}>{streak}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{streak === 1 ? 'Semana seguida' : 'Semanas seguidas'}</Text>
          <Text style={{ color: colors.text }}>Você treina com constância há {streak} {streak === 1 ? 'semana' : 'semanas'}!</Text>
        </View>
      )}
    </View>
  );

  const empty = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {ATHLETES.map((a) => (
          <View key={a.id} style={{ width: 150, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, alignItems: 'center', gap: 8 }}>
            <Avatar name={a.name} size={64} />
            <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>{a.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{a.tag}</Text>
            <Btn title={follow[a.id] ? 'Seguindo' : 'Seguir'} variant={follow[a.id] ? 'secondary' : 'primary'} onPress={() => setFollow({ ...follow, [a.id]: !follow[a.id] })} style={{ alignSelf: 'stretch', minHeight: 38 }} />
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Siga pessoas para ver os treinos delas no seu feed.</Text>
        <Btn title="Descobrir atletas" variant="secondary" onPress={() => router.push('/feed/discover')} />
        <Btn title="Conectar contatos" variant="secondary" onPress={() => router.push('/feed/friends')} />
        <Btn title="Registrar meu primeiro treino" variant="ghost" onPress={() => { startWorkout(); router.push('/active'); }} />
      </View>
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => setMenu(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm }}>
          <Text style={{ fontWeight: '500', color: colors.text }}>{feed === 'home' ? 'Início' : 'Meus treinos'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <IconButton name="search" onPress={() => router.push('/feed/friends')} testID="home-search" />
          <IconButton name="notifications-outline" onPress={() => router.push('/feed/notifications')} testID="home-bell" />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <WorkoutCard w={item} onMenu={() => setTarget(item.id)} />}
      />
      <ActiveBar />
      <Sheet visible={menu} onClose={() => setMenu(false)} title="Feed">
        <Btn title="Início" variant={feed === 'home' ? 'primary' : 'secondary'} style={{ marginBottom: 8 }} onPress={() => { setFeed('home'); setMenu(false); }} />
        <Btn title="Meus treinos" variant={feed === 'mine' ? 'primary' : 'secondary'} onPress={() => { setFeed('mine'); setMenu(false); }} />
      </Sheet>
      <Sheet visible={!!target} onClose={() => setTarget(null)}>
        <Btn title="Abrir treino" variant="secondary" style={{ marginBottom: 8 }} onPress={() => { const id = target!; setTarget(null); router.push({ pathname: '/feed/workout/[id]', params: { id } }); }} />
        <Btn title="Excluir treino" variant="danger" onPress={() => { deleteWorkout(target!); setTarget(null); showToast('Treino excluído'); }} />
      </Sheet>
      <Dialog visible={watchDlg} title="Em breve" message="A integração com relógios depende de apps nativos e chega numa próxima versão." actions={[{ label: 'Ok', primary: true, onPress: () => setWatchDlg(false) }]} />
    </Screen>
  );
}
