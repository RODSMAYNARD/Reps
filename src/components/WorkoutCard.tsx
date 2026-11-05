import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { fmtDuration, fmtVolume, timeAgo } from '../lib/format';
import { workoutVolume } from '../lib/stats';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';
import { Workout } from '../lib/types';
import { Avatar, Stat } from './ui';

export function WorkoutCard({ w, onMenu }: { w: Workout; onMenu?: () => void }) {
  const { exercises, profile } = useStore();
  const [liked, setLiked] = useState(false);
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercício removido';
  const shown = w.entries.slice(0, 3);
  return (
    <Pressable onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} testID="workout-card" style={{ padding: 16, gap: 10, borderBottomWidth: 8, borderBottomColor: colors.surface, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={profile.displayName || profile.username} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{profile.displayName || profile.username}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{timeAgo(w.date)}{w.visibility !== 'everyone' ? ' · só você' : ''}</Text>
        </View>
        {onMenu && <Pressable onPress={onMenu} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable>}
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{w.title}</Text>
      {!!w.description && <Text style={{ color: colors.text }}>{w.description}</Text>}
      <View style={{ flexDirection: 'row', gap: 28 }}>
        <Stat label="Tempo" value={fmtDuration(w.durationSec)} />
        <Stat label="Volume" value={fmtVolume(workoutVolume(w), profile.units)} />
        <Stat label="Séries" value={String(w.entries.reduce((t, e) => t + e.sets.length, 0))} />
      </View>
      <View style={{ gap: 4 }}>
        {shown.map((e) => <Text key={e.exerciseId} style={{ color: colors.text }}>{e.sets.length} × {name(e.exerciseId)}</Text>)}
        {w.entries.length > 3 && <Text style={{ color: colors.muted }}>Ver mais {w.entries.length - 3} exercício(s)</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 22, paddingTop: 4 }}>
        <Pressable onPress={() => setLiked(!liked)} hitSlop={8} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={22} color={liked ? colors.primary : colors.text} />
          {liked && <Text style={{ color: colors.primary }}>1</Text>}
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} hitSlop={8}><Ionicons name="chatbubble-outline" size={22} color={colors.text} /></Pressable>
        <Pressable onPress={() => Share.share({ message: `${w.title} — ${fmtDuration(w.durationSec)}, ${fmtVolume(workoutVolume(w), profile.units)} no Reps` })} hitSlop={8}><Ionicons name="share-outline" size={22} color={colors.text} /></Pressable>
      </View>
    </Pressable>
  );
}
