import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { GymIcon } from '../../components/GymIcon';
import { Header, Screen } from '../../components/ui';
import { EQUIPMENT_OPTIONS } from '../../lib/exerciseOptions';
import { patchDraft, useDraft } from '../../lib/exerciseDraft';
import { colors } from '../../lib/theme';

export default function SelectEquipment() {
  const d = useDraft();
  return (
    <Screen>
      <Header title="Select Equipment Type" />
      <ScrollView>
        {EQUIPMENT_OPTIONS.map((o) => (
          <Pressable key={o.value} onPress={() => { patchDraft({ equipment: o.value }); router.back(); }} testID={`equip-${o.value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><GymIcon name={o.icon} size={30} color={colors.text} /></View>
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{o.label}</Text>
            {d.equipment === o.value && <Ionicons name="checkmark" size={22} color={colors.primary} />}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
