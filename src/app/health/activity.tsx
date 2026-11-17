import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ActivityRings, CumulativeLine, fmtNum, HCard, HealthNotice, HTitle, KpiGrid, KpiTile, MC, RangeTabs, TrendChart, WeekRings, type IconName } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Empty, Header, Screen } from '../../components/ui';
import { toDisplayDist } from '../../lib/format';
import { dayKey, setSample, sync, todayKey, useHealth, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import type { Units } from '../../lib/types';

/**
 * Atividade (relógio/pulseira): anéis de hoje (Mover / Exercício / Passos) com a semana em mini-anéis (como o Apple Fitness),
 * passos acumulados ao longo do dia contra a meta (como a "linha do tempo" do Garmin), passos por hora, KPIs do dia,
 * tendências de 7/30 dias com meta e conquistas (sequência, melhor dia, metas batidas, distância total).
 * Números sempre no formato do idioma (`fmtNum`: 11.733 passos / 4,2 km em português).
 * Sem dado = '–' ou bloco escondido, nunca um 0 inventado.
 */
type Range = '7' | '30';

const fmtN = (v: number | null | undefined) => fmtNum(v);
const fmtDistU = (m: number, u: Units, digits = 1) => `${fmtNum(toDisplayDist(m, u), digits)} ${u.distance}`;
/** % da meta arredondado para BAIXO: 99,5% não aparece como "100%" com a meta ainda aberta. */
const pctOf = (v: number | null | undefined, goal: number) => (v == null ? null : Math.floor((v * 100) / Math.max(1, goal) + 1e-9));
const avgOf = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number' && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** Meio-dia de `back` dias atrás (meio-dia não erra o dia na troca do horário de verão). */
const daysAgo = (back: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - back);
  return d;
};

/** Dias seguidos batendo a meta de passos, terminando hoje (se já bateu) ou ontem. */
function stepStreak(byDate: Map<string, DayHealth>, goal: number) {
  const met = (d: Date) => (byDate.get(dayKey(d))?.steps ?? -1) >= goal;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!met(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (n < 366 && met(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Linha da legenda dos anéis: nome, % da meta e "valor / meta unidade". */
function RingStat({ label, color, value, goal, unit }: { label: string; color: string; value: number | undefined; goal: number; unit?: string }) {
  const pct = pctOf(value, goal);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color }}>{label}</Text>
        {pct != null && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: pct >= 100 ? colors.success : colors.muted, fontVariant: ['tabular-nums'] }}>{`${fmtNum(pct)}%`}</Text>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 17, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>
        {fmtN(value)}
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.muted }}>{` / ${fmtN(goal)}${unit ? ` ${unit}` : ''}`}</Text>
      </Text>
    </View>
  );
}

/** Linha de conquista: ícone colorido, título, detalhe e valor à direita. */
function AchRow({ icon, color, title, detail, value }: { icon: IconName; color: string; title: string; detail?: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{title}</Text>
        {!!detail && <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{detail}</Text>}
      </View>
      <Text numberOfLines={1} style={{ maxWidth: '45%', fontSize: 16, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/**
 * Texto à direita do título do bloco: fica só com o espaço que sobra e corta com "…"
 * (em pt, "Minutos de exercício" + "Média diária 35 min" passava de 360 px e vazava para fora da tela).
 */
function TitleRight({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0, marginLeft: 12, alignItems: 'flex-end' }}>
      <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] }}>{children}</Text>
    </View>
  );
}

/** Média do período à direita do título do gráfico. */
function AvgRight({ text }: { text: string | null }) {
  if (text == null) return null;
  return <TitleRight>{tr('Daily avg')} {text}</TitleRight>;
}

