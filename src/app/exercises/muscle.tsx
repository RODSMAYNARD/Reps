import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MuscleTile } from '../../components/MuscleTile';
import { Btn, Header, Screen, SearchBar } from '../../components/ui';
import { MUSCLE_OPTIONS } from '../../lib/exerciseOptions';
import { getDraft, patchDraft } from '../../lib/exerciseDraft';
import { norm } from '../../lib/catalog';
import { colors } from '../../lib/theme';

/** Sem `multi`: escolhe o músculo principal (uma opção). Com `multi=1`: escolhe os outros músculos (várias, com caixinha e botão). */
export default function SelectMuscle() {
  const { multi } = useLocalSearchParams<{ multi?: string }>();
  const many = !!multi;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>(() => getDraft().secondary);
  const list = MUSCLE_OPTIONS.filter((m) => norm(m.label).includes(norm(q.trim())));
  return (
    <Screen>
      <Header title={many ? 'Secondary Muscle Groups' : 'Select Muscle Group'} />
      <SearchBar value={q} onChangeText={setQ} placeholder="Search muscle" />
      <ScrollView keyboardShouldPersistTaps="handled">
        {list.map((m) => {
          const on = many ? sel.includes(m.label) : getDraft().muscle === m.label;
          return (
            <Pressable key={m.label} testID={`muscle-${m.label}`} onPress={() => (many ? setSel(on ? sel.filter((x) => x !== m.label) : [...sel, m.label]) : (patchDraft({ muscle: m.label }), router.back()))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
              <MuscleTile muscle={m.muscle} target={m.target} />
              <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{m.label}</Text>
              {many ? (
                <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: on ? 0 : 1.5, borderColor: colors.faint, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
              ) : on ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {many && <View style={{ padding: 16 }}><Btn title="Update Muscle Group(s)" onPress={() => { patchDraft({ secondary: sel }); router.back(); }} testID="muscle-update" /></View>}
    </Screen>
  );
}
