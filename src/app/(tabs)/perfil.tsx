import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { WorkoutCard } from '../../components/WorkoutCard';
import { Avatar, BarChart, Dialog, Header, HeaderAction, IconButton, PillRow, Screen, Section, Tile } from '../../components/ui';
import { fmtDuration } from '../../lib/format';
import { startOfWeek, weeklySeries } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Perfil() {
  const { profile, workouts, deleteWorkout } = useStore();
  const [metric, setMetric] = useState<'duration' | 'volume' | 'reps'>('duration');
  const [del, setDel] = useState<string | null>(null);
  const series = weeklySeries(workouts, metric, 12);
  const thisWeek = workouts.filter((w) => new Date(w.date) >= startOfWeek());
  const headline = metric === 'duration' ? fmtDuration(thisWeek.reduce((t, w) => t + w.durationSec, 0)) : metric === 'volume' ? `${Math.round(series.at(-1)?.value ?? 0)} ${profile.units.weight}` : `${Math.round(series.at(-1)?.value ?? 0)} reps`;
  const name = profile.displayName || profile.username;
  return (
    <Screen edges={['top']}>
      <Header left="none" leftNode={<HeaderAction label="Edit Profile" onPress={() => router.push('/profile/edit')} />} title={profile.username}
        right={<>
          <IconButton name="share-outline" onPress={() => Share.share({ message: `Follow @${profile.username} on Reps` })} />
          <IconButton name="settings-outline" onPress={() => router.push('/settings')} testID="open-settings" />
        </>} />
      <ScrollView>
        <View style={{ flexDirection: 'row', gap: 16, padding: 16, alignItems: 'center' }}>
          <Avatar name={name} size={84} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[['Workouts', String(workouts.length), '/profile/calendar'], ['Followers', '0', '/feed/friends'], ['Following', '0', '/feed/friends']].map(([l, v, to]) => (
                <Text key={l} onPress={() => router.push(to as never)} style={{ color: colors.muted }}>{l}{'\n'}<Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{v}</Text></Text>
              ))}
            </View>
          </View>
        </View>
        {!!profile.bio && <Text style={{ paddingHorizontal: 16, color: colors.text }}>{profile.bio}</Text>}
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 17, color: colors.text }}><Text style={{ fontWeight: '700' }}>{headline}</Text> this week</Text>
          <BarChart data={series} highlightLast format={(v) => (metric === 'duration' ? (v < 1 ? `${Math.round(v * 60)} min` : `${Math.round(v * 10) / 10} h`) : String(Math.round(v)))} />
        </View>
        <PillRow value={metric} onChange={(m) => setMetric(m as typeof metric)} items={[{ id: 'duration', label: 'Duration' }, { id: 'volume', label: 'Volume' }, { id: 'reps', label: 'Reps' }]} />
        <Section title="Dashboard" />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Tile icon="trending-up-outline" label="Statistics" onPress={() => router.push('/profile/stats')} />
            <Tile icon="barbell-outline" label="Exercises" onPress={() => router.navigate('/exercicios')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Tile icon="body-outline" label="Measures" onPress={() => router.push('/profile/measures')} />
            <Tile icon="calendar-outline" label="Calendar" onPress={() => router.push('/profile/calendar')} />
          </View>
        </View>
        <Section title="Workouts" />
        {workouts.length === 0 && <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>No workouts logged yet.</Text>}
        {workouts.map((w) => <WorkoutCard key={w.id} w={w} onMenu={() => setDel(w.id)} />)}
      </ScrollView>
      <ActiveBar />
      <Dialog visible={!!del} title="Delete workout?" message="This action can't be undone." onClose={() => setDel(null)} actions={[{ label: 'Cancel' }, { label: 'Delete', danger: true, onPress: () => { deleteWorkout(del!); setDel(null); } }]} />
    </Screen>
  );
}
