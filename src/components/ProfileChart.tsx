import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PlainText } from './Text';
import { locale, tr } from '../lib/i18n';
import { colors } from '../lib/theme';

export type ChartBar = { label: string; value: number; from: Date; monthly: boolean };

/** Gráfico do Perfil como no Hevy (vídeo do Rodrigo, 2026-11-23): barras tocáveis (a escolhida fica azul claro), eixo com
 * 3 valores à esquerda e linhas de grade, datas embaixo (uma a cada 2 barras). O título acima usa `onPick` com a barra
 * escolhida; sem toque, vale a última (esta semana / este mês). `fmtAxis` formata os valores do eixo. */
export function ProfileChart({ data, fmtAxis, selected, onPick, height = 130 }: { data: ChartBar[]; fmtAxis: (v: number) => string; selected: number; onPick: (i: number) => void; height?: number }) {
  const [w, setW] = useState(0);
  const max = Math.max(...data.map((d) => d.value), 0);
  const top = niceTop(max);
  const ticks = [0, top / 2, top];
  const every = data.length > 8 ? 2 : 1; // datas a cada 2 barras quando são muitas
  const axisW = 46;
  const plotW = Math.max(0, w - axisW);
  const slot = data.length ? plotW / data.length : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} testID="profile-chart">
      <View style={{ height, flexDirection: 'row' }}>
        {/* eixo: valores à esquerda */}
        <View style={{ width: axisW, justifyContent: 'space-between' }}>
          {[...ticks].reverse().map((t, i) => <PlainText key={i} style={{ fontSize: 10, lineHeight: 12, color: colors.muted, marginTop: i === 0 ? -6 : 0, marginBottom: i === 2 ? -6 : 0 }}>{fmtAxis(t)}</PlainText>)}
        </View>
        <View style={{ flex: 1 }}>
          {/* linhas de grade */}
          {ticks.map((t, i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: height - (t / (top || 1)) * height, height: 1, backgroundColor: colors.border }} />)}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
            {data.map((d, i) => (
              <Pressable key={i} onPress={() => onPick(i)} testID={`chart-bar-${i}`} accessibilityRole="button" accessibilityState={{ selected: i === selected }}
                style={{ flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: Math.min(4, slot * 0.18) }}>
                <View style={{ height: d.value > 0 ? `${Math.max(2, (d.value / (top || 1)) * 100)}%` : 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: i === selected ? '#7DB9FF' : d.value > 0 ? colors.primary : colors.border }} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      {/* datas embaixo das barras */}
      <View style={{ flexDirection: 'row', marginLeft: axisW, marginTop: 6, height: 14 }}>
        {/* uma data a cada `every` barras, ocupando a largura delas (alinhada ao começo da barra) */}
        {data.map((d, i) => (i % every === 0 ? (
          <View key={i} style={{ flex: Math.min(every, data.length - i), paddingLeft: Math.min(4, slot * 0.18) }}>
            <PlainText numberOfLines={1} style={{ fontSize: 10, color: colors.muted }}>{shortLabel(d, i === 0)}</PlainText>
          </View>
        ) : null))}
      </View>
    </View>
  );
}

/** Data curta embaixo da barra: "7 set" (semana) ou "nov" / "dez 25" (mês; o ano aparece em janeiro e na primeira barra). */
function shortLabel(b: ChartBar, first: boolean) {
  const m = b.from.toLocaleDateString(locale(), { month: 'short' }).replace('.', '');
  if (!b.monthly) return `${b.from.getDate()} ${m}`;
  return first || b.from.getMonth() === 0 ? `${m} ${String(b.from.getFullYear()).slice(2)}` : m;
}

/** Topo "redondo" para o eixo: 2.300 → 3.000, 32.033 → 40.000, 1,6 h → 2. */
function niceTop(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10; // topo justo: 5,5 h → 6 h, 32 mil → 40 mil
  return step * p;
}

/** Legenda ao lado do número: "esta semana", "semana passada", "6 semanas atrás"; por mês, o nome do mês. */
export function barCaption(b: ChartBar) {
  if (b.monthly) return b.from.toLocaleDateString(locale(), { month: 'long', year: b.from.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  const weeks = Math.round((Date.now() - b.from.getTime()) / (7 * 864e5));
  if (weeks <= 0) return tr('this week');
  if (weeks === 1) return tr('last week');
  return tr('{n} weeks ago').replace('{n}', String(weeks));
}

