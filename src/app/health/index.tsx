/**
 * Saúde > Hoje: painel do dia como nos apps de relógio (Apple Fitness, Fitbit, Garmin, Oura, Whoop, Bevel, Ultrahuman):
 * semana em mini-anéis, prontidão, anéis de atividade, resumo do dia em frases (regras simples, sem IA), checagem dos sinais vitais,
 * grade com todos os indicadores, semana contra a anterior e metas. Dados só no aparelho (`lib/health.ts`); sem dado = "–", nunca 0 inventado.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Delta, fmtNum, HCard, HealthNotice, HTitle, InRangeChips, KpiGrid, KpiTile, LegendRow, MC, Ring, WeekRings, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { DateScroller, DayHeader, weekdayShort } from '../../components/WeekStrip';
import { Btn, Header, IconButton, Screen, Sheet, TextLink } from '../../components/ui';
import { toDisplayDist, toDisplayWeight } from '../../lib/format';
import { dayKey, fmtSleep, PROVIDER_NAME, readiness, setGoals, setSample, sleepScore, sync, todayKey, useHealth, vsBaseline, type DayHealth, type Goals } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

type Num = (d: DayHealth) => number | undefined;
type Tile = { id: string; icon: IconName; color: string; label: string; value: string; unit?: string; sub?: string; delta?: ReactNode; to: Href };
/** Frase do resumo do dia: `text` = chave do dicionário (frase inteira, sem o ponto); `a` (negrito) e `b` = números, fora da chave. */
type Fact = { id: string; text: string; tone: -1 | 0 | 1; w: number; a?: string; b?: string };

/** Números sempre no formato do idioma (11.733 passos e 81,2 kg em português). */
const n0 = (v: number) => fmtNum(v);
const n1 = (v: number) => fmtNum(v, 1);
const sleepTxt = (m: number) => fmtSleep(Math.round(m));
const pctOf = (v: number, goal: number) => `${fmtNum((v / Math.max(1, goal)) * 100)}% ${tr('of goal')}`;
/** Sinal na frente (+12% / −4 bpm), com o menos tipográfico. */
const signed = (v: number, body: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${body}`;
const shortDate = (k: string) => (k === todayKey() ? tr('Today') : new Date(`${k}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }));
const hourNow = () => new Date().getHours();
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
const total = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) : undefined);
const num = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
/** Valor do cartão: sem dado = "–" e sem unidade. */
const val = (v: number | undefined, fmt: (x: number) => string, unit?: string) => (v == null ? { value: '–' } : { value: fmt(v), unit });
/** Cor da prontidão (lida na hora: o tema troca a paleta). */
const scoreColor = (s: number) => (s >= 75 ? colors.success : s >= 50 ? colors.warn : colors.danger);

/** Metas editáveis (passo do +/-, limites) e onde está o valor do dia. */
const GOALS: { key: keyof Goals; label: string; sub: string; icon: IconName; color: string; step: number; min: number; max: number; fmt: (v: number) => string; unit?: string; get: Num }[] = [
  { key: 'steps', label: 'Steps', sub: 'Per day', icon: 'footsteps', color: MC.steps, step: 500, min: 500, max: 50000, fmt: n0, get: (d) => d.steps },
  { key: 'moveKcal', label: 'Move', sub: 'Active calories per day', icon: 'flame', color: MC.move, step: 50, min: 50, max: 5000, fmt: n0, unit: 'kcal', get: (d) => d.activeKcal },
  { key: 'exerciseMin', label: 'Exercise', sub: 'Minutes per day', icon: 'stopwatch', color: MC.exercise, step: 5, min: 5, max: 600, fmt: n0, unit: 'min', get: (d) => d.exerciseMin },
  { key: 'sleepMin', label: 'Sleep', sub: 'Per night', icon: 'moon', color: MC.sleep, step: 15, min: 240, max: 720, fmt: sleepTxt, get: (d) => d.sleepMin },
  { key: 'floors', label: 'Floors', sub: 'Per day', icon: 'trending-up', color: MC.floors, step: 1, min: 1, max: 200, fmt: n0, get: (d) => d.floors },
];
const withUnit = (txt: string, unit?: string) => (unit ? `${txt} ${unit}` : txt);

