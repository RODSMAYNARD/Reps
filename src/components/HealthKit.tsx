/**
 * Peças visuais da seção Saúde (todas as telas `src/app/health/*` usam estas).
 * Cores por métrica são fixas (iguais no claro e no escuro, como nos apps de saúde); fundo/texto vêm do tema.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Text } from './Text';
import { locale, tr } from '../lib/i18n';
import type { SleepSeg } from '../lib/health';
import { colors, radius } from '../lib/theme';

export const MC = {
  sleep: '#8E7CF0', deep: '#4B3FD6', rem: '#B49CFF', light: '#7FA8FF', awake: '#FF9F5A',
  heart: '#FF375F', hrv: '#30D158', move: '#FA114F', exercise: '#92E82A', stand: '#1EEAEF',
  steps: '#0A84FF', calories: '#FF9F0A', distance: '#5AC8FA', floors: '#BF5AF2',
  spo2: '#64D2FF', resp: '#66D4CF', vo2: '#FF6482', weight: '#AC8E68', fat: '#FFD60A',
} as const;
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Número no formato do idioma do app (1.234 / 1,5 em português). `digits` = casas decimais fixas. */
export const fmtNum = (v: number | null | undefined, digits = 0) =>
  v == null || !isFinite(v) ? '–' : v.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** X do toque dentro do elemento: `locationX` no celular; na web o clique chega como MouseEvent (`offsetX`). */
const touchX = (e: { nativeEvent: unknown }) => {
  const n = e.nativeEvent as { locationX?: number; offsetX?: number };
  return n.locationX ?? n.offsetX ?? 0;
};

/** Anel de progresso (0..1+, passa de 1 dá a volta com sombra mais forte). */
export function Ring({ value, size = 120, stroke = 12, color, track, children }: { value: number; size?: number; stroke?: number; color: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, value);
  const first = Math.min(1, v);
  const extra = v > 1 ? Math.min(1, v - 1) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? color + '33'} strokeWidth={stroke} fill="none" />
        {first > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * first} ${c}`} />}
        {extra > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.6} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * extra} ${c}`} />}
      </Svg>
      {children}
    </View>
  );
}

/** Três anéis concêntricos (Mover / Exercício / Passos), estilo relógio. */
export function ActivityRings({ rings, size = 132 }: { rings: { value: number; color: string }[]; size?: number }) {
  const stroke = Math.round(size * 0.1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <View key={i} style={{ position: 'absolute' }}>
          <Ring value={r.value} color={r.color} size={size - i * (stroke + 4) * 2} stroke={stroke} />
        </View>
      ))}
    </View>
  );
}

/** Seta com variação contra a média (verde = melhor, vermelho = pior; `higherIsBetter` define o sentido). */
export function Delta({ diff, unit = '', higherIsBetter = true, digits = 0 }: { diff: number | null | undefined; unit?: string; higherIsBetter?: boolean; digits?: number }) {
  if (diff == null || !isFinite(diff)) return null;
  const round = Math.round(Math.abs(diff) * 10 ** digits) / 10 ** digits;
  if (round === 0) return <Text style={{ fontSize: 12, color: colors.muted }}>= {tr('avg')}</Text>;
  const good = diff > 0 === higherIsBetter;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Ionicons name={diff > 0 ? 'arrow-up' : 'arrow-down'} size={12} color={good ? colors.success : colors.danger} />
      <Text style={{ fontSize: 12, color: good ? colors.success : colors.danger, fontVariant: ['tabular-nums'] }}>{round}{unit}</Text>
    </View>
  );
}

/** Cartão de indicador (grade de KPIs). */
export function KpiTile({ icon, color, label, value, unit, sub, delta, onPress, testID, style }: {
  icon: IconName; color: string; label: string; value: string; unit?: string; sub?: string; delta?: React.ReactNode; onPress?: () => void; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} testID={testID} style={[{ flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, fontSize: 13, fontWeight: '600', color }}>{label}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={colors.faint} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
        {!!unit && <Text style={{ fontSize: 13, color: colors.muted }}>{unit}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 16 }}>
        {!!sub && <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: colors.muted }}>{sub}</Text>}
        {delta}
      </View>
    </Pressable>
  );
}

/** Grade de 2 colunas para `KpiTile`. */
export function KpiGrid({ children }: { children: React.ReactNode[] }) {
  const items = children.filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => <View key={i} style={{ flexDirection: 'row', gap: 10 }}>{r}{r.length === 1 && <View style={{ flex: 1 }} />}</View>)}
    </View>
  );
}

