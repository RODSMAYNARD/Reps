import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { Text } from './Text';
import { fmtDayWheel } from '../lib/format';
import { locale } from '../lib/i18n';
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

/** Data (dia, mês, ano) em três rodas, para o período personalizado do gráfico do Perfil. Anos de `minYear` até o atual. */
export function DateWheels({ value, onChange, minYear }: { value: Date; onChange: (d: Date) => void; minYear: number }) {
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: thisYear - minYear + 1 }, (_, i) => String(minYear + i)), [minYear, thisYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale(), { month: 'short' })), []);
  const dim = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const daysList = useMemo(() => Array.from({ length: dim }, (_, i) => String(i + 1)), [dim]);
  // dia além do fim do mês novo (31 → fevereiro) vira o último dia do mês
  const set = (y: number, m: number, d: number) => onChange(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }} testID="date-wheels">
      <WheelPicker items={daysList} index={value.getDate() - 1} flex={0.7} onChange={(i) => set(value.getFullYear(), value.getMonth(), i + 1)} />
      <WheelPicker items={months} index={value.getMonth()} flex={1} onChange={(i) => set(value.getFullYear(), i, value.getDate())} />
      <WheelPicker items={years} index={Math.max(0, value.getFullYear() - minYear)} flex={1} onChange={(i) => set(minYear + i, value.getMonth(), value.getDate())} />
    </View>
  );
}
