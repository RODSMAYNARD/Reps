import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextStyle } from 'react-native';
import { Delta, fmtNum, HCard, HealthNotice, Hypnogram, HTitle, KpiGrid, KpiTile, LegendRow, MC, RangeTabs, Ring, StackBar, STAGE_COLOR, TrendChart, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { bedtimeConsistency, dayKey, fmtClock, fmtSleep, setSample, sleepScore, todayKey, useHealth, vsBaseline, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { colors } from '../../lib/theme';

/** Sono: nota da noite, linha da noite na cama, estágios (hipnograma + faixas típicas), tendências de 7/30 dias, médias, dívida de sono e dicas. */

type Range = '7' | '30';
type StageKey = 'deep' | 'light' | 'rem' | 'awake';
type RangeStatus = 'ok' | 'low' | 'high';

// Ordem da barra empilhada e da legenda. Faixa típica = fração da noite (dormindo + acordado), na mesma escala 0..1
// da barra de cada estágio. Referência geral, não diagnóstico.
const STAGES: { key: StageKey; label: string; range: [number, number] }[] = [
  { key: 'deep', label: 'Deep sleep', range: [0.13, 0.23] },
  { key: 'light', label: 'Light sleep', range: [0.5, 0.6] },
  { key: 'rem', label: 'REM sleep', range: [0.2, 0.25] },
  { key: 'awake', label: 'Awake', range: [0, 0.05] },
];
/** Faixa típica da nota do sono no gráfico (70 = "Good", 85 = "Great night", ver `verdict`). */
const SCORE_BAND: [number, number] = [70, 85];

const TIPS: { icon: IconName; text: string }[] = [
  { icon: 'alarm-outline', text: 'Keep the same bedtime and wake-up time, even on weekends.' },
  { icon: 'cafe-outline', text: 'Finish hard training and caffeine a few hours before bed.' },
  { icon: 'snow-outline', text: 'Sleep in a cool, dark and quiet room.' },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
const pad = (n: number) => String(n).padStart(2, '0');
/** fmtSleep com minutos inteiros (evita "7h 60m" quando a média vem quebrada). */
const sleepTxt = (m?: number) => fmtSleep(m == null ? undefined : Math.round(m));
/** Noite com estágios de verdade (sem estágios, o Health Connect grava a sessão inteira como "leve"). */
const hasBreakdown = (d: DayHealth) => (d.deepMin ?? 0) + (d.remMin ?? 0) > 0;
const verdict = (s: number) => (s >= 85 ? 'Great night' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : 'Poor');
const dateLabel = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
/** Horas no formato do idioma ("6,5h" em português); valor inteiro sem casa decimal ("Meta 8h"). */
const fmtHours = (v: number) => `${fmtNum(v, Number.isInteger(v) ? 0 : 1)}h`;
/** Situação do estágio frente à faixa típica, pelo % arredondado (o mesmo número que aparece na tela). */
const stageStatus = (pct: number, [lo, hi]: [number, number]): RangeStatus =>
  pct < Math.round(lo * 100) ? 'low' : pct > Math.round(hi * 100) ? 'high' : 'ok';

/** Últimos `n` dias (AAAA-MM-DD), do mais antigo até hoje. */
const lastKeys = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i));
  return dayKey(d);
});

