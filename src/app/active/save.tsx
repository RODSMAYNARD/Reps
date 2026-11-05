import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Dialog, Header, HeaderAction, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { fmtDuration, fmtVolume } from '../../lib/format';
import { setVolume } from '../../lib/stats';
import { elapsedSec, useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { Workout } from '../../lib/types';

const VIS: { id: Workout['visibility']; label: string }[] = [{ id: 'everyone', label: 'Todos' }, { id: 'followers', label: 'Seguidores' }, { id: 'private', label: 'Só eu' }];

export default function SaveWorkout() {
  const st = useStore();
  const { active, profile } = st;
  const [title, setTitle] = useState(active?.title ?? 'Treino');
  const [desc, setDesc] = useState('');
  const [vis, setVis] = useState<Workout['visibility']>('everyone');
  const [visSheet, setVisSheet] = useState(false);
  const [whenSheet, setWhenSheet] = useState(false);
  const [daysAgo, setDaysAgo] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nowTs] = useState(() => Date.now());
  if (!active) return null;
  const done = active.entries.flatMap((e) => e.sets.filter((s) => s.done));
  const dur = elapsedSec(active);
  const when = new Date(nowTs - daysAgo * 86400000);

  const save = async () => {
    setBusy(true);
    const w = await st.finishActive({ title: title.trim() || 'Treino', description: desc, visibility: vis, date: when.toISOString(), durationSec: dur });
    setBusy(false);
    if (w) { st.showToast('Treino salvo!'); router.dismissTo('/'); }
  };
  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  return (
    <Screen>
      <Header title="Salvar treino" right={<HeaderAction label="Salvar" primary onPress={save} disabled={busy} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Título do treino" placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 22, fontWeight: '700', color: colors.text }} testID="save-title" />
          {!!title && <Ionicons name="close-circle" size={22} color={colors.faint} onPress={() => setTitle('')} />}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stat label="Duração" value={fmtDuration(dur)} color={colors.primary} />
          <Stat label="Volume" value={fmtVolume(done.reduce((t, s) => t + setVolume(s), 0), profile.units)} />
          <Stat label="Séries" value={String(done.length)} />
        </View>
        <Pressable onPress={() => setWhenSheet(true)}><Text style={{ color: colors.muted, fontSize: 13 }}>Quando</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{when.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></Pressable>
        <Pressable onPress={pickPhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 12 }} /> : (
            <View style={{ width: 96, height: 96, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={30} color={colors.primary} /></View>
          )}
          <Text style={{ color: colors.text, fontSize: 16 }}>{photo ? 'Trocar foto' : 'Adicionar foto / vídeo'}</Text>
        </Pressable>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Descrição</Text>
          <TextInput value={desc} onChangeText={setDesc} multiline placeholder="Como foi o treino? Deixe algumas notas aqui..." placeholderTextColor={colors.faint} style={{ minHeight: 70, fontSize: 16, color: colors.text, textAlignVertical: 'top' }} />
        </View>
        <ListRow label="Visibilidade" detail={VIS.find((v) => v.id === vis)!.label} onPress={() => setVisSheet(true)} />
        <Btn title="Descartar treino" variant="ghost" onPress={() => setDiscard(true)} style={{ borderWidth: 0 }} />
      </ScrollView>
      <Sheet visible={visSheet} onClose={() => setVisSheet(false)} title="Quem pode ver">
        {VIS.map((v) => <ListRow key={v.id} label={v.label} last right={vis === v.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setVis(v.id); setVisSheet(false); }} />)}
      </Sheet>
      <Sheet visible={whenSheet} onClose={() => setWhenSheet(false)} title="Quando foi o treino?">
        {[0, 1, 2, 3, 7].map((d) => <ListRow key={d} label={d === 0 ? 'Agora' : d === 1 ? 'Ontem' : `Há ${d} dias`} last right={daysAgo === d ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined} onPress={() => { setDaysAgo(d); setWhenSheet(false); }} />)}
      </Sheet>
      <Dialog visible={discard} title="Descartar treino?" message="O treino não será salvo." onClose={() => setDiscard(false)}
        actions={[{ label: 'Cancelar' }, { label: 'Descartar', danger: true, onPress: () => { setDiscard(false); st.discardActive(); router.dismissTo('/'); } }]} />
    </Screen>
  );
}
