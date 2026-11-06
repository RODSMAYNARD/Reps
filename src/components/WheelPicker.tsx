import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';
import { fmtDayWheel } from '../lib/format';
import { colors } from '../lib/theme';

export const WHEEL_ITEM_H = 40;
const ROWS = 3;
const SPAN = 25; // itens desenhados de cada lado do selecionado (o resto vira espaçador)

/** Roda de seleção: 3 linhas visíveis, a do meio é a escolhida. Rola com encaixe e avisa a cada troca (sem biblioteca nativa).
 * Só desenha os itens perto do selecionado, então listas longas (1.440 minutos) continuam leves. */
export function WheelPicker({ items, index, onChange, flex, width, testID }: { items: string[]; index: number; onChange: (i: number) => void; flex?: number; width?: number; testID?: string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const last = useRef(index);
  const [center, setCenter] = useState(index);
  const pad = WHEEL_ITEM_H * ((ROWS - 1) / 2);
  const from = Math.max(0, center - SPAN);
  const to = Math.min(items.length, center + SPAN + 1);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollTo({ y: index * WHEEL_ITEM_H, animated: false }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H)));
    if (i !== last.current) { last.current = i; setCenter(i); onChange(i); }
  };
  return (
    <View testID={testID} style={{ height: WHEEL_ITEM_H * ROWS, flex, width }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: pad, height: WHEEL_ITEM_H, borderRadius: 10, backgroundColor: colors.surface }} />
      <ScrollView
        ref={ref}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        nestedScrollEnabled
        onScroll={onScroll}
        contentContainerStyle={{ paddingVertical: pad }}>
        <View style={{ height: from * WHEEL_ITEM_H }} />
        {items.slice(from, to).map((label, k) => (
          <View key={from + k} style={{ height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, color: from + k === index ? colors.text : colors.faint }}>{label}</Text>
          </View>
        ))}
        <View style={{ height: (items.length - to) * WHEEL_ITEM_H }} />
      </ScrollView>
    </View>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad2(h));
const MINUTES = Array.from({ length: 60 }, (_, m) => pad2(m));

/** Dia, hora e minuto em três rodas (últimos 365 dias até hoje; hora em 24 h). */
export function StartTimeWheels({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 366 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (365 - i)); return d; });
  }, []);
  const labels = useMemo(() => days.map(fmtDayWheel), [days]);
  const dayIdx = Math.max(0, days.findIndex((d) => d.toDateString() === value.toDateString()));
  const set = (patch: (d: Date) => void) => { const d = new Date(value); patch(d); d.setSeconds(0, 0); onChange(d); };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }} testID="start-time-wheels">
      <WheelPicker items={labels} index={dayIdx} flex={1.7} onChange={(i) => set((d) => d.setFullYear(days[i].getFullYear(), days[i].getMonth(), days[i].getDate()))} />
      <WheelPicker items={HOURS} index={value.getHours()} flex={0.6} onChange={(h) => set((d) => d.setHours(h))} />
      <Text style={{ fontSize: 17, color: colors.text }}>:</Text>
      <WheelPicker items={MINUTES} index={value.getMinutes()} flex={0.6} onChange={(m) => set((d) => d.setMinutes(m))} />
    </View>
  );
}
