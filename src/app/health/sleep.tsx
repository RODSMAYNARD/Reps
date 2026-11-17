import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Delta, HCard, HealthNotice, Hypnogram, HTitle, KpiGrid, KpiTile, LegendRow, MC, RangeTabs, Ring, StackBar, STAGE_COLOR, TrendChart, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { bedtimeConsistency, dayKey, fmtClock, fmtSleep, setSample, sleepScore, todayKey, useHealth, vsBaseline, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { colors } from '../../lib/theme';

/** Sono: nota da noite, estágios (hipnograma), tendências de 7/30 dias, médias, dívida de sono e dicas. */

type Range = '7' | '30';
type StageKey = 'deep' | 'light' | 'rem' | 'awake';

// Ordem da barra empilhada e da legenda. Faixas típicas = % da noite (referência geral, não diagnóstico).
const STAGES: { key: StageKey; label: string; range?: string }[] = [
  { key: 'deep', label: 'Deep sleep', range: '13–23%' },
  { key: 'light', label: 'Light sleep', range: '50–60%' },
  { key: 'rem', label: 'REM sleep', range: '20–25%' },
  { key: 'awake', label: 'Awake' },
];

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
const fmtHours = (v: number) => `${v.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;

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

function NavArrow({ icon, onPress, testID }: { icon: IconName; onPress?: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={10} testID={testID}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, opacity: onPress ? 1 : 0.35 }}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
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
  const avgAwake = avg(staged.map((d) => d.awakeMin ?? 0));
  const ofSleep = (x?: number) => (x != null && stagedSleep ? `${Math.round((x / stagedSleep) * 100)}% ${tr('of sleep')}` : undefined);
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
          <KpiTile icon="time-outline" color={MC.sleep} label="Consistency" value={consistency != null ? `±${consistency}` : '–'} unit={consistency != null ? 'min' : undefined} sub={tr('Bedtime variation')} />
          <KpiTile icon="hourglass-outline" color={MC.awake} label="Sleep debt" value={sleepTxt(debt)} sub={tr('Last 7 nights')} testID="sleep-debt" />
        </KpiGrid>

        <HCard>
          <Text style={{ fontWeight: '700', color: colors.text }}>Sleep score</Text>
          <TrendChart key={range} kind="line" data={scorePts} color={MC.sleep} />
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

/** Cartão principal da noite: nota (anel), tempo dormindo x meta, veredito, horários, acordado e eficiência. */
function NightHero({ night, goal, days }: { night: DayHealth; goal: number; days: DayHealth[] }) {
  const score = sleepScore(night, goal);
  const slept = night.sleepMin ?? 0;
  const staged = hasBreakdown(night);
  const inBed = night.bedtime != null && night.wakeTime != null ? (night.wakeTime - night.bedtime) / 60000 : undefined;
  const eff = staged && inBed && inBed > 0 ? Math.min(100, Math.round((slept / inBed) * 100)) : undefined;
  const vs = vsBaseline(days, night.date, (d) => d.sleepMin);
  const tone = score == null ? colors.muted : score >= 70 ? colors.success : score >= 50 ? colors.warn : colors.danger;
  return (
    <HCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring value={(score ?? 0) / 100} size={112} stroke={11} color={MC.sleep}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{score ?? '–'}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, color: colors.muted, maxWidth: 80 }}>Sleep score</Text>
        </Ring>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>Time asleep</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{fmtSleep(night.sleepMin)}</Text>
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
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MiniStat label="In bed" value={night.bedtime != null && night.wakeTime != null ? `${fmtClock(night.bedtime)} → ${fmtClock(night.wakeTime)}` : '–'} flex={1.6} />
        <MiniStat label="Awake" value={staged ? fmtSleep(night.awakeMin) : '–'} />
        <MiniStat label="Efficiency" value={eff != null ? `${eff}%` : '–'} />
      </View>
    </HCard>
  );
}

/** Estágios: hipnograma (só nas últimas 7 noites), barra empilhada e legenda com % da noite e faixa típica. */
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
            const pct = Math.round((mins[s.key] / total) * 100);
            return (
              <View key={s.key} style={{ gap: 2 }}>
                <LegendRow color={STAGE_COLOR[s.key]} label={s.label} value={`${fmtSleep(mins[s.key])} · ${pct}%`} frac={mins[s.key] / total} />
                {!!s.range && <Text style={{ marginLeft: 18, fontSize: 12, color: colors.muted }}>Typical range {s.range}</Text>}
              </View>
            );
          })}
          <Text style={{ fontSize: 12, color: colors.muted }}>Not a medical device. Talk to a doctor about concerns.</Text>
        </>
      )}
    </HCard>
  );
}
