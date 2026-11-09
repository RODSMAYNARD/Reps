import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Share, View } from 'react-native';
import { Text } from './Text';
import { fmtDuration, fmtVolume, timeAgo } from '../lib/format';
import { workoutVolume } from '../lib/stats';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';
import { Workout } from '../lib/types';
import { ExerciseLabel } from './ExerciseLabel';
import { Avatar, Stat } from './ui';

export function WorkoutCard({ w, onMenu }: { w: Workout; onMenu?: () => void }) {
  const { profile } = useStore();
  const shown = w.entries.slice(0, 3);
  return (
    <Pressable onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} testID="workout-card" style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={profile.displayName || profile.username} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{profile.displayName || profile.username}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{timeAgo(w.date)}{w.visibility !== 'everyone' ? ' · only you' : ''}</Text>
          {w.pending && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} testID="workout-pending"><Ionicons name="cloud-upload-outline" size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13 }}>Waiting to upload</Text></View>}
          {!!w.location && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="location-sharp" size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{w.location}</Text></View>}
        </View>
        {onMenu && <Pressable onPress={onMenu} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable>}
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{w.title}</Text>
      {!!w.description && <Text style={{ color: colors.text }}>{w.description}</Text>}
      <View style={{ flexDirection: 'row', gap: 28 }}>
        <Stat label="Time" value={fmtDuration(w.durationSec)} />
        <Stat label="Volume" value={fmtVolume(workoutVolume(w), profile.units)} />
        <Stat label="Sets" value={String(w.entries.reduce((t, e) => t + e.sets.length, 0))} />
      </View>
      <View style={{ gap: 4 }}>
        {shown.map((e) => <ExerciseLabel key={e.exerciseId} exerciseId={e.exerciseId} size={36} prefix={`${e.sets.length} × `} nameStyle={{ fontSize: 15 }} numberOfLines={1} />)}
        {w.entries.length > 3 && <Text style={{ color: colors.muted }}>See {w.entries.length - 3} more exercise(s)</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 22, paddingTop: 4 }}>
        <Pressable onPress={() => Share.share({ message: `${w.title} — ${fmtDuration(w.durationSec)}, ${fmtVolume(workoutVolume(w), profile.units)} on Reps` })} hitSlop={8}><Ionicons name="share-outline" size={22} color={colors.text} /></Pressable>
      </View>
    </Pressable>
  );
}