/**
 * Sinais vitais do dia contra a média dos 14 dias anteriores (como a checagem de Corpo e sinais vitais e o Ultrahuman).
 * Faixa = média ± `tol` (fração da média; com `abs`, em pontos: SpO2).
 */
const HRV_TOL = 0.2;
const VITALS: { id: string; label: string; f: Num; tol: number; abs?: boolean }[] = [
  { id: 'rhr', label: 'Resting HR', f: (d) => d.restingHr, tol: 0.1 },
  { id: 'hrv', label: 'HRV', f: (d) => d.hrv, tol: HRV_TOL },
  { id: 'spo2', label: 'Blood oxygen', f: (d) => d.spo2, tol: 2, abs: true },
  { id: 'resp', label: 'Breathing', f: (d) => d.respRate, tol: 0.1 },
];
/** Mínimo de medidas nos 14 dias anteriores para comparar (com 1 ou 2 a "média" engana). */
const MIN_BASE = 3;

/** Sugestão de treino de hoje conforme o rótulo da prontidão (`readiness` em lib/health). */
const TIPS: Record<string, { text: string; icon: IconName }> = {
  'Ready to push': { text: 'Good day for a heavy session.', icon: 'barbell' },
  'Train normally': { text: 'Train as planned at a moderate effort.', icon: 'barbell-outline' },
  'Take it easy': { text: 'Prefer mobility or a light session today.', icon: 'walk' },
};

