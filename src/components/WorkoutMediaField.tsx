import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { Text } from './Text';
import { Dialog, ListRow, Sheet } from './ui';
import { WorkoutVideo } from './WorkoutVideo';
import { VIDEO_MAX_BYTES } from '../lib/store';
import { colors, radius } from '../lib/theme';

/** Foto OU vídeo do treino (um por treino). `uri` = arquivo local escolhido agora ou URL assinada do que já está salvo. */
export type WorkoutMedia = { uri: string; kind: 'photo' | 'video' } | null;

/** Salvar e Editar treino: tirar foto, gravar vídeo (até 60 s), escolher da galeria (foto ou vídeo), trocar ou remover. */
export function WorkoutMediaField({ value, onChange, testID = 'workout-media' }: { value: WorkoutMedia; onChange: (m: WorkoutMedia) => void; testID?: string }) {
  const [sheet, setSheet] = useState(false);
  const [denied, setDenied] = useState<'camera' | 'library' | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const accept = (r: ImagePicker.ImagePickerResult) => {
    if (r.canceled) return;
    const a = r.assets[0];
    const video = a.type === 'video';
    if (video && (a.fileSize ?? 0) > VIDEO_MAX_BYTES) { setTooBig(true); return; }
    onChange({ uri: a.uri, kind: video ? 'video' : 'photo' });
  };
  const camera = async (kind: 'photo' | 'video') => {
    setSheet(false);
    try {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) { setDenied('camera'); return; }
      accept(await ImagePicker.launchCameraAsync(kind === 'photo' ? { mediaTypes: ['images'], quality: 0.7 } : { mediaTypes: ['videos'], videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium }));
    } catch { setDenied('camera'); }
  };
  const library = async () => {
    setSheet(false);
    try { accept(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium })); } catch { setDenied('library'); }
  };
  const title = value ? (value.kind === 'video' ? 'Change video' : 'Change photo') : 'Add a photo or video';
  return (
    <>
      {value?.kind === 'video' ? (
        <View style={{ marginVertical: 18, gap: 8 }}>
          <WorkoutVideo uri={value.uri} style={{ height: 220, borderRadius: 14, overflow: 'hidden' }} />
          <Pressable onPress={() => setSheet(true)} testID={testID} accessibilityRole="button" style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface }}>
            <Ionicons name="videocam-outline" size={16} color={colors.text} /><Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Change video</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setSheet(true)} testID={testID} accessibilityRole="button" accessibilityLabel={title}
          style={{ marginVertical: 18, height: value ? 200 : 130, borderRadius: 14, borderWidth: value ? 0 : 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {value ? (
            <>
              <Image source={{ uri: value.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill }}>
                <Ionicons name="camera-outline" size={16} color="#fff" /><Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Change photo</Text>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Ionicons name="camera-outline" size={30} color={colors.text} /><Text style={{ fontSize: 19, color: colors.text }}>Add a photo or video</Text></View>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Take one now or choose from your library</Text>
            </View>
          )}
        </Pressable>
      )}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title={title}>
        <ListRow icon="camera-outline" label="Take photo" onPress={() => camera('photo')} testID={`${testID}-camera`} />
        <ListRow icon="videocam-outline" label="Record video" subtitle="Up to 60 seconds" onPress={() => camera('video')} testID={`${testID}-record`} />
        <ListRow icon="images-outline" label="Choose from library" onPress={library} last={!value} testID={`${testID}-library`} />
        {!!value && <ListRow icon="trash-outline" label={value.kind === 'video' ? 'Remove video' : 'Remove photo'} danger last onPress={() => { setSheet(false); onChange(null); }} testID={`${testID}-remove`} />}
      </Sheet>
      <Dialog visible={!!denied} title={denied === 'camera' ? 'Camera access is off' : 'Photo access is off'}
        message={denied === 'camera' ? 'Allow Reps to use the camera in your phone settings to take a workout photo or video.' : 'Allow Reps to access your photos in your phone settings to attach a workout photo or video.'}
        onClose={() => setDenied(null)}
        actions={[{ label: 'Not now', onPress: () => setDenied(null) }, { label: 'Open settings', primary: true, onPress: () => { setDenied(null); Linking.openSettings().catch(() => {}); } }]} />
      <Dialog visible={tooBig} title="Video too large" message="Videos can be up to 50 MB. Try a shorter one (up to 60 seconds)." onClose={() => setTooBig(false)}
        actions={[{ label: 'OK', primary: true, onPress: () => setTooBig(false) }]} />
    </>
  );
}
