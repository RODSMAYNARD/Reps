import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { WorkoutCard } from '../../components/WorkoutCard';
import { WorkoutMenu } from '../../components/WorkoutMenu';
import { Avatar, Btn, Dialog, IconButton, Screen, Sheet } from '../../components/ui';
import { DEMO_ATHLETES as ATHLETES } from '../../lib/constants';
import { weekStreak } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

export default function Home() {
  const { workouts, startWorkout, session } = useStore();
  const [feed, setFeed] = useState<'home' | 'mine'>('home');
  const [menu, setMenu] = useState(false);
  const [watch, setWatch] = useState(true);
  const [watchDlg, setWatchDlg] = useState(false);
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState<string | null>(null);
  const streak = weekStreak(workouts);
  const pm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const pmKey = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`;
  const pmCount = workouts.filter((w) => { const d = new Date(w.date); return d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth(); }).length;
  const uid = session?.user.id;
  const [reportGone, setReportGone] = useState(true);
  useEffect(() => { if (uid) AsyncStorage.getItem(`reps:report-dismissed:${uid}`).then((v) => setReportGone(v === pmKey)).catch(() => setReportGone(false)); }, [uid, pmKey]);
  const dismissReport = () => { setReportGone(true); if (uid) AsyncStorage.setItem(`reps:report-dismissed:${uid}`, pmKey).catch(() => {}); };
  const list = workouts;

  const header = (
    <View>
      {watch && (
        <View style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, alignItems: 'center' }}>
          <Ionicons name="watch-outline" size={64} color={colors.text} />
          <Text style={{ fontWeight: '700', fontSize: 16, alignSelf: 'flex-start', color: colors.text }}>Sync with your watch</Text>
          <Text style={{ color: colors.muted, alignSelf: 'flex-start' }}>Log your workouts right from your wrist.</Text>
          <Btn title="Connect watch" onPress={() => setWatchDlg(true)} style={{ alignSelf: 'stretch' }} />
          <Btn title="Dismiss" variant="secondary" onPress={() => setWatch(false)} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      {pmCount > 0 && !reportGone && (
        <View style={{ padding: 16, gap: 8, borderBottomWidth: 8, borderBottomColor: colors.surface }} testID="report-card">
          <Text style={{ fontWeight: '800', fontSize: 20, color: colors.text }}>Your {pm.toLocaleDateString('en-US', { month: 'long' })} Monthly Report is ready!</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Get an overview of your workout data, milestones, and improvements from last month.</Text>
          <Btn title="View Report" onPress={() => router.push({ pathname: '/profile/report', params: { month: pmKey } })} />
          <Btn title="Dismiss" variant="secondary" onPress={dismissReport} />
        </View>
      )}
      {streak > 0 && (
        <View style={{ margin: 16, borderRadius: radius.lg, backgroundColor: colors.dangerSoft, padding: 20, gap: 4 }}>
          <Ionicons name="flame" size={44} color={colors.danger} />
          <Text style={{ fontSize: 56, fontWeight: '800', color: colors.text }}>{streak}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{streak === 1 ? 'Week streak' : 'Week streak'}</Text>
          <Text style={{ color: colors.text }}>You&apos;ve worked out consistently for {streak} {streak === 1 ? 'week' : 'weeks'}!</Text>
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
            <Btn title={follow[a.id] ? 'Following' : 'Follow'} variant={follow[a.id] ? 'secondary' : 'primary'} onPress={() => setFollow({ ...follow, [a.id]: !follow[a.id] })} style={{ alignSelf: 'stretch', minHeight: 38 }} />
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Follow people to see their workouts in your feed.</Text>
        <Btn title="Discover athletes" variant="secondary" onPress={() => router.push('/feed/discover')} />
        <Btn title="Connect contacts" variant="secondary" onPress={() => router.push('/feed/friends')} />
        <Btn title="Log my first workout" variant="ghost" onPress={() => { startWorkout(); router.push('/active'); }} />
      </View>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => setMenu(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm }}>
          <Text style={{ fontWeight: '500', color: colors.text }}>{feed === 'home' ? 'Home' : 'My Workouts'}</Text>
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
        <Btn title="Home" variant={feed === 'home' ? 'primary' : 'secondary'} style={{ marginBottom: 8 }} onPress={() => { setFeed('home'); setMenu(false); }} />
        <Btn title="My Workouts" variant={feed === 'mine' ? 'primary' : 'secondary'} onPress={() => { setFeed('mine'); setMenu(false); }} />
      </Sheet>
      <WorkoutMenu id={target} onClose={() => setTarget(null)} />
      <Dialog visible={watchDlg} title="Coming soon" message="Watch integration requires native apps and is coming in a future version." actions={[{ label: 'Ok', primary: true, onPress: () => setWatchDlg(false) }]} />
    </Screen>
  );
}
