import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '../../components/Text';
import { ActiveBar } from '../../components/ActiveBar';
import { RecoveryCard } from '../../components/HealthCards';
import { WorkoutCard } from '../../components/WorkoutCard';
import { WorkoutMenu } from '../../components/WorkoutMenu';
import { Btn, IconButton, Screen } from '../../components/ui';
import { FEATURES } from '../../lib/constants';
import { StreakRow } from '../../components/StreakRow';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { HomeNotices } from '../../components/HomeNotices';

/** Aba Social (feed dos treinos): fora da v1, escondida no _layout (href: null). Volta na v2. */
export default function Social() {
  const { workouts, startWorkout } = useStore();
  const [target, setTarget] = useState<string | null>(null);
  const list = workouts;

  const header = (
    <View>
      <HomeNotices style={{ marginHorizontal: 16, marginBottom: 12 }} />
      {FEATURES.watch && false && (
        <View style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, alignItems: 'center' }}>
          <Ionicons name="watch-outline" size={64} color={colors.text} />
          <Text style={{ fontWeight: '700', fontSize: 16, alignSelf: 'flex-start', color: colors.text }}>Sync with your watch</Text>
          <Text style={{ color: colors.muted, alignSelf: 'flex-start' }}>Log your workouts right from your wrist.</Text>

        </View>
      )}
      <RecoveryCard style={{ marginHorizontal: 16, marginBottom: 12 }} />
      <StreakRow style={{ marginHorizontal: 16, marginVertical: 8 }} />
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
        <Text style={{ fontWeight: '700', fontSize: 20, color: colors.text }}>Social</Text>
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
