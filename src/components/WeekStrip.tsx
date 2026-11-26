import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PlainText, Text } from './Text';
import { locale, tr } from '../lib/i18n';
import { colors } from '../lib/theme';
import { dayId } from '../lib/today';
import type { Workout } from '../lib/types';

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const midnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/** Sigla curta do dia como no ProteinWay: "Seg", "Ter", "Sáb" (sem o ponto do pt-BR). */
export const weekdayShort = (d: Date) => { const s = d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Linha acima da faixa (como no ProteinWay, 2026-11-23): "Hoje, segunda, 23 de nov" ou "Vendo sábado, 21 de nov";
 * com outro dia escolhido aparece o botão "← Voltar para hoje". */
export function DayHeader({ day, onToday, testID }: { day: Date; onToday: () => void; testID?: string }) {
  const isToday = dayId(day) === dayId(new Date());
  const label = day.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 36 }} testID={testID}>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '600', color: isToday ? colors.muted : colors.primary }}>
        {tr(isToday ? 'Today, {d}' : 'Viewing {d}').replace('{d}', label)}
      </Text>
      {!isToday && (
        <Pressable onPress={onToday} hitSlop={6} accessibilityRole="button" testID={testID ? `${testID}-today` : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primarySoft }}>
          <Ionicons name="arrow-back" size={15} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Back to today</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Faixa de dias que desliza para os dois lados sem fim, igual ao DateStrip do ProteinWay: começa com 60 dias passados e
 * 30 futuros e cresce perto das pontas, encaixa dia a dia e abre com hoje em 3º a partir da esquerda. Quando `focus` muda
 * (toque longe, "Voltar para hoje"), traz o dia para a tela se estiver fora. Usada na H2 (WeekStrip) e na tela Saúde. */
export function DateScroller({ width, testID, focus, renderDay }: { width: number; testID?: string; focus?: Date; renderDay: (day: { d: Date; off: number; isToday: boolean; cw: number }) => React.ReactNode }) {
  const cw = (width - 36) / 7, step = cw + 6;
  const ref = useRef<ScrollViewInstance>(null);
  const today = useMemo(() => midnight(new Date()), []);
  const todayKey = dayId(today);
  const [past, setPast] = useState(60), [fut, setFut] = useState(30);
  const x = useRef(0), shift = useRef(0), placed = useRef(false);
  const days = Array.from({ length: past + fut + 1 }, (_, i) => { const off = i - past; return { off, d: addDays(today, off) }; });

  // Hoje em 3º a partir da esquerda, depois do layout (e de novo se a largura ou o dia mudarem).
  useEffect(() => {
    placed.current = false;
    const t = setTimeout(() => { ref.current?.scrollTo({ x: (past - 2) * step, animated: false }); x.current = (past - 2) * step; placed.current = true; }, 60);
    return () => clearTimeout(t);
  }, [cw, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Dia escolhido fora da tela: rola até ele (deixa 2 dias antes, como o ProteinWay).
  const focusKey = focus ? dayId(focus) : '';
  useEffect(() => {
    if (!focus || !placed.current) return;
    const off = Math.round((midnight(focus).getTime() - today.getTime()) / 864e5);
    if (off < -past || off > fut) return;
    const at = (past + off) * step;
    if (at < x.current || at > x.current + 7 * step - step) { x.current = Math.max(0, at - 2 * step); ref.current?.scrollTo({ x: x.current, animated: true }); }
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Dias somados no lado do passado empurram a faixa para a direita: move a rolagem o mesmo tanto, antes de pintar.
  useLayoutEffect(() => { if (!shift.current) return; x.current += shift.current; shift.current = 0; ref.current?.scrollTo({ x: x.current, animated: false }); }, [past]);
  const onScroll = (e: { nativeEvent: { contentOffset: { x: number }; contentSize: { width: number }; layoutMeasurement: { width: number } } }) => {
    const n = e.nativeEvent; x.current = n.contentOffset.x;
    if (!placed.current || shift.current) return;
    if (n.contentOffset.x < step * 10) { shift.current = 60 * step; setPast((v) => v + 60); }
    else if (n.contentOffset.x + n.layoutMeasurement.width > n.contentSize.width - step * 10) setFut((v) => v + 30);
  };

  return (
    <ScrollView ref={ref} onScroll={onScroll} scrollEventThrottle={64} horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" testID={testID} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {days.map(({ off, d }) => <View key={dayId(d)}>{renderDay({ d, off, isToday: off === 0, cw })}</View>)}
    </ScrollView>
  );
}

/** Faixa de dias da H2 (opção C do Rods-Design-Choices, 2026-11-23). Cada dia só tem dois estados: treinou (anel azul inteiro,
 * número azul) ou não (anel fino claro). Sigla de hoje em azul; dia escolhido em fundo azul claro; futuros apagados, sem anel
 * e sem toque. Toque num dia passado escolhe o dia (`onSelect`). */
export function WeekStrip({ workouts, width, selected, onSelect, testID }: { workouts: Workout[]; width: number; selected: Date; onSelect: (d: Date) => void; testID?: string }) {
  const done = useMemo(() => new Set(workouts.map((w) => dayId(new Date(w.date)))), [workouts]);
  const selKey = dayId(selected);
  return (
    <DateScroller width={width} testID={testID} focus={selected} renderDay={({ d, off, isToday, cw }) => {
      const k = dayId(d), trained = done.has(k), future = off > 0, sel = k === selKey;
      return (
        <Pressable testID={trained ? 'h2-day-done' : 'h2-day'} accessibilityRole="button" accessibilityState={{ selected: sel }} disabled={future}
          accessibilityLabel={`${d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}${trained ? ', ✓' : ''}`}
          onPress={() => onSelect(d)}
          style={{ width: cw, alignItems: 'center', gap: 6, paddingVertical: 9, borderRadius: 18, backgroundColor: sel ? colors.primarySoft : 'transparent', opacity: future ? 0.45 : 1 }}>
          {/* PlainText: a sigla já vem no idioma do app; o dicionário trocaria "Sex" (sexta) por "Sexo" */}
          <PlainText style={{ fontSize: 12, lineHeight: 14, fontWeight: sel || isToday ? '800' : '600', color: isToday ? colors.primary : colors.muted }}>{weekdayShort(d)}</PlainText>
          <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            {!future && (
              <Svg width={36} height={36} style={{ position: 'absolute' }}>
                <Circle cx={18} cy={18} r={15.5} fill="none" stroke={trained ? colors.primary : colors.border} strokeWidth={trained ? 2.6 : 1.6} />
              </Svg>
            )}
            <Text style={{ fontSize: 15, lineHeight: 18, fontWeight: sel || isToday ? '800' : '600', color: trained ? colors.primary : colors.text }}>{d.getDate()}</Text>
          </View>
        </Pressable>
      );
    }} />
  );
}