/** Abas de período (7 dias / 30 dias). */
export function RangeTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm, backgroundColor: o.id === value ? colors.bg : 'transparent' }}>
          <Text style={{ fontSize: 13, fontWeight: o.id === value ? '700' : '500', color: o.id === value ? colors.text : colors.muted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Título de bloco dentro das telas de saúde. */
export function HTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{title}</Text>
      {right}
    </View>
  );
}

/** Cartão com fundo de superfície. */
export function HCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 }, style]}>{children}</View>;
}

export type TrendPoint = { label: string; value: number | null | undefined };
/**
 * Tendência por dia: barras (`bar`) ou linha (`line`). Valores ausentes ficam vazios (sem zero falso).
 * `goal` desenha a linha tracejada da meta; `avg` mostra a média no rodapé; toque numa barra mostra o valor.
 */
export function TrendChart({ data, kind = 'bar', color, height = 140, goal, band, format = (v) => String(Math.round(v)), unit = '' }: {
  data: TrendPoint[]; kind?: 'bar' | 'line'; color: string; height?: number; goal?: number;
  /** Faixa típica sombreada [mín, máx] (ex.: a média ±10% do usuário, ou 95–100% de SpO2). */
  band?: [number, number];
  format?: (v: number) => string; unit?: string;
}) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const vals = data.map((d) => d.value).filter((v): v is number => typeof v === 'number' && isFinite(v));
  if (!vals.length) return <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 30 }}>No data yet</Text>;
  const top = Math.max(...vals, goal ?? 0, band ? band[1] : 0);
  const bottom = kind === 'line' ? Math.min(...vals, band ? band[0] : Infinity) : 0;
  const lo = kind === 'line' ? bottom - (top - bottom || 1) * 0.15 : 0;
  const hi = top + (top - lo || 1) * 0.08;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const n = data.length;
  const slot = w / Math.max(1, n);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const shown = sel != null ? data[sel] : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, minHeight: 18 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>{shown ? shown.label : `${tr('Avg')} ${format(mean)}${unit}`}</Text>
        {shown && <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{shown.value != null ? `${format(shown.value)}${unit}` : '–'}</Text>}
      </View>
      <Pressable
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onPress={(e) => { if (!w) return; const i = Math.min(n - 1, Math.max(0, Math.floor(touchX(e) / slot))); setSel(sel === i ? null : i); }}
        style={{ height }}
      >
        {w > 0 && (
          <View style={{ pointerEvents: 'none' }}>
          <Svg width={w} height={height}>
            {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1={0} x2={w} y1={height * f} y2={height * f} stroke={colors.border} strokeWidth={1} />)}
            {band && <Rect x={0} width={w} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} fill={color} opacity={0.12} />}
            {kind === 'bar'
              ? data.map((d, i) => (d.value != null && isFinite(d.value) ? (
                <Rect key={i} x={i * slot + slot * 0.18} width={slot * 0.64} y={y(d.value)} height={Math.max(2, height - y(d.value))} rx={Math.min(4, slot * 0.25)} fill={color} opacity={sel == null || sel === i ? 1 : 0.35} />
              ) : null))
              : (() => {
                const pts = data.map((d, i) => (d.value != null && isFinite(d.value) ? `${i * slot + slot / 2},${y(d.value)}` : null)).filter(Boolean).join(' ');
                return (
                  <>
                    <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                    {data.map((d, i) => (d.value != null && isFinite(d.value) ? <Circle key={i} cx={i * slot + slot / 2} cy={y(d.value)} r={sel === i ? 5 : n > 14 ? 2 : 3.5} fill={color} /> : null))}
                  </>
                );
              })()}
            {goal != null && <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="5 5" />}
          </Svg>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[0]?.label}</Text>
        {goal != null && <Text style={{ color: colors.muted, fontSize: 11 }}>- - {tr('Target')} {format(goal)}{unit}</Text>}
        {goal == null && band && <Text style={{ color: colors.muted, fontSize: 11 }}>▮ {tr('Typical range')} {format(band[0])}–{format(band[1])}{unit}</Text>}
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[n - 1]?.label}</Text>
      </View>
    </View>
  );
}

const STAGE_ROW: Record<SleepSeg['s'], number> = { awake: 0, rem: 1, light: 2, deep: 3 };
export const STAGE_LABEL: Record<SleepSeg['s'], string> = { awake: 'Awake', rem: 'REM', light: 'Light sleep', deep: 'Deep' }; // 'Light' sozinho já é "Claro" (tema) no dicionário
export const STAGE_COLOR: Record<SleepSeg['s'], string> = { awake: MC.awake, rem: MC.rem, light: MC.light, deep: MC.deep };

