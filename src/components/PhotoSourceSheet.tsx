import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Dialog, ListRow, Sheet } from './ui';

/** Folha "Tirar foto / Escolher da galeria / Remover" com o aviso de permissão negada ("Open settings").
 * `options` vai para a câmera e para a galeria (ex.: recorte quadrado, base64). Devolve o arquivo escolhido em `onPicked`. */
export function PhotoSourceSheet({ visible, onClose, title, options, onPicked, onRemove, testID = 'photo-source' }: {
  visible: boolean; onClose: () => void; title: string; options?: ImagePicker.ImagePickerOptions;
  onPicked: (a: ImagePicker.ImagePickerAsset) => void; onRemove?: () => void; testID?: string;
}) {
  const [denied, setDenied] = useState<'camera' | 'library' | null>(null);
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, ...options };
  const accept = (r: ImagePicker.ImagePickerResult) => { if (!r.canceled && r.assets[0]) onPicked(r.assets[0]); };
  const camera = async () => {
    onClose();
    try {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) { setDenied('camera'); return; }
      accept(await ImagePicker.launchCameraAsync(opts));
    } catch { setDenied('camera'); }
  };
  const library = async () => {
    onClose();
    try { accept(await ImagePicker.launchImageLibraryAsync(opts)); } catch { setDenied('library'); }
  };
  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={title}>
        <ListRow icon="camera-outline" label="Take photo" onPress={camera} testID={`${testID}-camera`} />
        <ListRow icon="images-outline" label="Choose from library" onPress={library} last={!onRemove} testID={`${testID}-library`} />
        {!!onRemove && <ListRow icon="trash-outline" label="Remove photo" danger last onPress={() => { onClose(); onRemove(); }} testID={`${testID}-remove`} />}
      </Sheet>
      <Dialog visible={!!denied} title={denied === 'camera' ? 'Camera access is off' : 'Photo access is off'}
        message={denied === 'camera' ? 'Allow Reps to use the camera in your phone settings to take a photo.' : 'Allow Reps to access your photos in your phone settings to choose a photo.'}
        onClose={() => setDenied(null)}
        actions={[{ label: 'Not now', onPress: () => setDenied(null) }, { label: 'Open settings', primary: true, onPress: () => { setDenied(null); Linking.openSettings().catch(() => {}); } }]} />
    </>
  );
}