/** Média circular de horários (23:30 e 00:30 dão 00:00, não 12:00). Devolve minutos do dia. */
const clockMean = (ms: number[]) => {
  if (!ms.length) return undefined;
  let sin = 0, cos = 0;
  for (const t of ms) {
    const d = new Date(t);
    const a = ((d.getHours() * 60 + d.getMinutes()) / 1440) * 2 * Math.PI;
    sin += Math.sin(a); cos += Math.cos(a);
  }
  if (Math.hypot(sin, cos) < 1e-6) return undefined;
  const m = Math.round((Math.atan2(sin, cos) / (2 * Math.PI)) * 1440);
  return ((m % 1440) + 1440) % 1440;
};
const fmtMinOfDay = (m?: number) => (m == null ? '–' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`);

function MiniStat({ label, value, flex = 1 }: { label: string; value: string; flex?: number }) {
  return (
    <View style={{ flex, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/** Duração com os números grandes e as letras das unidades pequenas ("7h 12m"), como nos apps de sono. Sem dado = "–". */
function BigDuration({ min, size = 28 }: { min?: number; size?: number }) {
  const big: TextStyle = { fontSize: size, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] };
  if (min == null) return <Text style={big}>–</Text>;
  const m = Math.round(min);
  const unit: TextStyle = { fontSize: Math.round(size * 0.55), fontWeight: '700', color: colors.muted };
  return (
    <Text numberOfLines={1} style={big}>
      {Math.floor(m / 60)}<Text style={unit}>h</Text>{' '}{pad(m % 60)}<Text style={unit}>m</Text>
    </Text>
  );
}

function NavArrow({ icon, onPress, testID }: { icon: IconName; onPress?: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={10} testID={testID}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, opacity: onPress ? 1 : 0.35 }}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Selo "dentro / abaixo / acima da faixa típica" (mesmas cores do InRangeChips do kit). */
function RangePill({ status }: { status: RangeStatus }) {
  const ok = status === 'ok';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: ok ? colors.successSoft : colors.warnSoft }}>
      <Ionicons name={ok ? 'checkmark-circle' : status === 'low' ? 'arrow-down' : 'arrow-up'} size={12} color={ok ? colors.success : colors.warn} />
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.text }}>{ok ? 'In range' : status === 'low' ? 'Low' : 'High'}</Text>
    </View>
  );
}

export default function SleepScreen() {
  const h = useHealth();
  const [sel, setSel] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('7');
  const goal = h.goals.sleepMin;
  const nights = useMemo(() => h.days.filter((d) => (d.sleepMin ?? 0) > 0), [h.days]);
  const byDate = useMemo(() => new Map(h.days.map((d) => [d.date, d] as const)), [h.days]);
  const goConnect = () => router.push('/settings/integrations');

  if (!h.hasData) {
    return (
      <Screen>
        <Header title="Sleep" />
        <ScrollView testID="health-sleep" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <HealthNotice isSample={false} onPress={goConnect} />
          <HCard style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <Ionicons name="moon" size={44} color={MC.sleep} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>No sleep data yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Wear your watch or band to bed to see your sleep score, stages and trends.</Text>
            <Btn title="Connect watch" icon="watch-outline" onPress={goConnect} style={{ alignSelf: 'stretch' }} testID="sleep-connect" />
            <Btn title="Try with sample data" variant="outline" icon="flask-outline" onPress={() => setSample(true)} style={{ alignSelf: 'stretch' }} testID="sleep-sample" />
          </HCard>
        </ScrollView>
      </Screen>
    );
  }

  // Noite escolhida (padrão: a mais recente com sono)
  const night = nights.find((d) => d.date === sel) ?? nights[nights.length - 1];
  const pos = night ? nights.indexOf(night) : -1;
  const prev = pos > 0 ? nights[pos - 1] : undefined;
  const next = pos >= 0 && pos < nights.length - 1 ? nights[pos + 1] : undefined;

  // Período das tendências e médias
  const keys = lastKeys(range === '7' ? 7 : 30);
  const rangeNights = keys.map((k) => byDate.get(k)).filter((d): d is DayHealth => !!d && (d.sleepMin ?? 0) > 0);
  const staged = rangeNights.filter(hasBreakdown);
  const avgSleep = avg(rangeNights.map((d) => d.sleepMin!));
  const stagedSleep = avg(staged.map((d) => d.sleepMin!));
  const avgDeep = avg(staged.map((d) => d.deepMin ?? 0));
  const avgRem = avg(staged.map((d) => d.remMin ?? 0));
  // Acordado: só noites que registraram esse número (ausente não vira 0 falso).
  const avgAwake = avg(staged.filter((d) => d.awakeMin != null).map((d) => d.awakeMin!));
  const ofSleep = (x?: number) => (x != null && stagedSleep ? `${fmtNum((x / stagedSleep) * 100)}% ${tr('of sleep')}` : undefined);
  const avgBed = clockMean(rangeNights.filter((d) => d.bedtime != null).map((d) => d.bedtime!));
  const avgWake = clockMean(rangeNights.filter((d) => d.wakeTime != null).map((d) => d.wakeTime!));
  const consistency = bedtimeConsistency(rangeNights, Math.max(1, rangeNights.length));
  const week = lastKeys(7).map((k) => byDate.get(k)).filter((d): d is DayHealth => !!d && (d.sleepMin ?? 0) > 0);
  const debt = week.length ? week.reduce((s, d) => s + Math.max(0, goal - d.sleepMin!), 0) : undefined;
  const sleepBars = keys.map((k) => { const d = byDate.get(k); return { label: String(Number(k.slice(8))), value: d?.sleepMin ? Math.round(d.sleepMin / 6) / 10 : null }; });
  const scorePts = keys.map((k) => ({ label: String(Number(k.slice(8))), value: sleepScore(byDate.get(k), goal) }));

  return (
    <Screen>
      <Header title="Sleep" />
      <ScrollView testID="health-sleep" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {h.isSample && <HealthNotice isSample onPress={goConnect} />}

        {!night ? (
          <HCard style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <Ionicons name="moon" size={44} color={MC.sleep} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>No sleep recorded yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Wear your watch or band to bed to see your sleep score, stages and trends.</Text>
          </HCard>
        ) : (
          <>
            {/* Seletor de noite */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <NavArrow icon="chevron-back" testID="sleep-prev" onPress={prev ? () => setSel(prev.date) : undefined} />
              <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{dateLabel(night.date)}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, minHeight: 16 }}>{night.date === todayKey() ? 'Last night' : ''}</Text>
              </View>
              <NavArrow icon="chevron-forward" testID="sleep-next" onPress={next ? () => setSel(next.date) : undefined} />
            </View>

            <NightHero night={night} goal={goal} days={h.days} />

            <HTitle title="Sleep stages" />
            <StagesCard night={night} />
          </>
        )}

        <HTitle title="Trends" />
        <RangeTabs<Range> value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }]} />
        <HCard>
          <Text style={{ fontWeight: '700', color: colors.text }}>Time asleep</Text>
          <TrendChart key={range} data={sleepBars} color={MC.sleep} goal={goal > 0 ? goal / 60 : undefined} format={fmtHours} />
        </HCard>

        <HTitle
          title="Averages"
          right={<Text style={{ fontSize: 13, color: colors.muted }}>{rangeNights.length} {rangeNights.length === 1 ? 'night' : 'nights'}</Text>}
        />
        <KpiGrid>
          <KpiTile icon="moon" color={MC.sleep} label="Time asleep" value={sleepTxt(avgSleep)} sub={`${tr('Sleep goal')} ${fmtSleep(goal)}`} testID="sleep-avg" />
          <KpiTile icon="water" color={MC.deep} label="Deep" value={sleepTxt(avgDeep)} sub={ofSleep(avgDeep)} />
          <KpiTile icon="sparkles" color={MC.rem} label="REM" value={sleepTxt(avgRem)} sub={ofSleep(avgRem)} />
          <KpiTile icon="eye-outline" color={MC.awake} label="Awake" value={sleepTxt(avgAwake)} sub={avgAwake != null ? tr('per night') : undefined} />
          <KpiTile icon="bed-outline" color={MC.deep} label="Bedtime" value={fmtMinOfDay(avgBed)} />
          <KpiTile icon="sunny-outline" color={MC.calories} label="Wake-up" value={fmtMinOfDay(avgWake)} />
          <KpiTile icon="time-outline" color={MC.sleep} label="Consistency" value={consistency != null ? `±${fmtNum(consistency)}` : '–'} unit={consistency != null ? 'min' : undefined} sub={tr('Bedtime variation')} />
          <KpiTile icon="hourglass-outline" color={MC.awake} label="Sleep debt" value={sleepTxt(debt)} sub={tr('Last 7 nights')} testID="sleep-debt" />
        </KpiGrid>

        <HCard>
          <Text style={{ fontWeight: '700', color: colors.text }}>Sleep score</Text>
          {/* Faixa sombreada 70–85 (rodapé "Typical range 70–85", desenhado pelo TrendChart) */}
          <TrendChart key={range} kind="line" data={scorePts} color={MC.sleep} band={SCORE_BAND} />
        </HCard>

        <HTitle title="Sleep tips" />
        <HCard>
          {TIPS.map((t) => (
            <View key={t.text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons name={t.icon} size={18} color={MC.sleep} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.text }}>{t.text}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 12, color: colors.muted }}>Not a medical device. Talk to a doctor about concerns.</Text>
        </HCard>
      </ScrollView>
    </Screen>
  );
}

/** Cartão principal da noite: nota (anel), tempo dormindo x meta, veredito, linha da noite na cama e números da noite. */
function NightHero({ night, goal, days }: { night: DayHealth; goal: number; days: DayHealth[] }) {
  const score = sleepScore(night, goal);
  const slept = night.sleepMin ?? 0;
  const staged = hasBreakdown(night);
  const inBed = night.bedtime != null && night.wakeTime != null && night.wakeTime > night.bedtime ? (night.wakeTime - night.bedtime) / 60000 : undefined;
  const eff = staged && inBed ? Math.min(100, Math.round((slept / inBed) * 100)) : undefined;
  const vs = vsBaseline(days, night.date, (d) => d.sleepMin);
  const tone = score == null ? colors.muted : score >= 70 ? colors.success : score >= 50 ? colors.warn : colors.danger;
  return (
    <HCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring value={(score ?? 0) / 100} size={112} stroke={11} color={MC.sleep}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{score ?? '–'}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, color: colors.muted, maxWidth: 84 }}>Sleep score</Text>
        </Ring>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>Time asleep</Text>
          <BigDuration min={night.sleepMin} />
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
            <View style={{ width: `${goal > 0 ? Math.min(1, slept / goal) * 100 : 0}%`, height: 6, borderRadius: 3, backgroundColor: MC.sleep }} />
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>Sleep goal {fmtSleep(goal)}</Text>
          {vs != null && Math.round(vs.diff) !== 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Delta diff={vs.diff} unit=" min" />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: colors.muted }}>vs 14-day avg</Text>
            </View>
          )}
          {score != null && <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: tone }} testID="sleep-verdict">{verdict(score)}</Text>}
        </View>
      </View>
      <NightLine night={night} />
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MiniStat label="In bed" value={sleepTxt(inBed)} />
        <MiniStat label="Awake" value={staged ? fmtSleep(night.awakeMin) : '–'} />
        <MiniStat label="Efficiency" value={eff != null ? `${fmtNum(eff)}%` : '–'} />
      </View>
    </HCard>
  );
}

/**
 * Linha fina da noite na cama, do deitar (lua) ao acordar (sol): roxo = dormindo, laranja = acordado.
 * Sem pedaços guardados (noites com mais de 7 dias) a linha fica inteira em roxo; vãos sem registro ficam vazios.
 */
function NightLine({ night }: { night: DayHealth }) {
  const a = night.bedtime, b = night.wakeTime;
  if (a == null || b == null || b <= a) return null;
  const span = b - a;
  // Junta pedaços vizinhos do mesmo tipo (dormindo/acordado) para não aparecer emenda entre eles.
  const runs: { awake: boolean; a: number; b: number }[] = [];
  for (const s of [...(night.stages ?? [])].sort((x, y) => x.a - y.a)) {
    const awake = s.s === 'awake';
    const last = runs[runs.length - 1];
    if (last && last.awake === awake && s.a - last.b <= 60000) last.b = Math.max(last.b, s.b);
    else runs.push({ awake, a: s.a, b: s.b });
  }
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - a) / span) * 100));
  const clock: TextStyle = { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] };
  return (
    <View style={{ gap: 6 }} testID="sleep-timeline" accessibilityLabel={`${tr('Bedtime')} ${fmtClock(a)}, ${tr('Wake-up')} ${fmtClock(b)}`}>
      <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: runs.length ? colors.border : MC.sleep }}>
        {[...runs.filter((r) => !r.awake), ...runs.filter((r) => r.awake)].map((r, i) => {
          const left = pct(r.a);
          return (
            <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${Math.min(100 - left, Math.max(0.8, pct(r.b) - left))}%`, backgroundColor: r.awake ? MC.awake : MC.sleep }} />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="moon" size={13} color={MC.sleep} />
          <Text style={clock}>{fmtClock(a)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={clock}>{fmtClock(b)}</Text>
          <Ionicons name="sunny" size={13} color={MC.calories} />
        </View>
      </View>
    </View>
  );
}