function StepBtn({ icon, onPress, disabled, testID }: { icon: IconName; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} testID={testID} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Linha de um fator da prontidão (peso na nota, valor do dia e média de 14 dias). */
function Factor({ color, label, weight, value, base }: { color: string; label: string; weight: string; value: string; base?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{weight} {tr('of the score')}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
        {!!base && <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{base}</Text>}
      </View>
    </View>
  );
}

/** Uma frase do resumo: a frase vem do dicionário inteira e os números entram à parte, entre parênteses ("6h 10m de 8h 00m"). */
function FactText({ f, first }: { f: Fact; first: boolean }) {
  return (
    <Text>
      {first ? '' : ' '}
      {f.text}
      {f.a != null ? ' (' : ''}
      {f.a != null ? <Text style={{ fontWeight: '700' }}>{f.a}</Text> : null}
      {f.b != null ? ` ${tr('of')} ` : ''}
      {f.b ?? ''}
      {f.a != null ? ')' : ''}
      .
    </Text>
  );
}

export default function HealthHome() {
  const h = useHealth();
  const { profile } = useStore();
  const units = profile.units;
  const g = h.goals;
  const [sel, setSel] = useState(todayKey);
  const { width: winW } = useWindowDimensions(); // faixa de dias = largura da tela menos o padding de 16 de cada lado
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Recalcula ao virar o dia com a tela aberta (a chave de hoje entra nas dependências)
  const tk = todayKey();
  const byDate = useMemo(() => new Map(h.days.map((d) => [d.date, d])), [h.days]);

  // Esta semana (7 dias até hoje) contra os 7 anteriores
  const weekRows = useMemo(() => {
    const keys = (back: number) => Array.from({ length: 7 }, (_, i) => { const d = new Date(`${tk}T12:00:00`); d.setDate(d.getDate() - back - i); return dayKey(d); });
    const cur = keys(0), prev = keys(7);
    const vals = (ks: string[], f: Num) => ks.map((k) => byDate.get(k)).map((d) => (d ? f(d) : undefined)).filter(num);
    const row = (o: { id: string; icon: IconName; color: string; label: string; f: Num; agg: (xs: number[]) => number | undefined; fmt: (v: number) => string; pct: boolean; unit: string; better: boolean }) => {
      const a = o.agg(vals(cur, o.f)), b = o.agg(vals(prev, o.f));
      if (a == null && b == null) return null;
      const diff = a != null && b != null ? (o.pct ? (b ? ((a - b) / b) * 100 : null) : a - b) : null;
      return { id: o.id, icon: o.icon, color: o.color, label: o.label, cur: a != null ? o.fmt(a) : '–', prev: b != null ? o.fmt(b) : '–', diff, unit: o.unit, better: o.better };
    };
    return [
      row({ id: 'sleep', icon: 'moon', color: MC.sleep, label: 'Avg sleep', f: (d) => d.sleepMin, agg: mean, fmt: sleepTxt, pct: false, unit: ' min', better: true }),
      row({ id: 'steps', icon: 'footsteps', color: MC.steps, label: 'Avg steps', f: (d) => d.steps, agg: mean, fmt: n0, pct: true, unit: '%', better: true }),
      row({ id: 'rhr', icon: 'heart', color: MC.heart, label: 'Avg resting HR', f: (d) => d.restingHr, agg: mean, fmt: (v) => `${n0(v)} bpm`, pct: false, unit: ' bpm', better: false }),
      row({ id: 'kcal', icon: 'flame', color: MC.move, label: 'Active calories', f: (d) => d.activeKcal, agg: total, fmt: (v) => `${n0(v)} kcal`, pct: true, unit: '%', better: true }),
    ].filter((r): r is NonNullable<typeof r> => r != null);
  }, [byDate, tk]);

  const toIntegrations = () => router.push('/settings/integrations');
  const onSync = async () => {
    setSyncing(true);
    try { await sync(); } finally { setSyncing(false); }
  };
  const header = <Header title="Health" right={<IconButton name="settings-outline" onPress={toIntegrations} testID="health-settings" />} />;

  // Sem relógio/pulseira e sem dados de exemplo: convite para conectar
  if (!h.hasData) {
    return (
      <Screen>
        {header}
        <ScrollView testID="health-index" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          {!h.connected && <HealthNotice isSample={false} onPress={toIntegrations} />}
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="watch-outline" size={38} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{h.connected ? 'No health data yet' : 'All your health in one place'}</Text>
            <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center' }}>
              {h.connected
                ? `${tr('Wear your watch and let its app sync with')} ${PROVIDER_NAME}.`
                : 'Sleep, heart rate, HRV, steps and calories from your watch or band, next to your workouts.'}
            </Text>
          </View>
          {h.connected ? (
            <Btn title="Sync now" icon="sync" loading={syncing} onPress={onSync} testID="health-sync" />
          ) : (
            <>
              <Btn title="Connect watch" icon="watch-outline" onPress={toIntegrations} testID="health-connect-watch" />
              <Btn title="Try with sample data" icon="flask-outline" variant="secondary" onPress={() => setSample(true)} testID="health-try-sample" />
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  const day = byDate.get(sel);
  const isToday = sel === tk;
  const r = readiness(h.days, sel, g.sleepMin);
  const ss = sleepScore(day, g.sleepMin);
  const hrvBase = vsBaseline(h.days, sel, (d) => d.hrv)?.base;
  const rhrBase = vsBaseline(h.days, sel, (d) => d.restingHr)?.base;
  const ever = (f: Num) => h.days.some((d) => f(d) != null);
  /** Último valor conhecido até o dia escolhido (VO2 máx., peso, gordura: não são medidos todo dia). */
  const latest = (f: Num) => {
    for (let i = h.days.length - 1; i >= 0; i--) { const d = h.days[i]; const v = f(d); if (d.date <= sel && v != null) return { v, date: d.date }; }
    return null;
  };
  /** Seta contra a média de 14 dias; "vs avg" só quando há diferença. */
  const vsAvg = (f: Num, higherIsBetter: boolean) => {
    const b = vsBaseline(h.days, sel, f);
    if (!b) return {};
    return { sub: Math.round(Math.abs(b.diff)) !== 0 ? 'vs avg' : undefined, delta: <Delta diff={b.diff} higherIsBetter={higherIsBetter} /> };
  };
  /** Valor do dia contra a média dos 14 registros anteriores (mesma janela do `vsBaseline`), só com 3+ medidas nela. */
  const vsUsual = (f: Num) => {
    const cur = day ? f(day) : undefined;
    const xs = h.days.filter((d) => d.date < sel).slice(-14).map(f).filter(num);
    const base = mean(xs);
    if (!num(cur) || base == null || xs.length < MIN_BASE) return null;
    return { cur, base, diff: cur - base, pct: base ? (cur - base) / base : 0 };
  };
  const distTxt = (m: number) => { const v = toDisplayDist(m, units); return fmtNum(v, v >= 10 ? 1 : 2); };

  const tiles: Tile[] = [];
  const add = (f: Num, t: Tile) => { if (ever(f)) tiles.push(t); };
  add((d) => d.sleepMin, { id: 'sleep', icon: 'moon', color: MC.sleep, label: 'Sleep', ...val(day?.sleepMin, sleepTxt), sub: ss != null ? `${tr('Score')} ${ss}` : undefined, to: '/health/sleep' });
  add((d) => d.restingHr, { id: 'rhr', icon: 'heart', color: MC.heart, label: 'Resting HR', ...val(day?.restingHr, n0, 'bpm'), ...(day?.restingHr != null ? vsAvg((d) => d.restingHr, false) : {}), to: '/health/heart' });
  add((d) => d.hrv, { id: 'hrv', icon: 'pulse', color: MC.hrv, label: 'HRV', ...val(day?.hrv, n0, 'ms'), ...(day?.hrv != null ? vsAvg((d) => d.hrv, true) : {}), to: '/health/heart' });
  add((d) => d.avgHr, { id: 'avghr', icon: 'heart-outline', color: MC.heart, label: 'Avg HR', ...val(day?.avgHr, n0, 'bpm'), sub: day?.minHr != null && day?.maxHr != null ? `${n0(day.minHr)}–${n0(day.maxHr)} bpm` : undefined, to: '/health/heart' });
  add((d) => d.steps, { id: 'steps', icon: 'footsteps', color: MC.steps, label: 'Steps', ...val(day?.steps, n0), sub: day?.steps != null ? pctOf(day.steps, g.steps) : undefined, to: '/health/activity' });
  add((d) => d.activeKcal, { id: 'active', icon: 'flame', color: MC.move, label: 'Active calories', ...val(day?.activeKcal, n0, 'kcal'), sub: day?.activeKcal != null ? pctOf(day.activeKcal, g.moveKcal) : undefined, to: '/health/activity' });
  add((d) => d.totalKcal, { id: 'total', icon: 'flame-outline', color: MC.calories, label: 'Total calories', ...val(day?.totalKcal, n0, 'kcal'), sub: day?.totalKcal != null ? 'Active + resting' : undefined, to: '/health/activity' });
  add((d) => d.distanceM, { id: 'distance', icon: 'navigate', color: MC.distance, label: 'Distance', ...val(day?.distanceM, distTxt, units.distance), to: '/health/activity' });
  add((d) => d.floors, { id: 'floors', icon: 'trending-up', color: MC.floors, label: 'Floors', ...val(day?.floors, n0), sub: day?.floors != null ? pctOf(day.floors, g.floors) : undefined, to: '/health/activity' });
  add((d) => d.exerciseMin, { id: 'exercise', icon: 'stopwatch', color: MC.exercise, label: 'Exercise', ...val(day?.exerciseMin, n0, 'min'), sub: day?.exerciseMin != null ? pctOf(day.exerciseMin, g.exerciseMin) : undefined, to: '/health/activity' });
  add((d) => d.spo2, { id: 'spo2', icon: 'water', color: MC.spo2, label: 'Blood oxygen', ...val(day?.spo2, n1, '%'), to: '/health/body' });
  add((d) => d.respRate, { id: 'resp', icon: 'leaf', color: MC.resp, label: 'Breathing', ...val(day?.respRate, n1, 'br/min'), to: '/health/body' });
  const vo2 = latest((d) => d.vo2max);
  add((d) => d.vo2max, { id: 'vo2', icon: 'speedometer', color: MC.vo2, label: 'VO₂ max', ...val(vo2?.v, n1, 'ml/kg/min'), sub: vo2 ? shortDate(vo2.date) : undefined, to: '/health/heart' });
  const wt = latest((d) => d.weightKg);
  add((d) => d.weightKg, { id: 'weight', icon: 'scale-outline', color: MC.weight, label: 'Weight', ...val(wt?.v, (kg) => n1(toDisplayWeight(kg, units)), units.weight), sub: wt ? shortDate(wt.date) : undefined, to: '/health/body' });
  const fat = latest((d) => d.bodyFatPct);
  add((d) => d.bodyFatPct, { id: 'fat', icon: 'body-outline', color: MC.fat, label: 'Body fat', ...val(fat?.v, n1, '%'), sub: fat ? shortDate(fat.date) : undefined, to: '/health/body' });

  // Anéis grandes do dia: legenda curta para caber em 360 px também na web (o ícone já diz que são passos)
  const rings: { id: string; icon: IconName; color: string; v?: number; goal: number; unit?: string }[] = [
    { id: 'move', icon: 'flame', color: MC.move, v: day?.activeKcal, goal: g.moveKcal, unit: 'kcal' },
    { id: 'exercise', icon: 'stopwatch', color: MC.exercise, v: day?.exerciseMin, goal: g.exerciseMin, unit: 'min' },
    { id: 'steps', icon: 'footsteps', color: MC.steps, v: day?.steps, goal: g.steps },
  ];

  // Resumo do dia (estilo Bevel/Fitbit, por regras): sono x meta, VFC e FC de repouso x média de 14 dias, passos x meta.
  // Cada fato tem um tom (-1 pior, 0 neutro, +1 melhor) e um peso; os 2 mais fortes viram as frases, puxando os do mesmo tom da prontidão.
  const facts: Fact[] = [];
  if (day?.sleepMin != null) {
    const short = g.sleepMin - day.sleepMin;
    if (short <= 0) facts.push({ id: 'sleep', text: 'You met your sleep goal', tone: 1, w: 1, a: sleepTxt(day.sleepMin) });
    else if (short <= 30) facts.push({ id: 'sleep', text: 'You slept close to your goal', tone: 0, w: 0.5, a: sleepTxt(day.sleepMin), b: sleepTxt(g.sleepMin) });
    else facts.push({ id: 'sleep', text: 'You slept less than your goal', tone: -1, w: 1 + Math.min(2, short / 60), a: sleepTxt(day.sleepMin), b: sleepTxt(g.sleepMin) });
  }
  const hv = vsUsual((d) => d.hrv);
  if (hv) {
    const p = Math.round(hv.pct * 100);
    const a = signed(p, `${fmtNum(Math.abs(p))}%`);
    // Mesma faixa do cartão Vitals (±20%): a frase nunca diz "mais baixa que o normal" com o selo da VFC verde
    if (hv.pct > HRV_TOL) facts.push({ id: 'hrv', text: 'Your HRV was higher than usual', tone: 1, w: 1 + Math.min(1, (hv.pct - HRV_TOL) * 5), a });
    else if (hv.pct < -HRV_TOL) facts.push({ id: 'hrv', text: 'Your HRV was lower than usual', tone: -1, w: 1 + Math.min(2, (-hv.pct - HRV_TOL) * 10), a });
    else facts.push({ id: 'hrv', text: 'Your HRV was within your usual range', tone: 0, w: 0.4 });
  }
  const rh = vsUsual((d) => d.restingHr);
  if (rh) {
    const bpm = Math.round(rh.diff);
    const a = signed(bpm, `${fmtNum(Math.abs(bpm))} bpm`);
    if (bpm >= 3) facts.push({ id: 'rhr', text: 'Your resting heart rate was higher than usual', tone: -1, w: 1 + Math.min(2, (bpm - 3) / 2), a });
    else if (bpm <= -3) facts.push({ id: 'rhr', text: 'Your resting heart rate was lower than usual', tone: 1, w: 1 + Math.min(1, (-bpm - 3) / 3), a });
    else facts.push({ id: 'rhr', text: 'Your resting heart rate was steady', tone: 0, w: 0.3 });
  }
  if (day?.steps != null) {
    if (day.steps >= g.steps) facts.push({ id: 'steps', text: 'You hit your step goal', tone: 1, w: 0.9, a: n0(day.steps) });
    // Hoje cedo os passos ainda são poucos por natureza: só ganham peso no fim da tarde
    else facts.push({ id: 'steps', text: isToday ? 'You are below your step goal so far' : 'You stayed below your step goal', tone: 0, w: isToday ? (hourNow() >= 17 ? 0.8 : 0.1) : 0.6, a: n0(day.steps), b: n0(g.steps) });
  }
  const dir = r ? (r.score >= 75 ? 1 : r.score >= 50 ? 0 : -1) : 0;
  const rank = (f: Fact) => f.w + (dir !== 0 && f.tone === dir ? 1 : 0);
  const shown = [...facts].sort((x, y) => rank(y) - rank(x)).slice(0, 2);
  // Sugestão de treino só para hoje (num dia passado o resumo é só o que aconteceu)
  const tip = isToday && r ? TIPS[r.label] : undefined;

  // Sinais vitais na faixa (só os que têm valor no dia e média com 3+ medidas)
  const vitals = VITALS.flatMap((v) => {
    const c = vsUsual(v.f);
    return c ? [{ label: v.label, ok: v.abs ? Math.abs(c.diff) <= v.tol : Math.abs(c.pct) <= v.tol }] : [];
  });

  const box = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 } as const;
  const bands = [
    { range: '75–100', label: 'Ready to push', color: colors.success },
    { range: '50–74', label: 'Train normally', color: colors.warn },
    { range: '0–49', label: 'Take it easy', color: colors.danger },
  ];

  return (
    <Screen>
      {header}
      <ScrollView
        testID="health-index"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={h.connected ? <RefreshControl refreshing={syncing} onRefresh={onSync} /> : undefined}
      >
        {h.isSample && <HealthNotice isSample onPress={toIntegrations} />}

        {/* Dias da Saúde (AS1): mesma faixa que desliza da H2 (DateScroller); o anel enche com a % da meta de passos.
            Dias sem dado ficam com o trilho vazio; futuros apagados. Toque escolhe o dia (sel). */}
        <View testID="health-days" style={{ gap: 6 }}>
          <DayHeader day={new Date(`${sel}T12:00:00`)} onToday={() => setSel(todayKey())} testID="health-day-header" />
          {(
            <DateScroller width={winW - 32} focus={new Date(`${sel}T12:00:00`)} renderDay={({ d, off, cw }) => {
              const k = dayKey(d);
              const x = byDate.get(k);
              return (
                <View testID={`health-day-${k}`} style={{ width: cw, alignItems: 'center', opacity: off > 0 ? 0.45 : 1 }}>
                  <WeekRings size={34} selected={k === sel ? 0 : undefined} onPress={off > 0 ? undefined : () => setSel(k)}
                    days={[{ label: weekdayShort(d), day: d.getDate(), rings: [{ value: x?.steps != null ? x.steps / Math.max(1, g.steps) : 0, color: MC.steps }] }]} />
                </View>
              );
            }} />
          )}
        </View>

        {/* Atividade na largura toda e Prontidão logo abaixo (pedido do Rodrigo, 2026-11-23) */}
        <Pressable onPress={() => router.push('/health/activity')} testID="health-activity" style={box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flame" size={16} color={MC.move} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>Activity</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.faint} />
          </View>
          {/* AT2: um anel por meta, lado a lado, com o número e a meta embaixo de cada um */}
          <View style={{ flexDirection: 'row' }}>
            {rings.map((x) => (
              <View key={x.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Ring value={x.v != null ? x.v / Math.max(1, x.goal) : 0} size={68} stroke={7} color={x.color} track={colors.border}>
                  <Ionicons name={x.icon} size={22} color={x.color} />
                </Ring>
                <View style={{ alignItems: 'center' }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{x.v != null ? n0(x.v) : '–'}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>/{n0(x.goal)}{x.unit ? ` ${x.unit}` : ''}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: x.color }}>{x.id === 'move' ? 'Move' : x.id === 'exercise' ? 'Exercise' : 'Steps'}</Text>
                </View>
              </View>
            ))}
          </View>
        </Pressable>

        <Pressable onPress={() => setInfo(true)} testID="health-readiness" style={box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="speedometer" size={16} color={r ? scoreColor(r.score) : colors.muted} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>Readiness</Text>
            <Ionicons name="information-circle-outline" size={16} color={colors.faint} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Ring value={r ? r.score / 100 : 0} size={84} stroke={10} color={r ? scoreColor(r.score) : colors.faint}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{r ? r.score : '–'}</Text>
            </Ring>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontSize: 18, fontWeight: '700', color: r ? scoreColor(r.score) : colors.muted }}>{r ? r.label : 'Not enough data'}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>0–100</Text>
            </View>
          </View>
        </Pressable>

        {/* Resumo do dia em 1–2 frases + sugestão de treino (hoje) */}
        {(shown.length > 0 || !!tip) && (
          <View testID="health-insight" style={box}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bulb" size={16} color={MC.calories} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>{isToday ? "Today's insight" : 'Day summary'}</Text>
              {!isToday && <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{shortDate(sel)}</Text>}
            </View>
            {shown.length > 0 && (
              <Text style={{ fontSize: 15, lineHeight: 21, color: colors.text }}>
                {shown.map((f, i) => <FactText key={f.id} f={f} first={i === 0} />)}
              </Text>
            )}
            {!!tip && !!r && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <Ionicons name={tip.icon} size={18} color={scoreColor(r.score)} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{tip.text}</Text>
              </View>
            )}
          </View>
        )}

        {/* Sinais vitais na faixa típica (como o Ultrahuman): toque abre Corpo e sinais vitais */}
        {vitals.length > 0 && (
          <Pressable onPress={() => router.push('/health/body')} testID="health-vitals" style={box}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="fitness" size={16} color={MC.heart} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>Vitals</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.faint} />
            </View>
            <InRangeChips items={vitals} />
          </Pressable>
        )}

        {/* Todos os indicadores do dia */}
        {tiles.length > 0 && (
          <KpiGrid>
            {tiles.map((t) => (
              <KpiTile key={t.id} testID={`kpi-${t.id}`} icon={t.icon} color={t.color} label={t.label} value={t.value} unit={t.unit} sub={t.sub} delta={t.delta} onPress={() => router.push(t.to)} />
            ))}
          </KpiGrid>
        )}

        {/* Semana contra a anterior */}
        {weekRows.length > 0 && (
          <>
            <HTitle title="This week vs last week" />
            <HCard>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Last 7 days compared with the 7 days before.</Text>
              {weekRows.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={w.icon} size={18} color={w.color} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15 }}>{w.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{tr('Last week')}: {w.prev}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{w.cur}</Text>
                    <Delta diff={w.diff} unit={w.unit} higherIsBetter={w.better} />
                  </View>
                </View>
              ))}
            </HCard>
          </>
        )}

        {/* Metas (progresso do dia escolhido) */}
        <HTitle title="Goals" right={<TextLink title="Edit goals" onPress={() => setEditing(true)} />} />
        <HCard>
          {GOALS.map((x) => {
            const cur = day ? x.get(day) : undefined;
            const goal = g[x.key];
            return (
              <LegendRow
                key={x.key}
                color={x.color}
                label={x.label}
                value={cur != null ? withUnit(`${x.fmt(cur)} / ${x.fmt(goal)}`, x.unit) : withUnit(x.fmt(goal), x.unit)}
                frac={cur != null ? cur / Math.max(1, goal) : undefined}
              />
            );
          })}
        </HCard>

        {/* Rodapé */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {!!h.syncedAt && (
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
              {tr('Last sync')}: {new Date(h.syncedAt).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          {h.connected && <Btn title="Sync now" variant="secondary" icon="sync" loading={syncing} onPress={onSync} testID="health-sync" />}
          {h.isSample && <TextLink title="Turn off sample data" onPress={() => setSample(false)} />}
          <Text style={{ color: colors.faint, fontSize: 11, textAlign: 'center' }}>Not a medical device. Talk to a doctor about concerns.</Text>
        </View>
      </ScrollView>

      {/* Como a prontidão é calculada */}
      <Sheet visible={info} onClose={() => setInfo(false)} title="Readiness">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          {r && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ring value={r.score / 100} size={56} stroke={7} color={scoreColor(r.score)}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{r.score}</Text>
              </Ring>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '700', color: scoreColor(r.score) }}>{r.label}</Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted }}>{shortDate(sel)}</Text>
              </View>
            </View>
          )}
          <Text style={{ color: colors.text, fontSize: 14 }}>
            How ready your body looks for training, from 0 to 100. It compares last night&apos;s sleep, your HRV and your resting heart rate with your own 14-day average.
          </Text>
          <Factor color={MC.sleep} label="Sleep" weight="45%" value={ss != null ? `${tr('Score')} ${ss}` : '–'} base={day?.sleepMin != null ? sleepTxt(day.sleepMin) : undefined} />
          <Factor color={MC.hrv} label="HRV" weight="35%" value={day?.hrv != null ? `${n0(day.hrv)} ms` : '–'} base={hrvBase != null ? `${tr('14-day avg')} ${n0(hrvBase)} ms` : undefined} />
          <Factor color={MC.heart} label="Resting HR" weight="20%" value={day?.restingHr != null ? `${n0(day.restingHr)} bpm` : '–'} base={rhrBase != null ? `${tr('14-day avg')} ${n0(rhrBase)} bpm` : undefined} />
          <View style={{ gap: 6, paddingTop: 2 }}>
            {bands.map((b) => (
              <View key={b.range} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color }} />
                <Text style={{ width: 56, color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>{b.range}</Text>
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13 }}>{b.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Not a medical device.</Text>
          <Btn title="Got it" onPress={() => setInfo(false)} testID="health-readiness-ok" />
        </View>
      </Sheet>

      {/* Editar metas */}
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Edit goals">
        <View style={{ gap: 2, paddingBottom: 8 }}>
          {GOALS.map((x) => {
            const v = g[x.key];
            const change = (dir: 1 | -1) => {
              const patch: Partial<Goals> = {};
              patch[x.key] = Math.min(x.max, Math.max(x.min, v + dir * x.step));
              setGoals(patch);
            };
            return (
              <View key={x.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <Ionicons name={x.icon} size={20} color={x.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{x.label}</Text>
                  <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12 }}>{x.sub}</Text>
                </View>
                {/* Passo a passo: cabe em 360 px (rótulo com ~120 px); valor grande e unidade pequena embaixo (na web o texto não encolhe) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <StepBtn icon="remove" disabled={v <= x.min} onPress={() => change(-1)} testID={`goal-${x.key}-minus`} />
                  <View style={{ width: 80, alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{x.fmt(v)}</Text>
                    {!!x.unit && <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{x.unit}</Text>}
                  </View>
                  <StepBtn icon="add" disabled={v >= x.max} onPress={() => change(1)} testID={`goal-${x.key}-plus`} />
                </View>
              </View>
            );
          })}
          <Btn title="Done" onPress={() => setEditing(false)} style={{ marginTop: 8 }} testID="health-goals-done" />
        </View>
      </Sheet>
    </Screen>
  );
}