export default function Activity() {
  const h = useHealth();
  const { profile } = useStore();
  const units = profile.units;
  const goals = h.goals;
  const [range, setRange] = useState<Range>('7');
  const [refreshing, setRefreshing] = useState(false);
  const openIntegrations = () => router.push('/settings/integrations');
  const onRefresh = async () => { setRefreshing(true); await sync(); setRefreshing(false); };

  if (!h.hasData) {
    return (
      <Screen>
        <Header title="Activity" />
        <ScrollView testID="health-activity" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <HealthNotice isSample={false} onPress={openIntegrations} />
          <Empty
            icon="walk-outline"
            text="See your steps, calories and activity rings from your watch or band."
            action={(
              <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 4 }}>
                <Btn title="Connect watch" icon="watch-outline" onPress={openIntegrations} testID="activity-connect" />
                <Btn title="Try with sample data" icon="flask-outline" variant="secondary" onPress={() => setSample(true)} testID="activity-sample" />
              </View>
            )}
          />
        </ScrollView>
      </Screen>
    );
  }

  const byDate = new Map(h.days.map((d) => [d.date, d] as const));
  const tKey = todayKey();
  const today = byDate.get(tKey);
  const hasToday = !!today && [today.steps, today.distanceM, today.activeKcal, today.totalKcal, today.floors, today.exerciseMin].some((v) => v != null);

  // Anéis (Mover / Exercício / Passos) de um dia: dia sem dado = só o trilho apagado
  const ringsOf = (d: DayHealth | undefined) => [
    { value: (d?.activeKcal ?? 0) / Math.max(1, goals.moveKcal), color: MC.move },
    { value: (d?.exerciseMin ?? 0) / Math.max(1, goals.exerciseMin), color: MC.exercise },
    { value: (d?.steps ?? 0) / Math.max(1, goals.steps), color: MC.steps },
  ];
  // Semana em mini-anéis: últimos 7 dias terminando hoje (hoje destacado no fim); some se a semana não tiver nada
  const weekDays = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  const week = weekDays.map((d) => ({ label: d.toLocaleDateString(locale(), { weekday: 'narrow' }).toUpperCase(), rings: ringsOf(byDate.get(dayKey(d))) }));
  const hasWeek = weekDays.some((d) => {
    const x = byDate.get(dayKey(d));
    return !!x && [x.activeKcal, x.exerciseMin, x.steps].some((v) => v != null);
  });

  // Passos de hoje hora a hora (só se a leitura for de hoje; horas que ainda não chegaram ficam vazias, não 0).
  // O total do dia é o número oficial (o sistema já tira os duplicados entre relógio e celular); a série por hora
  // dá o formato e é ajustada para somar esse total, assim anéis, cabeçalho e gráficos mostram o mesmo número.
  const nowH = new Date().getHours();
  const raw = h.today?.date === tKey && Array.isArray(h.today.stepsByHour) ? h.today.stepsByHour.map((v) => (isFinite(v) && v > 0 ? v : 0)) : null;
  const rawSum = raw ? raw.slice(0, nowH + 1).reduce((a, b) => a + b, 0) : 0;
  const hourly = raw && rawSum > 0 ? raw.map((v) => (today?.steps != null ? (v * today.steps) / rawSum : v)) : null;
  const stepsNow = hourly ? today?.steps ?? rawSum : null;
  const stepsPct = pctOf(stepsNow, goals.steps);
  const stepsMet = stepsNow != null && stepsNow >= goals.steps;
  const stepsLeft = stepsNow != null ? Math.max(0, goals.steps - stepsNow) : 0;
  const hourData = hourly ? hourly.map((v, i) => ({ label: hh(i), value: i > nowH ? null : Math.round(v) })) : null;
  const peak = hourData ? hourData.reduce((b, p, i) => ((p.value ?? 0) > (hourData[b].value ?? 0) ? i : b), 0) : null;

  // Período (7/30 dias terminando hoje)
  const n = Number(range);
  const rows = Array.from({ length: n }, (_, i) => {
    const d = daysAgo(n - 1 - i);
    const key = dayKey(d);
    return { key, label: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), d: byDate.get(key) };
  });
  const series = (f: (d: DayHealth) => number | undefined) => rows.map((r) => ({ label: r.label, value: r.d ? f(r.d) ?? null : null }));
  const steps = series((d) => d.steps);
  const active = series((d) => d.activeKcal);
  const exercise = series((d) => d.exerciseMin);
  const dist = series((d) => (d.distanceM == null ? undefined : toDisplayDist(d.distanceM, units)));
  const avgSteps = avgOf(steps.map((p) => p.value));
  const avgActive = avgOf(active.map((p) => p.value));
  const avgExercise = avgOf(exercise.map((p) => p.value));
  const avgDist = avgOf(dist.map((p) => p.value));
  const fmtDist1 = (v: number) => fmtNum(v, 1);

  // Conquistas
  // Sem nenhum dado de passos/calorias ativas = '–' (não "0 dias" / "0 de 7" inventados)
  const streak = h.days.some((d) => d.steps != null) ? stepStreak(byDate, goals.steps) : null;
  const best = rows.reduce<{ key: string; steps: number } | null>((b, r) => (r.d?.steps && (!b || r.d.steps > b.steps) ? { key: r.key, steps: r.d.steps } : b), null);
  const moveVals = rows.map((r) => r.d?.activeKcal).filter((x): x is number => x != null);
  const moveClosed = moveVals.length ? moveVals.filter((v) => v >= goals.moveKcal).length : null;
  const distVals = rows.map((r) => r.d?.distanceM).filter((x): x is number => x != null);
  const totalDist = distVals.length ? distVals.reduce((a, b) => a + b, 0) : null;
  const rangeLabel = range === '7' ? 'Last 7 days' : 'Last 30 days';

  const goalSub = (v: number | undefined, goal: number) => { const p = pctOf(v, goal); return p == null ? undefined : `${fmtNum(p)}% ${tr('of goal')}`; };
  const met = (v: number | undefined, goal: number) => (v != null && v >= goal ? <Ionicons name="checkmark-circle" size={14} color={colors.success} /> : undefined);
  const resting = today?.totalKcal != null && today.activeKcal != null ? Math.max(0, today.totalKcal - today.activeKcal) : null;

  return (
    <Screen>
      <Header title="Activity" />
      <ScrollView
        testID="health-activity"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={h.connected ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined}
      >
        {h.isSample && <HealthNotice isSample onPress={openIntegrations} />}

        <HTitle
          title="Today"
          right={<TitleRight>{new Date().toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}</TitleRight>}
        />
        <HCard style={{ gap: 14 }}>
          {hasToday && today ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ActivityRings size={128} rings={ringsOf(today)} />
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <RingStat label="Move" color={MC.move} value={today.activeKcal} goal={goals.moveKcal} unit="kcal" />
                <RingStat label="Exercise" color={MC.exercise} value={today.exerciseMin} goal={goals.exerciseMin} unit="min" />
                <RingStat label="Steps" color={MC.steps} value={today.steps} goal={goals.steps} />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
              <Ionicons name="walk-outline" size={32} color={colors.faint} />
              <Text style={{ color: colors.muted, textAlign: 'center' }}>No activity data for today yet.</Text>
            </View>
          )}
          {hasWeek && (
            <View testID="activity-week" style={{ gap: 8 }}>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>This week</Text>
              <WeekRings days={week} selected={week.length - 1} />
            </View>
          )}
        </HCard>

        {hourly && stepsNow != null && (
          <>
            <HTitle title="Steps through the day" />
            <HCard>
              <View testID="activity-steps-day" style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 28, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{fmtN(stepsNow)}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted }}>steps</Text>
                  </View>
                  {stepsPct != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {stepsMet && <Ionicons name="checkmark-circle" size={14} color={colors.success} />}
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: stepsMet ? colors.success : colors.muted, fontVariant: ['tabular-nums'] }}>
                        {`${fmtNum(stepsPct)}% ${tr('of goal')}`}
                      </Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
                  {`${tr('Daily goal')} ${fmtN(goals.steps)}${stepsLeft > 0 ? ` · ${fmtN(stepsLeft)} ${tr('to go')}` : ''}`}
                </Text>
              </View>
              <CumulativeLine byHour={hourly} goal={goals.steps} color={MC.steps} untilHour={nowH} />
            </HCard>
          </>
        )}

        {hourData && (
          <>
            <HTitle
              title="Steps by hour"
              right={peak != null && (hourData[peak].value ?? 0) > 0 ? <TitleRight>{tr('Peak')} {hh(peak)}</TitleRight> : undefined}
            />
            <HCard>
              <TrendChart data={hourData} kind="bar" color={MC.steps} height={110} format={fmtN} />
            </HCard>
          </>
        )}

        {hasToday && today && (
          <KpiGrid>
            <KpiTile key="steps" icon="footsteps" color={MC.steps} label="Steps" value={fmtN(today.steps)} sub={goalSub(today.steps, goals.steps)} delta={met(today.steps, goals.steps)} />
            <KpiTile key="dist" icon="navigate" color={MC.distance} label="Distance" value={today.distanceM != null ? fmtNum(toDisplayDist(today.distanceM, units), 2) : '–'} unit={today.distanceM != null ? units.distance : undefined} />
            <KpiTile key="active" icon="flame" color={MC.move} label="Active calories" value={fmtN(today.activeKcal)} unit={today.activeKcal != null ? 'kcal' : undefined} sub={goalSub(today.activeKcal, goals.moveKcal)} delta={met(today.activeKcal, goals.moveKcal)} />
            <KpiTile key="total" icon="flame-outline" color={MC.calories} label="Total calories" value={fmtN(today.totalKcal)} unit={today.totalKcal != null ? 'kcal' : undefined} sub={resting != null ? `${tr('Resting')} ≈ ${fmtN(resting)} kcal` : undefined} />
            <KpiTile key="floors" icon="trending-up" color={MC.floors} label="Floors" value={fmtN(today.floors)} sub={goalSub(today.floors, goals.floors)} delta={met(today.floors, goals.floors)} />
            <KpiTile key="exercise" icon="stopwatch-outline" color={MC.exercise} label="Exercise" value={fmtN(today.exerciseMin)} unit={today.exerciseMin != null ? 'min' : undefined} sub={goalSub(today.exerciseMin, goals.exerciseMin)} delta={met(today.exerciseMin, goals.exerciseMin)} />
          </KpiGrid>
        )}

        <View style={{ marginTop: 8 }}>
          <RangeTabs<Range> value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }]} />
        </View>

        <HTitle title="Steps" right={<AvgRight text={avgSteps != null ? fmtN(avgSteps) : null} />} />
        <HCard>
          <TrendChart data={steps} kind="bar" color={MC.steps} goal={goals.steps} format={fmtN} />
        </HCard>

        <HTitle title="Active calories" right={<AvgRight text={avgActive != null ? `${fmtN(avgActive)} kcal` : null} />} />
        <HCard>
          <TrendChart data={active} kind="bar" color={MC.move} goal={goals.moveKcal} format={fmtN} unit=" kcal" />
        </HCard>

        <HTitle title="Exercise minutes" right={<AvgRight text={avgExercise != null ? `${fmtN(avgExercise)} min` : null} />} />
        <HCard>
          <TrendChart data={exercise} kind="bar" color={MC.exercise} goal={goals.exerciseMin} format={fmtN} unit=" min" />
        </HCard>

        <HTitle title="Distance" right={<AvgRight text={avgDist != null ? `${fmtDist1(avgDist)} ${units.distance}` : null} />} />
        <HCard>
          <TrendChart data={dist} kind="bar" color={MC.distance} format={fmtDist1} unit={` ${units.distance}`} />
        </HCard>

        <HTitle title="Achievements" right={<TitleRight>{rangeLabel}</TitleRight>} />
        <HCard style={{ gap: 14 }}>
          <AchRow icon="flame" color={MC.calories} title="Step streak" detail={tr('Days in a row at goal')} value={streak == null ? '–' : `${fmtNum(streak)} ${tr(streak === 1 ? 'day' : 'days')}`} />
          <AchRow icon="trophy" color={MC.fat} title="Best step day" detail={best ? fmtDay(best.key) : undefined} value={best ? fmtN(best.steps) : '–'} />
          <AchRow icon="checkmark-done-circle" color={MC.move} title="Move goal closed" detail={`${tr('Daily goal')} ${fmtN(goals.moveKcal)} kcal`} value={moveClosed == null ? '–' : `${fmtNum(moveClosed)} ${tr('of')} ${fmtNum(n)}`} />
          <AchRow icon="map-outline" color={MC.distance} title="Total distance" value={totalDist != null ? fmtDistU(totalDist, units) : '–'} />
        </HCard>

        {h.connected && !!h.syncedAt && (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
            {tr('Last sync')}: {new Date(h.syncedAt).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