/** Hipnograma: estágios da noite ao longo do tempo (uma faixa por estágio). Toque mostra o estágio e o horário. */
export function Hypnogram({ segs, height = 120 }: { segs: SleepSeg[]; height?: number }) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<SleepSeg | null>(null);
  if (!segs.length) return null;
  const a = Math.min(...segs.map((s) => s.a)), b = Math.max(...segs.map((s) => s.b));
  const span = Math.max(1, b - a);
  const rowH = height / 4;
  const clock = (ms: number) => `${String(new Date(ms).getHours()).padStart(2, '0')}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`;
  const pick = (x: number) => {
    if (!w) return;
    const t = a + (Math.max(0, Math.min(w, x)) / w) * span;
    const hit = segs.find((s) => t >= s.a && t <= s.b) ?? null;
    setSel(hit && sel && hit.a === sel.a && hit.s === sel.s ? null : hit);
  };
  return (
    <View>
      <View style={{ minHeight: 20, marginBottom: 4, marginLeft: 64 }}>
        {sel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STAGE_COLOR[sel.s] }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{STAGE_LABEL[sel.s]}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>{clock(sel.a)}–{clock(sel.b)} · {Math.round((sel.b - sel.a) / 60000)} min</Text>
          </View>
        ) : <Text style={{ fontSize: 12, color: colors.faint }}>Tap the chart to see each stage</Text>}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 64, height }}>
          {(['awake', 'rem', 'light', 'deep'] as const).map((s) => (
            <View key={s} style={{ height: rowH, justifyContent: 'center' }}><Text numberOfLines={1} style={{ fontSize: 11, color: STAGE_COLOR[s] }}>{STAGE_LABEL[s]}</Text></View>
          ))}
        </View>
        <Pressable style={{ flex: 1, height }} onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => pick(touchX(e))} testID="hypnogram">
          {w > 0 && (
            <View style={{ pointerEvents: 'none' }}>
              <Svg width={w} height={height}>
                {[0, 1, 2, 3].map((i) => <Rect key={i} x={0} y={i * rowH + 2} width={w} height={rowH - 4} rx={4} fill={colors.border} opacity={0.35} />)}
                {segs.map((s, i) => (
                  <Rect key={i} x={((s.a - a) / span) * w} y={STAGE_ROW[s.s] * rowH + 3} width={Math.max(1.5, ((s.b - s.a) / span) * w)} height={rowH - 6} rx={3} fill={STAGE_COLOR[s.s]} opacity={!sel || (sel.a === s.a && sel.s === s.s) ? 1 : 0.35} />
                ))}
                {sel && <Line x1={(((sel.a + sel.b) / 2 - a) / span) * w} x2={(((sel.a + sel.b) / 2 - a) / span) * w} y1={0} y2={height} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />}
              </Svg>
            </View>
          )}
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginLeft: 64 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{clock(a)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{clock(a + span / 2)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{clock(b)}</Text>
      </View>
    </View>
  );
}

/** Barra horizontal empilhada (ex.: estágios do sono em %). */
export function StackBar({ parts, height = 12 }: { parts: { value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: colors.border }}>
      {parts.map((p, i) => <View key={i} style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }} />)}
    </View>
  );
}

