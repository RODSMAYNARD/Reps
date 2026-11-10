import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { IconCircle } from '../../components/IconCircle';
import { Header, Screen } from '../../components/ui';
import { EQUIPMENT_OPTIONS } from '../../lib/exerciseOptions';
import { patchDraft, useDraft } from '../../lib/exerciseDraft';
import { equipImage } from '../../lib/iconImages';
import { colors } from '../../lib/theme';

export default function SelectEquipment() {
  const d = useDraft();
  return (
    <Screen>
      <Header title="Select Equipment Type" />
      <ScrollView>
        {EQUIPMENT_OPTIONS.map((o) => (
          <Pressable key={o.value} onPress={() => { patchDraft({ equipment: o.value }); router.back(); }} testID={`equip-${o.value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
            <IconCircle source={equipImage(o.icon)} size={52} />
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{o.label}</Text>
            {d.equipment === o.value && <Ionicons name="checkmark" size={22} color={colors.primary} />}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
