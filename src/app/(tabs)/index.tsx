import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { WorkoutCard } from '../../components/WorkoutCard';
import { WorkoutMenu } from '../../components/WorkoutMenu';
import { Btn, IconButton, Screen } from '../../components/ui';
import { FEATURES } from '../../lib/constants';
import { weekStreak } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

export default function Home() {
  const { workouts, startWorkout, session, offline, pendingCount } = useStore();
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
      {(offline || pendingCount > 0) && (
        <View testID="offline-banner" style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={offline ? 'cloud-offline-outline' : 'cloud-upload-outline'} size={22} color={colors.muted} />
          <Text style={{ flex: 1, color: colors.text }}>
            {offline ? 'You are offline. Showing data saved on this device.' : ''}
            {offline && pendingCount > 0 ? ' ' : ''}
            {pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? 'workout is' : 'workouts are'} waiting to upload.` : ''}
          </Text>
        </View>
      )}
      {FEATURES.watch && false && (
        <View style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, alignItems: 'center' }}>
          <Ionicons name="watch-outline" size={64} color={colors.text} />
          <Text style={{ fontWeight: '700', fontSize: 16, alignSelf: 'flex-start', color: colors.text }}>Sync with your watch</Text>
          <Text style={{ color: colors.muted, alignSelf: 'flex-start' }}>Log your workouts right from your wrist.</Text>

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
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Week streak</Text>
          <Text style={{ color: colors.text }}>You&apos;ve worked out consistently for {streak} {streak === 1 ? 'week' : 'weeks'}!</Text>
        </View>
      )}
    </View>
  );

  const empty = (
    <View style={{ padding: 24, gap: 10 }}>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>Your workouts will show up here.</Text>
      <Btn title="Log my first workout" onPress={() => { startWorkout(); router.push('/active'); }} />
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontWeight: '700', fontSize: 20, color: colors.text }}>Home</Text>
        {FEATURES.social && (
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <IconButton name="search" onPress={() => router.push('/feed/friends')} testID="home-search" />
            <IconButton name="notifications-outline" onPress={() => router.push('/feed/notifications')} testID="home-bell" />
          </View>
        )}
      </View>
      <FlatList
        data={list}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <WorkoutCard w={item} onMenu={() => setTarget(item.id)} />}
      />
      <ActiveBar />
      <WorkoutMenu id={target} onClose={() => setTarget(null)} />
    </Screen>
  );
}
