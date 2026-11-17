/**
 * Saúde > Hoje: painel do dia como nos apps de relógio (Apple Saúde, Fitbit, Garmin, Oura, Whoop):
 * prontidão, anéis de atividade, grade com todos os indicadores (sono, coração, atividade, sinais vitais e corpo),
 * semana contra a anterior e metas. Dados só no aparelho (`lib/health.ts`); sem dado = "–", nunca 0 inventado.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityRings, Delta, HCard, HealthNotice, HTitle, KpiGrid, KpiTile, LegendRow, MC, Ring, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, IconButton, Screen, Sheet, TextLink } from '../../components/ui';
import { toDisplayDist, toDisplayWeight } from '../../lib/format';
import { dayKey, fmtSleep, PROVIDER_NAME, readiness, setGoals, setSample, sleepScore, sync, todayKey, useHealth, vsBaseline, type DayHealth, type Goals } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

type Num = (d: DayHealth) => number | undefined;
type Tile = { id: string; icon: IconName; color: string; label: string; value: string; unit?: string; sub?: string; delta?: ReactNode; to: Href };

const n0 = (v: number) => Math.round(v).toLocaleString(locale());
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString(locale(), { maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString(locale(), { minimumFractionDigits: v >= 10 ? 1 : 2, maximumFractionDigits: v >= 10 ? 1 : 2 });
const sleepTxt = (m: number) => fmtSleep(Math.round(m));
const pctOf = (v: number, goal: number) => `${Math.round((v / Math.max(1, goal)) * 100)}% ${tr('of goal')}`;
const shortDate = (k: string) => (k === todayKey() ? tr('Today') : new Date(`${k}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
const total = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) : undefined);
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

export default function HealthHome() {
  const h = useHealth();
  const { profile } = useStore();
  const units = profile.units;
  const g = h.goals;
  const [sel, setSel] = useState(todayKey);
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Recalcula ao virar o dia com a tela aberta (a chave de hoje entra nas dependências)
  const tk = todayKey();
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(`${tk}T12:00:00`); d.setDate(d.getDate() - (6 - i)); return d; }), [tk]);
  const byDate = useMemo(() => new Map(h.days.map((d) => [d.date, d])), [h.days]);

  // Esta semana (7 dias até hoje) contra os 7 anteriores
  const weekRows = useMemo(() => {
    const keys = (back: number) => Array.from({ length: 7 }, (_, i) => { const d = new Date(`${tk}T12:00:00`); d.setDate(d.getDate() - back - i); return dayKey(d); });
    const cur = keys(0), prev = keys(7);
    const vals = (ks: string[], f: Num) => ks.map((k) => byDate.get(k)).map((d) => (d ? f(d) : undefined)).filter((x): x is number => typeof x === 'number' && isFinite(x));
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

  const tiles: Tile[] = [];
  const add = (f: Num, t: Tile) => { if (ever(f)) tiles.push(t); };
  add((d) => d.sleepMin, { id: 'sleep', icon: 'moon', color: MC.sleep, label: 'Sleep', ...val(day?.sleepMin, sleepTxt), sub: ss != null ? `${tr('Score')} ${ss}` : undefined, to: '/health/sleep' });
  add((d) => d.restingHr, { id: 'rhr', icon: 'heart', color: MC.heart, label: 'Resting HR', ...val(day?.restingHr, n0, 'bpm'), ...(day?.restingHr != null ? vsAvg((d) => d.restingHr, false) : {}), to: '/health/heart' });
  add((d) => d.hrv, { id: 'hrv', icon: 'pulse', color: MC.hrv, label: 'HRV', ...val(day?.hrv, n0, 'ms'), ...(day?.hrv != null ? vsAvg((d) => d.hrv, true) : {}), to: '/health/heart' });
  add((d) => d.avgHr, { id: 'avghr', icon: 'heart-outline', color: MC.heart, label: 'Avg HR', ...val(day?.avgHr, n0, 'bpm'), sub: day?.minHr != null && day?.maxHr != null ? `${day.minHr}–${day.maxHr} bpm` : undefined, to: '/health/heart' });
  add((d) => d.steps, { id: 'steps', icon: 'footsteps', color: MC.steps, label: 'Steps', ...val(day?.steps, n0), sub: day?.steps != null ? pctOf(day.steps, g.steps) : undefined, to: '/health/activity' });
  add((d) => d.activeKcal, { id: 'active', icon: 'flame', color: MC.move, label: 'Active calories', ...val(day?.activeKcal, n0, 'kcal'), sub: day?.activeKcal != null ? pctOf(day.activeKcal, g.moveKcal) : undefined, to: '/health/activity' });
  add((d) => d.totalKcal, { id: 'total', icon: 'flame-outline', color: MC.calories, label: 'Total calories', ...val(day?.totalKcal, n0, 'kcal'), sub: day?.totalKcal != null ? 'Active + resting' : undefined, to: '/health/activity' });
  add((d) => d.distanceM, { id: 'distance', icon: 'navigate', color: MC.distance, label: 'Distance', ...val(day?.distanceM, (m) => n2(toDisplayDist(m, units)), units.distance), to: '/health/activity' });
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

  const rings = [
    { id: 'move', color: MC.move, v: day?.activeKcal, goal: g.moveKcal, unit: 'kcal' },
    { id: 'exercise', color: MC.exercise, v: day?.exerciseMin, goal: g.exerciseMin, unit: 'min' },
    { id: 'steps', color: MC.steps, v: day?.steps, goal: g.steps, unit: 'steps' },
  ];
  const card = { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 } as const;
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

        {/* Últimos 7 dias */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {week.map((d) => {
            const k = dayKey(d);
            const on = k === sel;
            return (
              <Pressable key={k} onPress={() => setSel(k)} testID={`health-day-${k}`} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: on ? colors.primary : colors.surface }}>
                <Text style={{ color: on ? colors.onPrimary : colors.muted, fontSize: 11 }}>{d.toLocaleDateString(locale(), { weekday: 'narrow' }).toUpperCase()}</Text>
                <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '700' }}>{d.getDate()}</Text>
                <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: byDate.has(k) ? (on ? colors.onPrimary : colors.primary) : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>

        {/* Prontidão + Atividade */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => setInfo(true)} testID="health-readiness" style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="speedometer" size={16} color={r ? scoreColor(r.score) : colors.muted} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>Readiness</Text>
              <Ionicons name="information-circle-outline" size={16} color={colors.faint} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ring value={r ? r.score / 100 : 0} size={88} stroke={10} color={r ? scoreColor(r.score) : colors.faint}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{r ? r.score : '–'}</Text>
              </Ring>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ alignSelf: 'stretch', textAlign: 'center', fontSize: 13, fontWeight: '700', color: r ? scoreColor(r.score) : colors.muted }}>{r ? r.label : 'Not enough data'}</Text>
            </View>
          </Pressable>

          <Pressable onPress={() => router.push('/health/activity')} testID="health-activity" style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flame" size={16} color={MC.move} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>Activity</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.faint} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <ActivityRings size={88} rings={rings.map((x) => ({ value: x.v != null ? x.v / Math.max(1, x.goal) : 0, color: x.color }))} />
            </View>
            <View style={{ gap: 3 }}>
              {rings.map((x) => (
                <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.color }} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{x.v != null ? n0(x.v) : '–'}</Text>/{n0(x.goal)} {x.unit}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        </View>

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
          <Factor color={MC.hrv} label="HRV" weight="35%" value={day?.hrv != null ? `${day.hrv} ms` : '–'} base={hrvBase != null ? `${tr('14-day avg')} ${n0(hrvBase)} ms` : undefined} />
          <Factor color={MC.heart} label="Resting HR" weight="20%" value={day?.restingHr != null ? `${day.restingHr} bpm` : '–'} base={rhrBase != null ? `${tr('14-day avg')} ${n0(rhrBase)} bpm` : undefined} />
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
                {/* Passo a passo: cabe em 360 px (rótulo com ~130 px) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <StepBtn icon="remove" disabled={v <= x.min} onPress={() => change(-1)} testID={`goal-${x.key}-minus`} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ width: 76, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{withUnit(x.fmt(v), x.unit)}</Text>
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
