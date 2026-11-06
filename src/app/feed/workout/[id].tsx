import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { ExerciseLabel } from '../../../components/ExerciseLabel';
import { WorkoutMenu } from '../../../components/WorkoutMenu';
import { Avatar, Header, IconButton, ListRow, Screen, Section, Stat } from '../../../components/ui';
import { fmtDateTime, fmtDuration, fmtVolume, fmtWeight } from '../../../lib/format';
import { muscleDistribution, workoutSets, workoutVolume } from '../../../lib/stats';
import { useStore } from '../../../lib/store';
import { colors } from '../../../lib/theme';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, exercises, profile, showToast } = useStore();
  const w = workouts.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [liked, setLiked] = useState(false);
  if (!w) return <Screen><Header title="Workout detail" /></Screen>;
  const u = profile.units;
  const dist = muscleDistribution([w], exercises);
  return (
    <Screen>
      <Header title="Workout detail" right={<>
        <IconButton name="share-outline" onPress={() => Share.share({ message: `${w.title} — ${fmtDuration(w.durationSec)}, ${fmtVolume(workoutVolume(w), u)} on Reps` })} />
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
          <View style={{ flexDirection: 'row', gap: 28 }}><Stat label="Time" value={fmtDuration(w.durationSec)} /><Stat label="Volume" value={fmtVolume(workoutVolume(w), u)} /><Stat label="Sets" value={String(workoutSets(w))} /></View>
          <View style={{ flexDirection: 'row', gap: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setLiked(!liked)}><Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={24} color={liked ? colors.primary : colors.text} /></Pressable>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} onPress={() => showToast('Comments are coming with the social features.')} />
          </View>
        </View>
        <Section title="Muscle distribution" />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {(more ? dist : dist.slice(0, 3)).map((d) => (
            <View key={d.name} style={{ gap: 4 }}>
              <Text style={{ color: colors.text }}>{d.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ height: 14, width: `${Math.max(2, d.pct) * 0.8}%`, backgroundColor: colors.primary, borderRadius: 3 }} /><Text style={{ color: colors.muted }}>{d.pct}%</Text></View>
            </View>
          ))}
          {dist.length > 3 && <Text onPress={() => setMore(!more)} style={{ color: colors.primary }}>{more ? 'Show less' : 'Show more'}</Text>}
        </View>
        <Section title="Workout" />
        {w.entries.map((e, i) => (
          <View key={i} style={{ paddingBottom: 10 }}>
            {e.superset != null && <Text style={{ alignSelf: 'flex-start', marginLeft: 16, backgroundColor: colors.purple, color: '#fff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' }}>Superset</Text>}
            <View style={{ padding: 16, paddingBottom: 6 }}><ExerciseLabel exerciseId={e.exerciseId} nameStyle={{ color: colors.primary, fontWeight: '600' }} /></View>
            {e.notes ? <Text style={{ paddingHorizontal: 16, color: colors.muted }}>{e.notes}</Text> : null}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16 }}><Text style={{ width: 50, color: colors.muted, fontSize: 12 }}>SET</Text><Text style={{ color: colors.muted, fontSize: 12 }}>WEIGHT & REPS</Text></View>
            {e.sets.map((s, j) => <View key={j} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: j % 2 ? colors.surface : colors.bg }}><Text style={{ width: 50, fontWeight: '600', color: s.type === 'warmup' ? colors.warn : colors.text }}>{s.type === 'warmup' ? 'W' : s.type === 'failure' ? 'F' : s.type === 'drop' ? 'D' : e.sets.slice(0, j + 1).filter((x) => x.type === 'normal').length}</Text><Text style={{ color: colors.text }}>{fmtWeight(s.kg ?? 0, u)} × {s.reps} reps</Text></View>)}
          </View>
        ))}
      </ScrollView>
      <WorkoutMenu id={menu ? w.id : null} onClose={() => setMenu(false)} onDeleted={() => router.back()}
        extra={<ListRow icon="alert-circle-outline" label="Report workout" danger onPress={() => { setMenu(false); router.push({ pathname: '/feed/report', params: { id: w.id } }); }} />} />
    </Screen>
  );
}
