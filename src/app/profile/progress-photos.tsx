import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Dialog, Empty, Header, Screen } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function ProgressPhotos() {
  const { measurements } = useStore();
  const photos = measurements.filter((m) => m.photoUri);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      <Header title="Fotos de progresso" />
      <ScrollView contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.length === 0 && <Empty icon="camera-outline" text="Nenhuma foto ainda. Adicione uma ao registrar medidas." />}
        {photos.map((m) => (
          <Pressable key={m.id} onPress={() => setOpen(m.photoUri)} style={{ width: '48%' }}>
            <Image source={{ uri: m.photoUri! }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: 12 }} />
            <View style={{ position: 'absolute', bottom: 8, left: 8 }}><Text style={{ color: '#fff', fontWeight: '600' }}>{fmtDate(m.date, { day: '2-digit', month: 'short', year: 'numeric' })}</Text></View>
          </Pressable>
        ))}
      </ScrollView>
      <Dialog visible={!!open} actions={[{ label: 'Fechar', primary: true, onPress: () => setOpen(null) }]} onClose={() => setOpen(null)}>
        {open && <Image source={{ uri: open }} style={{ width: '100%', height: 360, borderRadius: 12, backgroundColor: colors.surface }} resizeMode="contain" />}
      </Dialog>
    </Screen>
  );
}
