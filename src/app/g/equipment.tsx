import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { IconCircle } from '../../components/IconCircle';
import { Text } from '../../components/Text';
import { Btn, Header, HeaderAction, Screen } from '../../components/ui';
import { dayKeyOf, gearOf, setG, useG } from '../../lib/gplan';
import { tr } from '../../lib/i18n';
import { equipImage } from '../../lib/iconImages';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { EQUIP, presetIds } from '../../lib/trainer';

/** Equipamentos da aba G: abas por grupo, cartões marcáveis e NEXT (o treino do dia é refeito com o que foi escolhido). */

const POPULAR = ['barbell', 'dumbbell', 'cable2', 'smith', 'flatbench', 'latpull', 'legpress', 'pullup', 'kettlebell', 'band'];
const GROUPS = ['Popular', ...new Set(EQUIP.map((e) => e.group))];

export default function GEquipment() {
  const st = useStore();
  const g = useG(st.session?.user.id ?? null);
  const [sel, setSel] = useState<string[]>(() => gearOf(g));
  const [group, setGroup] = useState('Popular');
  const items = group === 'Popular' ? POPULAR.flatMap((id) => EQUIP.find((e) => e.id === id) ?? []) : EQUIP.filter((e) => e.group === group);
  const toggle = (id: string) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const next = () => {
    const def = presetIds('commercial');
    const same = sel.length === def.length && sel.every((x) => def.includes(x));
    const key = dayKeyOf(g.planId, g.done[g.planId] ?? 0);
    setG((s) => { const custom = { ...s.custom }; delete custom[key]; return { equipment: same ? null : sel, custom }; });
    st.showToast(tr('Plan Updated!'));
    router.back();
  };
  return (
    <Screen>
      <Header title="Equipment" titleAlign="left" right={<HeaderAction label="Default" onPress={() => setSel(presetIds('commercial'))} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}>
        {GROUPS.map((x) => (
          <Pressable key={x} onPress={() => setGroup(x)} style={{ paddingTop: 12 }} testID={`g-eq-tab-${x}`}>
            <Text style={{ fontSize: 15, fontWeight: group === x ? '700' : '400', color: group === x ? colors.text : colors.muted }}>{x}</Text>
            <View style={{ height: 3, borderRadius: 2, marginTop: 8, backgroundColor: group === x ? colors.primary : 'transparent' }} />
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {items.map((e) => {
          const on = sel.includes(e.id);
          return (
            <Pressable key={e.id} onPress={() => toggle(e.id)} testID={`g-eq-${e.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingLeft: 16, paddingRight: 10, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.border, backgroundColor: colors.bg }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text }}>{e.label}</Text>
              <IconCircle source={equipImage(e.id)} size={44} />
              {on && <View style={{ position: 'absolute', top: -8, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={14} color={colors.onPrimary} /></View>}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {sel.slice(0, 5).map((id) => { const src = equipImage(id); return src ? <Image key={id} source={src} style={{ width: 30, height: 30 }} /> : null; })}
          <Text style={{ flex: 1, textAlign: 'right', color: colors.text, fontSize: 15 }}>{sel.length} {tr('Selected')}</Text>
        </View>
        <Btn title={tr('Next').toUpperCase()} onPress={next} disabled={!sel.length} style={{ minHeight: 46 }} textStyle={{ fontWeight: '800', letterSpacing: 0.5 }} testID="g-eq-next" />
      </View>
    </Screen>
  );
}
