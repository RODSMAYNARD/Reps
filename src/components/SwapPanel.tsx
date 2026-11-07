import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { THUMBS } from '../data/thumbs';
import { catKey } from '../lib/catalog';
import { useStore } from '../lib/store';
import { substitutesFor } from '../lib/substitutes';
import { colors, radius } from '../lib/theme';

const SIZE = 112;

/** Painel "Swap" dentro do exercício: o exercício original e 3 ou 4 opções do mesmo músculo, com foto.
 * Tocar numa opção troca o exercício só neste treino; tocar no original volta. Tudo alinhado pelo topo. */
export function SwapPanel({ currentId, originalId, exclude, onPick, onInfo }: {
  currentId: string; originalId: string; exclude: Set<string>; onPick: (exerciseId: string) => void; onInfo: () => void;
}) {
  const { findExercise } = useStore();
  const orig = findExercise(originalId);
  if (!orig) return null;
  const subs = substitutesFor({ name: orig.name, muscle: orig.muscle, target: orig.target, equipment: orig.equipment, kind: orig.kind, catalogId: orig.catalogId }, exclude);
  const cards = [
    { id: originalId, name: orig.name, sub: 'Original', catalogId: orig.catalogId, uri: orig.assetUri, closest: false, why: '' },
    ...subs.map((s) => ({ id: catKey(s.c), name: s.c.n, sub: s.c.e, catalogId: s.c.id, uri: null as string | null | undefined, closest: s.closest, why: s.why })),
  ];
  const chosen = cards.find((c) => c.id === currentId && c.id !== originalId);
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: radius.lg }} testID="swap-panel">
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 }}>
        <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' }}>Swap</Text>
        <Pressable onPress={onInfo} hitSlop={8} testID="swap-info" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="information-circle-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>
      {/* alignItems: flex-start = todas as fotos começam na mesma linha, mesmo com nomes de 1, 2 ou 3 linhas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10, alignItems: 'flex-start' }}>
        {cards.map((c) => {
          const on = c.id === currentId;
          const src = c.catalogId ? THUMBS[c.catalogId] : undefined;
          return (
            <Pressable key={c.id} onPress={() => onPick(c.id)} testID={`swap-card-${c.catalogId ?? 'x'}`} style={{ width: SIZE, alignSelf: 'flex-start' }}>
              <View style={{ width: SIZE, height: SIZE, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: on ? colors.primary : 'transparent', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {src ? <Image source={src} style={{ width: SIZE, height: SIZE }} resizeMode="cover" /> : c.uri ? <Image source={{ uri: c.uri }} style={{ width: SIZE, height: SIZE }} /> : <Ionicons name="barbell-outline" size={40} color={colors.faint} />}
                {on && <View style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={15} color="#FFFFFF" /></View>}
              </View>
              <Text numberOfLines={3} style={{ color: colors.text, fontSize: 13, lineHeight: 16, marginTop: 6 }}>{c.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{c.sub}{c.closest ? ' · ' : ''}{c.closest && <Text style={{ color: '#1F9D55', fontWeight: '700' }}>Closest match</Text>}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginHorizontal: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        {chosen ? `${chosen.name}. ${chosen.why}` : 'Tap another exercise to use it instead, only in this workout.'}
      </Text>
    </View>
  );
}
