import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { THUMB_COLS, THUMB_SHEETS, THUMBS } from '../data/thumbs';
import { useMedia } from '../lib/media';
import { colors } from '../lib/theme';

/** Round exercise thumbnail, cropped from a bundled sprite sheet (instant, offline, few OTA assets); dumbbell fallback. */
export function ExerciseThumb({ catalogId, size = 44 }: { catalogId?: string | null; size?: number }) {
  const cell = catalogId ? THUMBS[catalogId] : undefined;
  const sheet = cell ? THUMB_SHEETS[cell[0]] : undefined;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {cell && sheet ? (
        <Image
          source={sheet.src}
          style={{ position: 'absolute', left: -cell[1] * size, top: -cell[2] * size, width: THUMB_COLS * size, height: sheet.rows * size }}
        />
      ) : (
        <Ionicons name="barbell-outline" size={size / 2} color={colors.muted} />
      )}
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
