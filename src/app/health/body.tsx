import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Delta, fmtNum, HCard, HealthNotice, HTitle, InRangeChips, KpiTile, MC, RangeTabs, TrendChart, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { toDisplayWeight } from '../../lib/format';
import { dayKey, setSample, todayKey, useHealth, vsBaseline, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

/**
 * Corpo e sinais vitais (como Withings / Apple Saúde): peso, gordura corporal, SpO2, frequência respiratória
 * e a checagem dos sinais da última noite/dia contra a média do próprio usuário (14 dias). Não é diagnóstico.
 * Números sempre pelo `fmtNum` (vírgula em português: 81,2 kg) e valor grande + unidade pequena em Texts separados:
 * na web o `adjustsFontSizeToFit` não encolhe nada, e "15,0 resp/min" numa string só cortava em 360 px.
 */

type Range = '7' | '30';
type Field = 'weightKg' | 'bodyFatPct' | 'spo2' | 'respRate' | 'restingHr' | 'hrv';

/** Arredonda para 1 casa (só para conta; o texto sai pelo `fmtNum`). */
const r1 = (n: number) => Math.round(n * 10) / 10;
/** 1 casa fixa no formato do idioma (81,2 / 97,0). */
const f1 = (v: number) => fmtNum(v, 1);
/** Até 1 casa (97 / 96,8): gráficos com faixa típica, para a legenda sair "95–100%" e não "95,0–100,0%". */
const upTo1 = (v: number) => fmtNum(v, Number.isInteger(r1(v)) ? 0 : 1);
/** Sinal na frente do texto já formatado (sem sinal quando arredonda para zero). */
const signed = (n: number, body: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${body}`;
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const dateOf = (k: string) => new Date(`${k}T12:00:00`);
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** Faixas de referência sombreadas nos gráficos (como a faixa ideal do Eight Sleep): SpO2 95–100%, respiração em repouso 12–20/min. */
const SPO2_BAND: [number, number] = [95, 100];
const RESP_BAND: [number, number] = [12, 20];

/**
 * Checagem dos sinais (como Fitbit Health Metrics / Apple Vitals): faixa típica = média de 14 dias ± tolerância.
 * `abs` = tolerância em pontos (SpO2); senão é fração da média.
 * Respiração usa 'Breathing' (Respiração): 'Respiratory rate' em português cortava na linha ("Frequência respira...").
 */
const CHECKS: { key: Field; label: string; icon: IconName; color: string; unit: string; digits: 0 | 1; tol: number; abs?: boolean }[] = [
  { key: 'spo2', label: 'Blood oxygen', icon: 'water', color: MC.spo2, unit: '%', digits: 1, tol: 2, abs: true },
  { key: 'respRate', label: 'Breathing', icon: 'leaf', color: MC.resp, unit: 'br/min', digits: 1, tol: 0.1 },
  { key: 'restingHr', label: 'Resting HR', icon: 'heart', color: MC.heart, unit: 'bpm', digits: 0, tol: 0.1 },
  { key: 'hrv', label: 'HRV', icon: 'pulse', color: MC.hrv, unit: 'ms', digits: 0, tol: 0.2 },
];
type Check = (typeof CHECKS)[number];
/** Mínimo de medidas nos 14 dias anteriores para comparar (com 1 ou 2 noites a "média" acusaria fora da faixa à toa). */
const MIN_BASE = 3;

/** Unidade dentro de uma frase de uma linha só ("Sua média 96,8%"): "%" colado, as outras com espaço e traduzidas. */
const unitText = (u: string) => (u === '%' ? '%' : ` ${tr(u)}`);

/**
 * Número grande + unidade pequena ao lado (como o KpiTile). A unidade é um Text próprio, traduzido na hora
 * ('br/min' → 'resp/min'), e não encolhe; o número pode encolher no celular. Sem valor ('–') a unidade some.
 */
function ValueUnit({ value, unit, size, unitSize }: { value: string; unit?: string; size: number; unitSize: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: unit === '%' ? 1 : 3, minWidth: 0 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1, fontSize: size, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {!!unit && value !== '–' && <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: unitSize, fontWeight: '600', color: colors.muted }}>{unit}</Text>}
    </View>
  );
}

type Stat = { label: string; value: string; unit?: string; sub?: string };

/** Cartão de métrica: título colorido, até 3 números lado a lado (valor + unidade) e o gráfico. */
function MetricCard({ icon, color, title, right, stats, children }: {
  icon: IconName; color: string; title: string; right?: React.ReactNode; stats: Stat[]; children?: React.ReactNode;
}) {
  return (
    <HCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color }}>{title}</Text>
        {right}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{s.label}</Text>
            <ValueUnit value={s.value} unit={s.unit} size={22} unitSize={13} />
            {!!s.sub && <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>{s.sub}</Text>}
          </View>
        ))}
      </View>
      {children}
    </HCard>
  );
}

/** Barra da faixa típica: meio sombreado = típico; ponto = valor do dia. */
function RangeBar({ pos, color }: { pos: number; color: string }) {
  return (
    <View style={{ flex: 1, minWidth: 60, height: 12, justifyContent: 'center' }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
        <View style={{ position: 'absolute', left: '25%', width: '50%', top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.success, opacity: 0.4 }} />
      </View>
      <View style={{ position: 'absolute', left: `${pos * 100}%`, marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: color, borderWidth: 2, borderColor: colors.surface }} />
    </View>
  );
}

type VitalRowData = { c: Check; cur: number; base: number | null; typical: boolean | null; pos: number | null };

function VitalRow({ c, cur, base, typical, pos }: VitalRowData) {
  const tone = typical ? colors.success : colors.warn;
  return (
    <View style={{ gap: 8 }} testID={`vital-${c.key}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.color + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={c.icon} size={16} color={c.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{c.label}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{base != null ? `${tr('Your avg')} ${fmtNum(base, c.digits)}${unitText(c.unit)}` : tr('No baseline yet')}</Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          <ValueUnit value={fmtNum(cur, c.digits)} unit={c.unit} size={16} unitSize={11} />
        </View>
      </View>
      {pos != null && typical != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 40 }}>
          <RangeBar pos={pos} color={typical ? c.color : colors.warn} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <Ionicons name={typical ? 'checkmark-circle' : 'alert-circle'} size={13} color={tone} />
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: tone }}>{typical ? 'Typical' : 'Outside your range'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function BodyVitals() {
  const h = useHealth();
  const { profile } = useStore();
  const units = profile.units;
  const [range, setRange] = useState<Range>('7');
  const [sel, setSel] = useState<string | null>(null);
  const goIntegrations = () => router.push('/settings/integrations');

  if (!h.hasData) {
    return (
      <Screen>
        <Header title="Body & Vitals" />
        <ScrollView testID="health-body" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <HealthNotice isSample={false} onPress={goIntegrations} />
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <Ionicons name="body-outline" size={48} color={colors.faint} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>No body data yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 15 }}>Connect your watch, band or smart scale to see weight, body fat, blood oxygen and breathing rate.</Text>
          </View>
          <Btn title="Connect watch" icon="watch-outline" onPress={goIntegrations} testID="body-connect" />
          <Btn title="Try with sample data" icon="flask-outline" variant="secondary" onPress={() => setSample(true)} testID="body-sample" />
        </ScrollView>
      </Screen>
    );
  }

  // Período escolhido: um ponto por dia (dias sem medida ficam vazios no gráfico).
  const n = Number(range);
  const keys = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); return dayKey(d); });
  const byDate = new Map(h.days.map((d) => [d.date, d] as const));
  const inRange = keys.map((k) => byDate.get(k)).filter((d): d is DayHealth => !!d);
  const lab = (k: string) => dateOf(k).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const vals = (f: Field) => inRange.map((d) => d[f]).filter(num);
  const series = (f: Field, map: (v: number) => number = (v) => v) => keys.map((k) => { const v = byDate.get(k)?.[f]; return { label: lab(k), value: num(v) ? map(v) : null }; });
  const latest = (f: Field) => {
    for (let i = h.days.length - 1; i >= 0; i--) { const v = h.days[i][f]; if (num(v)) return { v, date: h.days[i].date }; }
    return null;
  };
  const periodLabel = range === '7' ? 'Last 7 days' : 'Last 30 days';

  // Peso (na unidade do perfil; a conta é em kg, o texto sai com 1 casa no formato do idioma)
  const wLatest = latest('weightKg');
  const wVals = vals('weightKg');
  const wDiff = wVals.length >= 2 ? r1(toDisplayWeight(wVals[wVals.length - 1] - wVals[0], units)) : null;
  const wChange = wDiff == null ? '–' : signed(wDiff, f1(Math.abs(wDiff)));

  // Gordura corporal
  const fLatest = latest('bodyFatPct');
  const fVals = vals('bodyFatPct');
  const fDiff = fVals.length >= 2 ? r1(fVals[fVals.length - 1] - fVals[0]) : null;
  const fChange = fDiff == null ? '–' : signed(fDiff, f1(Math.abs(fDiff)));

  // SpO2 e respiração
  const hasSpo2 = latest('spo2') != null;
  const sVals = vals('spo2');
  const sAvg = avgOf(sVals);
  const hasResp = latest('respRate') != null;
  const rVals = vals('respRate');
  const rAvg = avgOf(rVals);
  const brMin = tr('br/min');

  // FC de repouso (atalho para a tela do coração)
  const rhr = latest('restingHr');
  const rhrVs = rhr ? vsBaseline(h.days, rhr.date, (d) => d.restingHr) : null;

  // Checagem dos sinais: dia escolhido (padrão = o mais recente com algum sinal) contra a média de 14 dias
  const vDates = h.days.filter((d) => CHECKS.some((c) => num(d[c.key]))).map((d) => d.date);
  const vDate = sel && vDates.includes(sel) ? sel : vDates[vDates.length - 1];
  const vi = vDate ? vDates.indexOf(vDate) : -1;
  const vDay = vDate ? byDate.get(vDate) : undefined;
  const rows: VitalRowData[] = [];
  if (vDate && vDay) {
    for (const c of CHECKS) {
      const cur = vDay[c.key];
      if (!num(cur)) continue;
      const b = vsBaseline(h.days, vDate, (d) => d[c.key]);
      // Mesma janela do vsBaseline (14 dias anteriores): com menos de 3 medidas ainda não há "faixa típica" confiável.
      const nBase = h.days.filter((d) => d.date < vDate).slice(-14).filter((d) => num(d[c.key])).length;
      if (!b || nBase < MIN_BASE) { rows.push({ c, cur, base: null, typical: null, pos: null }); continue; }
      const typical = c.abs ? Math.abs(b.diff) <= c.tol : Math.abs(b.pct) <= c.tol;
      const spread = c.abs ? c.tol * 2 : b.base * c.tol * 2; // barra = média ± 2x a tolerância
      rows.push({ c, cur, base: b.base, typical, pos: spread > 0 ? clamp01((cur - (b.base - spread)) / (2 * spread)) : 0.5 });
    }
  }
  // Resumo no topo (como o "x/6 dentro da faixa" do Ultrahuman): só os sinais que foram de fato comparados.
  const inRangeItems = rows.filter((r) => r.typical != null).map((r) => ({ label: r.c.label, ok: r.typical === true }));
  const vLabel = !vDate ? '' : vDate === todayKey() ? 'Today' : dateOf(vDate).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Screen>
      <Header title="Body & Vitals" />
      <ScrollView testID="health-body" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {h.isSample && <HealthNotice isSample onPress={goIntegrations} />}

        <RangeTabs<Range> value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }]} />

        <HTitle title="Body" />
        <MetricCard
          icon="scale-outline"
          color={MC.weight}
          title="Weight"
          right={(
            <Pressable onPress={() => router.push('/profile/measures')} hitSlop={8} testID="body-log-measures" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Log measurements</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
          stats={[
            { label: 'Latest', value: wLatest ? f1(toDisplayWeight(wLatest.v, units)) : '–', unit: units.weight, sub: wLatest ? lab(wLatest.date) : undefined },
            { label: 'Change', value: wChange, unit: units.weight, sub: periodLabel },
          ]}
        >
          <TrendChart kind="line" color={MC.weight} data={series('weightKg', (v) => r1(toDisplayWeight(v, units)))} format={f1} unit={` ${units.weight}`} />
        </MetricCard>

        {fLatest && (
          <MetricCard
            icon="body"
            color={MC.fat}
            title="Body fat"
            stats={[
              { label: 'Latest', value: f1(fLatest.v), unit: '%', sub: lab(fLatest.date) },
              { label: 'Change', value: fChange, unit: '%', sub: periodLabel },
            ]}
          >
            <TrendChart kind="line" color={MC.fat} data={series('bodyFatPct')} format={f1} unit="%" />
          </MetricCard>
        )}

        <HTitle title="Vitals" />
        {hasSpo2 && (
          <MetricCard
            icon="water"
            color={MC.spo2}
            title="Blood oxygen"
            stats={[
              { label: 'Average', value: sAvg != null ? f1(sAvg) : '–', unit: '%' },
              { label: 'Lowest', value: sVals.length ? f1(Math.min(...sVals)) : '–', unit: '%' },
            ]}
          >
            {/* A faixa sombreada e a legenda "Faixa típica 95–100%" do gráfico substituem a nota de texto que havia aqui. */}
            <TrendChart kind="line" color={MC.spo2} data={series('spo2')} format={upTo1} unit="%" band={SPO2_BAND} />
          </MetricCard>
        )}
        {hasResp && (
          <MetricCard
            icon="leaf"
            color={MC.resp}
            title="Respiratory rate"
            stats={[
              { label: 'Average', value: rAvg != null ? f1(rAvg) : '–', unit: 'br/min' },
              { label: 'Min – max', value: rVals.length ? `${f1(Math.min(...rVals))}–${f1(Math.max(...rVals))}` : '–' },
            ]}
          >
            <TrendChart kind="line" color={MC.resp} data={series('respRate')} format={upTo1} unit={` ${brMin}`} band={RESP_BAND} />
          </MetricCard>
        )}
        {!hasSpo2 && !hasResp && !rhr && !rows.length && (
          <HCard><Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 12 }}>No vitals from your watch yet.</Text></HCard>
        )}
        {rhr && (
          <View style={{ flexDirection: 'row' }}>
            <KpiTile
              icon="heart"
              color={MC.heart}
              label="Resting HR"
              value={fmtNum(rhr.v)}
              unit="bpm"
              sub={lab(rhr.date)}
              delta={<Delta diff={rhrVs?.diff} unit=" bpm" higherIsBetter={false} />}
              onPress={() => router.push('/health/heart')}
              testID="body-resting-hr"
            />
          </View>
        )}

        {rows.length > 0 && (
          <HCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>Vitals check</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable disabled={vi <= 0} onPress={() => setSel(vDates[vi - 1])} hitSlop={10} style={{ padding: 4, opacity: vi <= 0 ? 0.3 : 1 }} testID="vitals-prev">
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text }}>{vLabel}</Text>
              <Pressable disabled={vi >= vDates.length - 1} onPress={() => setSel(vDates[vi + 1])} hitSlop={10} style={{ padding: 4, opacity: vi >= vDates.length - 1 ? 0.3 : 1 }} testID="vitals-next">
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>
            {inRangeItems.length > 0 && (
              <>
                <View testID="vitals-in-range">
                  <InRangeChips items={inRangeItems} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
              </>
            )}
            {rows.map((r) => <VitalRow key={r.c.key} {...r} />)}
            <Text style={{ fontSize: 12, color: colors.muted }}>Compared with your average of the previous 14 days.</Text>
          </HCard>
        )}

        <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>Not a medical device. Talk to a doctor about concerns.</Text>
      </ScrollView>
    </Screen>
  );
}
