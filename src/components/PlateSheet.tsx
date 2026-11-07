import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BARS, DEFAULT_PLATES, PlateSet, WUnit, barOf, fmtPlate, solvePlates, unitLabel } from '../lib/plates';
import { colors } from '../lib/theme';
import { NumInput } from './NumInput';
import { Btn, ListRow, Sheet } from './ui';

const PLATE_H_MIN = 36, PLATE_H_MAX = 84;

/** Barra com as anilhas de um lado, alturas proporcionais ao peso (maior junto da trava). */
function BarbellView({ bar, plates, biggest }: { bar: number; plates: number[]; biggest: number }) {
  const pw = plates.length > 9 ? 12 : plates.length > 6 ? 16 : 22;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 }}>
      <View style={{ width: 84, height: 16, backgroundColor: '#9AA3B2', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{fmtPlate(bar)}</Text>
      </View>
      <View style={{ width: 8, height: 30, backgroundColor: '#7B8599', borderRadius: 2 }} />
      {plates.map((p, i) => (
        <View key={i} style={{ width: pw, height: PLATE_H_MIN + (PLATE_H_MAX - PLATE_H_MIN) * (p / biggest), marginLeft: 2, backgroundColor: colors.primary, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
          {pw >= 16 && <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{fmtPlate(p)}</Text>}
        </View>
      ))}
      <View style={{ width: 20, height: 12, backgroundColor: '#9AA3B2', borderTopRightRadius: 3, borderBottomRightRadius: 3, marginLeft: 2 }} />
    </ScrollView>
  );
}

const Chip = ({ on, label, onPress, round }: { on: boolean; label: string; onPress: () => void; round?: boolean }) => (
  <Pressable onPress={onPress} style={{ minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: round ? 0 : 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.surface, marginRight: 8 }}>
    <Text style={{ color: on ? '#FFFFFF' : colors.muted, fontWeight: '600', fontSize: 14 }}>{label}</Text>
  </Pressable>
);

/** Calculadora de anilhas: mostra o que carregar em cada lado, o peso possível mais próximo e o equipamento disponível (anilhas e barra), como no Hevy. */
export function PlateSheet({ visible, onClose, target, unit, sets, onChange }: {
  visible: boolean; onClose: () => void; target: number; unit: WUnit; sets: PlateSet; onChange: (s: PlateSet) => void;
}) {
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState<number | null>(null);
  const label = unitLabel(unit);
  const bar = barOf(unit, sets.bar);
  const sol = useMemo(() => solvePlates(target, bar.w, sets.on), [target, bar.w, sets.on]);
  const biggest = Math.max(1, ...sets.all);
  const isCustom = (p: number) => !DEFAULT_PLATES[unit].includes(p);
  const toggle = (p: number) => onChange({ ...sets, on: sets.on.includes(p) ? sets.on.filter((x) => x !== p) : [...sets.on, p] });
  const addCustom = () => {
    const v = Math.round((custom ?? 0) * 100) / 100;
    if (v <= 0 || v > 100 || sets.all.includes(v)) return;
    onChange({ ...sets, all: [...sets.all, v].sort((a, b) => b - a), on: [...sets.on, v] });
    setCustom(null); setAdding(false);
  };
  const removePlate = (p: number) => onChange({ ...sets, all: sets.all.filter((x) => x !== p), on: sets.on.filter((x) => x !== p) });
  const close = () => { setManage(false); setAdding(false); onClose(); };

  return (
    <>
      <Sheet visible={visible && !manage && !adding} onClose={close} title="Plate Calculator">
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: -6 }}>Target Weight: {fmtPlate(target)}{label}</Text>
        <BarbellView bar={bar.w} plates={sol.perSide} biggest={biggest} />
        {!sol.exact && <Text style={{ color: colors.danger, textAlign: 'center', marginTop: -8, marginBottom: 8 }} testID="plate-closest">Closest possible weight is {fmtPlate(sol.total)}{label}</Text>}
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.muted }}>Available Equipment</Text>
            <Text style={{ color: colors.primary, fontWeight: '500' }} onPress={() => setManage(true)} testID="plate-manage">Manage</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 84, color: colors.text, fontSize: 14 }}>Plates ({label})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {sets.all.map((p) => <Chip key={p} round on={sets.on.includes(p)} label={fmtPlate(p)} onPress={() => toggle(p)} />)}
            </ScrollView>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 84, color: colors.text, fontSize: 14 }}>Bar ({label})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {BARS[unit].map((b) => <Chip key={b.id} on={sets.bar === b.id} label={`${b.label} (${fmtPlate(b.w)}${label})`} onPress={() => onChange({ ...sets, bar: b.id })} />)}
            </ScrollView>
          </View>
        </View>
      </Sheet>

      <Sheet visible={visible && manage && !adding} onClose={close} title="Manage Equipment" left={<Ionicons name="arrow-back" size={24} color={colors.text} onPress={() => setManage(false)} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 }}>
          <Text style={{ color: colors.muted }}>Plates</Text>
          <Text style={{ color: colors.primary, fontWeight: '500' }} onPress={() => setAdding(true)} testID="plate-custom">+ Custom Plate</Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }}>
          {sets.all.map((p) => (
            <ListRow key={p} label={`${fmtPlate(p)}${label}`} last
              right={isCustom(p) ? <Ionicons name="trash-outline" size={20} color={colors.danger} onPress={() => removePlate(p)} /> : undefined} />
          ))}
        </ScrollView>
      </Sheet>

      <Sheet visible={visible && adding} onClose={() => { setAdding(false); setCustom(null); }} title="Custom Plate" left={<Ionicons name="arrow-back" size={24} color={colors.text} onPress={() => { setAdding(false); setCustom(null); }} />}>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={{ color: colors.muted }}>Weight of one plate ({label})</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 10 }}><NumInput decimal value={custom} onChange={setCustom} placeholder="0" testID="plate-custom-input" /></View>
          <Btn title="Add plate" onPress={addCustom} disabled={!custom || custom <= 0} />
        </View>
      </Sheet>
    </>
  );
}
