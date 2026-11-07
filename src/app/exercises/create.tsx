import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Header, HeaderAction, Screen } from '../../components/ui';
import { EQUIPMENT_OPTIONS, MUSCLE_OPTIONS, kindLabel } from '../../lib/exerciseOptions';
import { patchDraft, resetDraft, useDraft } from '../../lib/exerciseDraft';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

function Row({ label, value, optional, onPress, testID }: { label: string; value?: string; optional?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
        {value ? <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={2}>{value}</Text> : <Text style={{ fontSize: 14, color: colors.primary }}>Select{optional ? <Text style={{ color: colors.muted }}> (optional)</Text> : null}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** Criar exercício: nome, imagem, equipamento, músculo principal, outros músculos e tipo — cada escolha abre a própria tela. */
export default function CreateExercise() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addExercise, updateExercise, findExercise, showToast } = useStore();
  const d = useDraft();
  const [saving, setSaving] = useState(false);
  const editing = id ? findExercise(id) : undefined;
  useEffect(() => {
    resetDraft();
    if (editing) patchDraft({ name: editing.name, equipment: editing.equipment, muscle: (MUSCLE_OPTIONS.find((m) => !!editing.target && m.target === editing.target) ?? MUSCLE_OPTIONS.find((m) => !m.target && m.muscle === editing.muscle))?.label ?? editing.muscle, secondary: editing.secondary ?? [], kind: editing.kind, assetUri: editing.assetUri ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pickAsset = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    const a = r.assets?.[0];
    if (!r.canceled && a?.base64) patchDraft({ assetUri: `data:image/jpeg;base64,${a.base64}` });
  };

  const save = async () => {
    const muscle = MUSCLE_OPTIONS.find((m) => m.label === d.muscle);
    if (!d.name.trim()) return showToast('Enter an exercise name.');
    if (!d.equipment) return showToast('Select the equipment.');
    if (!muscle) return showToast('Select the primary muscle group.');
    if (!d.kind) return showToast('Select the exercise type.');
    if (saving) return;
    setSaving(true);
    const x = { name: d.name, muscle: muscle.muscle, target: muscle.target ?? null, equipment: d.equipment, kind: d.kind, secondary: d.secondary, assetUri: d.assetUri };
    const ok = editing ? await updateExercise(editing.id, x) : !!(await addExercise(x));
    setSaving(false);
    if (ok) { showToast(editing ? 'Exercise updated' : 'Exercise created'); router.back(); }
  };

  const equipLabel = EQUIPMENT_OPTIONS.find((o) => o.value === d.equipment)?.label;
  return (
    <Screen>
      <Header title={editing ? 'Edit Exercise' : 'Create Exercise'} right={<HeaderAction label="Save" primary disabled={saving} onPress={save} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 12, gap: 10 }}>
          <Pressable onPress={pickAsset} testID="ex-asset" style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {d.assetUri ? <Image source={{ uri: d.assetUri }} style={{ width: 96, height: 96 }} /> : <Ionicons name="camera-outline" size={30} color={colors.text} />}
          </Pressable>
          <Pressable onPress={pickAsset} hitSlop={8}><Text style={{ color: colors.primary, fontSize: 16 }}>{d.assetUri ? 'Change Asset' : 'Add Asset'}</Text></Pressable>
        </View>
        <TextInput value={d.name} onChangeText={(t) => patchDraft({ name: t })} placeholder="Exercise Name" placeholderTextColor={colors.faint} style={{ fontSize: 20, fontWeight: '500', color: colors.text, paddingVertical: 14 }} testID="ex-name" />
        <Row label="Equipment" value={equipLabel} onPress={() => router.push('/exercises/equipment')} testID="ex-equipment" />
        <Row label="Primary Muscle Group" value={d.muscle ?? undefined} onPress={() => router.push('/exercises/muscle')} testID="ex-muscle" />
        <Row label="Other Muscles" value={d.secondary.length ? d.secondary.join(', ') : undefined} optional onPress={() => router.push({ pathname: '/exercises/muscle', params: { multi: '1' } })} testID="ex-secondary" />
        <Row label="Exercise Type" value={d.kind ? kindLabel(d.kind) : undefined} onPress={() => router.push('/exercises/type')} testID="ex-type" />
      </ScrollView>
    </Screen>
  );
}