/** Linha de legenda/valor (cor, nome, valor à direita, barra de proporção opcional). */
export function LegendRow({ color, label, value, frac, range }: {
  color: string; label: string; value: string; frac?: number;
  /** Faixa típica [de, até] em fração 0..1 da mesma barra (desenhada como uma moldura clara por cima). */
  range?: [number, number];
}) {
  const c01 = (x: number) => Math.max(0, Math.min(1, x));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>{label}</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      {frac != null && (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, marginLeft: 18, justifyContent: 'center' }}>
          <View style={{ width: `${c01(frac) * 100}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
          {range && (
            <View style={{ position: 'absolute', left: `${c01(range[0]) * 100}%`, width: `${Math.max(0.01, c01(range[1]) - c01(range[0])) * 100}%`, top: -3, bottom: -3, borderRadius: 4, borderWidth: 1.5, borderColor: colors.text, opacity: 0.55 }} />
          )}
        </View>
      )}
    </View>
  );
}

/** Gráfico de linha do dia (ex.: batimentos de hoje) com eixo de horas 0-24. */
export function DayLine({ points, color, height = 120, unit = '' }: { points: { t: number; v: number }[]; color: string; height?: number; unit?: string }) {
  const [w, setW] = useState(0);
  if (points.length < 2) return <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 30 }}>No data yet</Text>;
  const d0 = new Date(points[0].t); d0.setHours(0, 0, 0, 0);
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs) - 5, hi = Math.max(...vs) + 5;
  const x = (t: number) => ((t - d0.getTime()) / 86400000) * w;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>{Math.round(Math.min(...vs))}–{Math.round(Math.max(...vs))}{unit}</Text>
      </View>
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {[6, 12, 18].map((h) => <Line key={h} x1={(h / 24) * w} x2={(h / 24) * w} y1={0} y2={height} stroke={colors.border} strokeWidth={1} />)}
            <Polyline points={points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {['00', '06', '12', '18', '24'].map((h) => <Text key={h} style={{ color: colors.muted, fontSize: 11 }}>{h}h</Text>)}
      </View>
    </View>
  );
}

/** Aviso de dados de exemplo / sem conexão (topo das telas de saúde). */
export function HealthNotice({ isSample, onPress }: { isSample: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: isSample ? colors.warnSoft : colors.primarySoft }}>
      <Ionicons name={isSample ? 'flask-outline' : 'watch-outline'} size={20} color={isSample ? colors.warn : colors.primary} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{isSample ? 'Sample data. Connect your watch or band to see your own numbers.' : 'Connect your watch or band to see your numbers.'}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Mini-anéis dos últimos dias (como o resumo semanal do relógio). `onPress(i)` escolhe o dia. */
export function WeekRings({ days, selected, onPress, size = 34 }: {
  days: { label: string; rings: { value: number; color: string }[] }[]; selected?: number; onPress?: (i: number) => void; size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d, i) => (
        <Pressable key={i} onPress={onPress ? () => onPress(i) : undefined} disabled={!onPress} style={{ alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2, borderRadius: radius.sm, backgroundColor: selected === i ? colors.surfaceAlt : 'transparent' }}>
          <ActivityRings rings={d.rings} size={size} />
          <Text style={{ fontSize: 11, color: selected === i ? colors.text : colors.muted, fontWeight: selected === i ? '700' : '400' }}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Passos acumulados ao longo do dia (0–24 h) com a linha da meta e o ponto em que ela foi batida.
 * `byHour` = passos em cada hora; `untilHour` corta a linha na hora atual (hoje).
 */
export function CumulativeLine({ byHour, goal, color, untilHour = 23, height = 120 }: { byHour: number[]; goal?: number; color: string; untilHour?: number; height?: number }) {
  const [w, setW] = useState(0);
  const cum: number[] = [];
  byHour.slice(0, untilHour + 1).forEach((v, i) => cum.push((cum[i - 1] ?? 0) + (v || 0)));
  const total = cum[cum.length - 1] ?? 0;
  if (!total) return <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 30 }}>No data yet</Text>;
  const hi = Math.max(total, goal ?? 0) * 1.1;
  const x = (h: number) => (h / 24) * w;
  const y = (v: number) => height - (v / hi) * height;
  const pts = [`${x(0)},${y(0)}`, ...cum.map((v, i) => `${x(i + 1)},${y(v)}`)].join(' ');
  const hitIdx = goal ? cum.findIndex((v) => v >= goal) : -1;
  return (
    <View>
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {[6, 12, 18].map((h) => <Line key={h} x1={x(h)} x2={x(h)} y1={0} y2={height} stroke={colors.border} strokeWidth={1} />)}
            {goal != null && <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="5 5" />}
            <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {hitIdx >= 0 && <Circle cx={x(hitIdx + 1)} cy={y(cum[hitIdx])} r={5} fill={colors.success} stroke={colors.bg} strokeWidth={2} />}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {['00', '06', '12', '18', '24'].map((h) => <Text key={h} style={{ color: colors.muted, fontSize: 11 }}>{h}h</Text>)}
      </View>
    </View>
  );
}

/** "N de M dentro da sua faixa" com um selo por métrica (verde dentro, amarelo fora). */
export function InRangeChips({ items }: { items: { label: string; ok: boolean }[] }) {
  if (!items.length) return null;
  const ok = items.filter((i) => i.ok).length;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{ok}/{items.length} {tr('metrics within your range')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.map((i) => (
          <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: i.ok ? colors.successSoft : colors.warnSoft }}>
            <Ionicons name={i.ok ? 'checkmark-circle' : 'alert-circle'} size={14} color={i.ok ? colors.success : colors.warn} />
            <Text style={{ fontSize: 12, color: colors.text }}>{i.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
