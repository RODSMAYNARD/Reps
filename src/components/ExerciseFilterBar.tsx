import { Ionicons } from '@expo/vector-icons';
import { track } from '../lib/analytics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from './Text';
import { EQUIPMENT_FILTERS, MUSCLE_FILTERS, filterExercises } from '../lib/catalog';
import { colors, radius } from '../lib/theme';
import { Exercise } from '../lib/types';
import { IconCircle } from './IconCircle';
import { MuscleTile } from './MuscleTile';
import { Sheet } from './ui';
import { equipImage } from '../lib/iconImages';

type Tile = { id: string; label: string; icon: string };

/** Grade de 2 colunas como no exemplo do Hevy: círculo à esquerda e o nome inteiro à direita (quebra só entre palavras).
 * A largura do cartão vem da tela: em celular estreito o círculo diminui para sobrar espaço ao texto. */
function Grid({ tiles, sel, onToggle, equip }: { tiles: Tile[]; sel: string[]; onToggle: (id: string) => void; equip?: boolean }) {
  const { width } = useWindowDimensions();
  const GAP = 10;
  const tileW = Math.floor((width - 32 - GAP) / 2); // a folha tem 16 de margem de cada lado
  const icon = tileW < 150 ? 42 : 48;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {tiles.map((t) => {
        const on = sel.includes(t.id);
        return (
          <Pressable key={t.id} onPress={() => onToggle(t.id)} testID={`filter-${t.id}`} style={{ width: tileW, minHeight: icon + 22, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 10, paddingLeft: 10, paddingRight: 8, borderWidth: 2, borderColor: on ? colors.primary : 'transparent' }}>
            {equip ? <IconCircle source={equipImage(t.id)} size={icon} /> : <MuscleTile label={t.label} size={icon} />}
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 19, color: colors.text }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} textBreakStrategy="simple" android_hyphenationFrequency="none">{t.label}</Text>
            {/* marcado: só a borda azul e um selinho no canto, sem roubar espaço do nome */}
            {on && <View style={{ position: 'absolute', top: 6, right: 6 }}><Ionicons name="checkmark-circle" size={18} color={colors.primary} /></View>}
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
  // Só conta com a folha aberta (antes refazia a busca inteira a cada renderização da tela).
  const count = useMemo(() => (open ? filterExercises(list, q, dm, de).length : 0), [open, list, q, dm, de]);
  const toggle = (arr: string[], set: (v: string[]) => void) => (id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const apply = () => { track('exercise_filters_applied', { muscles: dm.length, equipment: de.length, results: count }); onChange(dm, de); setOpen(null); };
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
        <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={{ paddingVertical: 4, gap: 14 }}>
          {open === 'muscle' && MUSCLE_FILTERS.map((g) => (
            <View key={g.title} style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 16 }}>{g.title}</Text>
              <Grid tiles={g.items} sel={dm} onToggle={toggle(dm, setDm)} />
            </View>
          ))}
          {open === 'equip' && <Grid equip tiles={EQUIPMENT_FILTERS} sel={de} onToggle={toggle(de, setDe)} />}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12 }}>
          <Pressable onPress={clear} testID="filter-clear" style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}><Text style={{ fontSize: 16, color: colors.text }}>Clear Filters</Text></Pressable>
          <Pressable onPress={apply} testID="filter-apply" style={{ flex: 1.3, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}><Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>Show {count} results</Text></Pressable>
        </View>
      </Sheet>
    </>
  );
}
