import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { EQUIPMENT_FILTERS, MUSCLE_FILTERS, filterExercises } from '../lib/catalog';
import { colors, radius } from '../lib/theme';
import { Exercise } from '../lib/types';
import { Sheet } from './ui';

type Tile = { id: string; label: string; icon: string };

function Grid({ tiles, sel, onToggle }: { tiles: Tile[]; sel: string[]; onToggle: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {tiles.map((t) => {
        const on = sel.includes(t.id);
        return (
          <Pressable key={t.id} onPress={() => onToggle(t.id)} testID={`filter-${t.id}`} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, borderWidth: 2, borderColor: on ? colors.primary : 'transparent' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={t.icon as never} size={24} color={on ? colors.primary : colors.text} /></View>
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }} numberOfLines={2}>{t.label}</Text>
            {on && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botões "All Equipment" / "All Muscles" que abrem folhas com escolha de vários itens e contagem de resultados ao vivo. */
export function ExerciseFilterBar({ list, q, muscles, equipment, onChange }: { list: Exercise[]; q: string; muscles: string[]; equipment: string[]; onChange: (m: string[], e: string[]) => void }) {
  const [open, setOpen] = useState<'muscle' | 'equip' | null>(null);
  const [dm, setDm] = useState<string[]>(muscles);
  const [de, setDe] = useState<string[]>(equipment);
  const { height } = useWindowDimensions();
  const label = (ids: string[], all: string, names: Map<string, string>) => (ids.length === 0 ? all : ids.length === 1 ? names.get(ids[0])! : `${names.get(ids[0])} +${ids.length - 1}`);
  const mNames = new Map(MUSCLE_FILTERS.flatMap((g) => g.items).map((i) => [i.id, i.label]));
  const eNames = new Map(EQUIPMENT_FILTERS.map((i) => [i.id, i.label]));
  const show = (w: 'muscle' | 'equip') => { setDm(muscles); setDe(equipment); setOpen(w); };
  const count = filterExercises(list, q, dm, de).length;
  const toggle = (arr: string[], set: (v: string[]) => void) => (id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const apply = () => { onChange(dm, de); setOpen(null); };
  const clear = () => { if (open === 'muscle') setDm([]); else setDe([]); };
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        {([['equip', label(equipment, 'All Equipment', eNames), equipment.length] as const, ['muscle', label(muscles, 'All Muscles', mNames), muscles.length] as const]).map(([k, text, n]) => (
          <Pressable key={k} onPress={() => show(k)} testID={k === 'equip' ? 'filter-equipment' : 'filter-muscles'} style={{ flex: 1, backgroundColor: n ? colors.primarySoft : colors.surface, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: n ? 1 : 0, borderColor: colors.primary }}>
            <Text style={{ fontSize: 17, color: n ? colors.primary : colors.text }} numberOfLines={1}>{text}</Text>
          </Pressable>
        ))}
      </View>
      <Sheet visible={open !== null} onClose={() => setOpen(null)} title={open === 'muscle' ? 'Muscle Group' : 'Equipment'}>
        <ScrollView style={{ maxHeight: height * 0.62, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 14, gap: 14 }}>
          {open === 'muscle' && MUSCLE_FILTERS.map((g) => (
            <View key={g.title} style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 17 }}>{g.title}</Text>
              <Grid tiles={g.items} sel={dm} onToggle={toggle(dm, setDm)} />
            </View>
          ))}
          {open === 'equip' && <Grid tiles={EQUIPMENT_FILTERS} sel={de} onToggle={toggle(de, setDe)} />}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12 }}>
          <Pressable onPress={clear} testID="filter-clear" style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}><Text style={{ fontSize: 16, color: colors.text }}>Clear Filters</Text></Pressable>
          <Pressable onPress={apply} testID="filter-apply" style={{ flex: 1.3, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}><Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>Show {count} results</Text></Pressable>
        </View>
      </Sheet>
    </>
  );
}
