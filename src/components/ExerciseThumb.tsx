import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { THUMBS } from '../data/thumbs';
import { useMedia } from '../lib/media';
import { colors } from '../lib/theme';

/** Round exercise thumbnail. Bundled inside the app as a native resource (require, instant, zero decode cost); dumbbell fallback. */
export function ExerciseThumb({ catalogId, size = 44 }: { catalogId?: string | null; size?: number }) {
  const src = catalogId ? THUMBS[catalogId] : undefined;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {src ? <Image source={src} style={{ width: size, height: size }} /> : <Ionicons name="barbell-outline" size={size / 2} color={colors.muted} />}
    </View>
  );
}

/** Animated demo GIF for the exercise detail screen (one signed URL, fetched only when the screen opens). */
export function ExerciseGif({ catalogId, size = 220 }: { catalogId?: string | null; size?: number }) {
  const url = useMedia('gif', catalogId);
  if (!catalogId) return null;
  return (
    <View style={{ alignSelf: 'center', width: size, height: size, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginVertical: 12 }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="contain" /> : <Ionicons name="barbell-outline" size={size / 4} color={colors.faint} />}
    </View>
  );
}