/**
 * Estágios: hipnograma (só nas últimas 7 noites), barra empilhada e uma linha por estágio com a parte da noite (barra)
 * e a faixa típica (moldura na mesma escala), mais o selo dentro/abaixo/acima da faixa.
 */
function StagesCard({ night }: { night: DayHealth }) {
  const staged = hasBreakdown(night);
  const mins: Record<StageKey, number> = { deep: night.deepMin ?? 0, light: night.lightMin ?? 0, rem: night.remMin ?? 0, awake: night.awakeMin ?? 0 };
  const total = mins.deep + mins.light + mins.rem + mins.awake || 1;
  return (
    <HCard>
      {/* Sem estágios de verdade, o "stages" guardado é um bloco único de "leve": não desenhar hipnograma falso. */}
      {staged && night.stages?.length ? (
        <Hypnogram segs={night.stages} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
          <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>{staged ? 'Stage details are kept for the last 7 nights' : 'Your device did not record stages'}</Text>
        </View>
      )}
      {staged && (
        <>
          <StackBar parts={STAGES.map((s) => ({ value: mins[s.key], color: STAGE_COLOR[s.key] }))} />
          {STAGES.map((s) => {
            const share = mins[s.key] / total; // parte da noite, mesma escala 0..1 da faixa
            const pct = Math.round(share * 100);
            const [lo, hi] = s.range;
            return (
              <View key={s.key} style={{ gap: 4 }} testID={`sleep-stage-${s.key}`}>
                <LegendRow color={STAGE_COLOR[s.key]} label={s.label} value={`${fmtSleep(mins[s.key])} · ${fmtNum(pct)}%`} frac={share} range={s.range} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 18 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.muted }}>Typical range {`${fmtNum(lo * 100)}–${fmtNum(hi * 100)}%`}</Text>
                  <RangePill status={stageStatus(pct, s.range)} />
                </View>
              </View>
            );
          })}
          <Text style={{ fontSize: 12, color: colors.muted }}>Not a medical device. Talk to a doctor about concerns.</Text>
        </>
      )}
    </HCard>
  );
}
