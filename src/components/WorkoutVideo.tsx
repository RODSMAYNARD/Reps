import { Ionicons } from '@expo/vector-icons';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { Text } from './Text';

// expo-video é módulo nativo (2026-11-23): build antigo não tem e o require falha. Aí mostra o aviso em vez de quebrar.
let EV: typeof import('expo-video') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { EV = require('expo-video'); } catch { EV = null; }

/** Vídeo do treino com os controles do sistema (toque para tocar, tela cheia). Não toca sozinho. */
export function WorkoutVideo({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  if (!EV) {
    return (
      <View style={[{ backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 8 }, style]}>
        <Ionicons name="videocam-outline" size={30} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 14 }}>Update the app to play videos</Text>
      </View>
    );
  }
  return <Player uri={uri} style={style} />;
}

function Player({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = EV!.useVideoPlayer(uri, (p) => { p.loop = false; });
  const VideoView = EV!.VideoView;
  return <VideoView player={player} style={[{ backgroundColor: '#000' }, style]} nativeControls contentFit="cover" />;
}
