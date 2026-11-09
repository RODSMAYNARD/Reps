import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Header, Screen } from '../../components/ui';
import { EXERCISE_TYPES } from '../../lib/exerciseOptions';
import { patchDraft, useDraft } from '../../lib/exerciseDraft';
import { colors, radius } from '../../lib/theme';
import { ExerciseKind } from '../../lib/types';

const Chip = ({ text }: { text: string }) => <View style={{ backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 13, color: colors.text }}>{text}</Text></View>;

export default function SelectExerciseType() {
  const d = useDraft();
  return (
    <Screen>
      <Header title="Select Exercise Type" />
      <ScrollView>
        {EXERCISE_TYPES.map((t) => (
          <Pressable key={t.kind} disabled={t.soon} testID={`type-${t.kind}`} onPress={() => { patchDraft({ kind: t.kind as ExerciseKind }); router.back(); }} style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 6, opacity: t.soon ? 0.45 : 1, backgroundColor: d.kind === t.kind ? colors.primarySoft : colors.bg, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, color: colors.text }}>{t.label}</Text>
              {t.suggested && <View style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 12, color: colors.primary }}>Suggested</Text></View>}
              {t.soon && <Text style={{ fontSize: 12, color: colors.muted }}>Coming soon</Text>}
            </View>
            <Text style={{ fontSize: 14, color: colors.muted }}>Example: {t.example}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{t.chips.map((c) => <Chip key={c} text={c} />)}</View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
