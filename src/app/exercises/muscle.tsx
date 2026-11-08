import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BodyMap, regionsOf, type Region } from '../../components/BodyMap';
import { GymIcon } from '../../components/GymIcon';
import { Btn, Header, Screen, SearchBar } from '../../components/ui';
import { MUSCLE_OPTIONS } from '../../lib/exerciseOptions';
import { getDraft, patchDraft } from '../../lib/exerciseDraft';
import { norm } from '../../lib/catalog';
import { colors } from '../../lib/theme';

const BACK: Region[] = ['traps', 'upperback', 'lats', 'lowerback', 'triceps', 'glutes', 'hamstrings'];

/** Miniatura do músculo: boneco (frente ou costas) com o músculo pintado; Cardio, Full Body e Other usam ícone. */
function MuscleTile({ m }: { m: (typeof MUSCLE_OPTIONS)[number] }) {
  const box = { width: 52, height: 64, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (m.muscle === 'Cardio') return <View style={box}><GymIcon name="cardio" size={30} color={colors.text} /></View>;
  if (m.muscle === 'Full body') return <View style={box}><GymIcon name="fullbody" size={30} color={colors.text} /></View>;
  const regions = regionsOf(m.target ?? m.muscle);
  if (!regions.length) return <View style={box}><GymIcon name="other" size={30} color={colors.text} /></View>;
  const side = regions.some((r) => BACK.includes(r)) ? 'back' : 'front';
  return <View style={box}><BodyMap side={side} primary={regions} width={30} colors={{ body: colors.bodyBase, muscle: colors.bodyMuscle, on: colors.primary }} /></View>;
}

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
              <MuscleTile m={m} />
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
